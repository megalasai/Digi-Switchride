import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TrackingPartnerAppDocument = HydratedDocument<TrackingPartnerApp>;
export type TrackingPartnerTenantDocument = HydratedDocument<TrackingPartnerTenant>;
export type TrackingPartnerAssetDocument = HydratedDocument<TrackingPartnerAsset>;

@Schema({ timestamps: true, collection: 'tracking_partner_apps' })
export class TrackingPartnerApp {
  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  applicationId!: string;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ trim: true })
  notes?: string;

  @Prop({ required: true, enum: ['Active', 'Disabled'], default: 'Active' })
  status!: 'Active' | 'Disabled';

  @Prop()
  apiKeyHash?: string;

  @Prop()
  apiKeyPrefix?: string;
}

export type TrackingAccessTokenDocument = HydratedDocument<TrackingAccessToken>;

@Schema({ timestamps: true, collection: 'tracking_access_tokens' })
export class TrackingAccessToken {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, unique: true })
  tokenHash!: string;

  @Prop({ required: true })
  tokenPrefix!: string;

  @Prop({ required: true, enum: ['Active', 'Disabled'], default: 'Active' })
  status!: 'Active' | 'Disabled';
}

@Schema({ timestamps: true, collection: 'tracking_partner_tenants' })
export class TrackingPartnerTenant {
  @Prop({ required: true, trim: true, lowercase: true })
  applicationId!: string;

  @Prop({ required: true, type: String })
  tenantId!: string;
}

@Schema({ timestamps: true, collection: 'tracking_partner_assets' })
export class TrackingPartnerAsset {
  @Prop({ required: true, trim: true, lowercase: true })
  applicationId!: string;

  @Prop({ required: true, type: String })
  tenantId!: string;

  @Prop({ required: true, trim: true })
  deviceId!: string;

  @Prop({ type: String })
  vehicleId?: string;
}

export const TrackingPartnerAppSchema = SchemaFactory.createForClass(TrackingPartnerApp);
export const TrackingPartnerTenantSchema = SchemaFactory.createForClass(TrackingPartnerTenant);
export const TrackingPartnerAssetSchema = SchemaFactory.createForClass(TrackingPartnerAsset);
export const TrackingAccessTokenSchema = SchemaFactory.createForClass(TrackingAccessToken);
TrackingAccessTokenSchema.index({ tokenHash: 1 }, { unique: true });

TrackingPartnerTenantSchema.index({ applicationId: 1, tenantId: 1 }, { unique: true });
TrackingPartnerAssetSchema.index({ applicationId: 1, deviceId: 1 }, { unique: true });
TrackingPartnerAssetSchema.index({ applicationId: 1, tenantId: 1, vehicleId: 1 });
