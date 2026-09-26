import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { IoTModule } from '../iot/iot.module';
import { RentalHub, RentalHubSchema, Vehicle, VehicleSchema, VehicleEvent, VehicleEventSchema } from '../schemas/fleet.schema';
import { Customer, CustomerSchema } from '../schemas/customer.schema';
import { AuditModule } from '../audit/audit.module';
import { FleetController, FleetAdminController } from './fleet.controller';
import { FleetService } from './fleet.service';

@Module({
  imports: [
    AuthModule,
    AuditModule,
    MongooseModule.forFeature([
      { name: RentalHub.name, schema: RentalHubSchema },
      { name: Vehicle.name, schema: VehicleSchema },
      { name: VehicleEvent.name, schema: VehicleEventSchema },
      { name: Customer.name, schema: CustomerSchema },
    ]),
    IoTModule,
  ],
  controllers: [FleetController, FleetAdminController],
  providers: [FleetService],
  exports: [FleetService],
})
export class FleetModule {}
