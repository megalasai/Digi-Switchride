import { from } from 'rxjs';
import { lastValueFrom } from 'rxjs';
import { CallHandler, ExecutionContext, ForbiddenException, Injectable, NestInterceptor } from '@nestjs/common';
import { tenantAls } from '../common/tenant-als';
import { TenantsService } from './tenants.service';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private tenants: TenantsService) {}

  async intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest<{
      url?: string;
      originalUrl?: string;
      user?: { type?: string; role?: string; tenantId?: string; hubIds?: string[] };
      headers: Record<string, string | string[] | undefined>;
    }>();
    const path = req.originalUrl ?? req.url ?? '';
    const headerId = headerValue(req.headers['x-tenant-id']);
    const headerSlug = headerValue(req.headers['x-tenant-slug']);
    if (isPublicBranding(path)) {
      const slug = queryValue(path, 'slug') || headerSlug;
      const tenant = slug ? await this.tenants.findBySlug(slug) : null;
      return from(
        tenantAls.run({ tenantId: tenant?._id.toString() ?? null, hubIds: null, skip: !tenant }, () =>
          lastValueFrom(next.handle()),
        ),
      );
    }
    if (isPublicUnauthenticated(path)) {
      return from(tenantAls.run({ tenantId: null, skip: true }, () => lastValueFrom(next.handle())));
    }
    const user = req.user;
    let tenantId: string | null;

    if (path.includes('/internal/iot') || path.includes('/iot/ingest')) {
      tenantId = null;
    } else if (user?.type === 'admin' && user.role === 'SuperAdmin') {
      if (headerId || headerSlug) tenantId = await this.tenants.resolveTenantId(headerId || headerSlug);
      else tenantId = null;
    } else if (user?.type === 'admin') {
      if (!user.tenantId) {
        throw new ForbiddenException('This account is not assigned to an organization');
      }
      tenantId = user.tenantId;
    } else if (user?.tenantId) {
      tenantId = user.tenantId;
    } else {
      tenantId = await this.tenants.resolveTenantId(headerSlug || headerId);
    }

    return from(tenantAls.run({ tenantId, hubIds: user?.hubIds?.length ? user.hubIds : null, skip: false }, () => lastValueFrom(next.handle())));
  }
}

function isPublicUnauthenticated(path: string) {
  const route = path.split('?')[0] ?? '';
  return (
    route.startsWith('/api/health') ||
    route === '/api/v1/auth/admin/login' ||
    route === '/api/v1/auth/login' ||
    route === '/api/v1/auth/register' ||
    route === '/api/v1/auth/refresh' ||
    route.startsWith('/api/v1/auth/otp/') ||
    route === '/api/v1/tenants/current' ||
    route === '/api/v1/iot/ingest'
  );
}

function isPublicBranding(path: string) {
  const route = path.split('?')[0] ?? '';
  return route.startsWith('/api/v1/branding');
}

function queryValue(path: string, key: string) {
  const query = path.includes('?') ? path.slice(path.indexOf('?') + 1) : '';
  return new URLSearchParams(query).get(key)?.trim() || undefined;
}

function headerValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0]?.trim() || undefined;
  return value?.trim() || undefined;
}
