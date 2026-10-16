import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { AppointmentStatus, BreakdownStatus, ServiceRequestStatus } from '@digi-switchride/shared';
import { tenantPlugin } from '../common/tenant.plugin';

@Schema({ timestamps: true, collection: 'breakdowns' })
export class Breakdown {
  @Prop({ required: true, type: String })
  riderId!: string;

  @Prop({ required: true, type: String })
  vehicleId!: string;

  @Prop({ required: true, trim: true })
  issueType!: string;

  @Prop({ required: true, trim: true })
  description!: string;

  @Prop()
  lat?: number;

  @Prop()
  lng?: number;

  @Prop({ required: true, enum: ['Open', 'Assigned', 'InProgress', 'Escalated', 'Closed'], default: 'Open' })
  status!: BreakdownStatus;

  @Prop()
  assignedTo?: string;

  @Prop()
  escalatedTo?: string;

  @Prop({ type: [{ at: Date, actorEmail: String, note: String }], default: [] })
  actions!: { at: Date; actorEmail?: string; note: string }[];

  @Prop()
  closedAt?: Date;

  @Prop()
  closeNote?: string;
}

export type BreakdownDocument = HydratedDocument<Breakdown>;
export const BreakdownSchema = SchemaFactory.createForClass(Breakdown);
BreakdownSchema.plugin(tenantPlugin);
BreakdownSchema.index({ status: 1, createdAt: -1 });
BreakdownSchema.index({ riderId: 1 });

@Schema({ timestamps: true, collection: 'service_centres' })
export class ServiceCentre {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, trim: true })
  address!: string;

  @Prop({ required: true, trim: true })
  contactName!: string;

  @Prop({ required: true, trim: true })
  contactPhone!: string;

  @Prop()
  lat?: number;

  @Prop()
  lng?: number;

  @Prop({ default: true })
  isActive!: boolean;
}

export type ServiceCentreDocument = HydratedDocument<ServiceCentre>;
export const ServiceCentreSchema = SchemaFactory.createForClass(ServiceCentre);
ServiceCentreSchema.plugin(tenantPlugin);

@Schema({ timestamps: true, collection: 'service_slots' })
export class ServiceSlot {
  @Prop({ required: true, type: String })
  centreId!: string;

  @Prop({ required: true })
  date!: string;

  @Prop({ required: true })
  startTime!: string;

  @Prop({ required: true })
  endTime!: string;

  @Prop({ required: true, default: 4 })
  capacity!: number;

  @Prop({ default: 0 })
  bookedCount!: number;
}

export type ServiceSlotDocument = HydratedDocument<ServiceSlot>;
export const ServiceSlotSchema = SchemaFactory.createForClass(ServiceSlot);
ServiceSlotSchema.plugin(tenantPlugin);
ServiceSlotSchema.index({ centreId: 1, date: 1 });

@Schema({ timestamps: true, collection: 'service_requests' })
export class ServiceRequest {
  @Prop({ required: true, type: String })
  riderId!: string;

  @Prop({ type: String })
  vehicleId?: string;

  @Prop({ required: true, trim: true })
  category!: string;

  @Prop({ required: true, trim: true })
  description!: string;

  @Prop({ required: true, enum: ['Open', 'Assigned', 'InProgress', 'Completed', 'Cancelled'], default: 'Open' })
  status!: ServiceRequestStatus;

  @Prop()
  assignedTo?: string;

  @Prop()
  progressNote?: string;

  @Prop()
  completedAt?: Date;

  @Prop()
  completionNote?: string;
}

export type ServiceRequestDocument = HydratedDocument<ServiceRequest>;
export const ServiceRequestSchema = SchemaFactory.createForClass(ServiceRequest);
ServiceRequestSchema.plugin(tenantPlugin);
ServiceRequestSchema.index({ riderId: 1, status: 1 });

@Schema({ timestamps: true, collection: 'service_appointments' })
export class ServiceAppointment {
  @Prop({ required: true, type: String })
  riderId!: string;

  @Prop({ type: String })
  vehicleId?: string;

  @Prop({ required: true, type: String })
  centreId!: string;

  @Prop({ required: true, type: String })
  slotId!: string;

  @Prop({ type: String })
  serviceRequestId?: string;

  @Prop({ required: true, enum: ['Scheduled', 'Rescheduled', 'Cancelled', 'Completed'], default: 'Scheduled' })
  status!: AppointmentStatus;

  @Prop()
  notes?: string;

  @Prop()
  cancelledReason?: string;
}

export type ServiceAppointmentDocument = HydratedDocument<ServiceAppointment>;
export const ServiceAppointmentSchema = SchemaFactory.createForClass(ServiceAppointment);
ServiceAppointmentSchema.index({ slotId: 1, status: 1 });
ServiceAppointmentSchema.plugin(tenantPlugin);
