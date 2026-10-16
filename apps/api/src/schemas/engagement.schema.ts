import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { tenantPlugin } from '../common/tenant.plugin';

@Schema({ timestamps: true, collection: 'charging_stations' })
export class ChargingStation {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, trim: true })
  address!: string;

  @Prop({ required: true, default: 4 })
  chargerCount!: number;

  @Prop()
  lat?: number;

  @Prop()
  lng?: number;

  @Prop()
  operatingHours?: string;

  @Prop({ required: true, enum: ['Active', 'Inactive', 'Maintenance'], default: 'Active' })
  status!: string;

  @Prop({ type: String })
  hubId?: string;
}

export type ChargingStationDocument = HydratedDocument<ChargingStation>;
export const ChargingStationSchema = SchemaFactory.createForClass(ChargingStation);
ChargingStationSchema.plugin(tenantPlugin);

@Schema({ timestamps: true, collection: 'notifications' })
export class AppNotification {
  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ required: true, trim: true })
  body!: string;

  @Prop({ required: true, enum: ['AllRiders', 'ActiveRiders'], default: 'AllRiders' })
  audience!: string;

  @Prop({ required: true, enum: ['InApp'], default: 'InApp' })
  channel!: string;

  @Prop({ default: 'Queued' })
  status!: string;

  @Prop()
  sentAt?: Date;

  @Prop()
  createdBy?: string;
}

export type AppNotificationDocument = HydratedDocument<AppNotification>;
export const AppNotificationSchema = SchemaFactory.createForClass(AppNotification);
AppNotificationSchema.plugin(tenantPlugin);

@Schema({ timestamps: true, collection: 'feedback' })
export class Feedback {
  @Prop({ required: true, type: String })
  riderId!: string;

  @Prop({ required: true, min: 1, max: 5 })
  rating!: number;

  @Prop({ required: true, trim: true })
  comment!: string;

  @Prop({ enum: ['Ride', 'Service', 'App', 'Vehicle'], default: 'App' })
  category!: string;
}

export type FeedbackDocument = HydratedDocument<Feedback>;
export const FeedbackSchema = SchemaFactory.createForClass(Feedback);
FeedbackSchema.plugin(tenantPlugin);
FeedbackSchema.index({ riderId: 1 });

@Schema({ timestamps: true, collection: 'agreements' })
export class Agreement {
  @Prop({ required: true, type: String })
  riderId!: string;

  @Prop({ required: true, enum: ['RentalAgreement', 'ServiceWaiver', 'KYCConsent'] })
  type!: string;

  @Prop({ required: true, trim: true })
  content!: string;

  @Prop()
  documentUrl?: string;

  @Prop({ required: true, enum: ['Draft', 'Issued', 'Signed'], default: 'Issued' })
  status!: string;

  @Prop()
  signedAt?: Date;
}

export type AgreementDocument = HydratedDocument<Agreement>;
export const AgreementSchema = SchemaFactory.createForClass(Agreement);
AgreementSchema.plugin(tenantPlugin);
AgreementSchema.index({ riderId: 1 });
