import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import { Booking, BookingDocument, Payment, PaymentDocument, Promotion, PromotionDocument, Ride, RideDocument } from '../schemas/booking.schema';
import { Customer, CustomerDocument } from '../schemas/customer.schema';
import { Vehicle, VehicleDocument } from '../schemas/fleet.schema';
import { calculateGst } from '../common/helpers';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
  ) {}

  async createOrder(customerId: string, bookingId: string, amount: number, currency = 'INR') {
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) throw new NotFoundException('Booking not found');

    const gst = calculateGst(amount);
    const razorpayOrderId = `order_${randomUUID().replace(/-/g, '')}`;

    const payment = await this.paymentModel.create({
      customerId,
      bookingId,
      amount: amount + gst,
      gstAmount: gst,
      currency,
      razorpayOrderId,
      status: 'Created',
    });

    return {
      id: payment._id.toString(),
      razorpayOrderId,
      amount: payment.amount,
      currency,
      status: 'Created',
    };
  }

  async handleRazorpayWebhook(_payload: string, _signature: string) {
    return { received: true };
  }

  async getHistory(customerId: string, page = 1, pageSize = 20) {
    const total = await this.paymentModel.countDocuments({ customerId });
    const items = await this.paymentModel.find({ customerId }).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize);
    return {
      items: items.map((p) => ({
        id: p._id.toString(),
        bookingId: p.bookingId,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        method: p.method,
        createdAt: (p as any).createdAt,
        invoiceUrl: p.invoiceUrl,
      })),
      page,
      pageSize,
      totalCount: total,
    };
  }

  async getReconciliation(from: Date, to: Date) {
    const payments = await this.paymentModel.find({ createdAt: { $gte: from, $lte: to } });
    const collected = payments.filter((p) => p.status === 'Paid').reduce((s, p) => s + p.amount, 0);
    const refunded = payments.filter((p) => p.status === 'Refunded').reduce((s, p) => s + p.amount, 0);
    const gst = payments.filter((p) => p.status === 'Paid').reduce((s, p) => s + p.gstAmount, 0);
    const unmatched = payments.filter((p) => p.status === 'Paid' && !p.reconciledAt).length;

    return {
      totalCollected: collected,
      totalRefunded: refunded,
      netRevenue: collected - refunded,
      gstAmount: gst,
      unmatchedPayments: unmatched,
      items: payments.map((p) => ({
        paymentId: p._id.toString(),
        razorpayPaymentId: p.razorpayPaymentId,
        amount: p.amount,
        status: p.status,
        reconciledAt: p.reconciledAt,
      })),
    };
  }
}

@Injectable()
export class PromotionsService {
  constructor(@InjectModel(Promotion.name) private promotionModel: Model<PromotionDocument>) {}

  async create(data: { code: string; description?: string; discountType: string; discountValue: number; validFrom: Date; validTo: Date; maxUses?: number }) {
    const promo = await this.promotionModel.create({ ...data, code: data.code.toUpperCase() });
    return this.toDto(promo);
  }

  async list() {
    const promos = await this.promotionModel.find();
    return promos.map((p) => this.toDto(p));
  }

  private toDto(p: PromotionDocument) {
    return {
      id: p._id.toString(),
      code: p.code,
      description: p.description,
      discountType: p.discountType,
      discountValue: p.discountValue,
      validFrom: p.validFrom,
      validTo: p.validTo,
      maxUses: p.maxUses,
      currentUses: p.currentUses,
      isActive: p.isActive,
    };
  }
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Ride.name) private rideModel: Model<RideDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(Vehicle.name) private vehicleModel: Model<VehicleDocument>,
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
  ) {}

  async getSummary(from: Date, to: Date) {
    const rides = await this.rideModel.find({ status: 'Ended', endedAt: { $gte: from, $lte: to } });
    const payments = await this.paymentModel.find({ status: 'Paid', paidAt: { $gte: from, $lte: to } });
    const totalVehicles = await this.vehicleModel.countDocuments();
    const inRide = await this.vehicleModel.countDocuments({ status: 'InRide' });
    const newCustomers = await this.customerModel.countDocuments({ createdAt: { $gte: from, $lte: to } });
    const avgDuration = rides.length
      ? rides.reduce((s, r) => s + (r.durationMinutes ?? 0), 0) / rides.length
      : 0;

    return {
      totalRides: rides.length,
      totalRevenue: payments.reduce((s, p) => s + p.amount, 0),
      activeVehicles: inRide,
      fleetUtilizationPercent: totalVehicles > 0 ? (inRide / totalVehicles) * 100 : 0,
      newCustomers,
      averageRideDurationMinutes: avgDuration,
    };
  }
}
