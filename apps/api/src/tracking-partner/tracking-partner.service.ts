import { BadRequestException, ConflictException, Injectable, NotFoundException, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { Model } from 'mongoose';
import { findByEitherId } from '../common/mongo-id';
import { runWithoutTenant } from '../common/tenant-als';
import { IoTDevice, IoTDeviceDocument, Vehicle, VehicleDocument, GpsTrackPoint, GpsTrackPointDocument } from '../schemas/fleet.schema';
import {
  TrackingPartnerApp,
  TrackingPartnerAppDocument,
  TrackingPartnerAsset,
  TrackingPartnerAssetDocument,
  TrackingPartnerTenant,
  TrackingPartnerTenantDocument,
} from '../schemas/tracking-partner.schema';
import { TenantsService } from '../tenants/tenants.service';

const HISTORY_MAX_DAYS = 31;
const HISTORY_MAX_POINTS = 5000;

@Injectable()
export class TrackingPartnerService implements OnModuleInit {
  constructor(
    @InjectModel(TrackingPartnerApp.name) private appModel: Model<TrackingPartnerAppDocument>,
    @InjectModel(TrackingPartnerTenant.name) private tenantMap: Model<TrackingPartnerTenantDocument>,
    @InjectModel(TrackingPartnerAsset.name) private assetMap: Model<TrackingPartnerAssetDocument>,
    @InjectModel(IoTDevice.name) private deviceModel: Model<IoTDeviceDocument>,
    @InjectModel(Vehicle.name) private vehicleModel: Model<VehicleDocument>,
    @InjectModel(GpsTrackPoint.name) private trackPointModel: Model<GpsTrackPointDocument>,
    private tenants: TenantsService,
  ) {}

  async onModuleInit() {
    await this.appModel.collection.createIndex({ applicationId: 1 }, { unique: true }).catch(() => undefined);
    await this.appModel.collection.createIndex({ apiKeyHash: 1 }, { unique: true }).catch(() => undefined);
  }

  async createApp(data: { applicationId: string; name: string; notes?: string }) {
    const applicationId = data.applicationId.trim().toLowerCase();
    if (await this.appModel.findOne({ applicationId })) {
      throw new ConflictException('An application with this applicationId already exists');
    }
    const apiKey = this.newApiKey();
    const doc = await this.appModel.create({
      applicationId,
      name: data.name.trim(),
      notes: data.notes?.trim() || undefined,
      status: 'Active',
      apiKeyHash: hashApiKey(apiKey),
      apiKeyPrefix: apiKey.slice(0, 12),
    });
    return { ...this.toApp(doc), apiKey };
  }

  async listApps() {
    const rows = await this.appModel.find().sort({ applicationId: 1 });
    return { items: rows.map((row) => this.toApp(row)) };
  }

  async getApp(applicationId: string) {
    return this.toApp(await this.requireApp(applicationId));
  }

  async updateApp(applicationId: string, data: { name?: string; notes?: string; status?: 'Active' | 'Disabled' }) {
    const doc = await this.requireApp(applicationId);
    if (data.name != null) doc.name = data.name.trim();
    if (data.notes != null) doc.notes = data.notes.trim() || undefined;
    if (data.status) doc.status = data.status;
    await doc.save();
    return this.toApp(doc);
  }

  async rotateKey(applicationId: string) {
    const doc = await this.requireApp(applicationId);
    const apiKey = this.newApiKey();
    doc.apiKeyHash = hashApiKey(apiKey);
    doc.apiKeyPrefix = apiKey.slice(0, 12);
    await doc.save();
    return { ...this.toApp(doc), apiKey };
  }

  async authenticate(apiKey: string) {
    const hash = hashApiKey(apiKey);
    const doc = await this.appModel.findOne({ apiKeyHash: hash });
    if (!doc || !safeEqual(doc.apiKeyHash, hash)) {
      throw new UnauthorizedException('Invalid tracking API key');
    }
    if (doc.status !== 'Active') throw new UnauthorizedException('This tracking application is disabled');
    return { applicationId: doc.applicationId, name: doc.name };
  }

  async replaceTenants(applicationId: string, tenantIds: string[]) {
    await this.requireApp(applicationId);
    const unique = [...new Set(tenantIds.map((id) => id.trim()).filter(Boolean))];
    for (const tenantId of unique) {
      const tenant = await this.tenants.findById(tenantId);
      if (!tenant) throw new BadRequestException(`Unknown tenantId ${tenantId}`);
    }
    await this.tenantMap.deleteMany({ applicationId });
    if (unique.length) {
      await this.tenantMap.insertMany(unique.map((tenantId) => ({ applicationId, tenantId })));
    }
    return this.listTenants(applicationId);
  }

  async listTenants(applicationId: string) {
    await this.requireApp(applicationId);
    const rows = await this.tenantMap.find({ applicationId }).sort({ tenantId: 1 });
    const names = await this.tenants.namesByIds(rows.map((row) => row.tenantId));
    return {
      applicationId,
      items: rows.map((row) => ({
        applicationId,
        tenantId: row.tenantId,
        tenantName: names[row.tenantId] || null,
      })),
    };
  }

  async replaceAssets(applicationId: string, items: { tenantId: string; deviceId: string; vehicleId?: string }[]) {
    await this.requireApp(applicationId);
    const mapped = [];
    for (const item of items) {
      const tenantId = item.tenantId.trim();
      const deviceId = item.deviceId.trim();
      if (!tenantId || !deviceId) throw new BadRequestException('Each mapping needs tenantId and deviceId');
      const tenant = await this.tenants.findById(tenantId);
      if (!tenant) throw new BadRequestException(`Unknown tenantId ${tenantId}`);
      const device = await runWithoutTenant(() => this.deviceModel.findOne({ deviceId }));
      if (!device) throw new BadRequestException(`Unknown deviceId ${deviceId}`);
      let vehicleId = item.vehicleId?.trim() || device.vehicleId;
      if (vehicleId) {
        const vehicle = await runWithoutTenant(() => findByEitherId(this.vehicleModel, vehicleId));
        if (!vehicle) throw new BadRequestException(`Unknown vehicleId ${vehicleId}`);
        vehicleId = vehicle._id.toString();
      }
      mapped.push({ applicationId, tenantId, deviceId, vehicleId });
    }
    await this.assetMap.deleteMany({ applicationId });
    if (mapped.length) await this.assetMap.insertMany(mapped);
    return this.listAssets(applicationId);
  }

  async listAssets(applicationId: string) {
    await this.requireApp(applicationId);
    const rows = await this.assetMap.find({ applicationId }).sort({ tenantId: 1, deviceId: 1 });
    const items = await Promise.all(rows.map((row) => this.enrichAsset(row.applicationId, row.tenantId, row.deviceId, row.vehicleId)));
    return { applicationId, items };
  }

  async liveFleet(applicationId: string, tenantId?: string) {
    const assets = await this.resolveAssets(applicationId, tenantId);
    const items = [];
    for (const asset of assets) {
      items.push(await this.livePayload(applicationId, asset));
    }
    return {
      applicationId,
      tenantId: tenantId || null,
      count: items.length,
      generatedAt: new Date().toISOString(),
      items,
    };
  }

  async liveVehicle(applicationId: string, query: { deviceId?: string; vehicleId?: string }) {
    const asset = await this.requireMappedAsset(applicationId, query);
    return {
      applicationId,
      generatedAt: new Date().toISOString(),
      item: await this.livePayload(applicationId, asset),
    };
  }

  async history(applicationId: string, query: { deviceId?: string; vehicleId?: string; startDateTime: string; endDateTime: string }) {
    const asset = await this.requireMappedAsset(applicationId, query);
    const start = new Date(query.startDateTime);
    const end = new Date(query.endDateTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('startDateTime and endDateTime must be ISO-8601 datetimes');
    }
    if (end <= start) throw new BadRequestException('endDateTime must be after startDateTime');
    const days = (end.getTime() - start.getTime()) / 86400000;
    if (days > HISTORY_MAX_DAYS) {
      throw new BadRequestException(`History window cannot exceed ${HISTORY_MAX_DAYS} days`);
    }
    const filter: Record<string, unknown> = { at: { $gte: start, $lte: end } };
    const or = [];
    if (asset.vehicleId) or.push({ vehicleId: asset.vehicleId });
    if (asset.deviceId) or.push({ deviceId: asset.deviceId });
    filter.$or = or;
    const points = await runWithoutTenant(() =>
      this.trackPointModel.find(filter).sort({ at: 1 }).limit(HISTORY_MAX_POINTS),
    );
    return {
      applicationId,
      deviceId: asset.deviceId,
      vehicleId: asset.vehicleId || null,
      startDateTime: start.toISOString(),
      endDateTime: end.toISOString(),
      count: points.length,
      truncated: points.length >= HISTORY_MAX_POINTS,
      items: points.map((p) => ({
        at: p.at,
        lat: p.lat,
        lng: p.lng,
        speedKmh: p.speedKmh ?? null,
        ignition: p.ignition ?? null,
        deviceId: p.deviceId ?? asset.deviceId,
        vehicleId: p.vehicleId,
      })),
    };
  }

  private async requireApp(applicationId: string) {
    const id = applicationId.trim().toLowerCase();
    const doc = await this.appModel.findOne({ applicationId: id });
    if (!doc) throw new NotFoundException('Tracking application not found');
    return doc;
  }

  private async resolveAssets(applicationId: string, tenantId?: string) {
    await this.requireApp(applicationId);
    const wantedTenant = tenantId?.trim();
    const assetFilter: Record<string, unknown> = { applicationId };
    if (wantedTenant) assetFilter.tenantId = wantedTenant;
    const assets = await this.assetMap.find(assetFilter);
    if (assets.length) {
      return assets.map((row) => ({
        applicationId,
        tenantId: row.tenantId,
        deviceId: row.deviceId,
        vehicleId: row.vehicleId,
      }));
    }
    const tenantFilter: Record<string, unknown> = { applicationId };
    if (wantedTenant) tenantFilter.tenantId = wantedTenant;
    const tenants = await this.tenantMap.find(tenantFilter);
    const tenantIds = tenants.map((row) => row.tenantId);
    if (!tenantIds.length) return [];
    const devices = await runWithoutTenant(() =>
      this.deviceModel.find({ tenantId: { $in: tenantIds } }).sort({ deviceId: 1 }),
    );
    return devices.map((device) => ({
      applicationId,
      tenantId: String((device as { tenantId?: string }).tenantId || ''),
      deviceId: device.deviceId,
      vehicleId: device.vehicleId,
    }));
  }

  private async requireMappedAsset(applicationId: string, query: { deviceId?: string; vehicleId?: string }) {
    const deviceId = query.deviceId?.trim();
    const vehicleId = query.vehicleId?.trim();
    if (!deviceId && !vehicleId) {
      throw new BadRequestException('Provide deviceId or vehicleId');
    }
    const assets = await this.resolveAssets(applicationId);
    const match = assets.find((row) => {
      if (deviceId && row.deviceId === deviceId) return true;
      if (vehicleId && (row.vehicleId === vehicleId || row.deviceId === vehicleId)) return true;
      return false;
    });
    if (match) return match;
    throw new NotFoundException('This device or vehicle is not mapped to the application');
  }

  private async livePayload(
    applicationId: string,
    asset: { tenantId: string; deviceId: string; vehicleId?: string },
  ) {
    const device = await runWithoutTenant(() => this.deviceModel.findOne({ deviceId: asset.deviceId }));
    const vehicle = asset.vehicleId
      ? await runWithoutTenant(() => findByEitherId(this.vehicleModel, asset.vehicleId))
      : device?.vehicleId
        ? await runWithoutTenant(() => findByEitherId(this.vehicleModel, device.vehicleId))
        : null;
    const names = await this.tenants.namesByIds([asset.tenantId]);
    const lat = device?.lastLat ?? vehicle?.lastLat;
    const lng = device?.lastLng ?? vehicle?.lastLng;
    return {
      applicationId,
      tenantId: asset.tenantId,
      tenantName: names[asset.tenantId] || null,
      deviceId: asset.deviceId,
      vehicleId: vehicle?._id.toString() ?? asset.vehicleId ?? null,
      vehicleRegistration: vehicle?.registrationNumber ?? null,
      vehicleType: vehicle?.type ?? null,
      vehicleStatus: vehicle?.status ?? device?.vehicleStatus ?? null,
      displayName: device?.displayName ?? null,
      vendorType: device?.vendorType ?? null,
      imei: device?.imei ?? null,
      connectionStatus: device?.connectionStatus ?? 'Unknown',
      lastSeenAt: device?.lastSeenAt ?? vehicle?.lastTelemetryAt ?? null,
      lastLocation: lat != null && lng != null ? { lat, lng } : null,
      lastPlace: vehicle?.lastPlace ?? null,
      speedKmh: device?.speedKmh ?? null,
      ignition: device?.ignition ?? null,
      batteryPercent: device?.batteryPercent ?? vehicle?.batteryPercent ?? null,
      batteryVoltage: device?.batteryVoltage ?? null,
      odometerKm: device?.odometerKm ?? vehicle?.odometerKm ?? null,
      immobilised: device?.immobilised ?? false,
      vendorStatus: device?.vendorStatus ?? null,
    };
  }

  private async enrichAsset(applicationId: string, tenantId: string, deviceId: string, vehicleId?: string) {
    const live = await this.livePayload(applicationId, { tenantId, deviceId, vehicleId });
    return {
      applicationId,
      tenantId: live.tenantId,
      tenantName: live.tenantName,
      deviceId: live.deviceId,
      vehicleId: live.vehicleId,
      vehicleRegistration: live.vehicleRegistration,
      displayName: live.displayName,
      vendorType: live.vendorType,
      connectionStatus: live.connectionStatus,
    };
  }

  private toApp(doc: TrackingPartnerAppDocument) {
    return {
      applicationId: doc.applicationId,
      name: doc.name,
      notes: doc.notes ?? null,
      status: doc.status,
      apiKeyPrefix: doc.apiKeyPrefix,
      createdAt: (doc as { createdAt?: Date }).createdAt ?? null,
      updatedAt: (doc as { updatedAt?: Date }).updatedAt ?? null,
    };
  }

  private newApiKey() {
    return `mtx_${randomBytes(24).toString('hex')}`;
  }
}

function hashApiKey(key: string) {
  return createHash('sha256').update(key).digest('hex');
}

function safeEqual(stored: string, incoming: string) {
  const a = Buffer.from(stored);
  const b = Buffer.from(incoming);
  return a.length === b.length && timingSafeEqual(a, b);
}
