import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { getMongooseOptions, resolveMongoUri } from './config/mongo.config';
import { AuthModule } from './auth/auth.module';
import { CustomersModule } from './customers/customers.module';
import { FleetModule } from './fleet/fleet.module';
import { BookingsModule } from './bookings/bookings.module';
import { PaymentsModule } from './payments/payments.module';
import { SupportModule } from './support/support.module';
import { IoTModule } from './iot/iot.module';
import { AuditAdminModule } from './audit/audit-admin.module';
import { AuditModule } from './audit/audit.module';
import { OperationsModule } from './operations/operations.module';
import { EngagementModule } from './engagement/engagement.module';
import { RiderModule } from './rider/rider.module';
import { BrandingModule } from './branding/branding.module';
import { TenantsModule } from './tenants/tenants.module';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const logger = new Logger('MongoDB');
        const raw = config.get<string>('MONGODB_URI', 'mongodb://localhost:27017/switchride');
        const uri = resolveMongoUri(raw, logger);
        return getMongooseOptions(uri);
      },
    }),
    TenantsModule,
    AuthModule,
    CustomersModule,
    FleetModule,
    BookingsModule,
    PaymentsModule,
    SupportModule,
    IoTModule,
    AuditModule,
    AuditAdminModule,
    OperationsModule,
    EngagementModule,
    RiderModule,
    BrandingModule,
  ],
})
export class AppModule {}
