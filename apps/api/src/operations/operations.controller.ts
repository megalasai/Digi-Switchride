import { BadRequestException, Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard, RolesGuard } from '../auth/admin.guard';
import { Roles } from '../auth/roles.decorator';
import { actorFromRequest } from '../common/actor';
import {
  BreakdownActionDto,
  CancelAppointmentDto,
  CreateAppointmentDto,
  CreateBreakdownDto,
  CreateServiceCentreDto,
  CreateServiceRequestDto,
  CreateServiceSlotDto,
  RescheduleAppointmentDto,
  UpdateServiceCentreDto,
  UpdateServiceRequestDto,
} from '../auth/dto/admin-auth.dto';
import { OperationsService } from './operations.service';

@Controller('v1/admin/breakdowns')
@UseGuards(AuthGuard('jwt'), AdminGuard, RolesGuard)
export class BreakdownsAdminController {
  constructor(private operations: OperationsService) {}

  @Get()
  @Roles('SuperAdmin', 'Administrator', 'CommandCenter', 'Operations', 'ServiceTeam')
  list(@Query('status') status?: string) {
    return this.operations.listBreakdowns(status);
  }

  @Post()
  @Roles('SuperAdmin', 'Administrator', 'CommandCenter')
  create(@Req() req: Parameters<typeof actorFromRequest>[0], @Body() body: CreateBreakdownDto) {
    return this.operations.createBreakdown(body, actorFromRequest(req));
  }

  @Get(':id')
  @Roles('SuperAdmin', 'Administrator', 'CommandCenter', 'Operations', 'ServiceTeam')
  get(@Param('id') id: string) {
    return this.operations.getBreakdown(id);
  }

  @Post(':id/assign')
  @Roles('SuperAdmin', 'Administrator', 'CommandCenter')
  assign(@Req() req: Parameters<typeof actorFromRequest>[0], @Param('id') id: string, @Body() body: BreakdownActionDto) {
    if (!body.assignedTo?.trim()) throw new BadRequestException('assignedTo is required');
    return this.operations.assignBreakdown(id, body.assignedTo, body.note, actorFromRequest(req));
  }

  @Post(':id/progress')
  @Roles('SuperAdmin', 'Administrator', 'CommandCenter')
  progress(@Req() req: Parameters<typeof actorFromRequest>[0], @Param('id') id: string, @Body() body: BreakdownActionDto) {
    return this.operations.progressBreakdown(id, body.note, actorFromRequest(req));
  }

  @Post(':id/escalate')
  @Roles('SuperAdmin', 'Administrator', 'CommandCenter')
  escalate(@Req() req: Parameters<typeof actorFromRequest>[0], @Param('id') id: string, @Body() body: BreakdownActionDto) {
    if (!body.escalatedTo?.trim()) throw new BadRequestException('escalatedTo is required');
    return this.operations.escalateBreakdown(id, body.escalatedTo, body.note, actorFromRequest(req));
  }

  @Post(':id/close')
  @Roles('SuperAdmin', 'Administrator', 'CommandCenter')
  close(@Req() req: Parameters<typeof actorFromRequest>[0], @Param('id') id: string, @Body() body: BreakdownActionDto) {
    return this.operations.closeBreakdown(id, body.note, actorFromRequest(req));
  }
}

@Controller('v1/admin/service-centres')
@UseGuards(AuthGuard('jwt'), AdminGuard, RolesGuard)
export class ServiceCentresAdminController {
  constructor(private operations: OperationsService) {}

  @Get()
  @Roles('SuperAdmin', 'Administrator', 'CommandCenter', 'ServiceTeam', 'Operations')
  list() {
    return this.operations.listCentres();
  }

  @Post()
  @Roles('SuperAdmin', 'Administrator', 'ServiceTeam')
  create(@Req() req: Parameters<typeof actorFromRequest>[0], @Body() body: CreateServiceCentreDto) {
    return this.operations.createCentre(body, actorFromRequest(req));
  }

  @Put(':id')
  @Roles('SuperAdmin', 'Administrator', 'ServiceTeam')
  update(@Param('id') id: string, @Body() body: UpdateServiceCentreDto) {
    return this.operations.updateCentre(id, body);
  }
}

@Controller('v1/admin/service-slots')
@UseGuards(AuthGuard('jwt'), AdminGuard, RolesGuard)
export class ServiceSlotsAdminController {
  constructor(private operations: OperationsService) {}

  @Get()
  @Roles('SuperAdmin', 'Administrator', 'CommandCenter', 'ServiceTeam', 'Operations')
  list(@Query('centreId') centreId?: string, @Query('date') date?: string) {
    return this.operations.listSlots(centreId, date);
  }

  @Post()
  @Roles('SuperAdmin', 'Administrator', 'ServiceTeam')
  create(@Body() body: CreateServiceSlotDto) {
    return this.operations.createSlot(body);
  }
}

@Controller('v1/admin/service-requests')
@UseGuards(AuthGuard('jwt'), AdminGuard, RolesGuard)
export class ServiceRequestsAdminController {
  constructor(private operations: OperationsService) {}

  @Get()
  @Roles('SuperAdmin', 'Administrator', 'CommandCenter', 'ServiceTeam', 'Operations')
  list(@Query('status') status?: string) {
    return this.operations.listRequests(status);
  }

  @Post()
  @Roles('SuperAdmin', 'Administrator', 'CommandCenter', 'ServiceTeam')
  create(@Req() req: Parameters<typeof actorFromRequest>[0], @Body() body: CreateServiceRequestDto) {
    return this.operations.createRequest(body, actorFromRequest(req));
  }

  @Put(':id')
  @Roles('SuperAdmin', 'Administrator', 'CommandCenter', 'ServiceTeam')
  update(@Req() req: Parameters<typeof actorFromRequest>[0], @Param('id') id: string, @Body() body: UpdateServiceRequestDto) {
    return this.operations.updateRequest(id, body, actorFromRequest(req));
  }
}

@Controller('v1/admin/appointments')
@UseGuards(AuthGuard('jwt'), AdminGuard, RolesGuard)
export class AppointmentsAdminController {
  constructor(private operations: OperationsService) {}

  @Get()
  @Roles('SuperAdmin', 'Administrator', 'CommandCenter', 'ServiceTeam', 'Operations')
  list(@Query('status') status?: string) {
    return this.operations.listAppointments(status);
  }

  @Post()
  @Roles('SuperAdmin', 'Administrator', 'CommandCenter', 'ServiceTeam')
  create(@Req() req: Parameters<typeof actorFromRequest>[0], @Body() body: CreateAppointmentDto) {
    return this.operations.scheduleAppointment(body, actorFromRequest(req));
  }

  @Post(':id/reschedule')
  @Roles('SuperAdmin', 'Administrator', 'CommandCenter', 'ServiceTeam')
  reschedule(@Req() req: Parameters<typeof actorFromRequest>[0], @Param('id') id: string, @Body() body: RescheduleAppointmentDto) {
    return this.operations.rescheduleAppointment(id, body.slotId, body.notes, actorFromRequest(req));
  }

  @Post(':id/cancel')
  @Roles('SuperAdmin', 'Administrator', 'CommandCenter', 'ServiceTeam')
  cancel(@Req() req: Parameters<typeof actorFromRequest>[0], @Param('id') id: string, @Body() body: CancelAppointmentDto) {
    return this.operations.cancelAppointment(id, body.reason, actorFromRequest(req));
  }

  @Post(':id/complete')
  @Roles('SuperAdmin', 'Administrator', 'CommandCenter', 'ServiceTeam')
  complete(@Req() req: Parameters<typeof actorFromRequest>[0], @Param('id') id: string) {
    return this.operations.completeAppointment(id, actorFromRequest(req));
  }
}
