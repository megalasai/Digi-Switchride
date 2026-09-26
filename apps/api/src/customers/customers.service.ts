import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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

  async updateProfile(customerId: string, data: { email?: string; fullName?: string; emergencyContact?: string }) {
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
      createdAt: (c as any).createdAt,
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
    const masked = documentType === 'Aadhaar' && documentNumber ? maskAadhaar(documentNumber) : documentNumber;
    const submission = await this.kycModel.create({
      customerId,
      documentType,
      documentNumberMasked: masked,
      blobUrl,
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
        submittedAt: (s as any).createdAt,
      })),
      rejectionReason,
    };
  }

  async review(customerId: string, action: 'Approve' | 'Reject', reason?: string) {
    const status = action === 'Approve' ? 'Approved' : 'Rejected';
    await this.customerModel.findByIdAndUpdate(customerId, { kycStatus: status });
    await this.kycModel.updateMany(
      { customerId, status: { $in: ['Pending', 'UnderReview'] } },
      { status, rejectionReason: reason, reviewedAt: new Date() },
    );
  }
}
