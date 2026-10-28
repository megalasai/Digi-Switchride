import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { tenantPlugin } from '../common/tenant.plugin';

export const GPS_PROVIDERS = ['Track360', 'GenericPull', 'Traccar', 'PushIngest'] as const;
export type GpsProvider = (typeof GPS_PROVIDERS)[number];
export const GPS_AUTH_TYPES = ['basic', 'query', 'bearer', 'header', 'none'] as const;
export type GpsAuthType = (typeof GPS_AUTH_TYPES)[number];

export type GpsIntegrationDocument = HydratedDocument<GpsIntegration>;

@Schema({ timestamps: true, collection: 'gps_integrations' })
export class GpsIntegration {
  @Prop({ required: true })
  tenantId!: string;

  @Prop({ required: true, enum: GPS_PROVIDERS, default: 'Track360' })
  provider!: GpsProvider;

  @Prop({ default: false })
  enabled!: boolean;

  @Prop({ trim: true })
  displayName?: string;

  @Prop({ trim: true })
  username?: string;

  @Prop({ trim: true })
  password?: string;

  @Prop({ trim: true })
  pullUrl?: string;

  @Prop({ enum: GPS_AUTH_TYPES, default: 'basic' })
  authType?: GpsAuthType;

  @Prop({ trim: true })
  apiToken?: string;

  @Prop({ trim: true })
  headerName?: string;

  @Prop({ trim: true })
  ingestKey?: string;

  @Prop()
  lastSyncAt?: Date;

  @Prop()
  lastSyncOk?: boolean;

  @Prop()
  lastSyncMessage?: string;

  @Prop()
  lastSyncedCount?: number;
}

export const GpsIntegrationSchema = SchemaFactory.createForClass(GpsIntegration);
GpsIntegrationSchema.plugin(tenantPlugin);
GpsIntegrationSchema.index({ tenantId: 1, provider: 1 }, { unique: true });
GpsIntegrationSchema.index({ ingestKey: 1 }, { unique: true, sparse: true });
