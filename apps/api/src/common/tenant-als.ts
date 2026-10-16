import { AsyncLocalStorage } from 'async_hooks';

export type TenantStore = {
  tenantId: string | null;
  hubIds?: string[] | null;
  skip?: boolean;
};

export const tenantAls = new AsyncLocalStorage<TenantStore>();

export function getTenantStore(): TenantStore | undefined {
  return tenantAls.getStore();
}

export function currentTenantId(): string | null {
  const store = tenantAls.getStore();
  if (!store || store.skip) return null;
  return store.tenantId;
}

export function runWithoutTenant<T>(fn: () => T): T {
  return tenantAls.run({ tenantId: null, skip: true }, fn);
}
