import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { CustomersModule } from '../customers/customers.module';
import { FleetModule } from '../fleet/fleet.module';
import { OperationsModule } from '../operations/operations.module';
import { EngagementModule } from '../engagement/engagement.module';
import { PaymentsModule } from '../payments/payments.module';
import { SupportModule } from '../support/support.module';
import { Customer, CustomerSchema } from '../schemas/customer.schema';
import { Vehicle, VehicleSchema } from '../schemas/fleet.schema';
import { Payment, PaymentSchema } from '../schemas/booking.schema';
import { RentalPlan, RentalPlanSchema, WalletTransaction, WalletTransactionSchema } from '../schemas/rental.schema';
import { RiderAppController } from './rider.controller';
import { RiderAppService } from './rider.service';

@Module({
  imports: [
    AuthModule,
    CustomersModule,
    FleetModule,
    OperationsModule,
    EngagementModule,
    PaymentsModule,
    SupportModule,
    MongooseModule.forFeature([
      { name: Customer.name, schema: CustomerSchema },
      { name: Vehicle.name, schema: VehicleSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: RentalPlan.name, schema: RentalPlanSchema },
      { name: WalletTransaction.name, schema: WalletTransactionSchema },
    ]),
  ],
  controllers: [RiderAppController],
  providers: [RiderAppService],
})
export class RiderModule {}
