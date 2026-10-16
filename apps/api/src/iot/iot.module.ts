import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { Booking, BookingSchema, Ride, RideSchema } from '../schemas/booking.schema';
import { Customer, CustomerSchema } from '../schemas/customer.schema';
import { IoTDevice, IoTDeviceSchema, RentalHub, RentalHubSchema, Vehicle, VehicleSchema } from '../schemas/fleet.schema';
import { IoTController, IoTInternalController } from './iot.controller';
import { IoTService } from './iot.service';
import { TrackingService } from './tracking.service';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: IoTDevice.name, schema: IoTDeviceSchema },
      { name: Vehicle.name, schema: VehicleSchema },
      { name: RentalHub.name, schema: RentalHubSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: Ride.name, schema: RideSchema },
    ]),
  ],
  controllers: [IoTController, IoTInternalController],
  providers: [IoTService, TrackingService],
  exports: [IoTService],
})
export class IoTModule {}
