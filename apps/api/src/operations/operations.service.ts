import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { AuditActor } from '../audit/audit.service';
import { AuditService } from '../audit/audit.service';
import { runInWriteTenant } from '../common/tenant-write';
import { Customer, CustomerDocument } from '../schemas/customer.schema';
import { Vehicle, VehicleDocument } from '../schemas/fleet.schema';
import {
  Breakdown,
  BreakdownDocument,
  ServiceAppointment,
  ServiceAppointmentDocument,
  ServiceCentre,
  ServiceCentreDocument,
  ServiceRequest,
  ServiceRequestDocument,
  ServiceSlot,
  ServiceSlotDocument,
} from '../schemas/operations.schema';
import { normalizeIndiaPhone } from '../common/helpers';

@Injectable()
export class OperationsService {
  constructor(
    @InjectModel(Breakdown.name) private breakdownModel: Model<BreakdownDocument>,
    @InjectModel(ServiceCentre.name) private centreModel: Model<ServiceCentreDocument>,
    @InjectModel(ServiceSlot.name) private slotModel: Model<ServiceSlotDocument>,
    @InjectModel(ServiceRequest.name) private requestModel: Model<ServiceRequestDocument>,
    @InjectModel(ServiceAppointment.name) private appointmentModel: Model<ServiceAppointmentDocument>,
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    @InjectModel(Vehicle.name) private vehicleModel: Model<VehicleDocument>,
    private auditService: AuditService,
  ) {}

  async listBreakdowns(status?: string, riderId?: string) {
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (riderId) filter.riderId = riderId;
    const items = await this.breakdownModel.find(filter).sort({ createdAt: -1 }).limit(100);
    return { items: await this.enrichBreakdowns(items) };
  }

  async getBreakdown(id: string) {
    const item = await this.breakdownModel.findById(id);
    if (!item) throw new NotFoundException('Breakdown not found');
    const [enriched] = await this.enrichBreakdowns([item]);
    return enriched;
  }

  async createBreakdown(
    data: { riderId: string; vehicleId: string; issueType: string; description: string; lat?: number; lng?: number; tenantId?: string },
    actor?: AuditActor | null,
  ) {
    return runInWriteTenant(data.tenantId, async () => {
    const rider = await this.customerModel.findById(data.riderId);
    if (!rider) throw new NotFoundException('Rider not found');
    const vehicle = await this.vehicleModel.findById(data.vehicleId);
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    const created = await this.breakdownModel.create({
      ...data,
      status: 'Open',
      actions: [{ at: new Date(), actorEmail: actor?.actorEmail, note: 'Breakdown logged' }],
    });
    await this.auditService.record({
      actor,
      action: 'breakdown.create',
      entityType: 'Breakdown',
      entityId: created._id.toString(),
      after: { riderId: data.riderId, vehicleId: data.vehicleId, issueType: data.issueType },
    });
    return this.getBreakdown(created._id.toString());
    });
  }

  async assignBreakdown(id: string, assignedTo: string, note: string, actor?: AuditActor | null) {
    const item = await this.requireOpenish(id);
    item.assignedTo = assignedTo.trim();
    item.status = 'Assigned';
    this.pushAction(item, actor, note);
    await item.save();
    await this.auditService.record({ actor, action: 'breakdown.assign', entityType: 'Breakdown', entityId: id, after: { assignedTo } });
    return this.getBreakdown(id);
  }

  async progressBreakdown(id: string, note: string, actor?: AuditActor | null) {
    const item = await this.requireOpenish(id);
    item.status = 'InProgress';
    this.pushAction(item, actor, note);
    await item.save();
    return this.getBreakdown(id);
  }

  async escalateBreakdown(id: string, escalatedTo: string, note: string, actor?: AuditActor | null) {
    const item = await this.requireOpenish(id);
    item.escalatedTo = escalatedTo.trim();
    item.status = 'Escalated';
    this.pushAction(item, actor, note);
    await item.save();
    await this.auditService.record({ actor, action: 'breakdown.escalate', entityType: 'Breakdown', entityId: id, after: { escalatedTo } });
    return this.getBreakdown(id);
  }

  async closeBreakdown(id: string, note: string, actor?: AuditActor | null) {
    const item = await this.breakdownModel.findById(id);
    if (!item) throw new NotFoundException('Breakdown not found');
    if (item.status === 'Closed') throw new BadRequestException('Breakdown is already closed');
    item.status = 'Closed';
    item.closedAt = new Date();
    item.closeNote = note.trim();
    this.pushAction(item, actor, note);
    await item.save();
    await this.auditService.record({ actor, action: 'breakdown.close', entityType: 'Breakdown', entityId: id, after: { note } });
    return this.getBreakdown(id);
  }

  async listCentres() {
    const items = await this.centreModel.find().sort({ name: 1 });
    return { items: items.map((c) => this.toCentre(c)) };
  }

  async createCentre(data: { name: string; address: string; contactName: string; contactPhone: string; lat?: number; lng?: number }, actor?: AuditActor | null) {
    const centre = await this.centreModel.create({ ...data, contactPhone: normalizeIndiaPhone(data.contactPhone), isActive: true });
    await this.auditService.record({ actor, action: 'serviceCentre.create', entityType: 'ServiceCentre', entityId: centre._id.toString(), after: { name: data.name } });
    return this.toCentre(centre);
  }

  async updateCentre(id: string, data: Partial<{ name: string; address: string; contactName: string; contactPhone: string; lat: number; lng: number; isActive: boolean }>) {
    const centre = await this.centreModel.findById(id);
    if (!centre) throw new NotFoundException('Service centre not found');
    if (data.name != null) centre.name = data.name;
    if (data.address != null) centre.address = data.address;
    if (data.contactName != null) centre.contactName = data.contactName;
    if (data.contactPhone != null) centre.contactPhone = normalizeIndiaPhone(data.contactPhone);
    if (data.lat != null) centre.lat = data.lat;
    if (data.lng != null) centre.lng = data.lng;
    if (data.isActive != null) centre.isActive = data.isActive;
    await centre.save();
    return this.toCentre(centre);
  }

  async listSlots(centreId?: string, date?: string) {
    const filter: Record<string, unknown> = {};
    if (centreId) filter.centreId = centreId;
    if (date) filter.date = date;
    const items = await this.slotModel.find(filter).sort({ date: 1, startTime: 1 });
    return { items: items.map((s) => this.toSlot(s)) };
  }

  async createSlot(data: { centreId: string; date: string; startTime: string; endTime: string; capacity: number }) {
    const centre = await this.centreModel.findById(data.centreId);
    if (!centre || !centre.isActive) throw new NotFoundException('Active service centre not found');
    if (data.endTime <= data.startTime) throw new BadRequestException('End time must be after start time');
    const overlap = await this.slotModel.findOne({ centreId: data.centreId, date: data.date, startTime: data.startTime });
    if (overlap) throw new BadRequestException('A slot already exists for this centre, date and start time');
    const slot = await this.slotModel.create({ ...data, bookedCount: 0 });
    return this.toSlot(slot);
  }

  async listRequests(status?: string, riderId?: string) {
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (riderId) filter.riderId = riderId;
    const items = await this.requestModel.find(filter).sort({ createdAt: -1 }).limit(100);
    return { items: await this.enrichRequests(items) };
  }

  async createRequest(data: { riderId: string; vehicleId?: string; category: string; description: string }, actor?: AuditActor | null) {
    const rider = await this.customerModel.findById(data.riderId);
    if (!rider) throw new NotFoundException('Rider not found');
    if (data.vehicleId) {
      const vehicle = await this.vehicleModel.findById(data.vehicleId);
      if (!vehicle) throw new NotFoundException('Vehicle not found');
    }
    const created = await this.requestModel.create({ ...data, status: 'Open' });
    await this.auditService.record({ actor, action: 'serviceRequest.create', entityType: 'ServiceRequest', entityId: created._id.toString(), after: { riderId: data.riderId } });
    const [enriched] = await this.enrichRequests([created]);
    return enriched;
  }

  async updateRequest(
    id: string,
    data: { status?: string; assignedTo?: string; progressNote?: string; completionNote?: string },
    actor?: AuditActor | null,
  ) {
    const item = await this.requestModel.findById(id);
    if (!item) throw new NotFoundException('Service request not found');
    if (item.status === 'Completed' || item.status === 'Cancelled') {
      throw new BadRequestException('Completed or cancelled requests cannot be updated');
    }
    if (data.assignedTo != null) {
      item.assignedTo = data.assignedTo.trim();
      if (item.status === 'Open') item.status = 'Assigned';
    }
    if (data.progressNote != null) item.progressNote = data.progressNote.trim();
    if (data.status) {
      if (data.status === 'Completed' && !data.completionNote?.trim()) {
        throw new BadRequestException('Completion note is required');
      }
      item.status = data.status as typeof item.status;
      if (data.status === 'Completed') {
        item.completedAt = new Date();
        item.completionNote = data.completionNote?.trim();
      }
    }
    await item.save();
    await this.auditService.record({ actor, action: 'serviceRequest.update', entityType: 'ServiceRequest', entityId: id, after: { status: item.status } });
    const [enriched] = await this.enrichRequests([item]);
    return enriched;
  }

  async listAppointments(status?: string, riderId?: string) {
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (riderId) filter.riderId = riderId;
    const items = await this.appointmentModel.find(filter).sort({ createdAt: -1 }).limit(100);
    return { items: await this.enrichAppointments(items) };
  }

  async scheduleAppointment(
    data: { riderId: string; centreId: string; slotId: string; vehicleId?: string; serviceRequestId?: string; notes?: string },
    actor?: AuditActor | null,
  ) {
    await this.assertRider(data.riderId);
    const slot = await this.bookSlot(data.slotId, data.centreId);
    const created = await this.appointmentModel.create({ ...data, status: 'Scheduled' });
    await this.auditService.record({ actor, action: 'appointment.schedule', entityType: 'Appointment', entityId: created._id.toString(), after: { slotId: data.slotId } });
    const [enriched] = await this.enrichAppointments([created]);
    return enriched;
  }

  async rescheduleAppointment(id: string, slotId: string, notes?: string, actor?: AuditActor | null) {
    const item = await this.appointmentModel.findById(id);
    if (!item) throw new NotFoundException('Appointment not found');
    if (item.status === 'Cancelled' || item.status === 'Completed') {
      throw new BadRequestException('Cannot reschedule a cancelled or completed appointment');
    }
    await this.releaseSlot(item.slotId);
    const slot = await this.bookSlot(slotId, item.centreId);
    item.slotId = slot.id;
    item.status = 'Rescheduled';
    if (notes) item.notes = notes;
    await item.save();
    await this.auditService.record({ actor, action: 'appointment.reschedule', entityType: 'Appointment', entityId: id, after: { slotId } });
    const [enriched] = await this.enrichAppointments([item]);
    return enriched;
  }

  async cancelAppointment(id: string, reason: string, actor?: AuditActor | null) {
    const item = await this.appointmentModel.findById(id);
    if (!item) throw new NotFoundException('Appointment not found');
    if (item.status === 'Cancelled' || item.status === 'Completed') {
      throw new BadRequestException('Appointment cannot be cancelled');
    }
    await this.releaseSlot(item.slotId);
    item.status = 'Cancelled';
    item.cancelledReason = reason.trim();
    await item.save();
    await this.auditService.record({ actor, action: 'appointment.cancel', entityType: 'Appointment', entityId: id, after: { reason } });
    const [enriched] = await this.enrichAppointments([item]);
    return enriched;
  }

  async completeAppointment(id: string, actor?: AuditActor | null) {
    const item = await this.appointmentModel.findById(id);
    if (!item) throw new NotFoundException('Appointment not found');
    if (item.status === 'Cancelled') throw new BadRequestException('Cancelled appointments cannot be completed');
    item.status = 'Completed';
    await item.save();
    await this.auditService.record({ actor, action: 'appointment.complete', entityType: 'Appointment', entityId: id });
    const [enriched] = await this.enrichAppointments([item]);
    return enriched;
  }

  async counts() {
    const [breakdowns, serviceRequests] = await Promise.all([
      this.breakdownModel.countDocuments({ status: { $ne: 'Closed' } }),
      this.requestModel.countDocuments({ status: { $nin: ['Completed', 'Cancelled'] } }),
    ]);
    return { breakdowns, serviceRequests };
  }

  private async bookSlot(slotId: string, centreId: string) {
    const slot = await this.slotModel.findById(slotId);
    if (!slot) throw new NotFoundException('Service slot not found');
    if (slot.centreId !== centreId) throw new BadRequestException('Slot does not belong to the selected centre');
    if (slot.bookedCount >= slot.capacity) throw new BadRequestException('This slot is fully booked');
    slot.bookedCount += 1;
    await slot.save();
    return this.toSlot(slot);
  }

  private async releaseSlot(slotId: string) {
    const slot = await this.slotModel.findById(slotId);
    if (!slot) return;
    slot.bookedCount = Math.max(0, slot.bookedCount - 1);
    await slot.save();
  }

  private async assertRider(riderId: string) {
    const rider = await this.customerModel.findById(riderId);
    if (!rider) throw new NotFoundException('Rider not found');
    return rider;
  }

  private async requireOpenish(id: string) {
    const item = await this.breakdownModel.findById(id);
    if (!item) throw new NotFoundException('Breakdown not found');
    if (item.status === 'Closed') throw new BadRequestException('Closed breakdowns cannot be updated');
    return item;
  }

  private pushAction(item: BreakdownDocument, actor: AuditActor | null | undefined, note: string) {
    item.actions.push({ at: new Date(), actorEmail: actor?.actorEmail, note: note.trim() });
  }

  private async enrichBreakdowns(items: BreakdownDocument[]) {
    const riderIds = [...new Set(items.map((i) => i.riderId))];
    const vehicleIds = [...new Set(items.map((i) => i.vehicleId))];
    const [riders, vehicles] = await Promise.all([
      this.customerModel.find({ _id: { $in: riderIds } }),
      this.vehicleModel.find({ _id: { $in: vehicleIds } }),
    ]);
    const riderMap = Object.fromEntries(riders.map((r) => [r._id.toString(), r]));
    const vehicleMap = Object.fromEntries(vehicles.map((v) => [v._id.toString(), v]));
    return items.map((b) => {
      const rider = riderMap[b.riderId];
      const vehicle = vehicleMap[b.vehicleId];
      return {
        id: b._id.toString(),
        riderId: b.riderId,
        riderName: rider?.fullName,
        riderPhone: rider?.phone,
        vehicleId: b.vehicleId,
        vehicleRegistration: vehicle?.registrationNumber,
        issueType: b.issueType,
        description: b.description,
        lat: b.lat,
        lng: b.lng,
        status: b.status,
        assignedTo: b.assignedTo,
        escalatedTo: b.escalatedTo,
        actions: b.actions,
        closedAt: b.closedAt,
        closeNote: b.closeNote,
        createdAt: (b as { createdAt?: Date }).createdAt,
        tenantId: (b as { tenantId?: string }).tenantId,
      };
    });
  }

  private async enrichRequests(items: ServiceRequestDocument[]) {
    const riderIds = [...new Set(items.map((i) => i.riderId))];
    const riders = await this.customerModel.find({ _id: { $in: riderIds } });
    const riderMap = Object.fromEntries(riders.map((r) => [r._id.toString(), r]));
    return items.map((r) => ({
      id: r._id.toString(),
      riderId: r.riderId,
      riderName: riderMap[r.riderId]?.fullName,
      riderPhone: riderMap[r.riderId]?.phone,
      vehicleId: r.vehicleId,
      category: r.category,
      description: r.description,
      status: r.status,
      assignedTo: r.assignedTo,
      progressNote: r.progressNote,
      completionNote: r.completionNote,
      completedAt: r.completedAt,
      createdAt: (r as { createdAt?: Date }).createdAt,
    }));
  }

  private async enrichAppointments(items: ServiceAppointmentDocument[]) {
    const riderIds = [...new Set(items.map((i) => i.riderId))];
    const centreIds = [...new Set(items.map((i) => i.centreId))];
    const slotIds = [...new Set(items.map((i) => i.slotId))];
    const [riders, centres, slots] = await Promise.all([
      this.customerModel.find({ _id: { $in: riderIds } }),
      this.centreModel.find({ _id: { $in: centreIds } }),
      this.slotModel.find({ _id: { $in: slotIds } }),
    ]);
    const riderMap = Object.fromEntries(riders.map((r) => [r._id.toString(), r]));
    const centreMap = Object.fromEntries(centres.map((c) => [c._id.toString(), c]));
    const slotMap = Object.fromEntries(slots.map((s) => [s._id.toString(), s]));
    return items.map((a) => ({
      id: a._id.toString(),
      riderId: a.riderId,
      riderName: riderMap[a.riderId]?.fullName,
      riderPhone: riderMap[a.riderId]?.phone,
      centreId: a.centreId,
      centreName: centreMap[a.centreId]?.name,
      slotId: a.slotId,
      slot: slotMap[a.slotId] ? this.toSlot(slotMap[a.slotId]) : null,
      vehicleId: a.vehicleId,
      serviceRequestId: a.serviceRequestId,
      status: a.status,
      notes: a.notes,
      cancelledReason: a.cancelledReason,
      createdAt: (a as { createdAt?: Date }).createdAt,
    }));
  }

  private toCentre(c: ServiceCentreDocument) {
    return {
      id: c._id.toString(),
      name: c.name,
      address: c.address,
      contactName: c.contactName,
      contactPhone: c.contactPhone,
      lat: c.lat,
      lng: c.lng,
      isActive: c.isActive,
    };
  }

  private toSlot(s: ServiceSlotDocument) {
    return {
      id: s._id.toString(),
      centreId: s.centreId,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      capacity: s.capacity,
      bookedCount: s.bookedCount,
      remaining: Math.max(0, s.capacity - s.bookedCount),
    };
  }
}
