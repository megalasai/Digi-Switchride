import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FleetService } from './fleet.service';

@Controller('v1')
@UseGuards(AuthGuard('jwt'))
export class FleetController {
  constructor(private fleetService: FleetService) {}

  @Get('hubs/nearby')
  nearby(@Query('lat') lat: string, @Query('lng') lng: string, @Query('radiusKm') radiusKm = '5') {
    return this.fleetService.getNearbyHubs(+lat, +lng, +radiusKm).then((items) => ({ items }));
  }

  @Get('hubs/:hubId')
  getHub(@Param('hubId') hubId: string, @Query('lat') lat?: string, @Query('lng') lng?: string) {
    return this.fleetService.getHub(hubId, lat ? +lat : undefined, lng ? +lng : undefined);
  }

  @Get('hubs/:hubId/vehicles')
  hubVehicles(@Param('hubId') hubId: string, @Query('status') status?: string) {
    return this.fleetService.getHubVehicles(hubId, status).then((items) => ({ items }));
  }

  @Get('vehicles/:vehicleId')
  getVehicle(@Param('vehicleId') vehicleId: string) {
    return this.fleetService.getVehicle(vehicleId);
  }
}

@Controller('v1/admin')
@UseGuards(AuthGuard('jwt'))
export class FleetAdminController {
  constructor(private fleetService: FleetService) {}

  @Get('hubs')
  listHubs() {
    return this.fleetService.listAllHubs().then((items) => ({ items }));
  }

  @Post('hubs')
  createHub(@Body() body: { name: string; location: { lat: number; lng: number }; address: string; capacity: number; operatingHours?: string; geoFenceRadiusM?: number }) {
    return this.fleetService.createHub(body);
  }

  @Get('vehicles')
  listVehicles() {
    return this.fleetService.listAllVehicles().then((items) => ({ items }));
  }

  @Post('vehicles')
  createVehicle(@Body() body: { registrationNumber: string; type: string; hubId: string; model: string; iotDeviceId?: string }) {
    return this.fleetService.createVehicle(body);
  }
}
