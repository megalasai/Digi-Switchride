import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard, RolesGuard } from '../auth/admin.guard';
import { Roles } from '../auth/roles.decorator';
import { actorFromRequest } from '../common/actor';
import { CreateSupportTicketDto, UpdateSupportTicketDto } from '../auth/dto/admin-auth.dto';
import { SupportService } from './support.service';

@Controller('v1/support')
@UseGuards(AuthGuard('jwt'))
export class SupportController {
  constructor(private supportService: SupportService) {}

  @Post('tickets')
  create(@Req() req: { user: { customerId: string } }, @Body() body: { category: string; subject: string; description: string; bookingId?: string }) {
    return this.supportService.create(req.user.customerId, body);
  }

  @Get('tickets')
  list(@Req() req: { user: { customerId: string } }) {
    return this.supportService.list(req.user.customerId).then((items) => ({ items }));
  }
}

@Controller('v1/admin/support/tickets')
@UseGuards(AuthGuard('jwt'), AdminGuard, RolesGuard)
export class SupportAdminController {
  constructor(private supportService: SupportService) {}

  @Get()
  @Roles('SuperAdmin', 'Administrator', 'CommandCenter')
  list(@Query('status') status?: string) {
    return this.supportService.listAdmin(status);
  }

  @Post()
  @Roles('SuperAdmin', 'Administrator', 'CommandCenter')
  create(@Body() body: CreateSupportTicketDto) {
    return this.supportService.createAdmin(body);
  }

  @Put(':id')
  @Roles('SuperAdmin', 'Administrator', 'CommandCenter')
  update(@Req() req: Parameters<typeof actorFromRequest>[0], @Param('id') id: string, @Body() body: UpdateSupportTicketDto) {
    return this.supportService.updateAdmin(id, body, actorFromRequest(req));
  }
}
