import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { currentTenantId, runWithoutTenant, tenantAls } from '../common/tenant-als';
import { GPS_PROVIDERS, GpsIntegration, GpsIntegrationDocument, type GpsProvider } from '../schemas/gps-integration.schema';
import { TenantsService } from '../tenants/tenants.service';

export const DEFAULT_TRACK360_URL = 'https://prod-s1.track360.net.in/api/v1/auth/pull_api';

export type GpsIntegrationUpsert = {
  tenantId?: string;
  provider: string;
  enabled?: boolean;
  displayName?: string;
  username?: string;
  password?: string;
  pullUrl?: string;
};

export type GpsPullConfig = {
  tenantId: string;
  provider: GpsProvider;
  username: string;
  password: string;
  pullUrl: string;
};

@Injectable()
export class GpsIntegrationService {
  constructor(
    @InjectModel(GpsIntegration.name) private model: Model<GpsIntegrationDocument>,
    private tenants: TenantsService,
  ) {}

  providers() {
    return [...GPS_PROVIDERS];
  }

  async resolveTenantId(explicit?: string, allowAnyTenant = false) {
    const scoped = currentTenantId();
    const requested = explicit?.trim();
    if (!allowAnyTenant && scoped && requested && requested !== scoped) {
      throw new BadRequestException('You can only configure GPS for your own company');
    }
    const tenantId = allowAnyTenant && requested ? requested : scoped || requested;
    if (!tenantId) throw new BadRequestException('Select a tenant company to configure GPS');
    const tenant = await this.tenants.peek(tenantId);
    if (!tenant) throw new NotFoundException('Company not found');
    if (this.tenants.isParent(tenant)) {
      throw new BadRequestException('Configure GPS on a tenant company, not on Fleetel (parent).');
    }
    return tenant._id.toString();
  }

  async getAdmin(explicitTenantId?: string, allowAnyTenant = false) {
    const tenantId = await this.resolveTenantId(explicitTenantId, allowAnyTenant);
    const tenant = await this.tenants.peek(tenantId);
    const doc = await this.model.findOne({ tenantId });
    return {
      tenantId,
      tenantName: tenant?.name,
      tenantSlug: tenant?.slug,
      providers: this.providers(),
      config: doc ? this.toAdmin(doc) : this.emptyConfig(tenantId),
    };
  }

  async listOverview(allowAnyTenant = false) {
    const tenants = await this.tenants.listCustomers();
    const scoped = allowAnyTenant ? null : currentTenantId();
    const visible = scoped ? tenants.filter((t) => t.id === scoped) : tenants;
    const rows = await runWithoutTenant(async () =>
      this.model.find({ tenantId: { $in: visible.map((t) => t.id) } }),
    );
    const byTenant = Object.fromEntries(rows.map((g) => [g.tenantId, g]));
    return {
      items: visible.map((t) => {
        const g = byTenant[t.id];
        return {
          tenantId: t.id,
          tenantName: t.name,
          tenantSlug: t.slug,
          provider: g?.provider ?? null,
          enabled: g?.enabled === true,
          usernameSet: Boolean(g?.username),
          lastSyncAt: g?.lastSyncAt,
          lastSyncOk: g?.lastSyncOk,
          lastSyncMessage: g?.lastSyncMessage,
          lastSyncedCount: g?.lastSyncedCount,
        };
      }),
    };
  }

  async upsert(data: GpsIntegrationUpsert, allowAnyTenant = false) {
    const tenantId = await this.resolveTenantId(data.tenantId, allowAnyTenant);
    if (!GPS_PROVIDERS.includes(data.provider as GpsProvider)) {
      throw new BadRequestException('Unsupported GPS provider');
    }
    return tenantAls.run({ tenantId, hubIds: null, skip: false }, async () => {
      const existing = await this.model.findOne({ tenantId });
      const next = existing ?? new this.model({ tenantId });
      next.provider = data.provider as GpsProvider;
      next.enabled = data.enabled ?? existing?.enabled ?? false;
      next.displayName = data.displayName?.trim() || data.provider;
      if (data.username?.trim()) next.username = data.username.trim();
      if (data.password?.trim()) next.password = data.password.trim();
      next.pullUrl = (data.pullUrl?.trim() || existing?.pullUrl || DEFAULT_TRACK360_URL).replace(/\/$/, '');
      if (next.enabled) {
        if (!next.username || !next.password) {
          throw new BadRequestException('Enter the GPS API username and password before enabling');
        }
        if (!next.pullUrl) throw new BadRequestException('Enter the GPS pull URL before enabling');
      }
      await next.save();
      return this.toAdmin(next);
    });
  }

  async listEnabledForSync(scopedTenantId?: string | null): Promise<GpsPullConfig[]> {
    const filter: Record<string, unknown> = { enabled: true };
    if (scopedTenantId) filter.tenantId = scopedTenantId;
    const rows = await runWithoutTenant(async () => this.model.find(filter));
    return rows
      .filter((row) => row.username && row.password && row.pullUrl)
      .map((row) => ({
        tenantId: row.tenantId,
        provider: row.provider,
        username: row.username!,
        password: row.password!,
        pullUrl: row.pullUrl || DEFAULT_TRACK360_URL,
      }));
  }

  async recordSync(tenantId: string, result: { ok: boolean; synced: number; message: string }) {
    await runWithoutTenant(async () =>
      this.model.updateOne(
        { tenantId },
        {
          $set: {
            lastSyncAt: new Date(),
            lastSyncOk: result.ok,
            lastSyncMessage: result.message,
            lastSyncedCount: result.synced,
          },
        },
      ),
    );
  }

  private emptyConfig(tenantId: string) {
    return {
      tenantId,
      provider: 'Track360' as const,
      enabled: false,
      displayName: 'Track360',
      username: '',
      passwordSet: false,
      passwordMasked: null as string | null,
      pullUrl: DEFAULT_TRACK360_URL,
      lastSyncAt: undefined as Date | undefined,
      lastSyncOk: undefined as boolean | undefined,
      lastSyncMessage: undefined as string | undefined,
      lastSyncedCount: undefined as number | undefined,
    };
  }

  private toAdmin(doc: GpsIntegrationDocument) {
    return {
      tenantId: doc.tenantId,
      provider: doc.provider,
      enabled: doc.enabled,
      displayName: doc.displayName || doc.provider,
      username: doc.username ?? '',
      passwordSet: Boolean(doc.password),
      passwordMasked: doc.password ? maskSecret(doc.password) : null,
      pullUrl: doc.pullUrl || DEFAULT_TRACK360_URL,
      lastSyncAt: doc.lastSyncAt,
      lastSyncOk: doc.lastSyncOk,
      lastSyncMessage: doc.lastSyncMessage,
      lastSyncedCount: doc.lastSyncedCount,
    };
  }
}

function maskSecret(value: string) {
  if (value.length <= 2) return '••••';
  return `${value.slice(0, 2)}${'•'.repeat(Math.min(8, value.length - 2))}`;
}
