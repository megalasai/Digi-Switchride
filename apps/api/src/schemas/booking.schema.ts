import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { BookingStatus, BookingType, PaymentStatus, RideStatus } from '@digi-switchride/shared';
import { tenantPlugin } from '../common/tenant.plugin';
import { GeoLocation } from './fleet.schema';

export type BookingDocument = HydratedDocument<Booking>;

@Schema({ timestamps: true, collection: 'bookings' })
export class Booking {
  @Prop({ required: true, type: String })
  customerId!: string;

  @Prop({ required: true, type: String })
  vehicleId!: string;

  @Prop({ required: true, type: String })
  hubId!: string;

  @Prop({ required: true, enum: ['PerMinute', 'Hourly', 'Daily', 'Weekly', 'Monthly'] })
  bookingType!: BookingType;

  @Prop({ required: true, enum: ['Draft', 'Confirmed', 'Active', 'Completed', 'Cancelled', 'NoShow'], default: 'Draft' })
  status!: BookingStatus;

  @Prop({ required: true, default: 0 })
  estimatedAmount!: number;

  @Prop({ default: 'INR' })
  currency!: string;

  @Prop()
  promoCode?: string;

  @Prop()
  startTime?: Date;

  @Prop()
  endTime?: Date;
}

export const BookingSchema = SchemaFactory.createForClass(Booking);
BookingSchema.index({ customerId: 1, status: 1 });
BookingSchema.plugin(tenantPlugin);

export type RideDocument = HydratedDocument<Ride>;

@Schema({ timestamps: true, collection: 'rides' })
export class Ride {
  @Prop({ required: true, type: String })
  bookingId!: string;

  @Prop({ required: true, type: String })
  vehicleId!: string;

  @Prop({ required: true, type: String })
  customerId!: string;

  @Prop({ required: true, enum: ['NotStarted', 'InProgress', 'Ended', 'ForceEnded'], default: 'NotStarted' })
  status!: RideStatus;

  @Prop()
  startedAt?: Date;

  @Prop()
  endedAt?: Date;

  @Prop({ type: GeoLocation })
  startLocation?: GeoLocation;

  @Prop({ type: GeoLocation })
  endLocation?: GeoLocation;

  @Prop()
  durationMinutes?: number;

  @Prop()
  distanceKm?: number;

  @Prop()
  finalFare?: number;

  @Prop({ sparse: true, unique: true })
  startIdempotencyKey?: string;

  @Prop({ sparse: true, unique: true })
  endIdempotencyKey?: string;
}

export const RideSchema = SchemaFactory.createForClass(Ride);
RideSchema.index({ customerId: 1, status: 1 });
RideSchema.plugin(tenantPlugin);

export type PaymentDocument = HydratedDocument<Payment>;

@Schema({ timestamps: true, collection: 'payments' })
export class Payment {
  @Prop({ required: true, type: String })
  customerId!: string;

  @Prop({ required: true, type: String })
  bookingId!: string;

  @Prop({ required: true })
  amount!: number;

  @Prop({ default: 'INR' })
  currency!: string;

  @Prop({ required: true, enum: ['Created', 'Paid', 'Failed', 'Refunded'], default: 'Created' })
  status!: PaymentStatus;

  @Prop()
  razorpayOrderId?: string;

  @Prop()
  razorpayPaymentId?: string;

  @Prop()
  gatewayProvider?: string;

  @Prop()
  gatewayOrderId?: string;

  @Prop()
  gatewayPaymentId?: string;

  @Prop()
  method?: string;

  @Prop({ default: 0 })
  gstAmount!: number;

  @Prop()
  invoiceUrl?: string;

  @Prop()
  paidAt?: Date;

  @Prop()
  reconciledAt?: Date;

  @Prop()
  reference?: string;

  @Prop()
  refundReason?: string;

  @Prop()
  refundedAt?: Date;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
PaymentSchema.plugin(tenantPlugin);
PaymentSchema.index({ razorpayOrderId: 1 });
PaymentSchema.index({ status: 1, createdAt: -1 });
PaymentSchema.index({ customerId: 1 });

export type PromotionDocument = HydratedDocument<Promotion>;

@Schema({ timestamps: true, collection: 'promotions' })
export class Promotion {
  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  code!: string;

  @Prop()
  description?: string;

  @Prop({ required: true, enum: ['Percentage', 'FixedAmount'] })
  discountType!: string;

  @Prop({ required: true })
  discountValue!: number;

  @Prop({ required: true })
  validFrom!: Date;

  @Prop({ required: true })
  validTo!: Date;

  @Prop()
  maxUses?: number;

  @Prop({ default: 0 })
  currentUses!: number;

  @Prop({ default: true })
  isActive!: boolean;
}

export const PromotionSchema = SchemaFactory.createForClass(Promotion);
PromotionSchema.plugin(tenantPlugin);

export type SupportTicketDocument = HydratedDocument<SupportTicket>;

@Schema({ timestamps: true, collection: 'support_tickets' })
export class SupportTicket {
  @Prop({ required: true, type: String })
  customerId!: string;

  @Prop({ required: true, enum: ['Ride', 'Payment', 'KYC', 'Vehicle', 'General'] })
  category!: string;

  @Prop({ required: true })
  subject!: string;

  @Prop({ required: true })
  description!: string;

  @Prop()
  bookingId?: string;

  @Prop({ required: true, enum: ['Open', 'InProgress', 'Resolved', 'Closed'], default: 'Open' })
  status!: string;

  @Prop()
  assignedTo?: string;

  @Prop()
  resolvedAt?: Date;

  @Prop({ type: [{ at: Date, actorEmail: String, note: String }], default: [] })
  notes!: { at: Date; actorEmail?: string; note: string }[];
}

export const SupportTicketSchema = SchemaFactory.createForClass(SupportTicket);
SupportTicketSchema.plugin(tenantPlugin);
