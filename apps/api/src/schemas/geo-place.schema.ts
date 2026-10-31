import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { tenantPlugin } from '../common/tenant.plugin';

export type GeoPlaceDocument = HydratedDocument<GeoPlace>;

@Schema({ timestamps: true, collection: 'geo_places' })
export class GeoPlace {
  @Prop({ required: true, enum: ['geofence', 'poi'] })
  kind!: 'geofence' | 'poi';

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true })
  lat!: number;

  @Prop({ required: true })
  lng!: number;

  @Prop()
  radiusM?: number;

  @Prop({ trim: true })
  notes?: string;
}

export const GeoPlaceSchema = SchemaFactory.createForClass(GeoPlace);
GeoPlaceSchema.plugin(tenantPlugin);
GeoPlaceSchema.index({ kind: 1, name: 1 });
