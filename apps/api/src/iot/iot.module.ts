import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { TenantsModule } from '../tenants/tenants.module';
import { Booking, BookingSchema, Ride, RideSchema } from '../schemas/booking.schema';
import { Customer, CustomerSchema } from '../schemas/customer.schema';
import { IoTDevice, IoTDeviceSchema, RentalHub, RentalHubSchema, Vehicle, VehicleSchema } from '../schemas/fleet.schema';
import { GpsIntegration, GpsIntegrationSchema } from '../schemas/gps-integration.schema';
import { IoTController, IoTInternalController } from './iot.controller';
import { GpsIntegrationService } from './gps-integration.service';
import { IoTService } from './iot.service';
import { TrackingService } from './tracking.service';

@Module({
  imports: [
    AuthModule,
    TenantsModule,
    MongooseModule.forFeature([
      { name: IoTDevice.name, schema: IoTDeviceSchema },
      { name: Vehicle.name, schema: VehicleSchema },
      { name: RentalHub.name, schema: RentalHubSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: Ride.name, schema: RideSchema },
      { name: GpsIntegration.name, schema: GpsIntegrationSchema },
    ]),
  ],
  controllers: [IoTController, IoTInternalController],
  providers: [IoTService, TrackingService, GpsIntegrationService],
  exports: [IoTService],
})
export class IoTModule {}
