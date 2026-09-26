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

  async update(id: string, data: { description?: string; discountType?: string; discountValue?: number; validFrom?: Date; validTo?: Date; maxUses?: number; isActive?: boolean }) {
    const promo = await this.promotionModel.findById(id);
    if (!promo) throw new NotFoundException('Promotion not found');

    if (data.description != null) promo.description = data.description;
    if (data.discountType != null) promo.discountType = data.discountType as any;
    if (data.discountValue != null) promo.discountValue = data.discountValue;
    if (data.validFrom != null) promo.validFrom = data.validFrom;
    if (data.validTo != null) promo.validTo = data.validTo;
    if (data.maxUses != null) promo.maxUses = data.maxUses;
    if (data.isActive != null) promo.isActive = data.isActive;

    await promo.save();
    return this.toDto(promo);
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
    const totalFleet = await this.vehicleModel.countDocuments();
    const availableVehicles = await this.vehicleModel.countDocuments({ status: 'Available' });
    const inRideVehicles = await this.vehicleModel.countDocuments({ status: 'InRide' });
    const iotLinkedVehicles = await this.vehicleModel.countDocuments({ iotDeviceId: { $exists: true, $ne: null } });
    const newCustomers = await this.customerModel.countDocuments({ createdAt: { $gte: from, $lte: to } });
    const avgDuration = rides.length
      ? rides.reduce((s, r) => s + (r.durationMinutes ?? 0), 0) / rides.length
      : 0;

    return {
      totalRides: rides.length,
      totalRevenue: payments.reduce((s, p) => s + p.amount, 0),
      totalFleet,
      availableVehicles,
      inRideVehicles,
      /** @deprecated use inRideVehicles — kept for backward compatibility */
      activeVehicles: inRideVehicles,
      iotLinkedVehicles,
      fleetUtilizationPercent: totalFleet > 0 ? (inRideVehicles / totalFleet) * 100 : 0,
      newCustomers,
      averageRideDurationMinutes: avgDuration,
    };
  }
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Ride.name) private rideModel: Model<RideDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(Vehicle.name) private vehicleModel: Model<VehicleDocument>,
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
  ) {}

  async getSnapshot() {
    const from = new Date(Date.now() - 30 * 86400000);
    const to = new Date();

    const [
      totalRiders,
      activeRiders,
      suspendedRiders,
      deactivatedRiders,
      vehiclesByStatus,
      outstanding,
      kycGroups,
      recentRiders,
      attentionVehicles,
      paidPayments,
      endedRides,
    ] = await Promise.all([
      this.customerModel.countDocuments(),
      this.customerModel.countDocuments({ accountStatus: 'Active' }),
      this.customerModel.countDocuments({ accountStatus: 'Suspended' }),
      this.customerModel.countDocuments({ accountStatus: 'Deactivated' }),
      this.vehicleModel.aggregate<{ _id: string; count: number }>([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      this.paymentModel.aggregate<{ count: number; amount: number }>([
        { $match: { status: { $in: ['Created', 'Failed'] } } },
        { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$amount' } } },
      ]),
      this.customerModel.aggregate<{ _id: string; count: number }>([{ $group: { _id: '$kycStatus', count: { $sum: 1 } } }]),
      this.customerModel.find().sort({ createdAt: -1 }).limit(5),
      this.vehicleModel
        .find({
          $or: [{ status: { $in: ['Maintenance', 'Offline'] } }, { batteryPercent: { $lte: 20 } }],
        })
        .sort({ batteryPercent: 1 })
        .limit(8),
      this.paymentModel.find({ status: 'Paid', paidAt: { $gte: from, $lte: to } }),
      this.rideModel.find({ status: 'Ended', endedAt: { $gte: from, $lte: to } }),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const row of vehiclesByStatus) statusCounts[row._id] = row.count;
    const kycCounts: Record<string, number> = {};
    for (const row of kycGroups) kycCounts[row._id] = row.count;

    const totalFleet = Object.values(statusCounts).reduce((s, n) => s + n, 0);

    return {
      riders: {
        total: totalRiders,
        active: activeRiders,
        inactive: suspendedRiders + deactivatedRiders,
        suspended: suspendedRiders,
        deactivated: deactivatedRiders,
      },
      vehicles: {
        total: totalFleet,
        byStatus: {
          Available: statusCounts.Available ?? 0,
          Reserved: statusCounts.Reserved ?? 0,
          InRide: statusCounts.InRide ?? 0,
          Maintenance: statusCounts.Maintenance ?? 0,
          Offline: statusCounts.Offline ?? 0,
        },
      },
      outstandingPayments: {
        count: outstanding[0]?.count ?? 0,
        amount: outstanding[0]?.amount ?? 0,
      },
      kyc: {
        NotSubmitted: kycCounts.NotSubmitted ?? 0,
        Pending: kycCounts.Pending ?? 0,
        UnderReview: kycCounts.UnderReview ?? 0,
        Approved: kycCounts.Approved ?? 0,
        Rejected: kycCounts.Rejected ?? 0,
      },
      upcomingModules: {
        serviceRequests: { count: 0, operational: false },
        breakdownAlerts: { count: 0, operational: false },
        chargingStations: { count: 0, operational: false },
      },
      last30Days: {
        totalRides: endedRides.length,
        totalRevenue: paidPayments.reduce((s, p) => s + p.amount, 0),
      },
      recentRiders: recentRiders.map((c) => ({
        id: c._id.toString(),
        fullName: c.fullName,
        phone: c.phone,
        accountStatus: c.accountStatus,
        kycStatus: c.kycStatus,
        createdAt: (c as { createdAt?: Date }).createdAt,
      })),
      vehiclesNeedingAttention: attentionVehicles.map((v) => ({
        id: v._id.toString(),
        registrationNumber: v.registrationNumber,
        status: v.status,
        batteryPercent: v.batteryPercent,
        assignedRiderId: v.assignedRiderId,
      })),
    };
  }
}
