import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RentalHub, RentalHubDocument, Vehicle, VehicleDocument, VehicleEvent, VehicleEventDocument } from '../schemas/fleet.schema';
import { Customer, CustomerDocument } from '../schemas/customer.schema';
import { haversineDistanceKm, normalizeVehicleRegistration, readLatLng, toGeoLocation } from '../common/helpers';
import { findByEitherId, mongoIdCandidates } from '../common/mongo-id';
import { IoTService } from '../iot/iot.service';
import { AuditService, type AuditActor } from '../audit/audit.service';
import { INDIA_VEHICLE_REG_PATTERN, VEHICLE_STATUSES, resolveWheelClass } from '@digi-switchride/shared';
import { applyHubScope, assignedHubIds, hubAllowed } from '../common/hub-scope';
import { runInWriteTenant } from '../common/tenant-write';

const BLOCKED_ASSIGN_STATUSES = ['Maintenance', 'Offline', 'InRide'];

@Injectable()
export class FleetService {
  constructor(
    @InjectModel(RentalHub.name) private hubModel: Model<RentalHubDocument>,
    @InjectModel(Vehicle.name) private vehicleModel: Model<VehicleDocument>,
    @InjectModel(VehicleEvent.name) private eventModel: Model<VehicleEventDocument>,
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    private iotService: IoTService,
    private auditService: AuditService,
  ) {}

  async getNearbyHubs(lat: number, lng: number, radiusKm: number) {
    const hubs = await this.hubModel.find({ status: 'Active' });
    const results = await Promise.all(
      hubs.map(async (hub) => {
        const point = readLatLng(hub.location);
        if (!point) return null;
        const distance = haversineDistanceKm(lat, lng, point.lat, point.lng);
        if (distance > radiusKm) return null;
        const availableVehicles = await this.vehicleModel.countDocuments({ hubId: hub._id.toString(), status: 'Available' });
        return {
          id: hub._id.toString(),
          name: hub.name,
          location: point,
          distanceKm: Math.round(distance * 100) / 100,
          availableVehicles,
          status: hub.status,
        };
      }),
    );
    return results.filter(Boolean).sort((a, b) => a!.distanceKm - b!.distanceKm);
  }

  async getHub(hubId: string, lat?: number, lng?: number) {
    const hub = await findByEitherId(this.hubModel, hubId);
    if (!hub) throw new NotFoundException('Hub not found');
    return this.toHubView(hub, lat, lng);
  }

  async getHubVehicles(hubId: string, status?: string) {
    const filter: Record<string, unknown> = { hubId };
    if (status) filter.status = status;
    const vehicles = await this.vehicleModel.find(filter);
    return vehicles.map((v) => this.toVehicleSummary(v));
  }

  async getVehicle(vehicleId: string) {
    const v = await findByEitherId(this.vehicleModel, vehicleId);
    if (!v) throw new NotFoundException('Vehicle not found');
    return this.toVehicle(v);
  }

  async getVehicleDetail(vehicleId: string) {
    const vehicle = await this.getVehicle(vehicleId);
    const rider = vehicle.assignedRiderId ? await this.customerModel.findById(vehicle.assignedRiderId) : null;
    const hub = await findByEitherId(this.hubModel, vehicle.hubId);
    const events = await this.eventModel.find({ vehicleId }).sort({ createdAt: -1 }).limit(50);
    return {
      vehicle,
      assignedRider: rider
        ? {
            id: rider._id.toString(),
            fullName: rider.fullName,
            phone: rider.phone,
            accountStatus: rider.accountStatus,
            kycStatus: rider.kycStatus,
          }
        : null,
      hub: hub
        ? { id: hub._id.toString(), name: hub.name, address: hub.address, status: hub.status }
        : null,
      events: events.map((e) => ({
        id: e._id.toString(),
        type: e.type,
        summary: e.summary,
        reason: e.reason,
        actorEmail: e.actorEmail,
        metadata: e.metadata,
        createdAt: (e as { createdAt?: Date }).createdAt,
      })),
    };
  }

  async createHub(data: { name: string; location: { lat: number; lng: number }; address: string; capacity: number; operatingHours?: string; geoFenceRadiusM?: number; tenantId?: string }) {
    return runInWriteTenant(data.tenantId, async () => {
      const hub = await this.hubModel.create({
        ...data,
        location: toGeoLocation(data.location.lat, data.location.lng),
      });
      return this.getHub(hub._id.toString());
    });
  }

  async updateHub(hubId: string, data: { name?: string; location?: { lat: number; lng: number }; address?: string; capacity?: number; operatingHours?: string; geoFenceRadiusM?: number; status?: string }) {
    const hub = await findByEitherId(this.hubModel, hubId);
    if (!hub) throw new NotFoundException('Hub not found');

    if (data.name != null) hub.name = data.name;
    if (data.address != null) hub.address = data.address;
    if (data.capacity != null) hub.capacity = data.capacity;
    if (data.operatingHours != null) hub.operatingHours = data.operatingHours;
    if (data.geoFenceRadiusM != null) hub.geoFenceRadiusM = data.geoFenceRadiusM;
    if (data.status != null) hub.status = data.status as typeof hub.status;
    if (data.location) hub.location = toGeoLocation(data.location.lat, data.location.lng);

    await hub.save();
    return this.getHub(hubId);
  }

  async createVehicle(
    data: { registrationNumber: string; type: string; wheelClass?: string; hubId: string; model: string; iotDeviceId?: string; notes?: string; tenantId?: string },
    actor?: AuditActor | null,
  ) {
    return runInWriteTenant(data.tenantId, async () => {
    const registrationNumber = this.requireValidRegistration(data.registrationNumber);
    const existing = await this.vehicleModel.findOne({ registrationNumber });
    if (existing) throw new ConflictException('Vehicle with this registration already exists');
    const hub = await findByEitherId(this.hubModel, data.hubId);
    if (!hub) throw new NotFoundException('Hub not found');
    if (!hubAllowed(data.hubId)) throw new BadRequestException('You can only add vehicles to an assigned hub');

    const { iotDeviceId, tenantId: _tenantId, ...vehicleData } = data;
    const vehicle = await this.vehicleModel.create({
      ...vehicleData,
      registrationNumber,
      wheelClass: resolveWheelClass(data.type, data.wheelClass),
      notes: data.notes,
      statusChangedAt: new Date(),
    });

    if (iotDeviceId) {
      await this.iotService.linkDeviceToVehicle(iotDeviceId, vehicle._id.toString());
    }

    await this.addEvent(vehicle._id.toString(), 'Note', 'Vehicle registered', undefined, actor, { hubId: data.hubId });
    const result = await this.getVehicle(vehicle._id.toString());
    await this.auditService.record({
      actor,
      action: 'vehicle.create',
      entityType: 'Vehicle',
      entityId: result.id,
      after: { registrationNumber: result.registrationNumber, hubId: result.hubId, type: result.type },
    });
    return result;
    });
  }

  async updateVehicle(
    vehicleId: string,
    data: { registrationNumber?: string; type?: string; wheelClass?: string; hubId?: string; model?: string; iotDeviceId?: string | null; status?: string; notes?: string },
    actor?: AuditActor | null,
  ) {
    const vehicle = await this.vehicleModel.findById(vehicleId);
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    const before = this.toVehicle(vehicle);

    if (data.registrationNumber != null) {
      const registrationNumber = this.requireValidRegistration(data.registrationNumber);
      const taken = await this.vehicleModel.findOne({ registrationNumber, _id: { $ne: vehicle._id } });
      if (taken) throw new ConflictException('Vehicle with this registration already exists');
      vehicle.registrationNumber = registrationNumber;
    }
    if (data.type != null) vehicle.type = data.type as typeof vehicle.type;
    if (data.wheelClass != null || data.type != null) {
      vehicle.wheelClass = resolveWheelClass(data.type ?? vehicle.type, data.wheelClass ?? vehicle.wheelClass);
    }
    if (data.model != null) vehicle.set('model', data.model);
    if (data.notes != null) vehicle.notes = data.notes;
    if (data.hubId != null && data.hubId !== vehicle.hubId) {
      const hub = await findByEitherId(this.hubModel, data.hubId);
      if (!hub) throw new NotFoundException('Hub not found');
      const previousHub = vehicle.hubId;
      vehicle.hubId = data.hubId;
      await this.addEvent(vehicleId, 'HubMove', `Moved from hub ${previousHub} to ${data.hubId}`, undefined, actor, {
        from: previousHub,
        to: data.hubId,
      });
    }
    if (data.status != null && data.status !== vehicle.status) {
      this.assertStatus(data.status);
      const previous = vehicle.status;
      vehicle.status = data.status as typeof vehicle.status;
      vehicle.statusChangedAt = new Date();
      await this.addEvent(vehicleId, 'StatusChange', `Status ${previous} → ${data.status}`, undefined, actor);
    }

    const newDeviceId = data.iotDeviceId === null ? undefined : data.iotDeviceId;
    const oldDeviceId = vehicle.iotDeviceId;

    if (data.iotDeviceId !== undefined && newDeviceId !== oldDeviceId) {
      if (oldDeviceId) await this.iotService.unlinkDevice(oldDeviceId);
      if (newDeviceId) await this.iotService.linkDeviceToVehicle(newDeviceId, vehicleId);
      vehicle.iotDeviceId = newDeviceId;
    }

    await vehicle.save();
    const after = await this.getVehicle(vehicleId);
    await this.auditService.record({
      actor,
      action: 'vehicle.update',
      entityType: 'Vehicle',
      entityId: vehicleId,
      before: { registrationNumber: before.registrationNumber, hubId: before.hubId, status: before.status, notes: before.notes },
      after: { registrationNumber: after.registrationNumber, hubId: after.hubId, status: after.status, notes: after.notes },
    });
    return after;
  }

  async listAllHubs() {
    const filter: Record<string, unknown> = {};
    const hubs = assignedHubIds();
    if (hubs) filter._id = { $in: hubs.flatMap((id) => mongoIdCandidates(id)) };
    const items = await this.hubModel.find(filter);
    return Promise.all(items.map((h) => this.toHubView(h)));
  }

  private async toHubView(hub: RentalHubDocument, lat?: number, lng?: number) {
    const point = readLatLng(hub.location) ?? { lat: 21.1458, lng: 79.0882 };
    const dist = lat != null && lng != null ? haversineDistanceKm(lat, lng, point.lat, point.lng) : 0;
    const hubId = hub._id.toString();
    const availableVehicles = await this.vehicleModel.countDocuments({ hubId, status: 'Available' });
    return {
      id: hubId,
      name: hub.name,
      location: point,
      distanceKm: Math.round(dist * 100) / 100,
      availableVehicles,
      status: hub.status,
      address: hub.address,
      capacity: hub.capacity,
      operatingHours: hub.operatingHours,
      geoFenceRadiusM: hub.geoFenceRadiusM,
      tenantId: (hub as { tenantId?: string }).tenantId,
    };
  }

  async listVehicles(params: {
    status?: string;
    hubId?: string;
    search?: string;
    availability?: string;
    page?: number;
    pageSize?: number;
  }) {
    const filter: Record<string, unknown> = {};
    if (params.status) filter.status = params.status;
    if (params.hubId) filter.hubId = params.hubId;
    applyHubScope(filter);
    if (params.search) {
      filter.registrationNumber = { $regex: normalizeVehicleRegistration(params.search), $options: 'i' };
    }
    if (params.availability === 'available') {
      filter.status = 'Available';
      filter.assignedRiderId = { $in: [null, undefined] };
    } else if (params.availability === 'assigned') {
      filter.assignedRiderId = { $exists: true, $nin: [null, ''] };
    } else if (params.availability === 'unassigned') {
      filter.$or = [{ assignedRiderId: { $exists: false } }, { assignedRiderId: null }, { assignedRiderId: '' }];
    }

    const page = params.page ?? 1;
    const pageSize = Math.min(params.pageSize ?? 50, 100);
    const totalCount = await this.vehicleModel.countDocuments(filter);
    const vehicles = await this.vehicleModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize);
    const riderIds = vehicles.map((v) => v.assignedRiderId).filter(Boolean) as string[];
    const riders = riderIds.length
      ? await this.customerModel.find({ _id: { $in: riderIds } })
      : [];
    const riderMap = Object.fromEntries(riders.map((r) => [r._id.toString(), r]));
    return {
      items: vehicles.map((v) => {
        const rider = v.assignedRiderId ? riderMap[v.assignedRiderId] : undefined;
        return {
          ...this.toVehicle(v),
          assignedRiderName: rider?.fullName,
          assignedRiderPhone: rider?.phone,
        };
      }),
      page,
      pageSize,
      totalCount,
    };
  }

  async listAllVehicles() {
    const result = await this.listVehicles({ page: 1, pageSize: 100 });
    return result.items;
  }

  async updateVehicleStatus(vehicleId: string, status: string, reason?: string, actor?: AuditActor | null) {
    this.assertStatus(status);
    const vehicle = await this.vehicleModel.findById(vehicleId);
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    if ((status === 'Maintenance' || status === 'Offline') && !reason?.trim()) {
      throw new BadRequestException('Reason is required when moving a vehicle to Maintenance or Offline');
    }
    const previous = vehicle.status;
    vehicle.status = status as typeof vehicle.status;
    vehicle.statusChangedAt = new Date();
    await vehicle.save();
    await this.addEvent(vehicleId, 'StatusChange', `Status ${previous} → ${status}`, reason, actor);
    await this.auditService.record({
      actor,
      action: 'vehicle.status',
      entityType: 'Vehicle',
      entityId: vehicleId,
      before: { status: previous },
      after: { status, reason },
    });
    return this.toVehicle(vehicle);
  }

  async assignVehicle(vehicleId: string, riderId: string, options: { override?: boolean; reason?: string }, actor?: AuditActor | null) {
    const vehicle = await this.vehicleModel.findById(vehicleId);
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    const rider = await this.customerModel.findById(riderId);
    if (!rider) throw new NotFoundException('Rider not found');
    if (rider.accountStatus !== 'Active') {
      throw new BadRequestException('Only active riders can be assigned a vehicle');
    }
    if (vehicle.assignedRiderId && vehicle.assignedRiderId !== riderId) {
      throw new BadRequestException('Vehicle is already assigned. Unassign it first.');
    }
    if (rider.assignedVehicleId && rider.assignedVehicleId !== vehicleId) {
      throw new BadRequestException('Rider already has an assigned vehicle. Unassign it first.');
    }
    if (BLOCKED_ASSIGN_STATUSES.includes(vehicle.status) && !options.override) {
      throw new BadRequestException(`Cannot assign a vehicle in ${vehicle.status} without override and reason`);
    }
    if (BLOCKED_ASSIGN_STATUSES.includes(vehicle.status) && options.override && !options.reason?.trim()) {
      throw new BadRequestException('Override assignment requires a reason');
    }

    vehicle.assignedRiderId = riderId;
    if (vehicle.status === 'Available') vehicle.status = 'Reserved';
    await vehicle.save();
    rider.assignedVehicleId = vehicleId;
    await rider.save();

    await this.addEvent(
      vehicleId,
      'Assignment',
      `Assigned to ${rider.fullName ?? rider.phone}`,
      options.reason,
      actor,
      { riderId, override: Boolean(options.override) },
    );
    await this.auditService.record({
      actor,
      action: 'vehicle.assign',
      entityType: 'Vehicle',
      entityId: vehicleId,
      after: { riderId, registrationNumber: vehicle.registrationNumber, override: Boolean(options.override), reason: options.reason },
    });
    return this.getVehicleDetail(vehicleId);
  }

  async unassignVehicle(vehicleId: string, reason?: string, actor?: AuditActor | null) {
    const vehicle = await this.vehicleModel.findById(vehicleId);
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    const previousRiderId = vehicle.assignedRiderId;
    if (!previousRiderId) throw new BadRequestException('Vehicle is not assigned');
    if (vehicle.status === 'InRide') {
      throw new BadRequestException('Cannot unassign a vehicle that is currently in a ride');
    }

    vehicle.assignedRiderId = undefined;
    if (vehicle.status === 'Reserved') vehicle.status = 'Available';
    await vehicle.save();
    await this.customerModel.findByIdAndUpdate(previousRiderId, { $unset: { assignedVehicleId: 1 } });
    await this.addEvent(vehicleId, 'Unassignment', 'Vehicle unassigned from rider', reason, actor, { riderId: previousRiderId });
    await this.auditService.record({
      actor,
      action: 'vehicle.unassign',
      entityType: 'Vehicle',
      entityId: vehicleId,
      before: { riderId: previousRiderId },
      after: { reason },
    });
    return this.getVehicleDetail(vehicleId);
  }

  private async addEvent(
    vehicleId: string,
    type: string,
    summary: string,
    reason?: string,
    actor?: AuditActor | null,
    metadata?: Record<string, unknown>,
  ) {
    await this.eventModel.create({
      vehicleId,
      type,
      summary,
      reason,
      actorId: actor?.actorId,
      actorEmail: actor?.actorEmail,
      metadata,
    });
  }

  private requireValidRegistration(value: string) {
    const registrationNumber = normalizeVehicleRegistration(value);
    if (!INDIA_VEHICLE_REG_PATTERN.test(registrationNumber)) {
      throw new BadRequestException('Enter a valid Indian registration (e.g. KA01AB1234)');
    }
    return registrationNumber;
  }

  private assertStatus(status: string) {
    if (!VEHICLE_STATUSES.includes(status as (typeof VEHICLE_STATUSES)[number])) {
      throw new BadRequestException('Invalid vehicle status');
    }
  }

  private toVehicleSummary(v: VehicleDocument) {
    return {
      id: v._id.toString(),
      registrationNumber: v.registrationNumber,
      type: v.type,
      wheelClass: resolveWheelClass(v.type, v.wheelClass),
      status: v.status,
      batteryPercent: v.batteryPercent,
      model: v.model,
    };
  }

  private toVehicle(v: VehicleDocument) {
    return {
      ...this.toVehicleSummary(v),
      hubId: v.hubId,
      odometerKm: v.odometerKm,
      iotDeviceId: v.iotDeviceId,
      lastLat: v.lastLat,
      lastLng: v.lastLng,
      lastTelemetryAt: v.lastTelemetryAt,
      lastPlace: v.lastPlace,
      lastPlaceKind: v.lastPlaceKind,
      lastHubId: v.lastHubId,
      locationTrail: (v.locationTrail ?? []).map((p) => ({ lat: p.lat, lng: p.lng, at: p.at })),
      pricingTier: v.pricingTier,
      assignedRiderId: v.assignedRiderId,
      notes: v.notes,
      statusChangedAt: v.statusChangedAt,
      tenantId: (v as { tenantId?: string }).tenantId,
    };
  }
}
