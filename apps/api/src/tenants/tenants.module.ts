import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { Tenant, TenantSchema } from '../schemas/tenant.schema';
import { AdminUser, AdminUserSchema } from '../schemas/admin.schema';
import { TenantsService } from './tenants.service';
import { PublicTenantsController, TenantsController } from './tenants.controller';
import { TenantInterceptor } from './tenant.interceptor';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Tenant.name, schema: TenantSchema },
      { name: AdminUser.name, schema: AdminUserSchema },
    ]),
  ],
  controllers: [TenantsController, PublicTenantsController],
  providers: [
    TenantsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor,
    },
  ],
  exports: [TenantsService],
})
export class TenantsModule {}
