import { from } from 'rxjs';
import { lastValueFrom } from 'rxjs';
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
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
    if (isPublicUnauthenticated(path)) {
      return from(tenantAls.run({ tenantId: null, skip: true }, () => lastValueFrom(next.handle())));
    }
    const headerId = headerValue(req.headers['x-tenant-id']);
    const headerSlug = headerValue(req.headers['x-tenant-slug']);
    const user = req.user;
    let tenantId: string | null;

    if (path.includes('/internal/iot')) {
      tenantId = null;
    } else if (user?.type === 'admin' && user.role === 'SuperAdmin') {
      if (headerId || headerSlug) tenantId = await this.tenants.resolveTenantId(headerId || headerSlug);
      else tenantId = null;
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
    route === '/api/v1/tenants/current'
  );
}

function headerValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0]?.trim() || undefined;
  return value?.trim() || undefined;
}
