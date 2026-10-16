import { getTenantStore } from './tenant-als';

export function assignedHubIds(): string[] | null {
  const store = getTenantStore();
  if (!store?.hubIds?.length) return null;
  return store.hubIds;
}

export function applyHubScope<T extends Record<string, unknown>>(filter: T, field = 'hubId'): T {
  const hubs = assignedHubIds();
  if (!hubs) return filter;
  const current = filter[field];
  if (typeof current === 'string') {
    if (!hubs.includes(current)) {
      (filter as Record<string, unknown>)[field] = '__none__';
    }
    return filter;
  }
  (filter as Record<string, unknown>)[field] = { $in: hubs };
  return filter;
}

export function hubAllowed(hubId?: string | null) {
  const hubs = assignedHubIds();
  if (!hubs) return true;
  return Boolean(hubId && hubs.includes(hubId));
}
