import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Customer, CustomerDocument } from '../schemas/customer.schema';
import { Vehicle, VehicleDocument } from '../schemas/fleet.schema';
import { Payment, PaymentDocument } from '../schemas/booking.schema';
import { RentalPlan, RentalPlanDocument, WalletTransaction, WalletTransactionDocument } from '../schemas/rental.schema';
import { OperationsService } from '../operations/operations.service';
import { EngagementService } from '../engagement/engagement.service';
import { PaymentsService } from '../payments/payments.service';
import { PaymentGatewayService } from '../payments/gateway.service';
import { KycService, ProfileService } from '../customers/customers.service';
import { RidersService } from '../customers/riders.service';
import { FleetService } from '../fleet/fleet.service';
import { SupportService } from '../support/support.service';
import { coerceInt, coerceNumber, idString } from '../common/coerce';
import { runWithoutTenant } from '../common/tenant-als';

@Injectable()
export class RiderAppService {
  constructor(
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    @InjectModel(Vehicle.name) private vehicleModel: Model<VehicleDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(RentalPlan.name) private planModel: Model<RentalPlanDocument>,
    @InjectModel(WalletTransaction.name) private walletModel: Model<WalletTransactionDocument>,
    private operations: OperationsService,
    private engagement: EngagementService,
    private paymentsSvc: PaymentsService,
    private gateways: PaymentGatewayService,
    private profileSvc: ProfileService,
    private kycSvc: KycService,
    private riders: RidersService,
    private support: SupportService,
    private fleet: FleetService,
  ) {}

  async home(riderId: string) {
    const rider = await this.requireRider(riderId);
    const tenantId = (rider as { tenantId?: string }).tenantId;
    const assignedId = idString(rider.assignedVehicleId);
    const [vehicleDoc, plan, outstanding, breakdowns, requests, notices, paymentGateway] = await Promise.all([
      assignedId ? this.vehicleModel.findById(assignedId) : null,
      rider.rentalPlanId ? this.planModel.findById(rider.rentalPlanId) : null,
      this.paymentModel.find({ customerId: riderId, status: { $in: ['Created', 'Failed'] } }),
      this.operations.listBreakdowns(undefined, riderId),
      this.operations.listRequests(undefined, riderId),
      this.engagement.listNotifications(),
      this.gateways.publicForTenant(tenantId),
    ]);
    let vehicle = vehicleDoc;
    if (assignedId && !vehicle) {
      rider.assignedVehicleId = undefined;
      await rider.save();
    }
    const openBreakdown = breakdowns.items.find((b) => b.status !== 'Closed');
    const openService = requests.items.find((r) => !['Completed', 'Cancelled'].includes(r.status));
    return {
      rider: this.profileSvc.toProfile(rider),
      plan: plan ? this.toPlan(plan) : null,
      vehicle: vehicle ? this.toVehicle(vehicle) : null,
      walletBalance: coerceNumber(rider.walletBalance, 0),
      outstanding: {
        count: outstanding.length,
        amount: outstanding.reduce((s, p) => s + coerceNumber(p.amount, 0), 0),
      },
      alerts: notices.items.slice(0, 5),
      breakdown: openBreakdown ?? null,
      service: openService ?? null,
      paymentGateway,
    };
  }

  async availableVehicles() {
    const items = await this.vehicleModel
      .find({
        status: 'Available',
        $or: [{ assignedRiderId: { $exists: false } }, { assignedRiderId: null }, { assignedRiderId: '' }],
      })
      .sort({ registrationNumber: 1 })
      .limit(100);
    return { items: items.map((v) => this.toVehicle(v)) };
  }

  async assignOwnVehicle(riderId: string, vehicleId: string) {
    if (!vehicleId?.trim()) throw new BadRequestException('Select a vehicle');
    await this.requireRider(riderId);
    await this.fleet.assignVehicle(vehicleId.trim(), riderId, {});
    return this.vehicle(riderId);
  }

  async vehicle(riderId: string) {
    const rider = await this.requireRider(riderId);
    if (!rider.assignedVehicleId) return { vehicle: null, breakdowns: [], requests: [] };
    const vehicle = await this.vehicleModel.findById(rider.assignedVehicleId);
    const [breakdowns, requests] = await Promise.all([
      this.operations.listBreakdowns(undefined, riderId),
      this.operations.listRequests(undefined, riderId),
    ]);
    return {
      vehicle: vehicle ? this.toVehicle(vehicle) : null,
      breakdowns: breakdowns.items,
      requests: requests.items,
    };
  }

  async reportBreakdown(riderId: string, data: { issueType: string; description: string; lat?: number; lng?: number }) {
    const rider = await this.requireRider(riderId);
    if (!rider.assignedVehicleId) throw new BadRequestException('No vehicle is assigned to this rider');
    if (!data.description || data.description.trim().length < 10) {
      throw new BadRequestException('Describe the issue in at least 10 characters');
    }
    return this.operations.createBreakdown({
      riderId,
      vehicleId: rider.assignedVehicleId,
      issueType: data.issueType?.trim() || 'Breakdown',
      description: data.description.trim(),
      lat: data.lat,
      lng: data.lng,
    });
  }

  async raiseService(riderId: string, data: { category: string; description: string }) {
    const rider = await this.requireRider(riderId);
    return this.operations.createRequest({
      riderId,
      vehicleId: rider.assignedVehicleId,
      category: data.category,
      description: data.description,
    });
  }

  serviceHistory(riderId: string) {
    return this.operations.listRequests(undefined, riderId);
  }

  slots(centreId?: string, date?: string) {
    return this.operations.listSlots(centreId, date);
  }

  centres() {
    return this.operations.listCentres();
  }

  appointments(riderId: string) {
    return this.operations.listAppointments(undefined, riderId);
  }

  schedule(riderId: string, data: { centreId: string; slotId: string; notes?: string; serviceRequestId?: string }) {
    return this.operations.scheduleAppointment({ riderId, ...data });
  }

  reschedule(riderId: string, id: string, slotId: string, notes?: string) {
    return this.operations.rescheduleAppointment(id, slotId, notes);
  }

  cancelAppointment(riderId: string, id: string, reason: string) {
    return this.operations.cancelAppointment(id, reason);
  }

  wallet(riderId: string) {
    return this.walletModel.find({ riderId }).sort({ createdAt: -1 }).limit(50).then((items) => ({
      items: items.map((t) => ({
        id: t._id.toString(),
        type: t.type,
        amount: coerceNumber(t.amount, 0),
        note: t.note,
        reference: t.reference,
        balanceAfter: coerceNumber(t.balanceAfter, 0),
        createdAt: (t as { createdAt?: Date }).createdAt,
      })),
    }));
  }

  async payments(riderId: string) {
    const res = await this.paymentsSvc.getHistory(riderId, 1, 50);
    return {
      ...res,
      items: res.items.map((p) => ({
        ...p,
        amount: coerceNumber(p.amount, 0),
      })),
    };
  }

  async pay(riderId: string, method: string) {
    const due = await this.paymentModel.countDocuments({ customerId: riderId, status: { $in: ['Created', 'Failed'] } });
    if (!due) {
      const rider = await this.requireRider(riderId);
      const plan = rider.rentalPlanId ? await this.planModel.findById(rider.rentalPlanId) : null;
      const amount = plan?.charges ?? 0;
      if (amount <= 0) throw new BadRequestException('No amount due');
      await this.paymentModel.create({
        customerId: riderId,
        bookingId: 'rental-plan',
        amount,
        gstAmount: 0,
        currency: 'INR',
        status: 'Created',
      });
    }
    const result = await this.paymentsSvc.payOutstanding(riderId, method);
    if (method === 'Wallet') {
      const rider = await this.requireRider(riderId);
      await this.walletModel.create({
        riderId,
        type: 'Debit',
        amount: result.amount,
        note: 'Outstanding payment',
        reference: result.reference,
        balanceAfter: rider.walletBalance ?? 0,
      });
    }
    return result;
  }

  async plans(riderId: string) {
    const rider = await this.requireRider(riderId);
    const tenantId = idString((rider as { tenantId?: unknown }).tenantId);
    const filter: Record<string, unknown> = { isActive: true };
    if (tenantId) {
      filter.$or = [
        { tenantId },
        { tenantId: { $exists: false } },
        { tenantId: null },
        { tenantId: '' },
      ];
    }
    const plans = await runWithoutTenant(() => this.planModel.find(filter).sort({ name: 1 }));
    return {
      currentPlanId: idString(rider.rentalPlanId) ?? null,
      items: plans.map((p) => this.toPlan(p)),
    };
  }

  changePlan(riderId: string, rentalPlanId: string) {
    return this.riders.assignPlan(riderId, rentalPlanId);
  }

  agreements(riderId: string) {
    return this.engagement.listAgreements(riderId);
  }

  stations() {
    return this.engagement.listStations();
  }

  notifications() {
    return this.engagement.listNotifications();
  }

  kyc(riderId: string) {
    return this.kycSvc.getStatus(riderId);
  }

  submitKyc(riderId: string, documentType: string, documentNumber?: string, blobUrl?: string) {
    return this.kycSvc.submit(riderId, documentType, documentNumber, blobUrl);
  }

  feedback(riderId: string, data: { rating: number; comment: string; category?: string }) {
    return this.engagement.createFeedback({ riderId, ...data });
  }

  async referral(riderId: string) {
    const rider = await this.requireRider(riderId);
    const list = await this.engagement.listReferrals();
    const mine = list.items.find((i) => i.id === riderId);
    return {
      code: rider.referralCode,
      referredCount: mine?.referredCount ?? 0,
      referredBy: rider.referredBy,
    };
  }

  applyReferral(riderId: string, code: string) {
    return this.engagement.applyReferral(riderId, code);
  }

  tickets(riderId: string) {
    return this.support.list(riderId).then((items) => ({ items }));
  }

  createTicket(riderId: string, data: { category: string; subject: string; description: string }) {
    return this.support.create(riderId, data);
  }

  profile(riderId: string) {
    return this.profileSvc.getProfile(riderId);
  }

  updateProfile(riderId: string, data: { email?: string; fullName?: string; address?: string; emergencyContact?: string }) {
    return this.profileSvc.updateProfile(riderId, data);
  }

  private async requireRider(id: string) {
    const rider = await this.customerModel.findById(id);
    if (!rider) throw new NotFoundException('Rider not found');
    return rider;
  }

  private toPlan(p: RentalPlanDocument) {
    return {
      id: p._id.toString(),
      name: p.name,
      charges: coerceNumber(p.charges, 0),
      durationDays: coerceInt(p.durationDays, 30),
      billingFrequency: p.billingFrequency,
      eligibility: p.eligibility,
      terms: p.terms,
      isActive: p.isActive,
    };
  }

  private toVehicle(v: VehicleDocument) {
    return {
      id: v._id.toString(),
      registrationNumber: v.registrationNumber,
      type: v.type,
      wheelClass: v.wheelClass ?? (v.type === 'ERickshaw' ? 'ThreeWheeler' : v.type === 'ECar' ? 'FourWheeler' : 'TwoWheeler'),
      model: v.model,
      status: v.status,
      batteryPercent: coerceInt(v.batteryPercent, 0),
      lastLat: v.lastLat != null ? coerceNumber(v.lastLat) : null,
      lastLng: v.lastLng != null ? coerceNumber(v.lastLng) : null,
      hubId: v.hubId,
    };
  }
}
