import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { Model } from 'mongoose';
import { findByEitherId } from '../common/mongo-id';
import { runWithoutTenant } from '../common/tenant-als';
import { normalizeSecret, readSecret } from '../config/secrets';
import { IoTDevice, IoTDeviceDocument, Vehicle, VehicleDocument, GpsTrackPoint, GpsTrackPointDocument } from '../schemas/fleet.schema';
import {
  TrackingAccessToken,
  TrackingAccessTokenDocument,
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
  private readonly logger = new Logger(TrackingPartnerService.name);

  constructor(
    @InjectModel(TrackingPartnerApp.name) private appModel: Model<TrackingPartnerAppDocument>,
    @InjectModel(TrackingPartnerTenant.name) private tenantMap: Model<TrackingPartnerTenantDocument>,
    @InjectModel(TrackingPartnerAsset.name) private assetMap: Model<TrackingPartnerAssetDocument>,
    @InjectModel(IoTDevice.name) private deviceModel: Model<IoTDeviceDocument>,
    @InjectModel(Vehicle.name) private vehicleModel: Model<VehicleDocument>,
    @InjectModel(GpsTrackPoint.name) private trackPointModel: Model<GpsTrackPointDocument>,
    @InjectModel(TrackingAccessToken.name) private tokenModel: Model<TrackingAccessTokenDocument>,
    private tenants: TenantsService,
    private config: ConfigService,
  ) {}

  async onModuleInit() {
    await this.appModel.collection.createIndex({ applicationId: 1 }, { unique: true }).catch(() => undefined);
    await this.tokenModel.collection.createIndex({ tokenHash: 1 }, { unique: true }).catch(() => undefined);
    const envKey = readSecret(this.config, 'TRACKING_API_KEY', '');
    if (envKey) this.logger.log(`Shared tracking API key is configured (${envKey.length} chars)`);
    else this.logger.warn('TRACKING_API_KEY is empty on this instance; partner calls will return 401 until it is set');
    await this.ensureApp('schoolapplication', 'School tracking');
  }

  async createApp(data: { applicationId: string; name: string; notes?: string; tenantIds?: string[] }) {
    const applicationId = data.applicationId.trim().toLowerCase();
    if (await this.appModel.findOne({ applicationId })) {
      throw new ConflictException('An application with this applicationId already exists. Use your API key to update tenant and device mappings.');
    }
    const doc = await this.appModel.create({
      applicationId,
      name: data.name.trim(),
      notes: data.notes?.trim() || undefined,
      status: 'Active',
    });
    if (data.tenantIds?.length) {
      await this.replaceTenants(applicationId, data.tenantIds);
    }
    const tenants = await this.listTenants(applicationId);
    return { ...this.toApp(doc), tenants: tenants.items };
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

  async rotateKey(_applicationId: string) {
    return this.issueAccessToken('rotated');
  }

  async issueAccessToken(name: string) {
    const apiKey = this.newApiKey();
    const doc = await this.tokenModel.create({
      name: name.trim() || 'customer',
      tokenHash: hashApiKey(apiKey),
      tokenPrefix: apiKey.slice(0, 12),
      status: 'Active',
    });
    return {
      name: doc.name,
      tokenPrefix: doc.tokenPrefix,
      status: doc.status,
      apiKey,
    };
  }

  async listAccessTokens() {
    const rows = await this.tokenModel.find().sort({ createdAt: -1 });
    return {
      items: rows.map((row) => ({
        name: row.name,
        tokenPrefix: row.tokenPrefix,
        status: row.status,
        createdAt: (row as { createdAt?: Date }).createdAt ?? null,
      })),
    };
  }

  async authenticate(apiKey: string) {
    const incoming = normalizeSecret(apiKey);
    const hash = hashApiKey(incoming);
    const envKey = readSecret(this.config, 'TRACKING_API_KEY', '');
    if (envKey && (safeEqual(envKey, incoming) || safeEqual(hashApiKey(envKey), hash))) {
      return { applicationId: '*', name: 'shared' };
    }
    const token = await this.tokenModel.findOne({ tokenHash: hash, status: 'Active' });
    if (token && safeEqual(token.tokenHash, hash)) {
      return { applicationId: '*', name: token.name };
    }
    const legacy = await this.appModel.findOne({ apiKeyHash: hash });
    if (legacy?.apiKeyHash && safeEqual(legacy.apiKeyHash, hash)) {
      if (legacy.status !== 'Active') throw new UnauthorizedException('This tracking application is disabled');
      return { applicationId: legacy.applicationId, name: legacy.name };
    }
    throw new UnauthorizedException('Invalid tracking API key');
  }

  async replaceTenants(applicationId: string, tenantIds: string[]) {
    await this.ensureApp(applicationId);
    const unique = [...new Set(await Promise.all(tenantIds.map((id) => this.resolveTenantRef(id))))];
    await this.tenantMap.deleteMany({ applicationId });
    if (unique.length) {
      await this.tenantMap.insertMany(unique.map((tenantId) => ({ applicationId, tenantId })));
    }
    return this.listTenants(applicationId);
  }

  async listTenants(applicationId: string) {
    await this.ensureApp(applicationId);
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
    await this.ensureApp(applicationId);
    const mapped = [];
    for (const item of items) {
      const tenantId = await this.resolveTenantRef(item.tenantId);
      const deviceId = item.deviceId.trim();
      if (!deviceId) throw new BadRequestException('Each mapping needs tenantId and deviceId');
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
    await this.ensureApp(applicationId);
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

  private async ensureApp(applicationId: string, name?: string) {
    const id = applicationId.trim().toLowerCase();
    const existing = await this.appModel.findOne({ applicationId: id });
    if (existing) return existing;
    try {
      return await this.appModel.create({
        applicationId: id,
        name: (name || id).trim() || id,
        status: 'Active',
      });
    } catch {
      const raced = await this.appModel.findOne({ applicationId: id });
      if (raced) return raced;
      throw new NotFoundException('Tracking application not found');
    }
  }

  private async resolveAssets(applicationId: string, tenantId?: string) {
    await this.ensureApp(applicationId);
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

  private async resolveTenantRef(ref: string) {
    const value = ref.trim();
    if (!value) throw new BadRequestException('tenantId is required');
    try {
      const tenant = await this.tenants.findById(value);
      return tenant._id.toString();
    } catch {
      const bySlug = await this.tenants.findBySlug(value);
      if (bySlug) return bySlug._id.toString();
      throw new BadRequestException(`Unknown tenantId ${value}`);
    }
  }

  private toApp(doc: TrackingPartnerAppDocument) {
    return {
      applicationId: doc.applicationId,
      name: doc.name,
      notes: doc.notes ?? null,
      status: doc.status,
      apiKeyPrefix: doc.apiKeyPrefix ?? null,
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
