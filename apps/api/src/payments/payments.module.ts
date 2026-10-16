import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Booking, BookingSchema, Payment, PaymentSchema, Promotion, PromotionSchema, Ride, RideSchema } from '../schemas/booking.schema';
import { Customer, CustomerSchema } from '../schemas/customer.schema';
import { Vehicle, VehicleSchema } from '../schemas/fleet.schema';
import { CustomersModule } from '../customers/customers.module';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { OperationsModule } from '../operations/operations.module';
import { EngagementModule } from '../engagement/engagement.module';
import { PaymentsController, AdminController } from './payments.controller';
import { DashboardService, PaymentsService, PromotionsService, ReportsService } from './payments.service';

@Module({
  imports: [
    AuthModule,
    AuditModule,
    CustomersModule,
    OperationsModule,
    EngagementModule,
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: Promotion.name, schema: PromotionSchema },
      { name: Ride.name, schema: RideSchema },
      { name: Vehicle.name, schema: VehicleSchema },
      { name: Customer.name, schema: CustomerSchema },
    ]),
  ],
  controllers: [PaymentsController, AdminController],
  providers: [PaymentsService, PromotionsService, ReportsService, DashboardService],
  exports: [PaymentsService, PromotionsService, ReportsService, DashboardService],
})
export class PaymentsModule {}
