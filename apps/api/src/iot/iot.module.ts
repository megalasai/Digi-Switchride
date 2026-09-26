import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { IoTDevice, IoTDeviceSchema, Vehicle, VehicleSchema } from '../schemas/fleet.schema';
import { IoTController, IoTInternalController } from './iot.controller';
import { IoTService } from './iot.service';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([{ name: IoTDevice.name, schema: IoTDeviceSchema }, { name: Vehicle.name, schema: VehicleSchema }]),
  ],
  controllers: [IoTController, IoTInternalController],
  providers: [IoTService],
  exports: [IoTService],
})
export class IoTModule {}
