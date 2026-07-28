import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Booking, BookingSchema, Payment, PaymentSchema, Promotion, PromotionSchema, Ride, RideSchema } from '../schemas/booking.schema';
import { Customer, CustomerSchema } from '../schemas/customer.schema';
import { Vehicle, VehicleSchema } from '../schemas/fleet.schema';
import { IoTModule } from '../iot/iot.module';
import { BookingsController, BookingsAdminController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
      { name: Ride.name, schema: RideSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: Vehicle.name, schema: VehicleSchema },
      { name: Promotion.name, schema: PromotionSchema },
      { name: Payment.name, schema: PaymentSchema },
    ]),
    IoTModule,
  ],
  controllers: [BookingsController, BookingsAdminController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
