import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard, RolesGuard } from '../auth/admin.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateGeoPlaceDto, UpdateGeoPlaceDto } from './geo.dto';
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

@Controller('v1/admin/geo/places')
@UseGuards(AuthGuard('jwt'), AdminGuard, RolesGuard)
@Roles('SuperAdmin', 'Administrator', 'Operations', 'CommandCenter', 'ServiceTeam')
export class GeoPlacesController {
  constructor(private geo: GeoService) {}

  @Get()
  list() {
    return this.geo.listPlaces().then((items) => ({ items }));
  }

  @Post()
  create(@Body() body: CreateGeoPlaceDto) {
    return this.geo.createPlace(body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: UpdateGeoPlaceDto) {
    return this.geo.updatePlace(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.geo.removePlace(id);
  }
}
