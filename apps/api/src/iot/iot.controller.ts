import { Body, Controller, Delete, Get, Headers, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard, RolesGuard } from '../auth/admin.guard';
import { Roles } from '../auth/roles.decorator';
import { UpdateIoTDeviceDto } from '../auth/dto/admin-auth.dto';
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
      authType?: string;
      apiToken?: string;
      headerName?: string;
    },
  ) {
    return this.gps.upsert(body, req.user?.role === 'SuperAdmin');
  }

  @Post('devices')
  @Roles('SuperAdmin', 'Administrator', 'Operations')
  registerDevice(
    @Body()
    body: {
      deviceId: string;
      vendorType?: string;
      vehicleId?: string;
      tenantId?: string;
      vehicleNumber?: string;
      imei?: string;
      lat?: number;
      lng?: number;
    },
  ) {
    return this.iotService.registerDevice(body.deviceId, body.vendorType, body.vehicleId, body.tenantId, {
      vehicleNumber: body.vehicleNumber,
      imei: body.imei,
      lat: body.lat,
      lng: body.lng,
    });
  }

  @Post('devices/import')
  @Roles('SuperAdmin', 'Administrator', 'Operations')
  importDevices(
    @Body()
    body: {
      tenantId?: string;
      vendorType?: string;
      items?: unknown;
      devices?: unknown;
    },
  ) {
    return this.iotService.importVendorDevices(body.items ?? body.devices ?? body, body.tenantId, body.vendorType || 'GenericPull');
  }

  @Put('devices/:deviceId')
  @Roles('SuperAdmin', 'Administrator', 'Operations')
  updateDevice(
    @Req() req: { user?: { role?: string } },
    @Param('deviceId') deviceId: string,
    @Body() body: UpdateIoTDeviceDto,
  ) {
    return this.iotService.updateDevice(deviceId, body, req.user?.role === 'SuperAdmin');
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

  @Delete('devices/:deviceId')
  @Roles('SuperAdmin', 'Administrator', 'Operations')
  deleteDevice(@Param('deviceId') deviceId: string) {
    return this.iotService.deleteDevice(deviceId);
  }
}

@Controller('v1/iot')
export class IoTIngestController {
  constructor(private iotService: IoTService) {}

  @Post('ingest')
  ingest(
    @Headers('x-ingest-key') ingestKey: string | undefined,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const key = ingestKey?.trim() || (authorization?.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : '');
    return this.iotService.ingestPushDevices(key, body);
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
