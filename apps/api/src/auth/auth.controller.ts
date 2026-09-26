import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
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
  @Roles('SuperAdmin')
  listUsers() {
    return this.authService.listAdminUsers().then((items) => ({ items }));
  }

  @Post()
  @Roles('SuperAdmin')
  createUser(@Req() req: Parameters<typeof actorFromRequest>[0], @Body() dto: CreateAdminUserDto) {
    return this.authService.createAdminUser(dto, actorFromRequest(req));
  }

  @Put(':id')
  @Roles('SuperAdmin')
  updateUser(@Req() req: Parameters<typeof actorFromRequest>[0], @Param('id') id: string, @Body() dto: UpdateAdminUserDto) {
    return this.authService.updateAdminUser(id, dto, actorFromRequest(req));
  }
}
