import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { Customer, CustomerSchema } from '../schemas/customer.schema';
import { Vehicle, VehicleSchema } from '../schemas/fleet.schema';
import {
  Breakdown,
  BreakdownSchema,
  ServiceAppointment,
  ServiceAppointmentSchema,
  ServiceCentre,
  ServiceCentreSchema,
  ServiceRequest,
  ServiceRequestSchema,
  ServiceSlot,
  ServiceSlotSchema,
} from '../schemas/operations.schema';
import {
  AppointmentsAdminController,
  BreakdownsAdminController,
  ServiceCentresAdminController,
  ServiceRequestsAdminController,
  ServiceSlotsAdminController,
} from './operations.controller';
import { OperationsService } from './operations.service';

@Module({
  imports: [
    AuthModule,
    AuditModule,
    MongooseModule.forFeature([
      { name: Breakdown.name, schema: BreakdownSchema },
      { name: ServiceCentre.name, schema: ServiceCentreSchema },
      { name: ServiceSlot.name, schema: ServiceSlotSchema },
      { name: ServiceRequest.name, schema: ServiceRequestSchema },
      { name: ServiceAppointment.name, schema: ServiceAppointmentSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: Vehicle.name, schema: VehicleSchema },
    ]),
  ],
  controllers: [
    BreakdownsAdminController,
    ServiceCentresAdminController,
    ServiceSlotsAdminController,
    ServiceRequestsAdminController,
    AppointmentsAdminController,
  ],
  providers: [OperationsService],
  exports: [OperationsService],
})
export class OperationsModule {}
