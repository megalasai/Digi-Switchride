import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { TenantsModule } from '../tenants/tenants.module';
import { GpsTrackPoint, GpsTrackPointSchema, IoTDevice, IoTDeviceSchema, Vehicle, VehicleSchema } from '../schemas/fleet.schema';
import {
  TrackingPartnerApp,
  TrackingPartnerAppSchema,
  TrackingPartnerAsset,
  TrackingPartnerAssetSchema,
  TrackingPartnerTenant,
  TrackingPartnerTenantSchema,
} from '../schemas/tracking-partner.schema';
import { TrackingPartnerAdminController, TrackingPartnerController, TrackingPartnerRegisterController } from './tracking-partner.controller';
import { TrackingPartnerGuard } from './tracking-partner.guard';
import { TrackingPartnerService } from './tracking-partner.service';

@Module({
  imports: [
    AuthModule,
    TenantsModule,
    MongooseModule.forFeature([
      { name: TrackingPartnerApp.name, schema: TrackingPartnerAppSchema },
      { name: TrackingPartnerTenant.name, schema: TrackingPartnerTenantSchema },
      { name: TrackingPartnerAsset.name, schema: TrackingPartnerAssetSchema },
      { name: IoTDevice.name, schema: IoTDeviceSchema },
      { name: Vehicle.name, schema: VehicleSchema },
      { name: GpsTrackPoint.name, schema: GpsTrackPointSchema },
    ]),
  ],
  controllers: [TrackingPartnerAdminController, TrackingPartnerRegisterController, TrackingPartnerController],
  providers: [TrackingPartnerService, TrackingPartnerGuard],
})
export class TrackingPartnerModule {}
