import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BookingsService } from './bookings.service';

@Controller('v1')
@UseGuards(AuthGuard('jwt'))
export class BookingsController {
  constructor(private bookingsService: BookingsService) {}

  @Post('bookings')
  create(@Req() req: { user: { customerId: string } }, @Body() body: { vehicleId: string; bookingType: string; promoCode?: string }) {
    return this.bookingsService.create(req.user.customerId, body.vehicleId, body.bookingType as any, body.promoCode);
  }

  @Get('bookings')
  list(@Req() req: { user: { customerId: string } }, @Query('status') status?: string, @Query('page') page = '1', @Query('pageSize') pageSize = '20') {
    return this.bookingsService.list(req.user.customerId, status, +page, +pageSize);
  }

  @Get('bookings/:bookingId')
  get(@Param('bookingId') bookingId: string) {
    return this.bookingsService.get(bookingId);
  }

  @Post('bookings/:bookingId/cancel')
  cancel(@Param('bookingId') bookingId: string) {
    return this.bookingsService.cancel(bookingId);
  }

  @Post('rides/:rideId/start')
  startRide(@Req() req: { user: { customerId: string } }, @Param('rideId') rideId: string, @Body() body: { idempotencyKey?: string; location?: { lat: number; lng: number } }) {
    return this.bookingsService.startRide(rideId, req.user.customerId, body.idempotencyKey, body.location);
  }

  @Post('rides/:rideId/end')
  endRide(@Req() req: { user: { customerId: string } }, @Param('rideId') rideId: string, @Body() body: { idempotencyKey?: string; location?: { lat: number; lng: number } }) {
    return this.bookingsService.endRide(rideId, req.user.customerId, body.idempotencyKey, body.location);
  }

  @Get('rides/active')
  async activeRide(@Req() req: { user: { customerId: string } }) {
    const ride = await this.bookingsService.getActiveRide(req.user.customerId);
    return ride ?? undefined;
  }

  @Get('rides/history')
  history(@Req() req: { user: { customerId: string } }, @Query('page') page = '1', @Query('pageSize') pageSize = '20') {
    return this.bookingsService.getHistory(req.user.customerId, +page, +pageSize);
  }
}

@Controller('v1/admin')
@UseGuards(AuthGuard('jwt'))
export class BookingsAdminController {
  constructor(private bookingsService: BookingsService) {}

  @Get('bookings')
  list(@Query('status') status?: string, @Query('page') page = '1', @Query('pageSize') pageSize = '20') {
    return this.bookingsService.adminList(status, +page, +pageSize);
  }

  @Get('rides/active')
  activeRides() {
    return this.bookingsService.getActiveRidesAdmin().then((items) => ({ items }));
  }
}
