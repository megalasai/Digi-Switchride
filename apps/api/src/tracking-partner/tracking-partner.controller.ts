import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard, RolesGuard } from '../auth/admin.guard';
import { Roles } from '../auth/roles.decorator';
import { TrackingPartnerGuard } from './tracking-partner.guard';
import { TrackingPartnerService } from './tracking-partner.service';
import {
  CreateTrackingPartnerDto,
  HistoryQueryDto,
  LiveQueryDto,
  PutPartnerAssetsDto,
  PutPartnerTenantsDto,
  UpdateTrackingPartnerDto,
  VehicleLiveQueryDto,
} from './tracking-partner.dto';

@Controller('v1/admin/tracking-partners')
@UseGuards(AuthGuard('jwt'), AdminGuard, RolesGuard)
export class TrackingPartnerAdminController {
  constructor(private partners: TrackingPartnerService) {}

  @Post()
  @Roles('SuperAdmin', 'Administrator')
  create(@Body() body: CreateTrackingPartnerDto) {
    return this.partners.createApp(body);
  }

  @Get()
  @Roles('SuperAdmin', 'Administrator', 'CommandCenter', 'Operations')
  list() {
    return this.partners.listApps();
  }

  @Get(':applicationId')
  @Roles('SuperAdmin', 'Administrator', 'CommandCenter', 'Operations')
  get(@Param('applicationId') applicationId: string) {
    return this.partners.getApp(applicationId);
  }

  @Patch(':applicationId')
  @Roles('SuperAdmin', 'Administrator')
  update(@Param('applicationId') applicationId: string, @Body() body: UpdateTrackingPartnerDto) {
    return this.partners.updateApp(applicationId, body);
  }

  @Post(':applicationId/rotate-key')
  @Roles('SuperAdmin', 'Administrator')
  rotateKey(@Param('applicationId') applicationId: string) {
    return this.partners.rotateKey(applicationId);
  }

  @Get(':applicationId/tenants')
  @Roles('SuperAdmin', 'Administrator', 'CommandCenter', 'Operations')
  getTenants(@Param('applicationId') applicationId: string) {
    return this.partners.listTenants(applicationId);
  }

  @Put(':applicationId/tenants')
  @Roles('SuperAdmin', 'Administrator')
  putTenants(@Param('applicationId') applicationId: string, @Body() body: PutPartnerTenantsDto) {
    return this.partners.replaceTenants(applicationId, body.tenantIds);
  }

  @Get(':applicationId/assets')
  @Roles('SuperAdmin', 'Administrator', 'CommandCenter', 'Operations')
  getAssets(@Param('applicationId') applicationId: string) {
    return this.partners.listAssets(applicationId);
  }

  @Put(':applicationId/assets')
  @Roles('SuperAdmin', 'Administrator')
  putAssets(@Param('applicationId') applicationId: string, @Body() body: PutPartnerAssetsDto) {
    return this.partners.replaceAssets(applicationId, body.items);
  }
}

@Controller('v1/tracking')
@UseGuards(TrackingPartnerGuard)
export class TrackingPartnerController {
  constructor(private partners: TrackingPartnerService) {}

  @Get(':applicationId/tenants')
  tenants(@Param('applicationId') applicationId: string) {
    return this.partners.listTenants(applicationId);
  }

  @Get(':applicationId/assets')
  assets(@Param('applicationId') applicationId: string) {
    return this.partners.listAssets(applicationId);
  }

  @Get(':applicationId/live')
  live(@Param('applicationId') applicationId: string, @Query() query: LiveQueryDto) {
    return this.partners.liveFleet(applicationId, query.tenantId);
  }

  @Get(':applicationId/live/vehicle')
  liveVehicle(@Param('applicationId') applicationId: string, @Query() query: VehicleLiveQueryDto) {
    return this.partners.liveVehicle(applicationId, query);
  }

  @Get(':applicationId/history')
  history(@Param('applicationId') applicationId: string, @Query() query: HistoryQueryDto) {
    return this.partners.history(applicationId, query);
  }
}
