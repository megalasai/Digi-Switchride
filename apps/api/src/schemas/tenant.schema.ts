import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TenantDocument = HydratedDocument<Tenant>;

@Schema({ timestamps: true, collection: 'tenants' })
export class Tenant {
  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  slug!: string;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ trim: true, lowercase: true })
  contactEmail?: string;

  @Prop({ required: true, enum: ['Active', 'Suspended'], default: 'Active' })
  status!: 'Active' | 'Suspended';

  @Prop({ default: false })
  isDefault!: boolean;

  /** Parent = Fleetel platform operator. Tenant = customer company. */
  @Prop({ required: true, enum: ['Parent', 'Tenant'], default: 'Tenant' })
  kind!: 'Parent' | 'Tenant';

  @Prop({ trim: true })
  notes?: string;
}

export const TenantSchema = SchemaFactory.createForClass(Tenant);
