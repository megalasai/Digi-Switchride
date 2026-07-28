import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get<string>('JWT_SECRET', 'dev-secret-key-min-32-chars-long!!'),
    });
  }

  async validate(payload: { sub: string; phone: string; role: string }) {
    const customer = await this.authService.validateCustomer(payload.sub);
    if (!customer) return null;
    return { customerId: payload.sub, phone: payload.phone, role: payload.role };
  }
}
