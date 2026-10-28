import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard, RolesGuard } from '../auth/admin.guard';
import { Roles } from '../auth/roles.decorator';
import { GpsIntegrationService } from './gps-integration.service';
import { IoTService } from './iot.service';

@Controller('v1/admin/iot')
@UseGuards(AuthGuard('jwt'), AdminGuard, RolesGuard)
export class IoTController {
  constructor(
    private iotService: IoTService,
    private gps: GpsIntegrationService,
  ) {}

  @Get('devices')
  listDevices(@Req() req: { user?: { role?: string } }) {
    const allTenants = req.user?.role === 'SuperAdmin';
    return this.iotService.listDevices(allTenants).then((items) => ({ items, sync: this.iotService.lastSync }));
  }

  @Post('devices/sync')
  @Roles('SuperAdmin', 'Administrator', 'Operations')
  syncDevices(@Req() req: { user?: { role?: string } }, @Query('tenantId') tenantId?: string) {
    const isSuper = req.user?.role === 'SuperAdmin';
    return this.iotService.syncTrack360({
      tenantId: tenantId?.trim() || undefined,
      allTenants: isSuper && !tenantId?.trim(),
    });
  }

  @Get('gps-integrations')
  @Roles('SuperAdmin', 'Administrator')
  listGpsIntegrations(@Req() req: { user?: { role?: string } }) {
    return this.gps.listOverview(req.user?.role === 'SuperAdmin');
  }

  @Get('gps-integration')
  @Roles('SuperAdmin', 'Administrator')
  getGpsIntegration(@Req() req: { user?: { role?: string } }, @Query('tenantId') tenantId?: string) {
    return this.gps.getAdmin(tenantId, req.user?.role === 'SuperAdmin');
  }

  @Put('gps-integration')
  @Roles('SuperAdmin', 'Administrator')
  saveGpsIntegration(
    @Req() req: { user?: { role?: string } },
    @Body()
    body: {
      tenantId?: string;
      provider: string;
      enabled?: boolean;
      displayName?: string;
      username?: string;
      password?: string;
      pullUrl?: string;
    },
  ) {
    return this.gps.upsert(body, req.user?.role === 'SuperAdmin');
  }

  @Post('devices')
  @Roles('SuperAdmin', 'Administrator', 'Operations')
  registerDevice(@Body() body: { deviceId: string; vendorType?: string; vehicleId?: string; tenantId?: string }) {
    return this.iotService.registerDevice(body.deviceId, body.vendorType, body.vehicleId, body.tenantId);
  }

  @Put('devices/:deviceId')
  @Roles('SuperAdmin', 'Administrator', 'Operations')
  updateDevice(@Param('deviceId') deviceId: string, @Body() body: { vendorType?: string; vehicleId?: string | null }) {
    return this.iotService.updateDevice(deviceId, body);
  }

  @Post('devices/:deviceId/command')
  @Roles('SuperAdmin', 'Administrator', 'Operations')
  sendCommand(@Param('deviceId') deviceId: string, @Body() body: { command: string }) {
    return this.iotService.sendCommand(deviceId, body.command);
  }

  @Post('devices/:deviceId/link')
  @Roles('SuperAdmin', 'Administrator', 'Operations')
  linkDevice(@Param('deviceId') deviceId: string, @Body() body: { vehicleId: string; vendorType?: string }) {
    return this.iotService.linkDeviceToVehicle(deviceId, body.vehicleId, body.vendorType);
  }

  @Delete('devices/:deviceId/link')
  @Roles('SuperAdmin', 'Administrator', 'Operations')
  unlinkDevice(@Param('deviceId') deviceId: string) {
    return this.iotService.unlinkDevice(deviceId);
  }
}

@Controller('v1/internal/iot')
export class IoTInternalController {
  constructor(private iotService: IoTService) {}

  @Post('telemetry')
  telemetry(
    @Body()
    body: {
      deviceId: string;
      lat: number;
      lng: number;
      batteryPercent?: number;
      odometerKm?: number;
      speedKmh?: number;
      ignition?: string;
      name?: string;
      vendorType?: string;
    },
  ) {
    return this.iotService.ingestLiveTelemetry(body);
  }
}
