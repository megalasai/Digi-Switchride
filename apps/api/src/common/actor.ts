import { Request } from 'express';

export interface AdminActor {
  actorId: string;
  actorEmail: string;
  ip?: string;
}

export function actorFromRequest(req: Request & { user?: { adminId?: string; email?: string } }): AdminActor | null {
  if (!req.user?.adminId) return null;
  const forwarded = req.headers['x-forwarded-for'];
  const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]?.trim() ?? req.ip;
  return { actorId: req.user.adminId, actorEmail: req.user.email ?? '', ip };
}
