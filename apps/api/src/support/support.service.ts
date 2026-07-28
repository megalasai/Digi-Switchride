import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SupportTicket, SupportTicketDocument } from '../schemas/booking.schema';

@Injectable()
export class SupportService {
  constructor(@InjectModel(SupportTicket.name) private ticketModel: Model<SupportTicketDocument>) {}

  async create(customerId: string, data: { category: string; subject: string; description: string; bookingId?: string }) {
    const ticket = await this.ticketModel.create({ customerId, ...data });
    return {
      id: ticket._id.toString(),
      category: ticket.category,
      subject: ticket.subject,
      description: ticket.description,
      status: ticket.status,
      createdAt: (ticket as any).createdAt,
    };
  }

  async list(customerId: string) {
    const tickets = await this.ticketModel.find({ customerId }).sort({ createdAt: -1 });
    return tickets.map((t) => ({
      id: t._id.toString(),
      category: t.category,
      subject: t.subject,
      description: t.description,
      status: t.status,
      createdAt: (t as any).createdAt,
    }));
  }
}
