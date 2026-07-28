import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IoTService } from './iot.service';

@Controller('v1/admin/iot')
@UseGuards(AuthGuard('jwt'))
export class IoTController {
  constructor(private iotService: IoTService) {}

  @Get('devices')
  listDevices() {
    return this.iotService.listDevices().then((items) => ({ items }));
  }

  @Post('devices/:deviceId/command')
  sendCommand(@Param('deviceId') deviceId: string, @Body() body: { command: string }) {
    return this.iotService.sendCommand(deviceId, body.command);
  }
}

@Controller('v1/internal/iot')
export class IoTInternalController {
  constructor(private iotService: IoTService) {}

  @Post('telemetry')
  telemetry(@Body() body: { deviceId: string; lat: number; lng: number; batteryPercent: number; odometerKm: number }) {
    return this.iotService.updateTelemetry(body.deviceId, body.lat, body.lng, body.batteryPercent, body.odometerKm);
  }
}
