import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { TrackingPartnerService } from './tracking-partner.service';

@Injectable()
export class TrackingPartnerGuard implements CanActivate {
  constructor(private partners: TrackingPartnerService) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<{
      params?: { applicationId?: string };
      headers: Record<string, string | string[] | undefined>;
      trackingApp?: { applicationId: string; name: string };
    }>();
    const key = readApiKey(req.headers);
    if (!key) {
      throw new UnauthorizedException('Send the tracking API key in the X-Api-Key header or as Authorization: Bearer');
    }
    await this.partners.authenticate(key);
    return true;
  }
}

function readApiKey(headers: Record<string, string | string[] | undefined>) {
  const direct = headerValue(headers['x-api-key']);
  if (direct) return direct;
  const auth = headerValue(headers.authorization);
  if (auth?.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return undefined;
}

function headerValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0]?.trim() || undefined;
  return value?.trim() || undefined;
}
