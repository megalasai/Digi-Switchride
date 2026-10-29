import { ConflictException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Customer, CustomerDocument, KycSubmission, KycSubmissionDocument } from '../schemas/customer.schema';
import { maskAadhaar } from '../common/helpers';

@Injectable()
export class ProfileService {
  constructor(@InjectModel(Customer.name) private customerModel: Model<CustomerDocument>) {}

  async createCustomer(data: { phone: string; fullName: string; email?: string }) {
    const existing = await this.customerModel.findOne({ phone: data.phone });
    if (existing) throw new ConflictException('Customer with this phone already exists');
    const customer = await this.customerModel.create({
      phone: data.phone,
      fullName: data.fullName,
      email: data.email,
      kycStatus: 'NotSubmitted',
      accountStatus: 'Active',
    });
    return this.toProfile(customer);
  }

  async getProfile(customerId: string) {
    const c = await this.customerModel.findById(customerId);
    if (!c) throw new NotFoundException('Customer not found');
    return this.toProfile(c);
  }

  async updateProfile(customerId: string, data: { email?: string; fullName?: string; emergencyContact?: string; address?: string }) {
    const c = await this.customerModel.findByIdAndUpdate(customerId, { $set: data }, { new: true });
    if (!c) throw new NotFoundException('Customer not found');
    return this.toProfile(c);
  }

  async updateCustomer(customerId: string, data: { phone?: string; fullName?: string; email?: string; accountStatus?: string }) {
    const customer = await this.customerModel.findById(customerId);
    if (!customer) throw new NotFoundException('Customer not found');

    if (data.phone && data.phone !== customer.phone) {
      const taken = await this.customerModel.findOne({ phone: data.phone });
      if (taken) throw new ConflictException('Phone already in use');
      customer.phone = data.phone;
    }
    if (data.fullName != null) customer.fullName = data.fullName;
    if (data.email != null) customer.email = data.email;
    if (data.accountStatus != null) customer.accountStatus = data.accountStatus as any;

    await customer.save();
    return this.toProfile(customer);
  }

  toProfile(c: CustomerDocument) {
    return {
      id: c._id.toString(),
      username: c.username,
      phone: c.phone,
      email: c.email,
      fullName: c.fullName,
      kycStatus: c.kycStatus,
      accountStatus: c.accountStatus,
      assignedVehicleId: c.assignedVehicleId,
      rentalPlanId: c.rentalPlanId,
      walletBalance: c.walletBalance ?? 0,
      referralCode: c.referralCode,
      referredBy: c.referredBy,
      address: c.address,
      emergencyContact: c.emergencyContact,
      createdAt: (c as { createdAt?: Date }).createdAt,
    };
  }
}

@Injectable()
export class KycService {
  constructor(
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    @InjectModel(KycSubmission.name) private kycModel: Model<KycSubmissionDocument>,
  ) {}

  async submit(customerId: string, documentType: string, documentNumber?: string, blobUrl?: string) {
    const allowed = ['Aadhaar', 'PAN', 'DrivingLicence', 'Selfie'];
    if (!allowed.includes(documentType)) {
      throw new BadRequestException('Document type must be Aadhaar, PAN, Driving Licence or Selfie');
    }
    const customer = await this.customerModel.findById(customerId);
    if (!customer) throw new NotFoundException('Customer not found');
    if (blobUrl && blobUrl.length > 7_000_000) {
      throw new BadRequestException('Document file is too large (max about 5 MB)');
    }
    const masked = documentType === 'Aadhaar' && documentNumber ? maskAadhaar(documentNumber) : documentNumber;
    const submission = await this.kycModel.create({
      customerId,
      documentType,
      documentNumberMasked: masked,
      blobUrl: blobUrl?.trim() || undefined,
      status: 'Pending',
    });
    await this.customerModel.findByIdAndUpdate(customerId, { kycStatus: 'Pending' });
    return {
      id: submission._id.toString(),
      documentType,
      status: submission.status,
      submittedAt: (submission as any).createdAt,
    };
  }

  async getStatus(customerId: string) {
    const customer = await this.customerModel.findById(customerId);
    if (!customer) throw new NotFoundException('Customer not found');
    const submissions = await this.kycModel.find({ customerId }).sort({ createdAt: -1 });
    const rejectionReason = submissions.find((s) => s.status === 'Rejected')?.rejectionReason;
    return {
      status: customer.kycStatus,
      submissions: submissions.map((s) => ({
        id: s._id.toString(),
        documentType: s.documentType,
        status: s.status,
        documentNumberMasked: s.documentNumberMasked,
        blobUrl: s.blobUrl,
        submittedAt: (s as any).createdAt,
      })),
      rejectionReason,
    };
  }

  async review(customerId: string, action: 'Approve' | 'Reject', reason?: string) {
    if (action === 'Reject' && !reason?.trim()) {
      throw new BadRequestException('Rejection reason is required');
    }
    const status = action === 'Approve' ? 'Approved' : 'Rejected';
    await this.customerModel.findByIdAndUpdate(customerId, { kycStatus: status });
    await this.kycModel.updateMany(
      { customerId, status: { $in: ['Pending', 'UnderReview'] } },
      { status, rejectionReason: reason, reviewedAt: new Date() },
    );
  }

  async listSubmissions(status?: string) {
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    else filter.status = { $in: ['Pending', 'UnderReview'] };
    const items = await this.kycModel.find(filter).sort({ createdAt: -1 }).limit(100);
    const riderIds = [...new Set(items.map((s) => s.customerId))];
    const riders = riderIds.length ? await this.customerModel.find({ _id: { $in: riderIds } }) : [];
    const riderMap = Object.fromEntries(riders.map((r) => [r._id.toString(), r]));
    return {
      items: items.map((s) => {
        const rider = riderMap[s.customerId];
        return {
          id: s._id.toString(),
          riderId: s.customerId,
          riderName: rider?.fullName,
          riderPhone: rider?.phone,
          riderKycStatus: rider?.kycStatus,
          documentType: s.documentType,
          documentNumberMasked: s.documentNumberMasked,
          blobUrl: s.blobUrl,
          status: s.status,
          rejectionReason: s.rejectionReason,
          submittedAt: (s as { createdAt?: Date }).createdAt,
          reviewedAt: s.reviewedAt,
        };
      }),
    };
  }

  async reviewSubmission(submissionId: string, action: 'Approve' | 'Reject', reason?: string, reviewedBy?: string) {
    if (action === 'Reject' && (!reason || reason.trim().length < 10)) {
      throw new BadRequestException('Rejection reason must be at least 10 characters');
    }
    const submission = await this.kycModel.findById(submissionId);
    if (!submission) throw new NotFoundException('KYC document not found');
    if (!['Pending', 'UnderReview'].includes(submission.status)) {
      throw new BadRequestException('This document has already been reviewed');
    }
    submission.status = action === 'Approve' ? 'Approved' : 'Rejected';
    submission.rejectionReason = action === 'Reject' ? reason?.trim() : undefined;
    submission.reviewedAt = new Date();
    submission.reviewedBy = reviewedBy;
    await submission.save();
    await this.recalculateRiderKyc(submission.customerId);
    return { id: submission._id.toString(), status: submission.status };
  }

  private async recalculateRiderKyc(customerId: string) {
    const submissions = await this.kycModel.find({ customerId });
    if (!submissions.length) {
      await this.customerModel.findByIdAndUpdate(customerId, { kycStatus: 'NotSubmitted' });
      return;
    }
    const latestByType = new Map<string, (typeof submissions)[number]>();
    for (const s of submissions.sort((a, b) => ((b as { createdAt?: Date }).createdAt?.getTime() ?? 0) - ((a as { createdAt?: Date }).createdAt?.getTime() ?? 0))) {
      if (!latestByType.has(s.documentType)) latestByType.set(s.documentType, s);
    }
    const latest = [...latestByType.values()];
    if (latest.some((s) => s.status === 'Pending' || s.status === 'UnderReview')) {
      await this.customerModel.findByIdAndUpdate(customerId, { kycStatus: 'Pending' });
      return;
    }
    const required = ['Aadhaar', 'PAN', 'DrivingLicence'];
    const approvedRequired = required.every((type) => latestByType.get(type)?.status === 'Approved');
    if (approvedRequired) {
      await this.customerModel.findByIdAndUpdate(customerId, { kycStatus: 'Approved' });
      return;
    }
    if (latest.some((s) => s.status === 'Rejected')) {
      await this.customerModel.findByIdAndUpdate(customerId, { kycStatus: 'Rejected' });
      return;
    }
    await this.customerModel.findByIdAndUpdate(customerId, { kycStatus: 'NotSubmitted' });
  }
}
