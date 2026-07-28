import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Customer, CustomerSchema, KycSubmission, KycSubmissionSchema } from '../schemas/customer.schema';
import { CustomersController } from './customers.controller';
import { KycService, ProfileService } from './customers.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Customer.name, schema: CustomerSchema },
      { name: KycSubmission.name, schema: KycSubmissionSchema },
    ]),
  ],
  controllers: [CustomersController],
  providers: [ProfileService, KycService],
  exports: [ProfileService, KycService],
})
export class CustomersModule {}
