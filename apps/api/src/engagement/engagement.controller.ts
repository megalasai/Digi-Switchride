import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard, RolesGuard } from '../auth/admin.guard';
import { Roles } from '../auth/roles.decorator';
import { actorFromRequest } from '../common/actor';
import {
  ApplyReferralDto,
  CreateAgreementDto,
  CreateChargingStationDto,
  CreateFeedbackDto,
  CreateNotificationDto,
  UpdateChargingStationDto,
} from '../auth/dto/admin-auth.dto';
import { EngagementService } from './engagement.service';

@Controller('v1/admin/charging-stations')
@UseGuards(AuthGuard('jwt'), AdminGuard, RolesGuard)
export class ChargingStationsAdminController {
  constructor(private engagement: EngagementService) {}

  @Get()
  @Roles('SuperAdmin', 'Administrator', 'Operations', 'CommandCenter', 'ServiceTeam')
  list() {
    return this.engagement.listStations();
  }

  @Post()
  @Roles('SuperAdmin', 'Administrator', 'Operations')
  create(@Req() req: Parameters<typeof actorFromRequest>[0], @Body() body: CreateChargingStationDto) {
    return this.engagement.createStation(body, actorFromRequest(req));
  }

  @Put(':id')
  @Roles('SuperAdmin', 'Administrator', 'Operations')
  update(@Param('id') id: string, @Body() body: UpdateChargingStationDto) {
    return this.engagement.updateStation(id, body);
  }

  @Delete(':id')
  @Roles('SuperAdmin', 'Administrator', 'Operations')
  remove(@Param('id') id: string) {
    return this.engagement.deleteStation(id);
  }
}

@Controller('v1/admin/notifications')
@UseGuards(AuthGuard('jwt'), AdminGuard, RolesGuard)
export class NotificationsAdminController {
  constructor(private engagement: EngagementService) {}

  @Get()
  @Roles('SuperAdmin', 'Administrator', 'CommandCenter', 'Finance')
  list() {
    return this.engagement.listNotifications();
  }

  @Post()
  @Roles('SuperAdmin', 'Administrator', 'CommandCenter')
  send(@Req() req: Parameters<typeof actorFromRequest>[0], @Body() body: CreateNotificationDto) {
    return this.engagement.sendNotification(body, actorFromRequest(req));
  }

  @Delete(':id')
  @Roles('SuperAdmin', 'Administrator', 'CommandCenter')
  remove(@Param('id') id: string) {
    return this.engagement.deleteNotification(id);
  }
}

@Controller('v1/admin/feedback')
@UseGuards(AuthGuard('jwt'), AdminGuard, RolesGuard)
export class FeedbackAdminController {
  constructor(private engagement: EngagementService) {}

  @Get()
  @Roles('SuperAdmin', 'Administrator', 'CommandCenter', 'Operations')
  list() {
    return this.engagement.listFeedback();
  }

  @Post()
  @Roles('SuperAdmin', 'Administrator', 'CommandCenter')
  create(@Body() body: CreateFeedbackDto) {
    return this.engagement.createFeedback(body);
  }

  @Delete(':id')
  @Roles('SuperAdmin', 'Administrator', 'CommandCenter')
  remove(@Param('id') id: string) {
    return this.engagement.deleteFeedback(id);
  }
}

@Controller('v1/admin/agreements')
@UseGuards(AuthGuard('jwt'), AdminGuard, RolesGuard)
export class AgreementsAdminController {
  constructor(private engagement: EngagementService) {}

  @Get()
  @Roles('SuperAdmin', 'Administrator', 'Operations', 'KycTeam', 'Finance')
  list(@Query('riderId') riderId?: string) {
    return this.engagement.listAgreements(riderId);
  }

  @Post()
  @Roles('SuperAdmin', 'Administrator', 'Operations')
  issue(@Req() req: Parameters<typeof actorFromRequest>[0], @Body() body: CreateAgreementDto) {
    return this.engagement.issueAgreement(body, actorFromRequest(req));
  }

  @Post(':id/sign')
  @Roles('SuperAdmin', 'Administrator', 'Operations')
  sign(@Param('id') id: string) {
    return this.engagement.signAgreement(id);
  }

  @Delete(':id')
  @Roles('SuperAdmin', 'Administrator', 'Operations')
  remove(@Param('id') id: string) {
    return this.engagement.deleteAgreement(id);
  }
}

@Controller('v1/admin/referrals')
@UseGuards(AuthGuard('jwt'), AdminGuard, RolesGuard)
export class ReferralsAdminController {
  constructor(private engagement: EngagementService) {}

  @Get()
  @Roles('SuperAdmin', 'Administrator', 'Finance', 'Operations')
  list() {
    return this.engagement.listReferrals();
  }

  @Post('apply')
  @Roles('SuperAdmin', 'Administrator', 'Operations')
  apply(@Body() body: ApplyReferralDto) {
    return this.engagement.applyReferral(body.riderId, body.code);
  }
}
