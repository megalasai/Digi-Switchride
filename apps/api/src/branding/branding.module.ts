import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { TenantsModule } from '../tenants/tenants.module';
import { Branding, BrandingSchema } from '../schemas/branding.schema';
import { BrandingAdminController, BrandingPublicController } from './branding.controller';
import { BrandingService } from './branding.service';

@Module({
  imports: [AuthModule, TenantsModule, MongooseModule.forFeature([{ name: Branding.name, schema: BrandingSchema }])],
  controllers: [BrandingPublicController, BrandingAdminController],
  providers: [BrandingService],
  exports: [BrandingService],
})
export class BrandingModule {}
