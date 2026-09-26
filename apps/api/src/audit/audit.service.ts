import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog, AuditLogDocument } from '../schemas/audit.schema';

export interface AuditActor {
  actorId: string;
  actorEmail: string;
  ip?: string;
}

@Injectable()
export class AuditService implements OnModuleInit {
  constructor(@InjectModel(AuditLog.name) private auditModel: Model<AuditLogDocument>) {}

  async onModuleInit() {
    // Append-only: never create update/delete indexes that invite mutation APIs.
  }

  async record(params: {
    actor?: AuditActor | null;
    action: string;
    entityType: string;
    entityId: string;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  }) {
    if (!params.actor?.actorId) return;
    await this.auditModel.create({
      actorId: params.actor.actorId,
      actorEmail: params.actor.actorEmail,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      before: params.before,
      after: params.after,
      ip: params.actor.ip,
    });
  }

  async list(query: {
    actorId?: string;
    entityType?: string;
    entityId?: string;
    from?: Date;
    to?: Date;
    page?: number;
    pageSize?: number;
  }) {
    const filter: Record<string, unknown> = {};
    if (query.actorId) filter.actorId = query.actorId;
    if (query.entityType) filter.entityType = query.entityType;
    if (query.entityId) filter.entityId = query.entityId;
    if (query.from || query.to) {
      filter.createdAt = {
        ...(query.from ? { $gte: query.from } : {}),
        ...(query.to ? { $lte: query.to } : {}),
      };
    }
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const totalCount = await this.auditModel.countDocuments(filter);
    const items = await this.auditModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean();
    return {
      items: items.map((row) => ({
        id: row._id.toString(),
        actorId: row.actorId,
        actorEmail: row.actorEmail,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        before: row.before,
        after: row.after,
        ip: row.ip,
        createdAt: (row as { createdAt?: Date }).createdAt,
      })),
      page,
      pageSize,
      totalCount,
    };
  }
}
