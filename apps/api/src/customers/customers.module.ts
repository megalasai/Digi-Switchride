import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { Customer, CustomerSchema, KycSubmission, KycSubmissionSchema } from '../schemas/customer.schema';
import { Vehicle, VehicleSchema } from '../schemas/fleet.schema';
import { Booking, BookingSchema, Payment, PaymentSchema, Ride, RideSchema } from '../schemas/booking.schema';
import { RentalPlan, RentalPlanSchema, WalletTransaction, WalletTransactionSchema } from '../schemas/rental.schema';
import { CustomersController } from './customers.controller';
import { PlansAdminController, RidersAdminController, WalletsAdminController } from './riders.controller';
import { KycService, ProfileService } from './customers.service';
import { RidersService } from './riders.service';

@Module({
  imports: [
    AuthModule,
    AuditModule,
    MongooseModule.forFeature([
      { name: Customer.name, schema: CustomerSchema },
      { name: KycSubmission.name, schema: KycSubmissionSchema },
      { name: Vehicle.name, schema: VehicleSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: Ride.name, schema: RideSchema },
      { name: RentalPlan.name, schema: RentalPlanSchema },
      { name: WalletTransaction.name, schema: WalletTransactionSchema },
    ]),
  ],
  controllers: [CustomersController, RidersAdminController, PlansAdminController, WalletsAdminController],
  providers: [ProfileService, KycService, RidersService],
  exports: [ProfileService, KycService, RidersService],
})
export class CustomersModule {}
