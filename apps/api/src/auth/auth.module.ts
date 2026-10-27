import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { readSecret } from '../config/secrets';
import { Customer, CustomerSchema, OtpRecord, OtpRecordSchema, RefreshToken, RefreshTokenSchema } from '../schemas/customer.schema';
import { AdminUser, AdminUserSchema } from '../schemas/admin.schema';
import { AuditModule } from '../audit/audit.module';
import { TenantsModule } from '../tenants/tenants.module';
import { AuthService } from './auth.service';
import { AuthController, AdminUsersController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { AdminGuard, RolesGuard } from './admin.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Customer.name, schema: CustomerSchema },
      { name: OtpRecord.name, schema: OtpRecordSchema },
      { name: RefreshToken.name, schema: RefreshTokenSchema },
      { name: AdminUser.name, schema: AdminUserSchema },
    ]),
    AuditModule,
    TenantsModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: readSecret(config, 'JWT_SECRET', 'dev-secret-key-min-32-chars-long!!'),
        signOptions: { expiresIn: '1h' },
      }),
    }),
  ],
  controllers: [AuthController, AdminUsersController],
  providers: [AuthService, JwtStrategy, AdminGuard, RolesGuard],
  exports: [AuthService, JwtModule, AdminGuard, RolesGuard],
})
export class AuthModule {}
