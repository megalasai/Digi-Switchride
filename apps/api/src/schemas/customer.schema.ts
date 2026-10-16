import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { AccountStatus, KycStatus } from '@digi-switchride/shared';
import { tenantPlugin } from '../common/tenant.plugin';

export type CustomerDocument = HydratedDocument<Customer>;

@Schema({ timestamps: true, collection: 'customers' })
export class Customer {
  @Prop({ trim: true, lowercase: true, sparse: true })
  username?: string;

  @Prop()
  passwordHash?: string;

  @Prop({ trim: true, sparse: true })
  phone?: string;

  @Prop({ trim: true, lowercase: true })
  email?: string;

  @Prop({ trim: true })
  fullName?: string;

  @Prop({ trim: true })
  emergencyContact?: string;

  @Prop({ trim: true })
  address?: string;

  @Prop({ required: true, enum: ['NotSubmitted', 'Pending', 'UnderReview', 'Approved', 'Rejected'], default: 'NotSubmitted' })
  kycStatus!: KycStatus;

  @Prop({ required: true, enum: ['Active', 'Suspended', 'Deactivated'], default: 'Active' })
  accountStatus!: AccountStatus;

  @Prop({ type: String })
  assignedVehicleId?: string;

  @Prop({ type: String })
  rentalPlanId?: string;

  @Prop({ default: 0 })
  walletBalance!: number;

  @Prop({ trim: true, unique: true, sparse: true })
  referralCode?: string;

  @Prop({ type: String })
  referredBy?: string;
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);
CustomerSchema.plugin(tenantPlugin);
CustomerSchema.index({ tenantId: 1, phone: 1 }, { unique: true, sparse: true });
CustomerSchema.index({ tenantId: 1, username: 1 }, { unique: true, sparse: true });
CustomerSchema.index({ accountStatus: 1, kycStatus: 1 });
CustomerSchema.index({ assignedVehicleId: 1 }, { sparse: true });

@Schema({ timestamps: true, collection: 'kyc_submissions' })
export class KycSubmission {
  @Prop({ required: true, type: String })
  customerId!: string;

  @Prop({ required: true, enum: ['Aadhaar', 'PAN', 'DrivingLicence', 'Selfie'] })
  documentType!: string;

  @Prop()
  documentNumberMasked?: string;

  @Prop()
  blobUrl?: string;

  @Prop({ required: true, enum: ['NotSubmitted', 'Pending', 'UnderReview', 'Approved', 'Rejected'], default: 'Pending' })
  status!: KycStatus;

  @Prop()
  rejectionReason?: string;

  @Prop()
  reviewedAt?: Date;

  @Prop()
  reviewedBy?: string;
}

export type KycSubmissionDocument = HydratedDocument<KycSubmission>;
export const KycSubmissionSchema = SchemaFactory.createForClass(KycSubmission);
KycSubmissionSchema.index({ customerId: 1 });
KycSubmissionSchema.plugin(tenantPlugin);

@Schema({ timestamps: true, collection: 'otp_records' })
export class OtpRecord {
  @Prop({ required: true })
  phone!: string;

  @Prop({ required: true })
  otpHash!: string;

  @Prop({ required: true })
  expiresAt!: Date;

  @Prop({ default: false })
  isUsed!: boolean;
}

export type OtpRecordDocument = HydratedDocument<OtpRecord>;
export const OtpRecordSchema = SchemaFactory.createForClass(OtpRecord);
OtpRecordSchema.index({ phone: 1, expiresAt: 1 });
OtpRecordSchema.plugin(tenantPlugin);

@Schema({ timestamps: true, collection: 'refresh_tokens' })
export class RefreshToken {
  @Prop({ required: true })
  customerId!: string;

  @Prop({ required: true })
  tokenHash!: string;

  @Prop({ required: true })
  expiresAt!: Date;

  @Prop({ default: false })
  isRevoked!: boolean;
}

export type RefreshTokenDocument = HydratedDocument<RefreshToken>;
export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);
