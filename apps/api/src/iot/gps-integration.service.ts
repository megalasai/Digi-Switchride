import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { currentTenantId, runWithoutTenant, tenantAls } from '../common/tenant-als';
import { tenantIdValues } from '../common/tenant.plugin';
import { GPS_AUTH_TYPES, GPS_PROVIDERS, GpsIntegration, GpsIntegrationDocument, type GpsAuthType, type GpsProvider } from '../schemas/gps-integration.schema';
import { randomUUID } from 'crypto';
import { TenantsService } from '../tenants/tenants.service';

export const DEFAULT_TRACK360_URL = 'https://prod-s1.track360.net.in/api/v1/auth/pull_api';

const GPS_USERNAME_TENANTS: Record<string, string[]> = {
  helloev1: ['hello ev', 'helloev', 'helloeveez', 'web-and-mobile'],
};

export type GpsIntegrationUpsert = {
  tenantId?: string;
  provider: string;
  enabled?: boolean;
  displayName?: string;
  username?: string;
  password?: string;
  pullUrl?: string;
  authType?: string;
  apiToken?: string;
  headerName?: string;
};

export type GpsPullConfig = {
  tenantId: string;
  provider: GpsProvider;
  username: string;
  password: string;
  pullUrl: string;
  authType?: GpsAuthType;
  apiToken?: string;
  headerName?: string;
};

@Injectable()
export class GpsIntegrationService implements OnModuleInit {
  private readonly logger = new Logger(GpsIntegrationService.name);

  constructor(
    @InjectModel(GpsIntegration.name) private model: Model<GpsIntegrationDocument>,
    private tenants: TenantsService,
  ) {}

  async onModuleInit() {
    try {
      await this.ensureIndexes();
      await this.bindKnownGpsAccounts();
    } catch (error) {
      this.logger.warn(`Could not bind GPS accounts to tenants: ${error instanceof Error ? error.message : error}`);
    }
  }

  private async ensureIndexes() {
    const indexes = await this.model.collection.indexes();
    for (const index of indexes) {
      const keys = index.key as Record<string, number>;
      if (index.unique && keys.tenantId === 1 && Object.keys(keys).length === 1) {
        await this.model.collection.dropIndex(index.name as string);
        this.logger.log('Dropped unique gps_integrations.tenantId so a company can connect more than one GPS API');
      }
    }
    await this.model.collection.createIndex({ tenantId: 1, provider: 1 }, { unique: true, background: true });
    await this.model.collection.createIndex({ ingestKey: 1 }, { unique: true, sparse: true, background: true });
  }

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
    await this.bindKnownGpsAccounts();
    const tenantId = await this.resolveTenantId(explicitTenantId, allowAnyTenant);
    const tenant = await this.tenants.peek(tenantId);
    const docs = await this.model.find({ tenantId }).sort({ provider: 1 });
    return {
      tenantId,
      tenantName: tenant?.name,
      tenantSlug: tenant?.slug,
      providers: this.providers(),
      ingestUrl: '/api/v1/iot/ingest',
      integrations: docs.map((doc) => this.toAdmin(doc)),
      config: docs[0] ? this.toAdmin(docs[0]) : this.emptyConfig(tenantId),
    };
  }

  async listOverview(allowAnyTenant = false) {
    await this.bindKnownGpsAccounts();
    const tenants = await this.tenants.listCustomers();
    const scoped = allowAnyTenant ? null : currentTenantId();
    const visible = scoped ? tenants.filter((t) => t.id === scoped) : tenants;
    const rows = await runWithoutTenant(async () =>
      this.model.find({ tenantId: { $in: visible.map((t) => t.id) } }),
    );
    const grouped = new Map<string, GpsIntegrationDocument[]>();
    for (const row of rows) {
      const list = grouped.get(row.tenantId) ?? [];
      list.push(row);
      grouped.set(row.tenantId, list);
    }
    return {
      items: visible.map((t) => {
        const list = grouped.get(t.id) ?? [];
        const enabled = list.filter((g) => g.enabled);
        return {
          tenantId: t.id,
          tenantName: t.name,
          tenantSlug: t.slug,
          provider: enabled.map((g) => g.provider).join(', ') || list[0]?.provider || null,
          enabled: enabled.length > 0,
          usernameSet: list.some((g) => Boolean(g.username) || Boolean(g.apiToken) || Boolean(g.ingestKey)),
          lastSyncAt: enabled[0]?.lastSyncAt ?? list[0]?.lastSyncAt,
          lastSyncOk: enabled[0]?.lastSyncOk ?? list[0]?.lastSyncOk,
          lastSyncMessage: enabled.map((g) => g.lastSyncMessage).filter(Boolean).join(' | ') || list[0]?.lastSyncMessage,
          lastSyncedCount: enabled.reduce((sum, g) => sum + (g.lastSyncedCount ?? 0), 0),
        };
      }),
    };
  }

  async upsert(data: GpsIntegrationUpsert, allowAnyTenant = false) {
    const bound = await this.tenantIdForGpsUsername(data.username);
    const tenantId = bound || (await this.resolveTenantId(data.tenantId, allowAnyTenant));
    if (!GPS_PROVIDERS.includes(data.provider as GpsProvider)) {
      throw new BadRequestException('Unsupported GPS provider');
    }
    return tenantAls.run({ tenantId, hubIds: null, skip: false }, async () => {
      const provider = data.provider as GpsProvider;
      const existing = await this.model.findOne({ tenantId, provider });
      const next = existing ?? new this.model({ tenantId, provider });
      next.provider = provider;
      next.enabled = data.enabled ?? existing?.enabled ?? false;
      next.displayName = data.displayName?.trim() || providerLabel(provider);
      if (data.username?.trim()) next.username = data.username.trim();
      if (data.password?.trim()) next.password = data.password.trim();
      if (data.apiToken?.trim()) next.apiToken = data.apiToken.trim();
      if (data.headerName?.trim()) next.headerName = data.headerName.trim();
      next.authType = (GPS_AUTH_TYPES.includes(data.authType as GpsAuthType)
        ? data.authType
        : provider === 'Track360'
          ? 'basic'
          : provider === 'PushIngest'
            ? 'none'
            : 'bearer') as GpsAuthType;
      if (provider === 'Track360') {
        next.pullUrl = (data.pullUrl?.trim() || existing?.pullUrl || DEFAULT_TRACK360_URL).replace(/\/$/, '');
      } else if (data.pullUrl?.trim()) {
        next.pullUrl = data.pullUrl.trim().replace(/\/$/, '');
      }
      let ingestKeyOnce: string | undefined;
      if (provider === 'PushIngest' && !next.ingestKey) {
        next.ingestKey = `gps_${randomUUID().replace(/-/g, '')}`;
        ingestKeyOnce = next.ingestKey;
      }
      if (next.enabled) {
        if (provider === 'PushIngest') {
          if (!next.ingestKey) throw new BadRequestException('Save once to create the ingest API key');
        } else if (provider === 'Track360') {
          if (!next.username || !next.password) {
            throw new BadRequestException('Enter the GPS API username and password before enabling');
          }
          if (!next.pullUrl) throw new BadRequestException('Enter the GPS pull URL before enabling');
        } else if (!next.pullUrl) {
          throw new BadRequestException('Enter the vendor pull URL before enabling');
        } else if (!next.username && !next.password && !next.apiToken) {
          throw new BadRequestException('Enter a username/password or API token before enabling');
        }
      }
      await next.save();
      return { ...this.toAdmin(next), ingestKeyOnce };
    });
  }

  async listEnabledForSync(scopedTenantId?: string | null): Promise<GpsPullConfig[]> {
    await this.bindKnownGpsAccounts();
    const rows = await runWithoutTenant(async () => this.model.find({ enabled: true, provider: { $ne: 'PushIngest' } }));
    const items: GpsPullConfig[] = [];
    for (const row of rows) {
      if (!row.pullUrl) continue;
      const tenantId = String((await this.tenantIdForGpsUsername(row.username)) || row.tenantId);
      if (scopedTenantId && tenantId !== String(scopedTenantId)) continue;
      if (!row.username && !row.password && !row.apiToken) continue;
      items.push({
        tenantId,
        provider: row.provider,
        username: row.username ?? '',
        password: row.password ?? '',
        pullUrl: row.pullUrl || DEFAULT_TRACK360_URL,
        authType: row.authType,
        apiToken: row.apiToken,
        headerName: row.headerName,
      });
    }
    return items;
  }

  async findByIngestKey(ingestKey: string) {
    const key = ingestKey.trim();
    if (!key) return null;
    return runWithoutTenant(async () => this.model.findOne({ ingestKey: key, enabled: true, provider: 'PushIngest' }));
  }

  async usernamesForTenant(tenantId: string) {
    const rows = await runWithoutTenant(async () => this.model.find());
    const wanted = new Set(tenantIdValues(tenantId).map((value) => String(value)));
    const names: string[] = [];
    for (const row of rows) {
      if (!row.username) continue;
      const owner = String((await this.tenantIdForGpsUsername(row.username)) || row.tenantId);
      if (wanted.has(owner) || wanted.has(String(row.tenantId))) names.push(row.username);
    }
    return [...new Set(names)];
  }

  async tenantIdForGpsUsername(username?: string | null) {
    const key = username?.trim().toLowerCase();
    if (!key) return null;
    const hints = GPS_USERNAME_TENANTS[key] ?? (key.startsWith('helloev') ? GPS_USERNAME_TENANTS.helloev1 : null);
    if (!hints) return null;
    const tenant = await this.tenants.findCustomerMatching(hints);
    return tenant?.id ?? null;
  }

  async bindKnownGpsAccounts() {
    const rows = await runWithoutTenant(async () => this.model.find());
    for (const row of rows) {
      const ownerId = await this.tenantIdForGpsUsername(row.username);
      if (!ownerId) continue;
      if (ownerId === row.tenantId) {
        if (row.enabled !== true) {
          await runWithoutTenant(async () =>
            this.model.collection.updateOne({ _id: row._id }, { $set: { enabled: true } }),
          );
        }
        continue;
      }
      await this.moveIntegrationToTenant(row, ownerId);
      this.logger.log(`Bound GPS user ${row.username} to tenant ${ownerId}`);
    }
  }

  private async moveIntegrationToTenant(row: GpsIntegrationDocument, tenantId: string) {
    await runWithoutTenant(async () => {
      const dest = await this.model.findOne({ tenantId, provider: row.provider, _id: { $ne: row._id } });
      if (dest) {
        dest.username = row.username;
        dest.password = row.password || dest.password;
        dest.pullUrl = row.pullUrl || dest.pullUrl;
        dest.provider = row.provider;
        dest.enabled = true;
        dest.displayName = row.displayName || dest.displayName;
        dest.tenantId = tenantId;
        await dest.save();
        await this.model.collection.deleteOne({ _id: row._id });
        return;
      }
      await this.model.collection.updateOne({ _id: row._id }, { $set: { tenantId, enabled: true } });
    });
  }

  async recordSync(tenantId: string, result: { ok: boolean; synced: number; message: string }, provider?: string) {
    await runWithoutTenant(async () =>
      this.model.updateOne(
        provider ? { tenantId, provider } : { tenantId },
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
      authType: 'basic' as const,
      apiTokenSet: false,
      ingestKeySet: false,
      ingestKeyMasked: null as string | null,
      headerName: '',
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
      pullUrl: doc.pullUrl || (doc.provider === 'Track360' ? DEFAULT_TRACK360_URL : ''),
      authType: doc.authType || 'basic',
      apiTokenSet: Boolean(doc.apiToken),
      ingestKeySet: Boolean(doc.ingestKey),
      ingestKeyMasked: doc.ingestKey ? maskSecret(doc.ingestKey) : null,
      headerName: doc.headerName ?? '',
      lastSyncAt: doc.lastSyncAt,
      lastSyncOk: doc.lastSyncOk,
      lastSyncMessage: doc.lastSyncMessage,
      lastSyncedCount: doc.lastSyncedCount,
    };
  }
}

function providerLabel(provider: string) {
  if (provider === 'GenericPull') return 'Generic HTTP pull';
  if (provider === 'PushIngest') return 'Push ingest API';
  return provider;
}

function maskSecret(value: string) {
  if (value.length <= 2) return '••••';
  return `${value.slice(0, 2)}${'•'.repeat(Math.min(8, value.length - 2))}`;
}
