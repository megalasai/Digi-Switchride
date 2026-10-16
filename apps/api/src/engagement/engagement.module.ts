import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { Customer, CustomerSchema } from '../schemas/customer.schema';
import {
  Agreement,
  AgreementSchema,
  AppNotification,
  AppNotificationSchema,
  ChargingStation,
  ChargingStationSchema,
  Feedback,
  FeedbackSchema,
} from '../schemas/engagement.schema';
import {
  AgreementsAdminController,
  ChargingStationsAdminController,
  FeedbackAdminController,
  NotificationsAdminController,
  ReferralsAdminController,
} from './engagement.controller';
import { EngagementService } from './engagement.service';

@Module({
  imports: [
    AuthModule,
    AuditModule,
    MongooseModule.forFeature([
      { name: ChargingStation.name, schema: ChargingStationSchema },
      { name: AppNotification.name, schema: AppNotificationSchema },
      { name: Feedback.name, schema: FeedbackSchema },
      { name: Agreement.name, schema: AgreementSchema },
      { name: Customer.name, schema: CustomerSchema },
    ]),
  ],
  controllers: [
    ChargingStationsAdminController,
    NotificationsAdminController,
    FeedbackAdminController,
    AgreementsAdminController,
    ReferralsAdminController,
  ],
  providers: [EngagementService],
  exports: [EngagementService],
})
export class EngagementModule {}
