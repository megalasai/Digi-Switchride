import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import { IoTDevice, IoTDeviceDocument, RentalHub, RentalHubDocument, Vehicle, VehicleDocument } from '../schemas/fleet.schema';
import { appendTrail, resolveHubOrPlace } from './location-lookup';
import { wheelClassFromType, type VehicleType } from '@digi-switchride/shared';
import { toGeoLocation } from '../common/helpers';
import { parseTrack360Payload, track360AuthHeader, track360PullUrl, type Track360Device } from './track360';
import { applyHubScope, assignedHubIds } from '../common/hub-scope';
import { runInWriteTenant } from '../common/tenant-write';
import { currentTenantId, runWithoutTenant, tenantAls } from '../common/tenant-als';
import { tenantIdClause } from '../common/tenant.plugin';
import { findByEitherId, mongoIdCandidates, persistById } from '../common/mongo-id';
import { TenantsService } from '../tenants/tenants.service';
import { readSecret } from '../config/secrets';
import { DEFAULT_TRACK360_URL, GpsIntegrationService, type GpsPullConfig } from './gps-integration.service';

@Injectable()
export class IoTService {
  private readonly logger = new Logger(IoTService.name);
  lastSync: { at: string; ok: boolean; synced: number; message: string } | null = null;

  constructor(
    @InjectModel(IoTDevice.name) private deviceModel: Model<IoTDeviceDocument>,
    @InjectModel(Vehicle.name) private vehicleModel: Model<VehicleDocument>,
    @InjectModel(RentalHub.name) private hubModel: Model<RentalHubDocument>,
    private config: ConfigService,
    private tenants: TenantsService,
    private gps: GpsIntegrationService,
  ) {}

  async registerDevice(deviceId: string, vendorType = 'Simulator', vehicleId?: string, tenantId?: string) {
    return runInWriteTenant(tenantId, async () => {
    const existing = await this.deviceModel.findOne({ deviceId });
    if (existing) throw new ConflictException(`Device ${deviceId} already exists`);

    await this.deviceModel.create({
      deviceId,
      vendorType,
      connectionStatus: 'Unknown',
      imei: deviceId,
    });
    if (vehicleId) {
      await this.linkDeviceToVehicle(deviceId, vehicleId, vendorType);
    } else {
      await this.ensureVehicleForDevice({
        deviceId,
        imei: deviceId,
        name: deviceId,
        lat: null,
        lng: null,
        vendorStatus: 'Unknown',
        type: vendorType === 'Track360' ? 'car' : 'scooter',
      });
    }
    return { deviceId, vendorType, vehicleId: vehicleId ?? null };
    });
  }

  async sendCommand(deviceId: string, command: string) {
    await this.deviceModel.findOneAndUpdate(
      { deviceId },
      { deviceId, vendorType: 'Simulator' },
      { upsert: true, setDefaultsOnInsert: true },
    );
    console.log(`[IoT] Command '${command}' sent to device ${deviceId}`);
    return { commandId: randomUUID(), status: 'Sent' };
  }

  async listDevices(allTenants = false) {
    if (allTenants) {
      return runWithoutTenant(async () => this.listScopedDevices());
    }
    return this.listScopedDevices();
  }

  private async listScopedDevices() {
    const tenantId = currentTenantId();
    const usernames = tenantId ? await this.gps.usernamesForTenant(tenantId) : [];
    const devices = tenantId
      ? await runWithoutTenant(() =>
          this.deviceModel
            .find({
              $or: [
                tenantIdClause(tenantId),
                ...(usernames.length ? [{ gpsUsername: { $in: usernames } }] : []),
              ],
            })
            .sort({ deviceId: 1 }),
        )
      : await this.deviceModel.find().sort({ deviceId: 1 });
    const hubs = assignedHubIds();
    const allowedVehicleIds = hubs
      ? new Set(
          (await this.vehicleModel.find(applyHubScope({}))).map((v) => v._id.toString()),
        )
      : null;
    const rows = await Promise.all(
      devices.map(async (d) => {
        const vehicle = await this.resolveVehicle(d.deviceId).catch(() => null);
        if (allowedVehicleIds && vehicle && !allowedVehicleIds.has(vehicle._id.toString())) return null;
        return {
          id: d.deviceId,
          vehicleId: vehicle?._id.toString() ?? d.vehicleId,
          vehicleRegistration: vehicle?.registrationNumber,
          vendorType: d.vendorType,
          connectionStatus: d.connectionStatus,
          lastSeenAt: d.lastSeenAt,
          batteryPercent: d.batteryPercent,
          odometerKm: d.odometerKm,
          lastLocation: d.lastLat != null && d.lastLng != null ? { lat: d.lastLat, lng: d.lastLng } : null,
          lastPlace: vehicle?.lastPlace,
          displayName: d.displayName,
          imei: d.imei,
          externalId: d.externalId,
          speedKmh: d.speedKmh,
          ignition: d.ignition,
          vendorStatus: d.vendorStatus,
          vehicleStatus: d.vehicleStatus,
          tenantId: (d as { tenantId?: string }).tenantId ?? (vehicle as { tenantId?: string } | null)?.tenantId,
        };
      }),
    );
    return rows.filter((row): row is NonNullable<typeof row> => row != null);
  }

  async syncTrack360(opts?: { tenantId?: string; allTenants?: boolean }) {
    const scoped = opts?.allTenants ? null : opts?.tenantId || currentTenantId();
    let configs = await this.gps.listEnabledForSync(scoped);
    if (!configs.length && !scoped) {
      const fallback = this.envGpsFallback();
      if (fallback) configs = [fallback];
    }
    if (!configs.length) {
      const message = scoped
        ? 'No GPS integration is enabled for this company. Add Track360 username and password under Integrations.'
        : 'No tenant GPS integrations are enabled.';
      this.lastSync = { at: new Date().toISOString(), ok: false, synced: 0, message };
      return { synced: 0, linked: 0, created: 0, message };
    }

    let synced = 0;
    let linked = 0;
    let created = 0;
    let ok = true;
    const parts: string[] = [];
    for (const config of configs) {
      try {
        const result = await tenantAls.run({ tenantId: config.tenantId, hubIds: null, skip: false }, () =>
          this.pullGps(config),
        );
        synced += result.synced;
        linked += result.linked;
        created += result.created;
        parts.push(result.message);
        await this.gps.recordSync(config.tenantId, { ok: true, synced: result.synced, message: result.message });
      } catch (error) {
        ok = false;
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`GPS sync failed for ${config.tenantId}: ${message}`);
        parts.push(message);
        await this.gps.recordSync(config.tenantId, { ok: false, synced: 0, message });
      }
    }
    const message = parts.join(' | ');
    this.lastSync = { at: new Date().toISOString(), ok, synced, message };
    return { synced, linked, created, message };
  }

  private envGpsFallback(): GpsPullConfig | null {
    const username = readSecret(this.config, 'TRACK360_USERNAME', '');
    const password = readSecret(this.config, 'TRACK360_PASSWORD', '');
    const tenantId = this.tenants.defaultTenantId();
    if (!username || !password || !tenantId) return null;
    return {
      tenantId,
      provider: 'Track360',
      username,
      password,
      pullUrl: this.config.get<string>('TRACK360_PULL_URL', DEFAULT_TRACK360_URL) ?? DEFAULT_TRACK360_URL,
    };
  }

  private async pullGps(config: GpsPullConfig) {
    await this.rehomeByGpsUsername(config.username, config.tenantId);
    const url = track360PullUrl(config.pullUrl, config.username, config.password);
    const res = await fetch(url, {
      signal: AbortSignal.timeout(20000),
      headers: {
        Accept: 'application/json',
        Authorization: track360AuthHeader(config.username, config.password),
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`${config.provider} pull failed (${res.status})${body ? `: ${body.slice(0, 180)}` : ''}`);
    }
    const payload = (await res.json()) as unknown;
    const devices = parseTrack360Payload(payload);
    await this.stampPulledDevices(config.tenantId, config.username, devices);
    if (!devices.length) {
      this.logger.warn(`${config.provider} returned no device rows for tenant ${config.tenantId}`);
    }
    let linked = 0;
    let created = 0;
    let failed = 0;
    for (const device of devices) {
      try {
        const result = await this.upsertTrack360Device(
          { ...device, vendorType: config.provider },
          config.tenantId,
          config.username,
        );
        if (result.linked) linked += 1;
        if (result.created) created += 1;
        const gps = toCoord(device.lat, device.lng);
        if (gps) {
          await this.updateTelemetry(device.deviceId, gps.lat, gps.lng, device.batteryPercent, device.odometerKm, {
            speedKmh: device.speedKmh,
            ignition: device.ignition,
          });
        }
      } catch (error) {
        failed += 1;
        this.logger.warn(
          `${config.provider} device ${device.deviceId} skipped: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
    this.logger.log(
      `${config.provider} sync ${config.tenantId}: ${devices.length} devices, ${created} vehicles created, ${linked} linked, ${failed} skipped`,
    );
    return {
      synced: devices.length,
      linked,
      created,
      message: `Imported ${devices.length} ${config.provider} devices (${created} new vehicles${failed ? `, ${failed} skipped` : ''})`,
    };
  }

  async provisionAllDevices() {
    const devices = await runWithoutTenant(() => this.deviceModel.find());
    let created = 0;
    let linked = 0;
    for (const device of devices) {
      const tenantId = String((device as { tenantId?: string }).tenantId ?? '');
      if (!tenantId) continue;
      try {
        const result = await tenantAls.run({ tenantId, hubIds: null, skip: false }, () =>
          this.ensureVehicleForDevice({
            deviceId: device.deviceId,
            imei: device.imei ?? device.deviceId,
            name: device.displayName || '',
            lat: device.lastLat ?? null,
            lng: device.lastLng ?? null,
            vendorStatus: device.vendorStatus ?? device.connectionStatus ?? 'Unknown',
            type: undefined,
            vendorType: device.vendorType,
          }),
        );
        if (result.created) created += 1;
        if (result.linked) linked += 1;
      } catch (error) {
        this.logger.warn(
          `Provision ${device.deviceId} skipped: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
    if (created) this.logger.log(`Provisioned ${created} vehicles from ${devices.length} IoT devices`);
    return { devices: devices.length, created, linked };
  }

  async ingestLiveTelemetry(body: {
    deviceId: string;
    lat: number;
    lng: number;
    batteryPercent?: number;
    odometerKm?: number;
    speedKmh?: number;
    ignition?: string;
    name?: string;
    vendorType?: string;
  }) {
    const deviceId = await this.resolveDeviceKey(body.deviceId);
    const vendorType = body.vendorType ?? (body.name ? 'Track360' : 'Simulator');
    await this.deviceModel.findOneAndUpdate(
      { deviceId },
      {
        $set: {
          imei: String(body.deviceId).replace(/\D/g, '') || body.deviceId,
          ...(body.name ? { displayName: body.name } : {}),
        },
        $setOnInsert: { deviceId, vendorType },
      },
      { upsert: true, setDefaultsOnInsert: true },
    );
    return this.updateTelemetry(deviceId, body.lat, body.lng, body.batteryPercent, body.odometerKm, {
      speedKmh: body.speedKmh,
      ignition: body.ignition,
    });
  }

  private async resolveDeviceKey(raw: string): Promise<string> {
    const digits = String(raw ?? '').replace(/\D/g, '');
    if (!digits) return raw;
    const keys = new Set([raw, digits]);
    if (digits.length === 16 && digits.startsWith('0')) keys.add(digits.slice(1));
    if (digits.length === 15) keys.add(`0${digits}`);
    const found = await this.deviceModel.findOne({
      $or: [{ deviceId: { $in: [...keys] } }, { imei: { $in: [...keys] } }],
    });
    return found?.deviceId ?? digits;
  }

  /** Establish bidirectional mapping: device ↔ vehicle */
  async linkDeviceToVehicle(deviceId: string, vehicleId: string, vendorType = 'Simulator') {
    const vehicle = await findByEitherId(this.vehicleModel, vehicleId);
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const deviceTaken = await this.vehicleModel.findOne({
      iotDeviceId: deviceId,
      _id: { $ne: vehicleId },
    });
    if (deviceTaken) {
      throw new ConflictException(`Device ${deviceId} is already linked to vehicle ${deviceTaken.registrationNumber}`);
    }

    const vehicleTaken = await this.deviceModel.findOne({
      vehicleId,
      deviceId: { $ne: deviceId },
    });
    if (vehicleTaken) {
      throw new ConflictException(`Vehicle is already linked to device ${vehicleTaken.deviceId}`);
    }

    if (vehicle.iotDeviceId && vehicle.iotDeviceId !== deviceId) {
      await this.deviceModel.updateOne({ deviceId: vehicle.iotDeviceId }, { $unset: { vehicleId: 1 } });
    }

    await this.deviceModel.findOneAndUpdate(
      { deviceId },
      { deviceId, vehicleId, vendorType },
      { upsert: true, setDefaultsOnInsert: true },
    );

    vehicle.iotDeviceId = deviceId;
    if (vehicle.status === 'Offline') {
      vehicle.status = 'Available';
    }
    await persistById(this.vehicleModel.collection, vehicle._id.toString(), {
      iotDeviceId: deviceId,
      status: vehicle.status,
    });

    return {
      deviceId,
      vehicleId,
      vehicleRegistration: vehicle.registrationNumber,
    };
  }

  async updateDevice(deviceId: string, data: { vendorType?: string; vehicleId?: string | null }) {
    const device = await this.deviceModel.findOne({ deviceId });
    if (!device) throw new NotFoundException('Device not found');

    if (data.vendorType != null) device.vendorType = data.vendorType;

    if (data.vehicleId !== undefined) {
      if (data.vehicleId) {
        await this.linkDeviceToVehicle(deviceId, data.vehicleId, device.vendorType);
      } else {
        await this.unlinkDevice(deviceId);
      }
    } else if (data.vendorType != null) {
      await device.save();
    }

    return this.listDevices().then((items) => items.find((d) => d.id === deviceId));
  }

  async unlinkDevice(deviceId: string) {
    const device = await this.deviceModel.findOne({ deviceId });
    if (!device) throw new NotFoundException('Device not found');

    await this.vehicleModel.updateMany({ iotDeviceId: deviceId }, { $unset: { iotDeviceId: 1 } });
    if (device.vehicleId) {
      await this.vehicleModel.updateOne({ _id: device.vehicleId, iotDeviceId: deviceId }, { $unset: { iotDeviceId: 1 } });
    }
    await this.deviceModel.updateOne({ deviceId }, { $unset: { vehicleId: 1 } });

    return { deviceId, unlinked: true };
  }

  async deleteDevice(deviceId: string) {
    const device = await this.deviceModel.findOne({ deviceId });
    if (!device) throw new NotFoundException('Device not found');
    await this.unlinkDevice(deviceId).catch(() => undefined);
    await this.deviceModel.deleteOne({ deviceId });
    return { deleted: true, deviceId };
  }

  async updateTelemetry(
    deviceId: string,
    lat: number,
    lng: number,
    battery?: number,
    odometer?: number,
    extras?: { speedKmh?: number; ignition?: string },
  ) {
    const now = new Date();

    const device = await this.upsertDeviceTelemetry(deviceId, {
        lastLat: lat,
        lastLng: lng,
        lastSeenAt: now,
        connectionStatus: 'Connected',
        ...(battery != null ? { batteryPercent: battery } : {}),
        ...(odometer != null ? { odometerKm: odometer } : {}),
        ...(extras?.speedKmh != null ? { speedKmh: extras.speedKmh } : {}),
        ...(extras?.ignition != null ? { ignition: extras.ignition } : {}),
    });
    if (!device) {
      return { deviceId, vehicleId: null, updated: false, message: 'Device upsert failed' };
    }

    let vehicle = await this.resolveVehicle(deviceId);
    if (!vehicle) {
      await this.ensureVehicleForDevice({
        deviceId,
        imei: device.imei ?? deviceId,
        name: device.displayName || '',
        lat,
        lng,
        vendorStatus: device.vendorStatus ?? 'Unknown',
        type: undefined,
        vendorType: device.vendorType,
      });
      vehicle = await this.resolveVehicle(deviceId);
    }
    if (!vehicle) {
      return { deviceId, vehicleId: null, updated: false, message: 'No vehicle mapped to this device' };
    }

    if (device.vehicleId !== vehicle._id.toString()) {
      const taken = await this.deviceModel.findOne({
        vehicleId: vehicle._id.toString(),
        deviceId: { $ne: deviceId },
      });
      if (!taken) {
        device.vehicleId = vehicle._id.toString();
        try {
          await device.save();
        } catch (error) {
          if (!isMongoDuplicate(error)) throw error;
        }
      }
    }
    if (vehicle.iotDeviceId !== deviceId) {
      const taken = await this.vehicleModel.findOne({ iotDeviceId: deviceId, _id: { $ne: vehicle._id } });
      if (!taken) vehicle.iotDeviceId = deviceId;
    }

    if (battery != null) vehicle.batteryPercent = battery;
    if (odometer != null) vehicle.odometerKm = odometer;
    vehicle.lastLat = lat;
    vehicle.lastLng = lng;
    vehicle.lastTelemetryAt = now;
    if (extras?.speedKmh != null) vehicle.speedKmh = extras.speedKmh;
    if (extras?.ignition != null) vehicle.ignition = extras.ignition;
    vehicle.locationTrail = appendTrail(vehicle.locationTrail, lat, lng, now);
    if (vehicle.status === 'Offline') {
      vehicle.status = 'Available';
    }
    const place = await resolveHubOrPlace(this.config, this.hubModel, lat, lng);
    vehicle.lastPlace = place.lastPlace;
    vehicle.lastPlaceKind = place.lastPlaceKind;
    vehicle.lastHubId = place.lastHubId ?? undefined;
    await persistById(this.vehicleModel.collection, vehicle._id.toString(), {
      batteryPercent: vehicle.batteryPercent,
      odometerKm: vehicle.odometerKm,
      lastLat: vehicle.lastLat,
      lastLng: vehicle.lastLng,
      lastTelemetryAt: vehicle.lastTelemetryAt,
      speedKmh: vehicle.speedKmh,
      ignition: vehicle.ignition,
      locationTrail: vehicle.locationTrail,
      status: vehicle.status,
      lastPlace: vehicle.lastPlace,
      lastPlaceKind: vehicle.lastPlaceKind,
      lastHubId: vehicle.lastHubId,
      iotDeviceId: vehicle.iotDeviceId,
      ...(currentTenantId() ? { tenantId: currentTenantId() } : {}),
    });

    return {
      deviceId,
      vehicleId: vehicle._id.toString(),
      vehicleRegistration: vehicle.registrationNumber,
      batteryPercent: battery,
      lastPlace: vehicle.lastPlace ?? null,
      lastPlaceKind: place.lastPlaceKind,
      trailPoints: vehicle.locationTrail?.length ?? 0,
      odometerKm: odometer,
      updated: true,
    };
  }

  private async resolveVehicle(deviceId: string): Promise<VehicleDocument | null> {
    const device = await this.deviceModel.findOne({ deviceId });
    if (device?.vehicleId) {
      const byId = await findByEitherId(this.vehicleModel, device.vehicleId);
      if (byId) return byId;
    }
    return this.vehicleModel.findOne({ iotDeviceId: deviceId });
  }

  private async upsertDeviceTelemetry(deviceId: string, patch: Record<string, unknown>) {
    const tenantId = currentTenantId();
    const filter = tenantId ? { deviceId, tenantId } : { deviceId };
    const update = { deviceId, ...patch, ...(tenantId ? { tenantId } : {}) };
    try {
      return await this.deviceModel.findOneAndUpdate(filter, update, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      });
    } catch (error) {
      if (!isMongoDuplicate(error)) throw error;
      return this.deviceModel.findOneAndUpdate(filter, patch, { new: true });
    }
  }

  private async upsertTrack360Device(
    row: Track360Device & { vendorType?: string },
    tenantId: string,
    gpsUsername?: string,
  ) {
    const vendorType = row.vendorType || 'Track360';
    await this.rehomeDeviceToTenant(row, tenantId);
    const connectionStatus =
      row.vendorStatus.toLowerCase() === 'online'
        ? 'Connected'
        : row.vendorStatus.toLowerCase() === 'offline'
          ? 'Disconnected'
          : 'Unknown';
    const fields = {
      deviceId: row.deviceId,
      tenantId,
      vendorType,
      imei: row.imei || row.deviceId,
      displayName: row.name || row.vehicleNumber || undefined,
      externalId: row.vendorDeviceId || row.deviceId,
      speedKmh: row.speedKmh,
      ignition: row.ignition,
      vendorStatus: row.vendorStatus,
      vehicleStatus: row.vehicleStatus,
      connectionStatus,
      lastSeenAt: row.lastSeenAt,
      lastLat: row.lat ?? undefined,
      lastLng: row.lng ?? undefined,
      batteryPercent: row.batteryPercent,
      odometerKm: row.odometerKm,
      ...(gpsUsername ? { gpsUsername } : {}),
    };
    await tenantAls.run({ tenantId, hubIds: null, skip: false }, async () => {
      await this.deviceModel.findOneAndUpdate(
        { deviceId: row.deviceId, tenantId },
        { $set: fields },
        { upsert: true, setDefaultsOnInsert: true },
      );
    });
    return tenantAls.run({ tenantId, hubIds: null, skip: false }, () => this.ensureVehicleForDevice({ ...row, vendorType }));
  }

  private async stampPulledDevices(tenantId: string, username: string, rows: Track360Device[]) {
    const keys = [...new Set(rows.flatMap((row) => deviceKeys(row.deviceId, row.imei)))];
    if (!keys.length) return;
    const owner = String(tenantId);
    await this.deviceModel.collection.updateMany(
      { $or: [{ deviceId: { $in: keys } }, { imei: { $in: keys } }] },
      { $set: { tenantId: owner, gpsUsername: username } },
    );
    await this.vehicleModel.collection.updateMany(
      { iotDeviceId: { $in: keys } },
      { $set: { tenantId: owner } },
    );
  }

  private async rehomeByGpsUsername(username: string, tenantId: string) {
    const key = username.trim();
    if (!key) return;
    const devices = await runWithoutTenant(() =>
      this.deviceModel.find({ gpsUsername: { $regex: new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }),
    );
    for (const device of devices) {
      await this.rehomeDeviceToTenant(
        { deviceId: device.deviceId, imei: device.imei ?? device.deviceId, name: '', lat: null, lng: null, vendorStatus: 'Unknown' },
        tenantId,
      );
    }
  }

  private async rehomeDeviceToTenant(row: Track360Device, tenantId: string) {
    const keys = deviceKeys(row.deviceId, row.imei);
    await runWithoutTenant(async () => {
      const existing = await this.deviceModel.findOne({
        $or: [{ deviceId: { $in: keys } }, { imei: { $in: keys } }],
      });
      if (!existing) return;
      const prev = String((existing as { tenantId?: string }).tenantId ?? '');
      if (prev === tenantId) return;
      await this.deviceModel.collection.updateOne({ _id: existing._id }, { $set: { tenantId } });
      const vehicleFilter: Record<string, unknown>[] = [{ iotDeviceId: existing.deviceId }, { iotDeviceId: row.deviceId }];
      if (existing.vehicleId) {
        for (const id of mongoIdCandidates(existing.vehicleId)) {
          vehicleFilter.push({ _id: id });
        }
      }
      await this.vehicleModel.collection.updateMany({ $or: vehicleFilter }, { $set: { tenantId } });
      this.logger.log(
        `Reassigned GPS device ${existing.deviceId} from tenant ${prev || 'none'} to ${tenantId}`,
      );
    });
  }

  private async ensureVehicleForDevice(
    row: Pick<Track360Device, 'deviceId' | 'imei' | 'name' | 'lat' | 'lng' | 'vendorStatus' | 'type' | 'vehicleNumber'> & {
      vendorType?: string;
    },
  ): Promise<{ linked: boolean; created: boolean }> {
    const tenantId = currentTenantId();
    const name = vehicleDisplayName(row.vehicleNumber || row.name, row.deviceId);
    const vendorType = row.vendorType || 'Track360';
    const already = (await this.vehicleModel.findOne({ iotDeviceId: row.deviceId }))
      ?? (await this.deviceModel.findOne({ deviceId: row.deviceId }).then(async (device) => (
        device?.vehicleId ? findByEitherId(this.vehicleModel, device.vehicleId) : null
      )));

    if (already) {
      const preferred = (row.vehicleNumber || row.name || '').replace(/\s+/g, ' ').trim();
      const locked = already.get('registrationLocked') === true;
      const placeholder = isPlaceholderRegistration(already.registrationNumber, row.deviceId, row.imei);
      if (preferred && !locked && placeholder) await this.applyDeviceNameAndFix(already, preferred, row);
      else {
        const gps = toCoord(row.lat, row.lng);
        if (gps) {
          already.lastLat = gps.lat;
          already.lastLng = gps.lng;
          await persistById(this.vehicleModel.collection, already._id.toString(), {
            lastLat: gps.lat,
            lastLng: gps.lng,
          });
        }
      }
      try {
        await this.linkDeviceToVehicle(row.deviceId, already._id.toString(), vendorType);
      } catch {
        /* already linked */
      }
      return { linked: true, created: false };
    }

    const byName = await this.vehicleModel.findOne({ registrationNumber: name });
    if (byName && (!byName.iotDeviceId || byName.iotDeviceId === row.deviceId)) {
      if (byName.get('registrationLocked') !== true) await this.applyDeviceNameAndFix(byName, name, row);
      try {
        await this.linkDeviceToVehicle(row.deviceId, byName._id.toString(), vendorType);
        return { linked: true, created: false };
      } catch {
        /* create a dedicated vehicle below */
      }
    }

    const registration = byName ? await this.uniqueFallbackRegistration(name, row.deviceId) : name;
    const hub = await this.ensureImportHub(row.lat, row.lng);
    const type = vehicleTypeFromTrack360(row.type);
    try {
      const vehicle = await this.vehicleModel.create({
        registrationNumber: registration,
        type,
        wheelClass: wheelClassFromType(type),
        model: name,
        hubId: hub._id.toString(),
        status: row.vendorStatus.toLowerCase() === 'offline' ? 'Offline' : 'Available',
        iotDeviceId: row.deviceId,
        lastLat: toCoord(row.lat, row.lng)?.lat,
        lastLng: toCoord(row.lat, row.lng)?.lng,
        notes: 'Created from IoT device',
        ...(tenantId ? { tenantId } : {}),
      });
      try {
        await this.linkDeviceToVehicle(row.deviceId, vehicle._id.toString(), vendorType);
      } catch {
        /* mapping may already exist */
      }
      return { linked: true, created: true };
    } catch (error) {
      if (!isMongoDuplicate(error)) throw error;
      const existing = await this.vehicleModel.findOne({
        $or: [{ registrationNumber: registration }, { iotDeviceId: row.deviceId }],
      });
      if (existing) {
        try {
          await this.linkDeviceToVehicle(row.deviceId, existing._id.toString(), vendorType);
        } catch {
          /* already linked */
        }
        return { linked: true, created: false };
      }
      throw error;
    }
  }

  private async applyDeviceNameAndFix(
    vehicle: VehicleDocument,
    name: string,
    row: Pick<Track360Device, 'lat' | 'lng'>,
  ) {
    if (vehicle.registrationNumber !== name) {
      const clash = await this.vehicleModel.findOne({ registrationNumber: name, _id: { $ne: vehicle._id } });
      if (!clash) vehicle.registrationNumber = name;
    }
    if (vehicle.get('model') !== name) vehicle.set('model', name);
    const gps = toCoord(row.lat, row.lng);
    if (gps) {
      vehicle.lastLat = gps.lat;
      vehicle.lastLng = gps.lng;
    }
    await persistById(this.vehicleModel.collection, vehicle._id.toString(), {
      registrationNumber: vehicle.registrationNumber,
      model: vehicle.get('model'),
      lastLat: vehicle.lastLat,
      lastLng: vehicle.lastLng,
      ...(currentTenantId() ? { tenantId: currentTenantId() } : {}),
    });
  }

  private async uniqueFallbackRegistration(name: string, deviceId: string): Promise<string> {
    const suffix = deviceId.replace(/\D/g, '').slice(-4) || deviceId.slice(-4);
    const base = `${name} ${suffix}`.trim();
    for (let i = 0; i < 50; i += 1) {
      const candidate = i === 0 ? base : `${name} ${suffix}-${i}`;
      const taken = await this.vehicleModel.findOne({ registrationNumber: candidate });
      if (!taken) return candidate;
    }
    return `${name} ${Date.now() % 10000}`;
  }

  private async ensureImportHub(lat?: number | null, lng?: number | null) {
    const existing = await this.hubModel.findOne({ $or: [{ name: 'Track360 Fleet' }, { status: 'Active' }] }).sort({ name: 1 });
    if (existing) return existing;
    return this.hubModel.create({
      name: 'Track360 Fleet',
      address: 'Imported from Track360 telematics',
      location: toGeoLocation(lat ?? 12.9716, lng ?? 77.5946),
      capacity: 500,
      geoFenceRadiusM: 250,
      status: 'Active',
      ...(currentTenantId() ? { tenantId: currentTenantId() } : {}),
    });
  }
}

function deviceKeys(...values: (string | undefined)[]) {
  const keys = new Set<string>();
  for (const value of values) {
    const raw = String(value ?? '').trim();
    if (!raw) continue;
    keys.add(raw);
    const digits = raw.replace(/\D/g, '');
    if (digits) {
      keys.add(digits);
      if (digits.length === 16 && digits.startsWith('0')) keys.add(digits.slice(1));
      if (digits.length === 15) keys.add(`0${digits}`);
    }
  }
  return [...keys];
}

function isMongoDuplicate(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: number }).code === 11000);
}

function isPlaceholderRegistration(current: string | undefined, deviceId: string, imei?: string) {
  const value = (current ?? '').replace(/[\s-]/g, '').toUpperCase();
  if (!value) return true;
  const keys = deviceKeys(deviceId, imei).map((key) => key.replace(/[\s-]/g, '').toUpperCase());
  return keys.includes(value);
}

function vehicleDisplayName(name: string | undefined, deviceId: string) {
  const trimmed = (name ?? '').replace(/\s+/g, ' ').trim();
  return trimmed || deviceId;
}

function toCoord(lat?: number | null, lng?: number | null): { lat: number; lng: number } | null {
  if (lat == null || lng == null) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

function vehicleTypeFromTrack360(type?: string): VehicleType {
  const t = (type ?? '').toLowerCase();
  if (t.includes('rick') || t.includes('auto')) return 'ERickshaw';
  if (t.includes('scoot') || t.includes('bike') || t.includes('cycle')) return 'EScooter';
  return 'ECar';
}
