import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { normalizeAdminRole } from '@digi-switchride/shared';
import { readSecret } from '../config/secrets';
import { AuthService } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: readSecret(config, 'JWT_SECRET', 'dev-secret-key-min-32-chars-long!!'),
    });
  }

  async validate(payload: { sub: string; phone?: string; email?: string; role: string; type?: string; tenantId?: string; hubIds?: string[] }) {
    if (payload.type === 'admin') {
      const admin = await this.authService.validateAdmin(payload.sub);
      if (!admin) return null;
      return {
        adminId: payload.sub,
        email: admin.email,
        role: normalizeAdminRole(admin.role) ?? admin.role,
        type: 'admin',
        tenantId: (admin as { tenantId?: string }).tenantId ?? payload.tenantId,
        hubIds: admin.hubIds?.length ? admin.hubIds : payload.hubIds,
      };
    }

    const customer = await this.authService.validateCustomer(payload.sub);
    if (!customer) return null;
    return {
      customerId: payload.sub,
      phone: customer.phone,
      role: 'Customer',
      type: 'customer',
      tenantId: (customer as { tenantId?: string }).tenantId ?? payload.tenantId,
    };
  }
}
