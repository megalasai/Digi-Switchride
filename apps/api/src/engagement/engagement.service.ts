import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { AuditActor } from '../audit/audit.service';
import { AuditService } from '../audit/audit.service';
import { applyHubScope, hubAllowed } from '../common/hub-scope';
import { runInWriteTenant } from '../common/tenant-write';
import { Customer, CustomerDocument } from '../schemas/customer.schema';
import {
  Agreement,
  AgreementDocument,
  AppNotification,
  AppNotificationDocument,
  ChargingStation,
  ChargingStationDocument,
  Feedback,
  FeedbackDocument,
} from '../schemas/engagement.schema';

@Injectable()
export class EngagementService {
  constructor(
    @InjectModel(ChargingStation.name) private stationModel: Model<ChargingStationDocument>,
    @InjectModel(AppNotification.name) private notificationModel: Model<AppNotificationDocument>,
    @InjectModel(Feedback.name) private feedbackModel: Model<FeedbackDocument>,
    @InjectModel(Agreement.name) private agreementModel: Model<AgreementDocument>,
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    private auditService: AuditService,
  ) {}

  async listStations() {
    const items = await this.stationModel.find(applyHubScope({})).sort({ name: 1 });
    return { items: items.map((s) => this.toStation(s)) };
  }

  async stationCount() {
    return this.stationModel.countDocuments(applyHubScope({ status: 'Active' }));
  }

  async createStation(data: { name: string; address: string; chargerCount: number; lat?: number; lng?: number; operatingHours?: string; hubId?: string; tenantId?: string }, actor?: AuditActor | null) {
    return runInWriteTenant(data.tenantId, async () => {
    if (!hubAllowed(data.hubId)) {
      throw new BadRequestException('You can only create stations for an assigned hub');
    }
    const station = await this.stationModel.create({ ...data, status: 'Active' });
    await this.auditService.record({ actor, action: 'station.create', entityType: 'ChargingStation', entityId: station._id.toString(), after: { name: data.name } });
    return this.toStation(station);
    });
  }

  async updateStation(id: string, data: Partial<{ name: string; address: string; chargerCount: number; lat: number; lng: number; operatingHours: string; status: string; hubId: string }>) {
    const station = await this.stationModel.findById(id);
    if (!station) throw new NotFoundException('Charging station not found');
    if (data.hubId != null && !hubAllowed(data.hubId)) {
      throw new BadRequestException('You can only assign stations to an assigned hub');
    }
    Object.assign(station, data);
    await station.save();
    return this.toStation(station);
  }

  async listNotifications() {
    const items = await this.notificationModel.find().sort({ createdAt: -1 }).limit(100);
    return {
      items: items.map((n) => ({
        id: n._id.toString(),
        title: n.title,
        body: n.body,
        audience: n.audience,
        channel: n.channel,
        status: n.status,
        sentAt: n.sentAt,
        createdBy: n.createdBy,
        createdAt: (n as { createdAt?: Date }).createdAt,
      })),
    };
  }

  async sendNotification(data: { title: string; body: string; audience: string }, actor?: AuditActor | null) {
    const created = await this.notificationModel.create({
      ...data,
      channel: 'InApp',
      status: 'Sent',
      sentAt: new Date(),
      createdBy: actor?.actorEmail,
    });
    await this.auditService.record({ actor, action: 'notification.send', entityType: 'Notification', entityId: created._id.toString(), after: { title: data.title, audience: data.audience } });
    return { id: created._id.toString(), status: created.status, channel: created.channel };
  }

  async listFeedback() {
    const items = await this.feedbackModel.find().sort({ createdAt: -1 }).limit(100);
    const riderIds = [...new Set(items.map((i) => i.riderId))];
    const riders = riderIds.length ? await this.customerModel.find({ _id: { $in: riderIds } }) : [];
    const map = Object.fromEntries(riders.map((r) => [r._id.toString(), r]));
    return {
      items: items.map((f) => ({
        id: f._id.toString(),
        riderId: f.riderId,
        riderName: map[f.riderId]?.fullName,
        riderPhone: map[f.riderId]?.phone,
        rating: f.rating,
        comment: f.comment,
        category: f.category,
        createdAt: (f as { createdAt?: Date }).createdAt,
      })),
    };
  }

  async createFeedback(data: { riderId: string; rating: number; comment: string; category?: string }) {
    const rider = await this.customerModel.findById(data.riderId);
    if (!rider) throw new NotFoundException('Rider not found');
    if (data.rating < 1 || data.rating > 5) throw new BadRequestException('Rating must be between 1 and 5');
    const created = await this.feedbackModel.create(data);
    return { id: created._id.toString(), rating: created.rating };
  }

  async listAgreements(riderId?: string) {
    const filter: Record<string, unknown> = {};
    if (riderId) filter.riderId = riderId;
    const items = await this.agreementModel.find(filter).sort({ createdAt: -1 }).limit(100);
    const riderIds = [...new Set(items.map((i) => i.riderId))];
    const riders = riderIds.length ? await this.customerModel.find({ _id: { $in: riderIds } }) : [];
    const map = Object.fromEntries(riders.map((r) => [r._id.toString(), r]));
    return {
      items: items.map((a) => ({
        id: a._id.toString(),
        riderId: a.riderId,
        riderName: map[a.riderId]?.fullName,
        type: a.type,
        content: a.content,
        documentUrl: a.documentUrl,
        status: a.status,
        signedAt: a.signedAt,
        createdAt: (a as { createdAt?: Date }).createdAt,
      })),
    };
  }

  async issueAgreement(data: { riderId: string; type: string; content: string; documentUrl?: string }, actor?: AuditActor | null) {
    const rider = await this.customerModel.findById(data.riderId);
    if (!rider) throw new NotFoundException('Rider not found');
    const created = await this.agreementModel.create({ ...data, status: 'Issued' });
    await this.auditService.record({ actor, action: 'agreement.issue', entityType: 'Agreement', entityId: created._id.toString(), after: { riderId: data.riderId, type: data.type } });
    return { id: created._id.toString(), status: created.status };
  }

  async signAgreement(id: string) {
    const item = await this.agreementModel.findById(id);
    if (!item) throw new NotFoundException('Agreement not found');
    item.status = 'Signed';
    item.signedAt = new Date();
    await item.save();
    return { id: item._id.toString(), status: item.status, signedAt: item.signedAt };
  }

  async listReferrals() {
    const riders = await this.customerModel.find({ referralCode: { $exists: true, $ne: null } }).sort({ createdAt: -1 });
    const referred = await this.customerModel.find({ referredBy: { $exists: true, $nin: [null, ''] } });
    return {
      items: riders.map((r) => ({
        id: r._id.toString(),
        fullName: r.fullName,
        phone: r.phone,
        referralCode: r.referralCode,
        referredCount: referred.filter((x) => x.referredBy === r._id.toString()).length,
      })),
    };
  }

  async applyReferral(riderId: string, code: string) {
    const rider = await this.customerModel.findById(riderId);
    if (!rider) throw new NotFoundException('Rider not found');
    if (rider.referredBy) throw new BadRequestException('This rider already has a referral');
    const referrer = await this.customerModel.findOne({ referralCode: code.trim().toUpperCase() });
    if (!referrer) throw new NotFoundException('Referral code not found');
    if (referrer._id.toString() === riderId) throw new BadRequestException('A rider cannot use their own code');
    rider.referredBy = referrer._id.toString();
    await rider.save();
    return { riderId, referredBy: referrer._id.toString(), referrerName: referrer.fullName };
  }

  private toStation(s: ChargingStationDocument) {
    return {
      id: s._id.toString(),
      name: s.name,
      address: s.address,
      chargerCount: s.chargerCount,
      lat: s.lat,
      lng: s.lng,
      operatingHours: s.operatingHours,
      status: s.status,
      hubId: s.hubId,
      tenantId: (s as { tenantId?: string }).tenantId,
    };
  }
}
