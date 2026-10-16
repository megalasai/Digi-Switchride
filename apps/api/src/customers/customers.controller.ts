import { Body, Controller, Get, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { KycService, ProfileService } from './customers.service';

@Controller('v1')
@UseGuards(AuthGuard('jwt'))
export class CustomersController {
  constructor(
    private profileService: ProfileService,
    private kycService: KycService,
  ) {}

  @Get('me')
  getProfile(@Req() req: { user: { customerId: string } }) {
    return this.profileService.getProfile(req.user.customerId);
  }

  @Put('me')
  updateProfile(@Req() req: { user: { customerId: string } }, @Body() body: { email?: string; fullName?: string; emergencyContact?: string; address?: string }) {
    return this.profileService.updateProfile(req.user.customerId, body);
  }

  @Post('kyc/submissions')
  submitKyc(
    @Req() req: { user: { customerId: string } },
    @Body() body: { documentType: string; documentNumber?: string; blobUrl?: string },
  ) {
    return this.kycService.submit(req.user.customerId, body.documentType, body.documentNumber, body.blobUrl);
  }

  @Get('kyc/status')
  kycStatus(@Req() req: { user: { customerId: string } }) {
    return this.kycService.getStatus(req.user.customerId);
  }
}
