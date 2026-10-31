import { Body, Controller, Get, Header, Put, Query, Res, StreamableFile, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { AdminGuard, RolesGuard } from '../auth/admin.guard';
import { Roles } from '../auth/roles.decorator';
import { BrandingService } from './branding.service';

@Controller('v1/branding')
export class BrandingPublicController {
  constructor(private brandingService: BrandingService) {}

  @Get()
  get(@Query('slug') slug?: string) {
    return this.brandingService.getForSlug(slug);
  }

  @Get('optional-logo')
  @Header('Cache-Control', 'no-store')
  async optionalLogo(@Query('slug') slug?: string, @Res({ passthrough: true }) res?: Response) {
    const logo = await this.brandingService.getOptionalLogo(slug);
    if (!logo) {
      res?.status(204);
      return;
    }
    return new StreamableFile(logo.buffer, { type: logo.mime, disposition: 'inline' });
  }
}

@Controller('v1/admin/branding')
@UseGuards(AuthGuard('jwt'), AdminGuard, RolesGuard)
export class BrandingAdminController {
  constructor(private brandingService: BrandingService) {}

  @Get()
  get() {
    return this.brandingService.getPublic();
  }

  @Put()
  @Roles('SuperAdmin', 'Administrator')
  update(
    @Body()
    body: { productName?: string; optionalLogoDataUrl?: string | null; clearOptionalLogo?: boolean },
  ) {
    return this.brandingService.update(body);
  }
}
