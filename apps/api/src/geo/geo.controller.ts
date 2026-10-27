import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../auth/admin.guard';
import { GeoService } from './geo.service';

@Controller('v1/geo')
@UseGuards(AuthGuard('jwt'), AdminGuard)
export class GeoController {
  constructor(private geo: GeoService) {}

  @Get('status')
  status() {
    return this.geo.status();
  }

  @Get('search')
  search(@Query('q') q = '') {
    const query = q.trim();
    if (query.length < 3) return { items: [] };
    return this.geo.search(query).then((items) => ({ items }));
  }

  @Get('reverse')
  reverse(@Query('lat') lat: string, @Query('lng') lng: string) {
    return this.geo.reverse(Number(lat), Number(lng));
  }
}
