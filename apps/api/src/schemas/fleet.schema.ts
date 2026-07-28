import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { HubStatus, VehicleStatus, VehicleType } from '@digi-switchride/shared';

export type RentalHubDocument = HydratedDocument<RentalHub>;

@Schema({ _id: false })
export class GeoLocation {
  @Prop({ required: true, enum: ['Point'], default: 'Point' })
  type!: string;

  @Prop({ type: [Number], required: true })
  coordinates!: [number, number]; // [lng, lat]
}

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

export type VehicleDocument = HydratedDocument<Vehicle>;

@Schema({ timestamps: true, collection: 'vehicles' })
export class Vehicle {
  @Prop({ required: true, unique: true, trim: true })
  registrationNumber!: string;

  @Prop({ required: true, enum: ['EScooter', 'EBike', 'ERickshaw'] })
  type!: VehicleType;

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
  pricingTier?: string;
}

export const VehicleSchema = SchemaFactory.createForClass(Vehicle);
VehicleSchema.index({ hubId: 1, status: 1 });

export type IoTDeviceDocument = HydratedDocument<IoTDevice>;

@Schema({ timestamps: true, collection: 'iot_devices' })
export class IoTDevice {
  @Prop({ required: true, unique: true })
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
}

export const IoTDeviceSchema = SchemaFactory.createForClass(IoTDevice);
