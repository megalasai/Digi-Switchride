import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard, RolesGuard } from '../auth/admin.guard';
import { Roles } from '../auth/roles.decorator';
import { TenantsService } from './tenants.service';

@Controller('v1/admin/tenants')
@UseGuards(AuthGuard('jwt'), AdminGuard, RolesGuard)
export class TenantsController {
  constructor(private tenants: TenantsService) {}

  @Get()
  @Roles('SuperAdmin')
  list() {
    return this.tenants.list().then((items) => ({ items }));
  }

  @Post()
  @Roles('SuperAdmin')
  create(@Body() body: { name: string; slug: string; contactEmail?: string; notes?: string }) {
    return this.tenants.create(body);
  }

  @Put(':id')
  @Roles('SuperAdmin')
  update(
    @Param('id') id: string,
    @Body() body: { name?: string; contactEmail?: string; status?: 'Active' | 'Suspended'; notes?: string },
  ) {
    return this.tenants.update(id, body);
  }

  @Delete(':id')
  @Roles('SuperAdmin')
  remove(@Param('id') id: string) {
    return this.tenants.remove(id);
  }
}

@Controller('v1/tenants')
export class PublicTenantsController {
  constructor(private tenants: TenantsService) {}

  @Get('current')
  async current() {
    const items = await this.tenants.listCustomers();
    const active = items.filter((t) => t.status === 'Active');
    return {
      items: active.map((t) => ({
        id: t.id,
        slug: t.slug,
        name: t.name,
        isDefault: t.isDefault,
        kind: t.kind,
        logoUrl: `/api/v1/branding/optional-logo?slug=${encodeURIComponent(t.slug)}`,
      })),
    };
  }
}
