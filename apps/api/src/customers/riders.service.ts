import { BadRequestException, ConflictException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { AccountStatus } from '@digi-switchride/shared';
import type { AuditActor } from '../audit/audit.service';
import { AuditService } from '../audit/audit.service';
import { runInWriteTenant } from '../common/tenant-write';
import { Customer, CustomerDocument, KycSubmission, KycSubmissionDocument } from '../schemas/customer.schema';
import { Vehicle, VehicleDocument } from '../schemas/fleet.schema';
import { Booking, BookingDocument, Payment, PaymentDocument, Ride, RideDocument } from '../schemas/booking.schema';
import { RentalPlan, RentalPlanDocument, WalletTransaction, WalletTransactionDocument } from '../schemas/rental.schema';
import { normalizeIndiaPhone } from '../common/helpers';
import { ProfileService } from './customers.service';
import { findByEitherId, removeByEitherId } from '../common/mongo-id';

@Injectable()
export class RidersService implements OnModuleInit {
  constructor(
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    @InjectModel(KycSubmission.name) private kycModel: Model<KycSubmissionDocument>,
    @InjectModel(Vehicle.name) private vehicleModel: Model<VehicleDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(Ride.name) private rideModel: Model<RideDocument>,
    @InjectModel(RentalPlan.name) private planModel: Model<RentalPlanDocument>,
    @InjectModel(WalletTransaction.name) private walletModel: Model<WalletTransactionDocument>,
    private profileService: ProfileService,
    private auditService: AuditService,
  ) {}

  async onModuleInit() {
    const count = await this.planModel.countDocuments();
    if (count === 0) {
      await this.planModel.insertMany([
        {
          name: 'Weekly Flex',
          charges: 1050,
          durationDays: 7,
          billingFrequency: 'Weekly',
          eligibility: 'KYC approved riders',
          terms: 'Weekly rental billed every 7 days. Vehicle must remain in serviceable condition.',
          isActive: true,
        },
        {
          name: 'Monthly Standard',
          charges: 4000,
          durationDays: 30,
          billingFrequency: 'Monthly',
          eligibility: 'KYC approved riders',
          terms: 'Monthly rental billed every 30 days. Early termination may attract remaining dues.',
          isActive: true,
        },
      ]);
    }
    const missing = await this.customerModel.find({ $or: [{ referralCode: { $exists: false } }, { referralCode: null }, { referralCode: '' }] }).limit(200);
    for (const rider of missing) {
      rider.referralCode = await this.nextReferralCode(rider.phone ?? '0000');
      await rider.save();
    }
  }

  async list(params: {
    search?: string;
    kycStatus?: string;
    accountStatus?: string;
    page?: number;
    pageSize?: number;
  }) {
    const filter: Record<string, unknown> = {};
    if (params.kycStatus) filter.kycStatus = params.kycStatus;
    if (params.accountStatus) filter.accountStatus = params.accountStatus;
    if (params.search) {
      const q = params.search.trim();
      filter.$or = [
        { phone: { $regex: q, $options: 'i' } },
        { fullName: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
      ];
    }
    const page = params.page ?? 1;
    const pageSize = Math.min(params.pageSize ?? 20, 100);
    const totalCount = await this.customerModel.countDocuments(filter);
    const items = await this.customerModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize);
    return {
      items: items.map((c) => this.toRiderSummary(c)),
      page,
      pageSize,
      totalCount,
    };
  }

  async create(data: { phone: string; fullName: string; email?: string; tenantId?: string }, actor?: AuditActor | null) {
    return runInWriteTenant(data.tenantId, async () => {
    const phone = normalizeIndiaPhone(data.phone);
    const existing = await this.customerModel.findOne({ phone });
    if (existing) throw new ConflictException('Rider with this phone already exists');
    const customer = await this.customerModel.create({
      phone,
      fullName: data.fullName.trim(),
      email: data.email?.trim() || undefined,
      kycStatus: 'NotSubmitted',
      accountStatus: 'Active',
      walletBalance: 0,
      referralCode: await this.nextReferralCode(phone),
    });
    const result = this.toRiderSummary(customer);
    await this.auditService.record({
      actor,
      action: 'rider.create',
      entityType: 'Rider',
      entityId: result.id,
      after: { phone: result.phone, fullName: result.fullName, email: result.email },
    });
    return result;
    });
  }

  async update(
    riderId: string,
    data: { phone?: string; fullName?: string; email?: string; accountStatus?: string; forceUnassign?: boolean },
    actor?: AuditActor | null,
  ) {
    const customer = await this.customerModel.findById(riderId);
    if (!customer) throw new NotFoundException('Rider not found');
    const before = this.toRiderSummary(customer);

    if (data.phone && normalizeIndiaPhone(data.phone) !== customer.phone) {
      const phone = normalizeIndiaPhone(data.phone);
      const taken = await this.customerModel.findOne({ phone });
      if (taken) throw new ConflictException('Phone already in use');
      customer.phone = phone;
    }
    if (data.fullName != null) customer.fullName = data.fullName.trim();
    if (data.email != null) customer.email = data.email.trim() || undefined;
    if (data.accountStatus != null) {
      await this.applyAccountStatus(customer, data.accountStatus as AccountStatus, Boolean(data.forceUnassign));
    }
    await customer.save();
    const after = this.toRiderSummary(customer);
    await this.auditService.record({
      actor,
      action: 'rider.update',
      entityType: 'Rider',
      entityId: riderId,
      before: {
        phone: before.phone,
        fullName: before.fullName,
        email: before.email,
        accountStatus: before.accountStatus,
      },
      after: {
        phone: after.phone,
        fullName: after.fullName,
        email: after.email,
        accountStatus: after.accountStatus,
      },
    });
    return after;
  }

  async remove(riderId: string, actor?: AuditActor | null) {
    const customer = await findByEitherId(this.customerModel, riderId);
    if (!customer) throw new NotFoundException('Rider not found');
    await this.vehicleModel.updateMany({ assignedRiderId: riderId }, { $unset: { assignedRiderId: 1 } });
    const deleted = await removeByEitherId(this.customerModel.collection, customer._id.toString());
    if (!deleted) throw new BadRequestException('Could not delete rider');
    await this.auditService.record({
      actor,
      action: 'rider.delete',
      entityType: 'Rider',
      entityId: riderId,
      before: { phone: customer.phone, fullName: customer.fullName },
    });
    return { deleted: true, id: riderId };
  }

  async getProfile(riderId: string) {
    const rider = await this.customerModel.findById(riderId);
    if (!rider) throw new NotFoundException('Rider not found');

    const [vehicle, plan, kyc, payments, bookings, rides, walletTx] = await Promise.all([
      rider.assignedVehicleId ? this.vehicleModel.findById(rider.assignedVehicleId) : null,
      rider.rentalPlanId ? this.planModel.findById(rider.rentalPlanId) : null,
      this.kycModel.find({ customerId: riderId }).sort({ createdAt: -1 }),
      this.paymentModel.find({ customerId: riderId }).sort({ createdAt: -1 }).limit(20),
      this.bookingModel.find({ customerId: riderId }).sort({ createdAt: -1 }).limit(20),
      this.rideModel.find({ customerId: riderId }).sort({ createdAt: -1 }).limit(20),
      this.walletModel.find({ riderId }).sort({ createdAt: -1 }).limit(50),
    ]);

    return {
      rider: this.toRiderSummary(rider),
      assignedVehicle: vehicle
        ? {
            id: vehicle._id.toString(),
            registrationNumber: vehicle.registrationNumber,
            model: vehicle.model,
            type: vehicle.type,
            wheelClass: vehicle.wheelClass,
            status: vehicle.status,
            batteryPercent: vehicle.batteryPercent,
            hubId: vehicle.hubId,
          }
        : null,
      rentalPlan: plan ? this.toPlan(plan) : null,
      wallet: {
        balance: rider.walletBalance ?? 0,
        transactions: walletTx.map((t) => ({
          id: t._id.toString(),
          type: t.type,
          amount: t.amount,
          reference: t.reference,
          note: t.note,
          balanceAfter: t.balanceAfter,
          createdAt: (t as { createdAt?: Date }).createdAt,
        })),
      },
      payments: payments.map((p) => ({
        id: p._id.toString(),
        bookingId: p.bookingId,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        method: p.method,
        createdAt: (p as { createdAt?: Date }).createdAt,
      })),
      rentalActivity: {
        bookings: bookings.map((b) => ({
          id: b._id.toString(),
          vehicleId: b.vehicleId,
          bookingType: b.bookingType,
          status: b.status,
          estimatedAmount: b.estimatedAmount,
          createdAt: (b as { createdAt?: Date }).createdAt,
        })),
        rides: rides.map((r) => ({
          id: r._id.toString(),
          vehicleId: r.vehicleId,
          status: r.status,
          startedAt: r.startedAt,
          endedAt: r.endedAt,
          durationMinutes: r.durationMinutes,
        })),
      },
      kyc: {
        status: rider.kycStatus,
        submissions: kyc.map((s) => ({
          id: s._id.toString(),
          documentType: s.documentType,
          status: s.status,
          documentNumberMasked: s.documentNumberMasked,
          blobUrl: s.blobUrl,
          rejectionReason: s.rejectionReason,
          submittedAt: (s as { createdAt?: Date }).createdAt,
          reviewedAt: s.reviewedAt,
        })),
      },
    };
  }

  async listPlans(includeInactive = false) {
    const filter = includeInactive ? {} : { isActive: true };
    const plans = await this.planModel.find(filter).sort({ name: 1 });
    return { items: plans.map((p) => this.toPlan(p)) };
  }

  async createPlan(
    data: { name: string; charges: number; durationDays: number; billingFrequency: string; eligibility?: string; terms?: string; tenantId?: string },
    actor?: AuditActor | null,
  ) {
    return runInWriteTenant(data.tenantId, async () => {
    const existing = await this.planModel.findOne({ name: data.name.trim() });
    if (existing) throw new ConflictException('A plan with this name already exists');
    const plan = await this.planModel.create({
      name: data.name.trim(),
      charges: data.charges,
      durationDays: data.durationDays,
      billingFrequency: data.billingFrequency,
      eligibility: data.eligibility?.trim(),
      terms: data.terms?.trim(),
      isActive: true,
    });
    const result = this.toPlan(plan);
    await this.auditService.record({
      actor,
      action: 'plan.create',
      entityType: 'RentalPlan',
      entityId: result.id,
      after: result as unknown as Record<string, unknown>,
    });
    return result;
    });
  }

  async updatePlan(
    id: string,
    data: Partial<{ name: string; charges: number; durationDays: number; billingFrequency: string; eligibility: string; terms: string; isActive: boolean }>,
    actor?: AuditActor | null,
  ) {
    const plan = await this.planModel.findById(id);
    if (!plan) throw new NotFoundException('Rental plan not found');
    const before = this.toPlan(plan);
    if (data.name != null) plan.name = data.name.trim();
    if (data.charges != null) plan.charges = data.charges;
    if (data.durationDays != null) plan.durationDays = data.durationDays;
    if (data.billingFrequency != null) plan.billingFrequency = data.billingFrequency as typeof plan.billingFrequency;
    if (data.eligibility != null) plan.eligibility = data.eligibility;
    if (data.terms != null) plan.terms = data.terms;
    if (data.isActive != null) plan.isActive = data.isActive;
    await plan.save();
    const after = this.toPlan(plan);
    await this.auditService.record({
      actor,
      action: 'plan.update',
      entityType: 'RentalPlan',
      entityId: id,
      before: before as unknown as Record<string, unknown>,
      after: after as unknown as Record<string, unknown>,
    });
    return after;
  }

  async deletePlan(id: string, actor?: AuditActor | null) {
    const plan = await findByEitherId(this.planModel, id);
    if (!plan) throw new NotFoundException('Rental plan not found');
    const deleted = await removeByEitherId(this.planModel.collection, plan._id.toString());
    if (!deleted) throw new BadRequestException('Could not delete rental plan');
    await this.auditService.record({
      actor,
      action: 'plan.delete',
      entityType: 'RentalPlan',
      entityId: id,
      before: this.toPlan(plan) as unknown as Record<string, unknown>,
    });
    return { deleted: true, id };
  }

  async adjustWallet(
    riderId: string,
    data: { type: 'Credit' | 'Debit'; amount: number; note: string; reference?: string },
    actor?: AuditActor | null,
  ) {
    const rider = await this.customerModel.findById(riderId);
    if (!rider) throw new NotFoundException('Rider not found');
    const amount = Math.round(data.amount * 100) / 100;
    if (amount <= 0) throw new BadRequestException('Amount must be greater than zero');
    const current = rider.walletBalance ?? 0;
    if (data.type === 'Debit' && amount > current) {
      throw new BadRequestException('Debit cannot exceed wallet balance');
    }
    const balanceAfter = data.type === 'Credit' ? current + amount : current - amount;
    rider.walletBalance = balanceAfter;
    await rider.save();
    const tx = await this.walletModel.create({
      riderId,
      type: data.type,
      amount,
      note: data.note.trim(),
      reference: data.reference?.trim(),
      actorId: actor?.actorId,
      balanceAfter,
    });
    await this.auditService.record({
      actor,
      action: 'wallet.adjust',
      entityType: 'Wallet',
      entityId: riderId,
      before: { balance: current },
      after: { type: data.type, amount, balanceAfter, note: data.note },
    });
    return {
      riderId,
      balance: balanceAfter,
      transaction: {
        id: tx._id.toString(),
        type: tx.type,
        amount: tx.amount,
        note: tx.note,
        reference: tx.reference,
        balanceAfter,
        createdAt: (tx as { createdAt?: Date }).createdAt,
      },
    };
  }

  async listWallets(search?: string) {
    const filter: Record<string, unknown> = {};
    if (search) {
      filter.$or = [{ phone: { $regex: search, $options: 'i' } }, { fullName: { $regex: search, $options: 'i' } }];
    }
    const riders = await this.customerModel.find(filter).sort({ walletBalance: -1 }).limit(100);
    return { items: riders.map((c) => this.toRiderSummary(c)) };
  }

  async assignPlan(riderId: string, rentalPlanId: string, actor?: AuditActor | null) {
    const rider = await this.customerModel.findById(riderId);
    if (!rider) throw new NotFoundException('Rider not found');
    const plan = await this.planModel.findById(rentalPlanId);
    if (!plan || !plan.isActive) throw new NotFoundException('Rental plan not found');
    const before = rider.rentalPlanId;
    rider.rentalPlanId = rentalPlanId;
    await rider.save();
    await this.auditService.record({
      actor,
      action: 'rider.plan.assign',
      entityType: 'Rider',
      entityId: riderId,
      before: { rentalPlanId: before },
      after: { rentalPlanId, planName: plan.name },
    });
    return this.getProfile(riderId);
  }

  private async applyAccountStatus(customer: CustomerDocument, status: AccountStatus, forceUnassign: boolean) {
    if (status === 'Deactivated' && customer.assignedVehicleId && !forceUnassign) {
      throw new BadRequestException('Unassign the vehicle or confirm force unassign before deactivating this rider');
    }
    if (status === 'Deactivated' && customer.assignedVehicleId && forceUnassign) {
      await this.vehicleModel.findByIdAndUpdate(customer.assignedVehicleId, {
        $unset: { assignedRiderId: 1 },
        status: 'Available',
        statusChangedAt: new Date(),
      });
      customer.assignedVehicleId = undefined;
    }
    customer.accountStatus = status;
  }

  toRiderSummary(c: CustomerDocument) {
    return {
      ...this.profileService.toProfile(c),
      assignedVehicleId: c.assignedVehicleId,
      rentalPlanId: c.rentalPlanId,
      walletBalance: c.walletBalance ?? 0,
      referralCode: c.referralCode,
      referredBy: c.referredBy,
      tenantId: (c as { tenantId?: string }).tenantId,
    };
  }

  private async nextReferralCode(phone: string) {
    const digits = phone.replace(/\D/g, '').slice(-4) || '0000';
    for (let i = 0; i < 8; i++) {
      const code = `SR${digits}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const taken = await this.customerModel.findOne({ referralCode: code });
      if (!taken) return code;
    }
    return `SR${Date.now().toString(36).toUpperCase().slice(-8)}`;
  }

  private toPlan(p: RentalPlanDocument) {
    return {
      id: p._id.toString(),
      name: p.name,
      charges: p.charges,
      durationDays: p.durationDays,
      billingFrequency: p.billingFrequency,
      eligibility: p.eligibility,
      terms: p.terms,
      isActive: p.isActive,
      tenantId: (p as { tenantId?: string }).tenantId,
    };
  }
}
