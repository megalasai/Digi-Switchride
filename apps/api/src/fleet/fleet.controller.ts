import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard, RolesGuard } from '../auth/admin.guard';
import { Roles } from '../auth/roles.decorator';
import { AssignVehicleDto, CreateVehicleDto, ImmobiliseVehicleDto, UnassignVehicleDto, UpdateVehicleDto, UpdateVehicleStatusDto } from '../auth/dto/admin-auth.dto';
import { actorFromRequest } from '../common/actor';
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
@UseGuards(AuthGuard('jwt'), AdminGuard, RolesGuard)
export class FleetAdminController {
  constructor(private fleetService: FleetService) {}

  @Get('hubs')
  @Roles('SuperAdmin', 'Administrator', 'Operations', 'CommandCenter', 'ServiceTeam')
  listHubs() {
    return this.fleetService.listAllHubs().then((items) => ({ items }));
  }

  @Post('hubs')
  @Roles('SuperAdmin', 'Administrator', 'Operations')
  createHub(@Body() body: { name: string; location: { lat: number; lng: number }; address: string; capacity: number; operatingHours?: string; geoFenceRadiusM?: number; tenantId?: string }) {
    return this.fleetService.createHub(body);
  }

  @Put('hubs/:hubId')
  @Roles('SuperAdmin', 'Administrator', 'Operations')
  updateHub(@Param('hubId') hubId: string, @Body() body: { name?: string; location?: { lat: number; lng: number }; address?: string; capacity?: number; operatingHours?: string; geoFenceRadiusM?: number; status?: string }) {
    return this.fleetService.updateHub(hubId, body);
  }

  @Delete('hubs/:hubId')
  @Roles('SuperAdmin', 'Administrator', 'Operations')
  deleteHub(@Param('hubId') hubId: string) {
    return this.fleetService.deleteHub(hubId);
  }

  @Get('track/vehicles')
  @Roles('SuperAdmin', 'Administrator', 'Operations', 'CommandCenter', 'ServiceTeam')
  listTrackFleet() {
    return this.fleetService.listTrackFleet();
  }

  @Get('vehicles/:vehicleId/track-history')
  @Roles('SuperAdmin', 'Administrator', 'Operations', 'CommandCenter', 'ServiceTeam')
  trackHistory(
    @Param('vehicleId') vehicleId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.fleetService.trackHistory(vehicleId, from, to);
  }

  @Post('vehicles/:vehicleId/immobilise')
  @Roles('SuperAdmin', 'Administrator', 'Operations', 'CommandCenter')
  immobilise(
    @Param('vehicleId') vehicleId: string,
    @Body() body: ImmobiliseVehicleDto,
  ) {
    return this.fleetService.immobiliseVehicle(vehicleId, body.immobilise !== false);
  }

  @Get('vehicles')
  @Roles('SuperAdmin', 'Administrator', 'Operations', 'CommandCenter', 'ServiceTeam')
  listVehicles(
    @Query('status') status?: string,
    @Query('hubId') hubId?: string,
    @Query('search') search?: string,
    @Query('availability') availability?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '50',
  ) {
    return this.fleetService.listVehicles({ status, hubId, search, availability, page: +page, pageSize: +pageSize });
  }

  @Post('vehicles')
  @Roles('SuperAdmin', 'Administrator', 'Operations')
  createVehicle(@Req() req: Parameters<typeof actorFromRequest>[0], @Body() body: CreateVehicleDto) {
    return this.fleetService.createVehicle(body, actorFromRequest(req));
  }

  @Get('vehicles/:vehicleId')
  @Roles('SuperAdmin', 'Administrator', 'Operations', 'CommandCenter', 'ServiceTeam')
  getVehicleDetail(@Param('vehicleId') vehicleId: string) {
    return this.fleetService.getVehicleDetail(vehicleId);
  }

  @Put('vehicles/:vehicleId')
  @Roles('SuperAdmin', 'Administrator', 'Operations')
  updateVehicle(@Req() req: Parameters<typeof actorFromRequest>[0], @Param('vehicleId') vehicleId: string, @Body() body: UpdateVehicleDto) {
    const isSuper = (req as { user?: { role?: string } }).user?.role === 'SuperAdmin';
    return this.fleetService.updateVehicle(vehicleId, body, actorFromRequest(req), isSuper);
  }

  @Delete('vehicles/:vehicleId')
  @Roles('SuperAdmin', 'Administrator', 'Operations')
  deleteVehicle(@Req() req: Parameters<typeof actorFromRequest>[0], @Param('vehicleId') vehicleId: string) {
    return this.fleetService.deleteVehicle(vehicleId, actorFromRequest(req));
  }

  @Post('vehicles/:vehicleId/status')
  @Roles('SuperAdmin', 'Administrator', 'Operations')
  updateVehicleStatus(
    @Req() req: Parameters<typeof actorFromRequest>[0],
    @Param('vehicleId') vehicleId: string,
    @Body() body: UpdateVehicleStatusDto,
  ) {
    return this.fleetService.updateVehicleStatus(vehicleId, body.status, body.reason, actorFromRequest(req));
  }

  @Post('vehicles/:vehicleId/assign')
  @Roles('SuperAdmin', 'Administrator', 'Operations')
  assign(
    @Req() req: Parameters<typeof actorFromRequest>[0],
    @Param('vehicleId') vehicleId: string,
    @Body() body: AssignVehicleDto,
  ) {
    return this.fleetService.assignVehicle(vehicleId, body.riderId, { override: body.override, reason: body.reason }, actorFromRequest(req));
  }

  @Post('vehicles/:vehicleId/unassign')
  @Roles('SuperAdmin', 'Administrator', 'Operations')
  unassign(
    @Req() req: Parameters<typeof actorFromRequest>[0],
    @Param('vehicleId') vehicleId: string,
    @Body() body: UnassignVehicleDto,
  ) {
    return this.fleetService.unassignVehicle(vehicleId, body.reason, actorFromRequest(req));
  }
}
