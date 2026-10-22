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
import { PaymentGatewayService } from './gateway.service';
import { PaymentGateway, PaymentGatewaySchema } from '../schemas/payment-gateway.schema';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [
    AuthModule,
    AuditModule,
    CustomersModule,
    OperationsModule,
    EngagementModule,
    TenantsModule,
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: Promotion.name, schema: PromotionSchema },
      { name: Ride.name, schema: RideSchema },
      { name: Vehicle.name, schema: VehicleSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: PaymentGateway.name, schema: PaymentGatewaySchema },
    ]),
  ],
  controllers: [PaymentsController, AdminController],
  providers: [PaymentsService, PromotionsService, ReportsService, DashboardService, PaymentGatewayService],
  exports: [PaymentsService, PromotionsService, ReportsService, DashboardService, PaymentGatewayService],
})
export class PaymentsModule {}
