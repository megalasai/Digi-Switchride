import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { tenantPlugin } from '../common/tenant.plugin';

export type BrandingDocument = HydratedDocument<Branding>;

@Schema({ timestamps: true, collection: 'branding' })
export class Branding {
  @Prop({ required: true, default: 'default' })
  key!: string;

  @Prop({ default: 'Fleetel-Switchride' })
  productName!: string;

  @Prop()
  optionalLogoMime?: string;

  @Prop({ type: Buffer })
  optionalLogo?: Buffer;

  @Prop({ default: false })
  optionalLogoCleared?: boolean;
}

export const BrandingSchema = SchemaFactory.createForClass(Branding);
BrandingSchema.plugin(tenantPlugin);
BrandingSchema.index({ tenantId: 1, key: 1 }, { unique: true });
