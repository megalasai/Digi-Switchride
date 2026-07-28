import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RentalHub, RentalHubDocument, Vehicle, VehicleDocument } from '../schemas/fleet.schema';
import { haversineDistanceKm, toGeoLocation } from '../common/helpers';

@Injectable()
export class FleetService {
  constructor(
    @InjectModel(RentalHub.name) private hubModel: Model<RentalHubDocument>,
    @InjectModel(Vehicle.name) private vehicleModel: Model<VehicleDocument>,
  ) {}

  async getNearbyHubs(lat: number, lng: number, radiusKm: number) {
    const hubs = await this.hubModel.find({ status: 'Active' });
    const results = await Promise.all(
      hubs.map(async (hub) => {
        const [hubLng, hubLat] = hub.location.coordinates;
        const distance = haversineDistanceKm(lat, lng, hubLat, hubLng);
        if (distance > radiusKm) return null;
        const availableVehicles = await this.vehicleModel.countDocuments({ hubId: hub._id.toString(), status: 'Available' });
        return {
          id: hub._id.toString(),
          name: hub.name,
          location: { lat: hubLat, lng: hubLng },
          distanceKm: Math.round(distance * 100) / 100,
          availableVehicles,
          status: hub.status,
        };
      }),
    );
    return results.filter(Boolean).sort((a, b) => a!.distanceKm - b!.distanceKm);
  }

  async getHub(hubId: string, lat?: number, lng?: number) {
    const hub = await this.hubModel.findById(hubId);
    if (!hub) throw new NotFoundException('Hub not found');
    const [hubLng, hubLat] = hub.location.coordinates;
    const dist = lat != null && lng != null ? haversineDistanceKm(lat, lng, hubLat, hubLng) : 0;
    const availableVehicles = await this.vehicleModel.countDocuments({ hubId, status: 'Available' });
    return {
      id: hub._id.toString(),
      name: hub.name,
      location: { lat: hubLat, lng: hubLng },
      distanceKm: Math.round(dist * 100) / 100,
      availableVehicles,
      status: hub.status,
      address: hub.address,
      capacity: hub.capacity,
      operatingHours: hub.operatingHours,
      geoFenceRadiusM: hub.geoFenceRadiusM,
    };
  }

  async getHubVehicles(hubId: string, status?: string) {
    const filter: Record<string, unknown> = { hubId };
    if (status) filter.status = status;
    const vehicles = await this.vehicleModel.find(filter);
    return vehicles.map((v) => this.toVehicleSummary(v));
  }

  async getVehicle(vehicleId: string) {
    const v = await this.vehicleModel.findById(vehicleId);
    if (!v) throw new NotFoundException('Vehicle not found');
    return this.toVehicle(v);
  }

  async createHub(data: { name: string; location: { lat: number; lng: number }; address: string; capacity: number; operatingHours?: string; geoFenceRadiusM?: number }) {
    const hub = await this.hubModel.create({
      ...data,
      location: toGeoLocation(data.location.lat, data.location.lng),
    });
    return this.getHub(hub._id.toString());
  }

  async createVehicle(data: { registrationNumber: string; type: string; hubId: string; model: string; iotDeviceId?: string }) {
    const vehicle = await this.vehicleModel.create(data);
    return this.toVehicle(vehicle);
  }

  async listAllHubs() {
    const hubs = await this.hubModel.find();
    return Promise.all(hubs.map((h) => this.getHub(h._id.toString())));
  }

  async listAllVehicles() {
    const vehicles = await this.vehicleModel.find();
    return vehicles.map((v) => this.toVehicle(v));
  }

  private toVehicleSummary(v: VehicleDocument) {
    return {
      id: v._id.toString(),
      registrationNumber: v.registrationNumber,
      type: v.type,
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
      pricingTier: v.pricingTier,
    };
  }
}
