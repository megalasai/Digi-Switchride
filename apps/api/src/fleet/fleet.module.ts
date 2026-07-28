import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RentalHub, RentalHubSchema, Vehicle, VehicleSchema } from '../schemas/fleet.schema';
import { FleetController, FleetAdminController } from './fleet.controller';
import { FleetService } from './fleet.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: RentalHub.name, schema: RentalHubSchema }, { name: Vehicle.name, schema: VehicleSchema }])],
  controllers: [FleetController, FleetAdminController],
  providers: [FleetService],
  exports: [FleetService],
})
export class FleetModule {}
