import { Controller, Get } from '@nestjs/common';
import { GeoService } from './geo/geo.service';

@Controller('health')
export class HealthController {
  constructor(private geo: GeoService) {}

  @Get()
  async ok() {
    const location = await this.geo.status();
    return {
      status: 'ok',
      service: 'api',
      product: 'Fleetel-Switchride',
      location,
    };
  }
}
