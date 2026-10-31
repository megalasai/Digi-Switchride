import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { GeoPlace, GeoPlaceSchema } from '../schemas/geo-place.schema';
import { GeoController, GeoPlacesController } from './geo.controller';
import { GeoService } from './geo.service';

@Module({
  imports: [AuthModule, MongooseModule.forFeature([{ name: GeoPlace.name, schema: GeoPlaceSchema }])],
  controllers: [GeoController, GeoPlacesController],
  providers: [GeoService],
  exports: [GeoService],
})
export class GeoModule {}
