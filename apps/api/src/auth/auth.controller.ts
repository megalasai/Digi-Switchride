import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { actorFromRequest } from '../common/actor';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AdminGuard, RolesGuard } from './admin.guard';
import { Roles } from './roles.decorator';
import { AdminLoginDto, CreateAdminUserDto, UpdateAdminUserDto } from './dto/admin-auth.dto';
import { RefreshTokenDto, SendOtpDto, VerifyOtpDto, CustomerRegisterDto, CustomerLoginDto } from './dto/auth.dto';

@Controller('v1/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('otp/send')
  sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto);
  }

  @Post('otp/verify')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Post('register')
  register(@Body() dto: CustomerRegisterDto) {
    return this.authService.registerCustomer(dto);
  }

  @Post('login')
  login(@Body() dto: CustomerLoginDto) {
    return this.authService.loginCustomer(dto);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @Post('admin/login')
  adminLogin(@Body() dto: AdminLoginDto) {
    return this.authService.adminLogin(dto);
  }
}

@Controller('v1/admin/users')
@UseGuards(AuthGuard('jwt'), AdminGuard, RolesGuard)
export class AdminUsersController {
  constructor(private authService: AuthService) {}

  @Get()
  @Roles('SuperAdmin', 'Administrator')
  listUsers(@Req() req: { user?: { role?: string; tenantId?: string } }) {
    return this.authService.listAdminUsers(req.user).then((items) => ({ items }));
  }

  @Post()
  @Roles('SuperAdmin', 'Administrator')
  createUser(@Req() req: Parameters<typeof actorFromRequest>[0] & { user?: { role?: string; tenantId?: string } }, @Body() dto: CreateAdminUserDto) {
    return this.authService.createAdminUser(dto, actorFromRequest(req), req.user);
  }

  @Put(':id')
  @Roles('SuperAdmin', 'Administrator')
  updateUser(@Req() req: Parameters<typeof actorFromRequest>[0] & { user?: { role?: string; tenantId?: string } }, @Param('id') id: string, @Body() dto: UpdateAdminUserDto) {
    return this.authService.updateAdminUser(id, dto, actorFromRequest(req), req.user);
  }

  @Delete(':id')
  @Roles('SuperAdmin', 'Administrator')
  deleteUser(
    @Req() req: Parameters<typeof actorFromRequest>[0] & { user?: { role?: string; tenantId?: string; adminId?: string } },
    @Param('id') id: string,
  ) {
    return this.authService.deleteAdminUser(id, actorFromRequest(req), req.user);
  }
}
