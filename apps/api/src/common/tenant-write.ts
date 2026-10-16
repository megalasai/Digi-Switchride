import { BadRequestException } from '@nestjs/common';
import { currentTenantId, getTenantStore, tenantAls } from './tenant-als';

export function resolveWriteTenantId(explicit?: string | null) {
  const tenantId = explicit?.trim() || currentTenantId();
  if (!tenantId) {
    throw new BadRequestException('Select a company before creating or assigning this record');
  }
  return tenantId;
}

export function runInWriteTenant<T>(explicit: string | undefined | null, fn: () => T): T {
  const tenantId = resolveWriteTenantId(explicit);
  const store = getTenantStore();
  return tenantAls.run({ tenantId, hubIds: store?.hubIds ?? null, skip: false }, fn);
}
