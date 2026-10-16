import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { BillingFrequency, WalletEntryType } from '@digi-switchride/shared';
import { tenantPlugin } from '../common/tenant.plugin';

export type RentalPlanDocument = HydratedDocument<RentalPlan>;

@Schema({ timestamps: true, collection: 'rental_plans' })
export class RentalPlan {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, default: 0 })
  charges!: number;

  @Prop({ required: true, default: 30 })
  durationDays!: number;

  @Prop({ required: true, enum: ['Weekly', 'Monthly', 'Quarterly'], default: 'Monthly' })
  billingFrequency!: BillingFrequency;

  @Prop({ trim: true })
  eligibility?: string;

  @Prop({ trim: true })
  terms?: string;

  @Prop({ default: true })
  isActive!: boolean;
}

export const RentalPlanSchema = SchemaFactory.createForClass(RentalPlan);
RentalPlanSchema.plugin(tenantPlugin);

export type WalletTransactionDocument = HydratedDocument<WalletTransaction>;

@Schema({ timestamps: true, collection: 'wallet_transactions' })
export class WalletTransaction {
  @Prop({ required: true, type: String })
  riderId!: string;

  @Prop({ required: true, enum: ['Credit', 'Debit'] })
  type!: WalletEntryType;

  @Prop({ required: true })
  amount!: number;

  @Prop({ trim: true })
  reference?: string;

  @Prop({ trim: true })
  note?: string;

  @Prop()
  actorId?: string;

  @Prop({ default: 0 })
  balanceAfter!: number;
}

export const WalletTransactionSchema = SchemaFactory.createForClass(WalletTransaction);
WalletTransactionSchema.index({ riderId: 1, createdAt: -1 });
WalletTransactionSchema.plugin(tenantPlugin);
