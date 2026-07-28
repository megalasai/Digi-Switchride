import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
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
