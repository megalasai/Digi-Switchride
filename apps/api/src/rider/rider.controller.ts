import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RiderAppService } from './rider.service';

@Controller('v1/rider')
@UseGuards(AuthGuard('jwt'))
export class RiderAppController {
  constructor(private rider: RiderAppService) {}

  @Get('home')
  home(@Req() req: { user: { customerId: string } }) {
    return this.rider.home(req.user.customerId);
  }

  @Get('vehicle')
  vehicle(@Req() req: { user: { customerId: string } }) {
    return this.rider.vehicle(req.user.customerId);
  }

  @Post('breakdowns')
  breakdown(
    @Req() req: { user: { customerId: string } },
    @Body() body: { issueType?: string; description: string; lat?: number; lng?: number },
  ) {
    return this.rider.reportBreakdown(req.user.customerId, { issueType: body.issueType ?? 'Breakdown', description: body.description, lat: body.lat, lng: body.lng });
  }

  @Get('breakdowns')
  breakdowns(@Req() req: { user: { customerId: string } }) {
    return this.rider.vehicle(req.user.customerId).then((v) => ({ items: v.breakdowns }));
  }

  @Post('service-requests')
  service(
    @Req() req: { user: { customerId: string } },
    @Body() body: { category: string; description: string },
  ) {
    return this.rider.raiseService(req.user.customerId, body);
  }

  @Get('service-requests')
  services(@Req() req: { user: { customerId: string } }) {
    return this.rider.serviceHistory(req.user.customerId);
  }

  @Get('service-centres')
  centres() {
    return this.rider.centres();
  }

  @Get('slots')
  slots(@Query('centreId') centreId?: string, @Query('date') date?: string) {
    return this.rider.slots(centreId, date);
  }

  @Get('appointments')
  appointments(@Req() req: { user: { customerId: string } }) {
    return this.rider.appointments(req.user.customerId);
  }

  @Post('appointments')
  schedule(
    @Req() req: { user: { customerId: string } },
    @Body() body: { centreId: string; slotId: string; notes?: string; serviceRequestId?: string },
  ) {
    return this.rider.schedule(req.user.customerId, body);
  }

  @Post('appointments/:id/reschedule')
  reschedule(@Param('id') id: string, @Req() req: { user: { customerId: string } }, @Body() body: { slotId: string; notes?: string }) {
    return this.rider.reschedule(req.user.customerId, id, body.slotId, body.notes);
  }

  @Post('appointments/:id/cancel')
  cancel(@Param('id') id: string, @Req() req: { user: { customerId: string } }, @Body() body: { reason: string }) {
    return this.rider.cancelAppointment(req.user.customerId, id, body.reason);
  }

  @Get('wallet')
  wallet(@Req() req: { user: { customerId: string } }) {
    return this.rider.wallet(req.user.customerId);
  }

  @Get('payments')
  payments(@Req() req: { user: { customerId: string } }) {
    return this.rider.payments(req.user.customerId);
  }

  @Post('payments')
  pay(@Req() req: { user: { customerId: string } }, @Body() body: { method: string }) {
    return this.rider.pay(req.user.customerId, body.method);
  }

  @Get('plans')
  plans(@Req() req: { user: { customerId: string } }) {
    return this.rider.plans(req.user.customerId);
  }

  @Post('plan')
  changePlan(@Req() req: { user: { customerId: string } }, @Body() body: { rentalPlanId: string }) {
    return this.rider.changePlan(req.user.customerId, body.rentalPlanId);
  }

  @Get('agreements')
  agreements(@Req() req: { user: { customerId: string } }) {
    return this.rider.agreements(req.user.customerId);
  }

  @Get('stations')
  stations() {
    return this.rider.stations();
  }

  @Get('notifications')
  notifications() {
    return this.rider.notifications();
  }

  @Get('kyc')
  kyc(@Req() req: { user: { customerId: string } }) {
    return this.rider.kyc(req.user.customerId);
  }

  @Post('kyc')
  submitKyc(
    @Req() req: { user: { customerId: string } },
    @Body() body: { documentType: string; documentNumber?: string; blobUrl?: string },
  ) {
    return this.rider.submitKyc(req.user.customerId, body.documentType, body.documentNumber, body.blobUrl);
  }

  @Post('feedback')
  feedback(@Req() req: { user: { customerId: string } }, @Body() body: { rating: number; comment: string; category?: string }) {
    return this.rider.feedback(req.user.customerId, body);
  }

  @Get('referral')
  referral(@Req() req: { user: { customerId: string } }) {
    return this.rider.referral(req.user.customerId);
  }

  @Post('referral')
  applyReferral(@Req() req: { user: { customerId: string } }, @Body() body: { code: string }) {
    return this.rider.applyReferral(req.user.customerId, body.code);
  }

  @Get('support')
  tickets(@Req() req: { user: { customerId: string } }) {
    return this.rider.tickets(req.user.customerId);
  }

  @Post('support')
  ticket(@Req() req: { user: { customerId: string } }, @Body() body: { category: string; subject: string; description: string }) {
    return this.rider.createTicket(req.user.customerId, body);
  }

  @Get('profile')
  profile(@Req() req: { user: { customerId: string } }) {
    return this.rider.profile(req.user.customerId);
  }

  @Put('profile')
  update(@Req() req: { user: { customerId: string } }, @Body() body: { email?: string; fullName?: string; address?: string; emergencyContact?: string }) {
    return this.rider.updateProfile(req.user.customerId, body);
  }
}
