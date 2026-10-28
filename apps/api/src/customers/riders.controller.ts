import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard, RolesGuard } from '../auth/admin.guard';
import { Roles } from '../auth/roles.decorator';
import { AssignRiderPlanDto, CreateCustomerDto, CreateRentalPlanDto, UpdateCustomerDto, UpdateRentalPlanDto, WalletAdjustDto } from '../auth/dto/admin-auth.dto';
import { actorFromRequest } from '../common/actor';
import { RidersService } from './riders.service';

@Controller('v1/admin/riders')
@UseGuards(AuthGuard('jwt'), AdminGuard, RolesGuard)
export class RidersAdminController {
  constructor(private ridersService: RidersService) {}

  @Get()
  @Roles('SuperAdmin', 'Administrator', 'CommandCenter', 'Operations', 'KycTeam', 'Finance')
  list(
    @Query('search') search?: string,
    @Query('kycStatus') kycStatus?: string,
    @Query('accountStatus') accountStatus?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    return this.ridersService.list({ search, kycStatus, accountStatus, page: +page, pageSize: +pageSize });
  }

  @Post()
  @Roles('SuperAdmin', 'Administrator', 'Operations')
  create(@Req() req: Parameters<typeof actorFromRequest>[0], @Body() body: CreateCustomerDto) {
    return this.ridersService.create(body, actorFromRequest(req));
  }

  @Get('plans')
  @Roles('SuperAdmin', 'Administrator', 'CommandCenter', 'Operations', 'KycTeam', 'Finance')
  plans() {
    return this.ridersService.listPlans();
  }

  @Post(':id/wallet')
  @Roles('SuperAdmin', 'Administrator', 'Finance')
  adjustWallet(
    @Req() req: Parameters<typeof actorFromRequest>[0],
    @Param('id') id: string,
    @Body() body: WalletAdjustDto,
  ) {
    return this.ridersService.adjustWallet(id, body, actorFromRequest(req));
  }

  @Get(':id')
  @Roles('SuperAdmin', 'Administrator', 'CommandCenter', 'Operations', 'KycTeam', 'Finance')
  profile(@Param('id') id: string) {
    return this.ridersService.getProfile(id);
  }

  @Put(':id')
  @Roles('SuperAdmin', 'Administrator', 'Operations')
  update(@Req() req: Parameters<typeof actorFromRequest>[0], @Param('id') id: string, @Body() body: UpdateCustomerDto) {
    return this.ridersService.update(id, body, actorFromRequest(req));
  }

  @Delete(':id')
  @Roles('SuperAdmin', 'Administrator', 'Operations')
  remove(@Req() req: Parameters<typeof actorFromRequest>[0], @Param('id') id: string) {
    return this.ridersService.remove(id, actorFromRequest(req));
  }

  @Post(':id/plan')
  @Roles('SuperAdmin', 'Administrator', 'Operations')
  assignPlan(
    @Req() req: Parameters<typeof actorFromRequest>[0],
    @Param('id') id: string,
    @Body() body: AssignRiderPlanDto,
  ) {
    return this.ridersService.assignPlan(id, body.rentalPlanId, actorFromRequest(req));
  }
}

@Controller('v1/admin/plans')
@UseGuards(AuthGuard('jwt'), AdminGuard, RolesGuard)
export class PlansAdminController {
  constructor(private ridersService: RidersService) {}

  @Get()
  @Roles('SuperAdmin', 'Administrator', 'CommandCenter', 'Operations', 'Finance')
  list() {
    return this.ridersService.listPlans(true);
  }

  @Post()
  @Roles('SuperAdmin', 'Administrator')
  create(@Req() req: Parameters<typeof actorFromRequest>[0], @Body() body: CreateRentalPlanDto) {
    return this.ridersService.createPlan(body, actorFromRequest(req));
  }

  @Put(':id')
  @Roles('SuperAdmin', 'Administrator')
  update(@Req() req: Parameters<typeof actorFromRequest>[0], @Param('id') id: string, @Body() body: UpdateRentalPlanDto) {
    return this.ridersService.updatePlan(id, body, actorFromRequest(req));
  }

  @Delete(':id')
  @Roles('SuperAdmin', 'Administrator')
  removePlan(@Req() req: Parameters<typeof actorFromRequest>[0], @Param('id') id: string) {
    return this.ridersService.deletePlan(id, actorFromRequest(req));
  }
}

@Controller('v1/admin/wallets')
@UseGuards(AuthGuard('jwt'), AdminGuard, RolesGuard)
export class WalletsAdminController {
  constructor(private ridersService: RidersService) {}

  @Get()
  @Roles('SuperAdmin', 'Administrator', 'Finance')
  list(@Query('search') search?: string) {
    return this.ridersService.listWallets(search);
  }
}
