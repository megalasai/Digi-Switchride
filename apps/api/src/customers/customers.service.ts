import { ConflictException, Injectable, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Customer, CustomerDocument, KycSubmission, KycSubmissionDocument } from '../schemas/customer.schema';
import { maskAadhaar, resolveRiderUsername } from '../common/helpers';
import { extractMongoId, findByEitherId, isHexObjectId, relatedIdFilter } from '../common/mongo-id';
import { runWithoutTenant } from '../common/tenant-als';

type KycRecord = {
  _id?: { toString(): string };
  customerId?: unknown;
  documentType: string;
  status: string;
  documentNumberMasked?: string;
  blobUrl?: string;
  rejectionReason?: string;
  reviewedAt?: Date;
  createdAt?: Date;
};

function normalizeDocStatus(status: string): string {
  const value = String(status ?? '').replace(/[\s_-]/g, '').toLowerCase();
  if (['approved', 'approve', 'accepted', 'verified', 'success'].includes(value)) return 'Approved';
  if (['pending', 'submitted', 'underreview', 'inreview', 'uploaded', 'review'].includes(value)) return 'Pending';
  if (['rejected', 'reject', 'declined', 'failed'].includes(value)) return 'Rejected';
  return String(status ?? '');
}

export function deriveKycStatus(submissions: Array<{ documentType?: string; status: string; createdAt?: Date | string }>): string {
  if (!submissions.length) return 'NotSubmitted';
  const latestByType = new Map<string, { status: string; createdAt?: Date | string }>();
  const timeOf = (value?: Date | string) => {
    if (!value) return 0;
    const t = value instanceof Date ? value.getTime() : Date.parse(String(value));
    return Number.isFinite(t) ? t : 0;
  };
  const sorted = [...submissions].sort((a, b) => timeOf(b.createdAt) - timeOf(a.createdAt));
  for (const s of sorted) {
    const type = s.documentType || '_doc';
    if (!latestByType.has(type)) latestByType.set(type, { status: normalizeDocStatus(s.status), createdAt: s.createdAt });
  }
  const latest = [...latestByType.values()];
  if (latest.some((s) => s.status === 'Pending')) return 'Pending';
  if (latest.length && latest.every((s) => s.status === 'Approved')) return 'Approved';
  if (latest.some((s) => s.status === 'Rejected')) return 'Rejected';
  if (latest.some((s) => s.status === 'Approved')) return 'UnderReview';
  return 'NotSubmitted';
}

@Injectable()
export class ProfileService {
  constructor(@InjectModel(Customer.name) private customerModel: Model<CustomerDocument>) {}

  async createCustomer(data: { username?: string; phone: string; fullName: string; email?: string }) {
    const username = resolveRiderUsername(data.username, data.phone);
    if (await this.customerModel.findOne({ username })) {
      throw new ConflictException('A rider with this username already exists in this company');
    }
    const existing = await this.customerModel.findOne({ phone: data.phone });
    if (existing) throw new ConflictException('Customer with this phone already exists');
    const customer = await this.customerModel.create({
      username,
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
export class KycService implements OnModuleInit {
  constructor(
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    @InjectModel(KycSubmission.name) private kycModel: Model<KycSubmissionDocument>,
  ) {}

  async onModuleInit() {
    await this.backfillRiderKycStatuses();
  }

  async submit(customerId: string, documentType: string, documentNumber?: string, blobUrl?: string) {
    const allowed = ['Aadhaar', 'PAN', 'DrivingLicence', 'Selfie'];
    if (!allowed.includes(documentType)) {
      throw new BadRequestException('Document type must be Aadhaar, PAN, Driving Licence or Selfie');
    }
    const customer = await findByEitherId(this.customerModel, customerId);
    if (!customer) throw new NotFoundException('Customer not found');
    if (!blobUrl?.trim()) {
      throw new BadRequestException('Document image is required');
    }
    if (blobUrl.length > 7_000_000) {
      throw new BadRequestException('Document file is too large (max about 5 MB)');
    }
    const masked = documentType === 'Aadhaar' && documentNumber ? maskAadhaar(documentNumber) : documentNumber;
    const tenantId = (customer as { tenantId?: string }).tenantId;
    const riderKey = extractMongoId(customer._id) || String(customerId);
    const submission = await this.kycModel.create({
      customerId: riderKey,
      documentType,
      documentNumberMasked: masked,
      blobUrl: blobUrl.trim(),
      status: 'Pending',
      ...(tenantId ? { tenantId } : {}),
    });
    await this.setRiderKycStatus(riderKey, 'Pending');
    return {
      id: submission._id.toString(),
      documentType,
      status: submission.status,
      submittedAt: (submission as any).createdAt,
    };
  }

  async getStatus(customerId: string) {
    const customer = await findByEitherId(this.customerModel, customerId);
    if (!customer) throw new NotFoundException('Customer not found');
    const synced = await this.syncRiderKycFromSubmissions(customerId);
    const rejectionReason = synced.submissions.find((s) => s.status === 'Rejected')?.rejectionReason;
    return {
      status: synced.kycStatus,
      submissions: synced.submissions.map((s) => ({
        id: s._id ? String(s._id) : '',
        documentType: s.documentType,
        status: s.status,
        documentNumberMasked: s.documentNumberMasked,
        blobUrl: s.blobUrl,
        submittedAt: s.createdAt,
      })),
      rejectionReason,
    };
  }

  async review(customerId: string, action: 'Approve' | 'Reject', reason?: string) {
    if (action === 'Reject' && !reason?.trim()) {
      throw new BadRequestException('Rejection reason is required');
    }
    const status = action === 'Approve' ? 'Approved' : 'Rejected';
    await this.kycModel.collection.updateMany(
      {
        $and: [relatedIdFilter('customerId', customerId), { status: { $in: ['Pending', 'UnderReview'] } }],
      },
      { $set: { status, rejectionReason: reason, reviewedAt: new Date() } },
    );
    await this.syncRiderKycFromSubmissions(customerId);
  }

  async listSubmissions(status?: string) {
    const filter: Record<string, unknown> = {};
    if (status && status !== 'all') filter.status = status;
    else if (!status) filter.status = { $in: ['Pending', 'UnderReview'] };
    const items = await this.kycModel
      .find(filter)
      .select('-blobUrl')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    const riderIds = [...new Set(items.map((s) => extractMongoId(s.customerId) || String(s.customerId)).filter(Boolean))];
    const riderMap: Record<string, CustomerDocument> = {};
    await Promise.all(
      riderIds.map(async (id) => {
        const rider = await findByEitherId(this.customerModel, id);
        if (rider) riderMap[id] = rider;
      }),
    );
    return {
      items: items.map((s) => {
        const riderId = extractMongoId(s.customerId) || String(s.customerId);
        const rider = riderMap[riderId];
        const pageDocs = items.filter((doc) => (extractMongoId(doc.customerId) || String(doc.customerId)) === riderId);
        const id = String(s._id);
        return {
          id,
          riderId,
          riderName: rider?.fullName,
          riderPhone: rider?.phone,
          riderKycStatus: rider?.kycStatus || deriveKycStatus(pageDocs),
          documentType: s.documentType,
          documentNumberMasked: s.documentNumberMasked,
          hasFile: true,
          fileUrl: `/admin/kyc/submissions/${id}/file`,
          status: s.status,
          rejectionReason: s.rejectionReason,
          submittedAt: (s as { createdAt?: Date }).createdAt,
          reviewedAt: s.reviewedAt,
        };
      }),
    };
  }

  async getSubmissionFile(submissionId: string) {
    const submission = await findByEitherId(this.kycModel, submissionId);
    if (!submission?.blobUrl) throw new NotFoundException('KYC document file not found');
    const blobUrl = String(submission.blobUrl);
    const data = blobUrl.match(/^data:([^;]+);base64,(.+)$/s);
    if (data) {
      return { mime: data[1] || 'application/octet-stream', buffer: Buffer.from(data[2], 'base64'), redirectUrl: null as string | null };
    }
    if (/^https?:\/\//i.test(blobUrl)) {
      return { mime: 'application/octet-stream', buffer: null as Buffer | null, redirectUrl: blobUrl };
    }
    return { mime: 'application/octet-stream', buffer: Buffer.from(blobUrl), redirectUrl: null as string | null };
  }

  async reviewSubmission(submissionId: string, action: 'Approve' | 'Reject', reason?: string, reviewedBy?: string) {
    if (action === 'Reject' && (!reason || reason.trim().length < 10)) {
      throw new BadRequestException('Rejection reason must be at least 10 characters');
    }
    const submission = await findByEitherId(this.kycModel, submissionId);
    if (!submission) throw new NotFoundException('KYC document not found');
    if (!['Pending', 'UnderReview'].includes(submission.status)) {
      throw new BadRequestException('This document has already been reviewed');
    }
    submission.status = action === 'Approve' ? 'Approved' : 'Rejected';
    submission.rejectionReason = action === 'Reject' ? reason?.trim() : undefined;
    submission.reviewedAt = new Date();
    submission.reviewedBy = reviewedBy;
    await submission.save();
    await this.syncRiderKycFromSubmissions(extractMongoId(submission.customerId) || String(submission.customerId));
    return { id: submission._id.toString(), status: submission.status };
  }

  async healIfNotSubmitted(customerId: string) {
    await this.syncRiderKycFromSubmissions(customerId);
  }

  async syncRiderKycFromSubmissions(customerId: string) {
    const submissions = await this.findSubmissions(customerId);
    const kycStatus = deriveKycStatus(submissions);
    await this.setRiderKycStatus(customerId, kycStatus);
    return { submissions, kycStatus };
  }

  async overlayKycStatuses(customers: Array<CustomerDocument | { _id: unknown; phone?: string; kycStatus?: string }>) {
    if (!customers.length) return;
    const ids = customers.map((c) => extractMongoId(c._id)).filter(Boolean);
    const phones = customers.map((c) => c.phone).filter((p): p is string => Boolean(p));
    const objectIds = ids.filter((id) => isHexObjectId(id)).map((id) => new Types.ObjectId(id));
    const clauses: Record<string, unknown>[] = [];
    if (ids.length) clauses.push({ customerId: { $in: ids } });
    if (objectIds.length) clauses.push({ customerId: { $in: objectIds } });
    if (phones.length) clauses.push({ customerId: { $in: phones } });
    if (!clauses.length) return;
    const docs = (await this.nativeKyc().find(clauses.length === 1 ? clauses[0] : { $or: clauses }).toArray()) as unknown as KycRecord[];
    const grouped = new Map<string, KycRecord[]>();
    for (const s of docs) {
      const key = extractMongoId(s.customerId) || String(s.customerId ?? '');
      if (!key || key === '[object Object]') continue;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(s);
    }
    for (const customer of customers) {
      const id = extractMongoId(customer._id);
      const list = grouped.get(id) ?? grouped.get(customer.phone ?? '') ?? [];
      if (!list.length) continue;
      const kycStatus = deriveKycStatus(list);
      customer.kycStatus = kycStatus as CustomerDocument['kycStatus'];
      if (id) await this.setRiderKycStatus(id, kycStatus);
    }
  }

  private mongoDb() {
    const connected = this.kycModel.db.db;
    if (connected) return connected;
    return this.kycModel.db.getClient().db();
  }

  private nativeKyc() {
    return this.mongoDb().collection('kyc_submissions');
  }

  private nativeCustomers() {
    return this.mongoDb().collection('customers');
  }

  private async findSubmissions(customerId: string): Promise<KycRecord[]> {
    const id = extractMongoId(customerId) || String(customerId);
    const clauses: Record<string, unknown>[] = [{ customerId: id }];
    if (isHexObjectId(id)) clauses.push({ customerId: new Types.ObjectId(id) });
    const [native, scoped, unscoped] = await Promise.all([
      this.nativeKyc().find({ $or: clauses }).sort({ createdAt: -1 }).toArray(),
      this.kycModel.find({ customerId: id }).sort({ createdAt: -1 }).lean(),
      runWithoutTenant(() => this.kycModel.find({ customerId: id }).sort({ createdAt: -1 }).lean()),
    ]);
    const merged = new Map<string, KycRecord>();
    for (const row of [...native, ...scoped, ...unscoped] as unknown as KycRecord[]) {
      const key = row._id ? String(row._id) : `${row.documentType}:${row.status}:${String(row.createdAt ?? '')}`;
      merged.set(key, row);
    }
    return [...merged.values()];
  }

  private async backfillRiderKycStatuses() {
    await runWithoutTenant(async () => {
      const docs = (await this.nativeKyc()
        .find({})
        .project({ customerId: 1, documentType: 1, status: 1, createdAt: 1 })
        .toArray()) as unknown as KycRecord[];
      const grouped = new Map<string, KycRecord[]>();
      for (const s of docs) {
        const id = extractMongoId(s.customerId) || String(s.customerId ?? '');
        if (!id || id === '[object Object]') continue;
        if (!grouped.has(id)) grouped.set(id, []);
        grouped.get(id)!.push(s);
      }
      for (const [id, list] of grouped) {
        await this.setRiderKycStatus(id, deriveKycStatus(list));
      }
    });
  }

  private async setRiderKycStatus(customerId: string, kycStatus: string) {
    const id = extractMongoId(customerId) || String(customerId);
    const clauses: Record<string, unknown>[] = [{ _id: id }];
    if (isHexObjectId(id)) clauses.push({ _id: new Types.ObjectId(id) });
    await this.nativeCustomers().updateMany({ $or: clauses }, { $set: { kycStatus } });
  }
}
