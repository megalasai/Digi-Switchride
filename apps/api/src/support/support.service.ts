import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { AuditActor } from '../audit/audit.service';
import { runInWriteTenant } from '../common/tenant-write';
import { Customer, CustomerDocument } from '../schemas/customer.schema';
import { SupportTicket, SupportTicketDocument } from '../schemas/booking.schema';

@Injectable()
export class SupportService {
  constructor(
    @InjectModel(SupportTicket.name) private ticketModel: Model<SupportTicketDocument>,
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
  ) {}

  async create(customerId: string, data: { category: string; subject: string; description: string; bookingId?: string }) {
    const ticket = await runInWriteTenant(undefined, async () =>
      this.ticketModel.create({ customerId, ...data, notes: [] }),
    );
    return this.toDto(ticket);
  }

  async list(customerId: string) {
    const tickets = await this.ticketModel.find({ customerId }).sort({ createdAt: -1 });
    return tickets.map((t) => this.toDto(t));
  }

  async listAdmin(status?: string) {
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    const tickets = await this.ticketModel.find(filter).sort({ createdAt: -1 }).limit(100);
    const riderIds = [...new Set(tickets.map((t) => t.customerId))];
    const riders = riderIds.length ? await this.customerModel.find({ _id: { $in: riderIds } }) : [];
    const map = Object.fromEntries(riders.map((r) => [r._id.toString(), r]));
    return {
      items: tickets.map((t) => ({
        ...this.toDto(t),
        riderName: map[t.customerId]?.fullName,
        riderPhone: map[t.customerId]?.phone,
      })),
    };
  }

  async updateAdmin(
    id: string,
    data: { status?: string; assignedTo?: string; note?: string },
    actor?: AuditActor | null,
  ) {
    const ticket = await this.ticketModel.findById(id);
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (data.status) {
      ticket.status = data.status;
      if (data.status === 'Resolved' || data.status === 'Closed') ticket.resolvedAt = new Date();
    }
    if (data.assignedTo != null) {
      ticket.assignedTo = data.assignedTo.trim();
      if (ticket.status === 'Open') ticket.status = 'InProgress';
    }
    if (data.note) {
      ticket.notes = ticket.notes ?? [];
      ticket.notes.push({ at: new Date(), actorEmail: actor?.actorEmail, note: data.note.trim() });
    }
    await ticket.save();
    return this.toDto(ticket);
  }

  async createAdmin(data: { riderId: string; category: string; subject: string; description: string }) {
    const rider = await this.customerModel.findById(data.riderId);
    if (!rider) throw new NotFoundException('Rider not found');
    if (!data.subject.trim() || data.description.trim().length < 10) {
      throw new BadRequestException('Subject and a detailed description are required');
    }
    return this.create(data.riderId, { category: data.category, subject: data.subject, description: data.description });
  }

  private toDto(ticket: SupportTicketDocument) {
    return {
      id: ticket._id.toString(),
      customerId: ticket.customerId,
      category: ticket.category,
      subject: ticket.subject,
      description: ticket.description,
      status: ticket.status,
      assignedTo: ticket.assignedTo,
      notes: ticket.notes ?? [],
      createdAt: (ticket as { createdAt?: Date }).createdAt,
      resolvedAt: ticket.resolvedAt,
    };
  }
}
