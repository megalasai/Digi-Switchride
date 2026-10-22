import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { tenantPlugin } from '../common/tenant.plugin';

export type PaymentGatewayDocument = HydratedDocument<PaymentGateway>;

@Schema({ timestamps: true, collection: 'payment_gateways' })
export class PaymentGateway {
  @Prop({ required: true, type: String, unique: true })
  tenantId!: string;

  @Prop({ required: true, enum: ['Razorpay', 'PayU', 'Cashfree', 'PhonePe', 'Paytm', 'Stripe', 'Custom'] })
  provider!: string;

  @Prop({ required: true, enum: ['Test', 'Live'], default: 'Test' })
  mode!: 'Test' | 'Live';

  @Prop({ default: false })
  enabled!: boolean;

  @Prop({ trim: true })
  displayName?: string;

  @Prop({ trim: true })
  merchantId?: string;

  @Prop({ trim: true })
  keyId?: string;

  @Prop({ trim: true })
  keySecret?: string;

  @Prop({ trim: true })
  webhookSecret?: string;

  @Prop({ type: [String], default: ['UPI', 'QR', 'NetBanking', 'DebitCard', 'CreditCard'] })
  methods!: string[];

  @Prop({ trim: true })
  checkoutUrl?: string;

  @Prop({ trim: true })
  notes?: string;
}

export const PaymentGatewaySchema = SchemaFactory.createForClass(PaymentGateway);
PaymentGatewaySchema.plugin(tenantPlugin);
PaymentGatewaySchema.index({ tenantId: 1 }, { unique: true });
