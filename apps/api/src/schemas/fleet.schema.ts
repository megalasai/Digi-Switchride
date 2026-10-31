import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { HubStatus, VehicleStatus, VehicleType, WheelClass } from '@digi-switchride/shared';
import { tenantPlugin } from '../common/tenant.plugin';

export type RentalHubDocument = HydratedDocument<RentalHub>;

@Schema({ _id: false })
export class GeoLocation {
  @Prop({ required: true, enum: ['Point'], default: 'Point' })
  type!: string;

  @Prop({ type: [Number], required: true })
  coordinates!: [number, number]; // [lng, lat]
}

@Schema({ _id: false })
export class LocationPing {
  @Prop({ required: true })
  lat!: number;

  @Prop({ required: true })
  lng!: number;

  @Prop({ required: true })
  at!: Date;
}

export const LocationPingSchema = SchemaFactory.createForClass(LocationPing);

@Schema({ timestamps: true, collection: 'rental_hubs' })
export class RentalHub {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true })
  address!: string;

  @Prop({ type: GeoLocation, required: true })
  location!: GeoLocation;

  @Prop({ required: true, default: 20 })
  capacity!: number;

  @Prop()
  operatingHours?: string;

  @Prop({ default: 100 })
  geoFenceRadiusM!: number;

  @Prop({ required: true, enum: ['Active', 'Inactive', 'Maintenance'], default: 'Active' })
  status!: HubStatus;
}

export const RentalHubSchema = SchemaFactory.createForClass(RentalHub);
RentalHubSchema.index({ location: '2dsphere' });
RentalHubSchema.plugin(tenantPlugin);

export type VehicleDocument = HydratedDocument<Vehicle>;

@Schema({ timestamps: true, collection: 'vehicles' })
export class Vehicle {
  @Prop({ required: true, trim: true })
  registrationNumber!: string;

  @Prop({ required: true, enum: ['EScooter', 'EBike', 'ERickshaw', 'ECar'] })
  type!: VehicleType;

  @Prop({ enum: ['TwoWheeler', 'ThreeWheeler', 'FourWheeler'] })
  wheelClass?: WheelClass;

  @Prop({ required: true, trim: true })
  model!: string;

  @Prop({ required: true, type: String })
  hubId!: string;

  @Prop({ required: true, enum: ['Available', 'Reserved', 'InRide', 'Maintenance', 'Offline'], default: 'Available' })
  status!: VehicleStatus;

  @Prop({ default: 100 })
  batteryPercent!: number;

  @Prop({ default: 0 })
  odometerKm!: number;

  @Prop()
  iotDeviceId?: string;

  @Prop()
  lastLat?: number;

  @Prop()
  lastLng?: number;

  @Prop()
  lastTelemetryAt?: Date;

  @Prop()
  lastPlace?: string;

  @Prop({ enum: ['Hub', 'Location'] })
  lastPlaceKind?: string;

  @Prop({ type: String })
  lastHubId?: string;

  @Prop({ type: [LocationPingSchema], default: [] })
  locationTrail?: LocationPing[];

  @Prop()
  pricingTier?: string;

  @Prop({ type: String })
  assignedRiderId?: string;

  @Prop({ trim: true })
  notes?: string;

  @Prop()
  statusChangedAt?: Date;

  @Prop()
  speedKmh?: number;

  @Prop()
  ignition?: string;

  @Prop({ default: false })
  registrationLocked?: boolean;

  @Prop({ default: false })
  immobilised?: boolean;

  @Prop()
  immobilisedAt?: Date;
}

export const VehicleSchema = SchemaFactory.createForClass(Vehicle);
VehicleSchema.plugin(tenantPlugin);
VehicleSchema.index({ hubId: 1, status: 1 });
VehicleSchema.index({ tenantId: 1, iotDeviceId: 1 }, { sparse: true, unique: true });
VehicleSchema.index({ assignedRiderId: 1 }, { sparse: true });
VehicleSchema.index({ tenantId: 1, registrationNumber: 1 }, { unique: true });

export type VehicleEventDocument = HydratedDocument<VehicleEvent>;

@Schema({ timestamps: true, collection: 'vehicle_events' })
export class VehicleEvent {
  @Prop({ required: true, type: String })
  vehicleId!: string;

  @Prop({ required: true, enum: ['StatusChange', 'Assignment', 'Unassignment', 'HubMove', 'Note'] })
  type!: string;

  @Prop({ required: true })
  summary!: string;

  @Prop()
  reason?: string;

  @Prop()
  actorId?: string;

  @Prop()
  actorEmail?: string;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;
}

export const VehicleEventSchema = SchemaFactory.createForClass(VehicleEvent);
VehicleEventSchema.index({ vehicleId: 1, createdAt: -1 });
VehicleEventSchema.plugin(tenantPlugin);

export type IoTDeviceDocument = HydratedDocument<IoTDevice>;

@Schema({ timestamps: true, collection: 'iot_devices' })
export class IoTDevice {
  @Prop({ required: true })
  deviceId!: string;

  @Prop()
  vehicleId?: string;

  @Prop({ required: true, default: 'Simulator' })
  vendorType!: string;

  @Prop({ required: true, enum: ['Connected', 'Disconnected', 'Unknown'], default: 'Unknown' })
  connectionStatus!: string;

  @Prop()
  lastSeenAt?: Date;

  @Prop()
  batteryPercent?: number;

  @Prop()
  lastLat?: number;

  @Prop()
  lastLng?: number;

  @Prop()
  odometerKm?: number;

  @Prop()
  imei?: string;

  @Prop()
  displayName?: string;

  @Prop()
  externalId?: string;

  @Prop()
  speedKmh?: number;

  @Prop()
  ignition?: string;

  @Prop()
  vendorStatus?: string;

  @Prop()
  vehicleStatus?: string;

  @Prop({ trim: true })
  gpsUsername?: string;

  @Prop()
  pendingCommand?: string;

  @Prop()
  lastCommandAt?: Date;

  @Prop({ default: false })
  immobilised?: boolean;
}

export type GpsTrackPointDocument = HydratedDocument<GpsTrackPoint>;

@Schema({ timestamps: true, collection: 'gps_track_points' })
export class GpsTrackPoint {
  @Prop({ required: true, type: String })
  vehicleId!: string;

  @Prop()
  deviceId?: string;

  @Prop({ required: true })
  lat!: number;

  @Prop({ required: true })
  lng!: number;

  @Prop()
  speedKmh?: number;

  @Prop()
  ignition?: string;

  @Prop({ required: true })
  at!: Date;
}

export const GpsTrackPointSchema = SchemaFactory.createForClass(GpsTrackPoint);
GpsTrackPointSchema.plugin(tenantPlugin);
GpsTrackPointSchema.index({ vehicleId: 1, at: -1 });
GpsTrackPointSchema.index({ at: 1 }, { expireAfterSeconds: 14 * 24 * 60 * 60 });

export const IoTDeviceSchema = SchemaFactory.createForClass(IoTDevice);
IoTDeviceSchema.index({ vehicleId: 1 }, { sparse: true });
IoTDeviceSchema.index({ tenantId: 1, deviceId: 1 }, { unique: true });
IoTDeviceSchema.plugin(tenantPlugin);
