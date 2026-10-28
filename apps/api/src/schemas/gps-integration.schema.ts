import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { tenantPlugin } from '../common/tenant.plugin';

export const GPS_PROVIDERS = ['Track360', 'GenericPull'] as const;
export type GpsProvider = (typeof GPS_PROVIDERS)[number];

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
GpsIntegrationSchema.index({ tenantId: 1 }, { unique: true });
