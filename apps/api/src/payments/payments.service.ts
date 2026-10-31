import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import { Booking, BookingDocument, Payment, PaymentDocument, Promotion, PromotionDocument, Ride, RideDocument } from '../schemas/booking.schema';
import { Customer, CustomerDocument } from '../schemas/customer.schema';
import { Vehicle, VehicleDocument } from '../schemas/fleet.schema';
import { calculateGst } from '../common/helpers';
import { OperationsService } from '../operations/operations.service';
import { EngagementService } from '../engagement/engagement.service';
import { applyHubScope } from '../common/hub-scope';
import { currentTenantId } from '../common/tenant-als';
import { runInWriteTenant } from '../common/tenant-write';
import { PaymentGatewayService } from './gateway.service';
import { findByEitherId, removeByEitherId } from '../common/mongo-id';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    private gateways: PaymentGatewayService,
  ) {}

  private async tenantIdForRider(customerId: string) {
    const fromAls = currentTenantId();
    if (fromAls) return fromAls;
    const customer = await this.customerModel.findById(customerId);
    return (customer as { tenantId?: string } | null)?.tenantId || '';
  }

  async createOrder(customerId: string, bookingId: string, amount: number, currency = 'INR') {
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) throw new NotFoundException('Booking not found');

    const gst = calculateGst(amount);
    const total = amount + gst;
    const tenantId = await this.tenantIdForRider(customerId);
    const checkout = tenantId
      ? await this.gateways.createCheckout(tenantId, { amount: total, currency, receipt: `bk_${bookingId}` })
      : { provider: 'None', orderId: `order_${randomUUID().replace(/-/g, '')}`, amount: total, currency };

    const payment = await this.paymentModel.create({
      customerId,
      bookingId,
      amount: total,
      gstAmount: gst,
      currency,
      razorpayOrderId: checkout.orderId,
      gatewayOrderId: checkout.orderId,
      gatewayProvider: checkout.provider,
      status: 'Created',
    });

    return {
      id: payment._id.toString(),
      razorpayOrderId: checkout.orderId,
      gatewayOrderId: checkout.orderId,
      gatewayProvider: checkout.provider,
      checkout,
      amount: payment.amount,
      currency,
      status: 'Created',
    };
  }

  async handleRazorpayWebhook(_payload: string, _signature: string) {
    return { received: true };
  }

  async applyGatewayPaid(orderId: string, gatewayPaymentId: string, method?: string) {
    const payment = await this.paymentModel.findOne({
      $or: [{ gatewayOrderId: orderId }, { razorpayOrderId: orderId }],
    });
    if (!payment) throw new NotFoundException('Payment not found for gateway order');
    payment.status = 'Paid';
    payment.paidAt = new Date();
    payment.gatewayPaymentId = gatewayPaymentId;
    payment.razorpayPaymentId = gatewayPaymentId;
    if (method) payment.method = method;
    await payment.save();
    return { id: payment._id.toString(), status: 'Paid' };
  }

  async listAdmin(params: { status?: string; search?: string; page?: number; pageSize?: number }) {
    const filter: Record<string, unknown> = {};
    if (params.status) filter.status = params.status;
    const page = params.page ?? 1;
    const pageSize = Math.min(params.pageSize ?? 50, 100);
    const items = await this.paymentModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize);
    const totalCount = await this.paymentModel.countDocuments(filter);
    const riderIds = [...new Set(items.map((p) => p.customerId))];
    const riders = riderIds.length ? await this.customerModel.find({ _id: { $in: riderIds } }) : [];
    const riderMap = Object.fromEntries(riders.map((r) => [r._id.toString(), r]));
    const mapped = items.map((p) => {
      const rider = riderMap[p.customerId];
      return {
        id: p._id.toString(),
        customerId: p.customerId,
        riderName: rider?.fullName,
        riderPhone: rider?.phone,
        bookingId: p.bookingId,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        method: p.method,
        reference: p.reference ?? p.razorpayOrderId ?? p.razorpayPaymentId,
        razorpayOrderId: p.razorpayOrderId,
        razorpayPaymentId: p.razorpayPaymentId,
        gstAmount: p.gstAmount,
        refundReason: p.refundReason,
        createdAt: (p as { createdAt?: Date }).createdAt,
        paidAt: p.paidAt,
        refundedAt: p.refundedAt,
      };
    });
    const filtered = params.search
      ? mapped.filter((row) => {
          const q = params.search!.toLowerCase();
          return [row.riderName, row.riderPhone, row.reference, row.id].some((v) => v?.toLowerCase().includes(q));
        })
      : mapped;
    return {
      items: filtered,
      page,
      pageSize,
      totalCount,
    };
  }

  async refund(paymentId: string, reason: string, actorId?: string) {
    const payment = await this.paymentModel.findById(paymentId);
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== 'Paid') throw new BadRequestException('Only paid transactions can be refunded');
    payment.status = 'Refunded';
    payment.refundReason = reason.trim();
    payment.refundedAt = new Date();
    await payment.save();
    return {
      id: payment._id.toString(),
      status: payment.status,
      refundReason: payment.refundReason,
      refundedAt: payment.refundedAt,
      actorId,
    };
  }

  async payOutstanding(customerId: string, method: string) {
    const allowed = ['Wallet', 'UPI', 'QR', 'NetBanking', 'DebitCard', 'CreditCard'];
    if (!allowed.includes(method)) throw new BadRequestException('Unsupported payment method');
    const due = await this.paymentModel.find({ customerId, status: { $in: ['Created', 'Failed'] } });
    if (!due.length) throw new BadRequestException('No outstanding payments');
    const total = due.reduce((s, p) => s + p.amount, 0);
    if (method === 'Wallet') {
      const customer = await this.customerModel.findById(customerId);
      if (!customer) throw new NotFoundException('Rider not found');
      if ((customer.walletBalance ?? 0) < total) throw new BadRequestException('Wallet balance is insufficient');
      customer.walletBalance = (customer.walletBalance ?? 0) - total;
      await customer.save();
      const reference = `pay_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
      for (const payment of due) {
        payment.status = 'Paid';
        payment.method = method;
        payment.paidAt = new Date();
        payment.reference = reference;
        payment.gatewayProvider = 'Wallet';
        await payment.save();
      }
      return { paid: due.length, amount: total, method, reference, status: 'Paid' };
    }
    const tenantId = await this.tenantIdForRider(customerId);
    if (!tenantId) throw new BadRequestException('Rider is not linked to a tenant company');
    const checkout = await this.gateways.createCheckout(tenantId, {
      amount: total,
      currency: due[0]?.currency || 'INR',
      receipt: `out_${customerId.slice(-8)}`,
      method,
    });
    for (const payment of due) {
      payment.method = method;
      payment.gatewayProvider = checkout.provider;
      payment.gatewayOrderId = checkout.orderId;
      payment.razorpayOrderId = checkout.orderId;
      payment.status = 'Created';
      await payment.save();
    }
    return {
      paid: 0,
      amount: total,
      method,
      status: 'Created',
      gatewayProvider: checkout.provider,
      checkout,
    };
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
        reference: p.reference ?? p.razorpayOrderId ?? p.razorpayPaymentId,
        createdAt: (p as { createdAt?: Date }).createdAt,
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
    const promo = await runInWriteTenant(undefined, async () =>
      this.promotionModel.create({ ...data, code: data.code.toUpperCase() }),
    );
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

  async remove(id: string) {
    const promo = await findByEitherId(this.promotionModel, id);
    if (!promo) throw new NotFoundException('Promotion not found');
    const deleted = await removeByEitherId(this.promotionModel.collection, promo._id.toString());
    if (!deleted) throw new BadRequestException('Could not delete promotion');
    return { deleted: true, id };
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

  async exportCsv(from: Date, to: Date) {
    const summary = await this.getSummary(from, to);
    const payments = await this.paymentModel.find({ createdAt: { $gte: from, $lte: to } }).sort({ createdAt: -1 }).limit(500);
    const header = ['section', 'key', 'value'];
    const rows = [
      ['summary', 'from', from.toISOString()],
      ['summary', 'to', to.toISOString()],
      ['summary', 'totalRides', String(summary.totalRides)],
      ['summary', 'totalRevenue', String(summary.totalRevenue)],
      ['summary', 'totalFleet', String(summary.totalFleet)],
      ['summary', 'availableVehicles', String(summary.availableVehicles)],
      ['summary', 'inRideVehicles', String(summary.inRideVehicles)],
      ['summary', 'iotLinkedVehicles', String(summary.iotLinkedVehicles)],
      ['summary', 'fleetUtilizationPercent', String(summary.fleetUtilizationPercent)],
      ['summary', 'newCustomers', String(summary.newCustomers)],
      ['summary', 'averageRideDurationMinutes', String(summary.averageRideDurationMinutes)],
      ...payments.map((p) => ['payment', p.status, `${p._id.toString()}|${p.customerId}|${p.amount}|${p.currency}`]),
    ];
    const csv = [header.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    return { csv, fileName: `switchride-report-${from.toISOString().slice(0, 10)}-${to.toISOString().slice(0, 10)}.csv` };
  }
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Ride.name) private rideModel: Model<RideDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(Vehicle.name) private vehicleModel: Model<VehicleDocument>,
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    private operationsService: OperationsService,
    private engagementService: EngagementService,
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
      opsCounts,
      stationCount,
      inRideVehicles,
      activeRides,
      locatedVehicles,
    ] = await Promise.all([
      this.customerModel.countDocuments(),
      this.customerModel.countDocuments({ accountStatus: 'Active' }),
      this.customerModel.countDocuments({ accountStatus: 'Suspended' }),
      this.customerModel.countDocuments({ accountStatus: 'Deactivated' }),
      this.vehicleModel.aggregate<{ _id: string; count: number }>([
        ...(Object.keys(applyHubScope({})).length ? [{ $match: applyHubScope({}) }] : []),
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.paymentModel.aggregate<{ count: number; amount: number }>([
        { $match: { status: { $in: ['Created', 'Failed'] } } },
        { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$amount' } } },
      ]),
      this.customerModel.aggregate<{ _id: string; count: number }>([{ $group: { _id: '$kycStatus', count: { $sum: 1 } } }]),
      this.customerModel.find().sort({ createdAt: -1 }).limit(5),
      this.vehicleModel
        .find(
          applyHubScope({
            $or: [{ status: { $in: ['Maintenance', 'Offline'] } }, { batteryPercent: { $lte: 20 } }],
          }),
        )
        .sort({ batteryPercent: 1 })
        .limit(8),
      this.paymentModel.find({ status: 'Paid', paidAt: { $gte: from, $lte: to } }),
      this.rideModel.find({ status: 'Ended', endedAt: { $gte: from, $lte: to } }),
      this.operationsService.counts(),
      this.engagementService.stationCount(),
      this.vehicleModel.find(applyHubScope({ status: 'InRide' })).sort({ lastTelemetryAt: -1 }).limit(40),
      this.rideModel.find({ status: 'InProgress' }),
      this.vehicleModel
        .find(
          applyHubScope({
            $or: [
              { lastLat: { $ne: null }, lastLng: { $ne: null } },
              { iotDeviceId: { $exists: true, $nin: [null, ''] } },
            ],
          }),
        )
        .sort({ lastTelemetryAt: -1 })
        .limit(500),
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
        serviceRequests: { count: opsCounts.serviceRequests, operational: true },
        breakdownAlerts: { count: opsCounts.breakdowns, operational: true },
        chargingStations: { count: stationCount, operational: true },
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
      activeRideVehicles: await this.toActiveRideVehicles(inRideVehicles, activeRides),
      locatedVehicles: this.toLocatedVehicles(locatedVehicles, activeRides),
    };
  }

  private async toActiveRideVehicles(
    vehicles: VehicleDocument[],
    rides: RideDocument[],
  ) {
    const rideByVehicle = Object.fromEntries(rides.map((r) => [r.vehicleId, r]));
    const riderIds = [
      ...vehicles.map((v) => v.assignedRiderId).filter((id): id is string => Boolean(id)),
      ...rides.map((r) => r.customerId),
    ];
    const riders = riderIds.length ? await this.customerModel.find({ _id: { $in: riderIds } }) : [];
    const riderMap = Object.fromEntries(riders.map((c) => [c._id.toString(), c]));
    return vehicles.map((v) => {
      const ride = rideByVehicle[v._id.toString()];
      const rider =
        (v.assignedRiderId ? riderMap[v.assignedRiderId] : undefined) ??
        (ride ? riderMap[ride.customerId] : undefined);
      return {
        id: v._id.toString(),
        rideId: ride?._id.toString(),
        registrationNumber: v.registrationNumber,
        type: v.type,
        wheelClass: v.wheelClass,
        batteryPercent: v.batteryPercent,
        riderName: rider?.fullName,
        riderPhone: rider?.phone,
        lastPlace: v.lastPlace ?? null,
        lastPlaceKind: v.lastPlaceKind,
        lastLocation: v.lastLat != null && v.lastLng != null ? { lat: v.lastLat, lng: v.lastLng } : null,
        lastTelemetryAt: v.lastTelemetryAt,
        locationTrail: (v.locationTrail ?? []).map((p) => ({ lat: p.lat, lng: p.lng, at: p.at })),
      };
    });
  }

  private toLocatedVehicles(vehicles: VehicleDocument[], rides: RideDocument[]) {
    const rideByVehicle = Object.fromEntries(rides.map((r) => [r.vehicleId, r]));
    return vehicles.map((v) => ({
      id: v._id.toString(),
      rideId: rideByVehicle[v._id.toString()]?._id.toString(),
      registrationNumber: v.registrationNumber,
      type: v.type,
      wheelClass: v.wheelClass,
      status: v.status,
      lastPlace: v.lastPlace ?? null,
      lastPlaceKind: v.lastPlaceKind,
      lastLocation: v.lastLat != null && v.lastLng != null ? { lat: v.lastLat, lng: v.lastLng } : null,
      lastTelemetryAt: v.lastTelemetryAt,
      speedKmh: v.speedKmh,
      ignition: v.ignition,
      assignedRiderId: v.assignedRiderId,
      immobilised: Boolean(v.immobilised),
    }));
  }
}
