import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { AdminRole } from '@digi-switchride/shared';

export type AdminUserDocument = HydratedDocument<AdminUser>;

@Schema({ timestamps: true, collection: 'admin_users' })
export class AdminUser {
  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  email!: string;

  @Prop({ required: true })
  passwordHash!: string;

  @Prop({ required: true, trim: true })
  fullName!: string;

  @Prop({
    required: true,
    enum: [
      'SuperAdmin',
      'Administrator',
      'CommandCenter',
      'Finance',
      'Operations',
      'ServiceTeam',
      'KycTeam',
      'FleetManager',
      'SupportAgent',
      'FinanceAdmin',
      'KycReviewer',
    ],
    default: 'CommandCenter',
  })
  role!: AdminRole;

  @Prop({ default: true })
  isActive!: boolean;
}

export const AdminUserSchema = SchemaFactory.createForClass(AdminUser);
