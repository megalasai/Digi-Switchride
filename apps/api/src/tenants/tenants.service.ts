import { BadRequestException, ConflictException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { Tenant, TenantDocument } from '../schemas/tenant.schema';
import { AdminUser, AdminUserDocument } from '../schemas/admin.schema';
import { runWithoutTenant } from '../common/tenant-als';
import { displayProductName, PARENT_COMPANY_NAME, PARENT_COMPANY_SLUG, PRODUCT_NAME } from '@digi-switchride/shared';
import { findByEitherId } from '../common/mongo-id';

export const DEFAULT_TENANT_SLUG = 'digi-switchride';
export { PARENT_COMPANY_SLUG };

const TENANT_COLLECTIONS = [
  'vehicles',
  'rental_hubs',
  'iot_devices',
  'customers',
  'admin_users',
  'branding',
  'bookings',
  'rides',
  'payments',
  'promotions',
  'support_tickets',
  'rental_plans',
  'wallet_transactions',
  'vehicle_events',
  'kyc_submissions',
  'otp_records',
  'charging_stations',
  'app_notifications',
  'feedback',
  'agreements',
  'breakdowns',
  'service_centres',
  'service_slots',
  'service_requests',
  'service_appointments',
  'audit_logs',
  'payment_gateways',
  'gps_integrations',
];

@Injectable()
export class TenantsService implements OnModuleInit {
  private defaultId: string | null = null;

  constructor(
    @InjectModel(Tenant.name) private tenantModel: Model<TenantDocument>,
    @InjectModel(AdminUser.name) private adminModel: Model<AdminUserDocument>,
    @InjectConnection() private connection: Connection,
  ) {}

  async onModuleInit() {
    await this.ensureParentCompany();
    const tenant = await this.ensureDefaultTenant();
    this.defaultId = tenant._id.toString();
    await this.backfill(this.defaultId);
  }

  async ensureParentCompany() {
    let parent = await this.tenantModel.findOne({ slug: PARENT_COMPANY_SLUG });
    if (!parent) {
      parent = await this.tenantModel.create({
        slug: PARENT_COMPANY_SLUG,
        name: PARENT_COMPANY_NAME,
        status: 'Active',
        isDefault: false,
        kind: 'Parent',
        contactEmail: 'hello@fleetel.com',
        notes: 'Platform operator. Customer companies are tenants of Fleetel.',
      });
    } else if (parent.kind !== 'Parent') {
      await this.tenantModel.collection.updateOne(
        { slug: PARENT_COMPANY_SLUG },
        { $set: { kind: 'Parent', name: PARENT_COMPANY_NAME } },
      );
      parent.kind = 'Parent';
      parent.name = PARENT_COMPANY_NAME;
    }
    await this.tenantModel.updateMany({ slug: { $ne: PARENT_COMPANY_SLUG }, $or: [{ kind: { $exists: false } }, { kind: null }] }, { $set: { kind: 'Tenant' } });
    return parent;
  }

  async ensureDefaultTenant() {
    let tenant = await this.tenantModel.findOne({ slug: DEFAULT_TENANT_SLUG });
    if (!tenant) {
      tenant = await this.tenantModel.create({
        slug: DEFAULT_TENANT_SLUG,
        name: PRODUCT_NAME,
        status: 'Active',
        isDefault: true,
        kind: 'Tenant',
        contactEmail: 'admin@digiswitchride.com',
        notes: 'Sample tenant on the Fleetel-Switchride product, operated by Fleetel.',
      });
    } else {
      const set: Record<string, unknown> = {};
      if (!tenant.kind) set.kind = 'Tenant';
      if (displayProductName(tenant.name) !== tenant.name) set.name = PRODUCT_NAME;
      if (Object.keys(set).length) {
        await this.tenantModel.collection.updateOne({ slug: DEFAULT_TENANT_SLUG }, { $set: set });
        Object.assign(tenant, set);
      }
    }
    return tenant;
  }

  defaultTenantId() {
    return this.defaultId;
  }

  async findById(id: string) {
    const tenant = await findByEitherId(this.tenantModel, id);
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async findBySlug(slug: string) {
    const normalized = slug.trim().toLowerCase();
    return this.tenantModel.findOne({ slug: normalized, status: 'Active' });
  }

  async resolveTenantId(slugOrId?: string | null) {
    if (slugOrId) {
      if (/^[a-f0-9]{24}$/i.test(slugOrId)) {
        const byId = await findByEitherId(this.tenantModel, slugOrId);
        if (byId && byId.status === 'Active') return byId._id.toString();
      }
      const bySlug = await this.findBySlug(slugOrId);
      if (bySlug) return bySlug._id.toString();
    }
    const fallback = await this.ensureDefaultTenant();
    return fallback._id.toString();
  }

  async list() {
    const items = await this.tenantModel.find().sort({ kind: 1, isDefault: -1, name: 1 });
    return items.map((t) => this.toTenant(t));
  }

  async listCustomers() {
    const items = await this.tenantModel.find({ kind: { $ne: 'Parent' } }).sort({ isDefault: -1, name: 1 });
    return items.map((t) => this.toTenant(t));
  }

  isParent(tenant: { kind?: string; slug?: string }) {
    return tenant.kind === 'Parent' || tenant.slug === PARENT_COMPANY_SLUG;
  }

  async create(data: { name: string; slug: string; contactEmail?: string; notes?: string }) {
    const slug = this.normalizeSlug(data.slug);
    if (slug === PARENT_COMPANY_SLUG) throw new BadRequestException('Fleetel is the parent company and cannot be created as a tenant');
    const existing = await this.tenantModel.findOne({ slug });
    if (existing) throw new ConflictException('Tenant slug already exists');
    const tenant = await this.tenantModel.create({
      name: data.name.trim(),
      slug,
      contactEmail: data.contactEmail?.trim().toLowerCase(),
      notes: data.notes?.trim(),
      status: 'Active',
      isDefault: false,
      kind: 'Tenant',
    });
    return this.toTenant(tenant);
  }

  async peek(id: string) {
    return findByEitherId(this.tenantModel, id);
  }

  async update(
    id: string,
    data: { name?: string; contactEmail?: string; status?: 'Active' | 'Suspended'; notes?: string },
  ) {
    const tenant = await this.findById(id);
    if (data.name != null) tenant.name = data.name.trim();
    if (data.contactEmail != null) tenant.contactEmail = data.contactEmail.trim().toLowerCase();
    if (data.notes != null) tenant.notes = data.notes.trim();
    if (data.status != null) {
      if (this.isParent(tenant) || tenant.isDefault) {
        if (data.status === 'Suspended') {
          throw new BadRequestException('Fleetel (parent) and the default tenant cannot be suspended');
        }
      }
      tenant.status = data.status;
    }
    try {
      await tenant.save();
    } catch (err) {
      if (!err || typeof err !== 'object' || (err as { name?: string }).name !== 'DocumentNotFoundError') throw err;
      await this.tenantModel.collection.updateOne(
        { slug: tenant.slug },
        {
          $set: {
            name: tenant.name,
            contactEmail: tenant.contactEmail,
            notes: tenant.notes,
            status: tenant.status,
          },
        },
      );
    }
    return this.toTenant(tenant);
  }

  toTenant(tenant: TenantDocument) {
    return {
      id: tenant._id.toString(),
      slug: tenant.slug,
      name: /digi[\s-]*switch/i.test(tenant.name) ? PRODUCT_NAME : tenant.name,
      contactEmail: tenant.contactEmail,
      status: tenant.status,
      isDefault: tenant.isDefault,
      kind: tenant.kind === 'Parent' ? 'Parent' : 'Tenant',
      notes: tenant.notes,
      createdAt: (tenant as { createdAt?: Date }).createdAt,
    };
  }

  private normalizeSlug(value: string) {
    const slug = value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
    if (slug.length < 2) throw new BadRequestException('Enter a slug like acme-fleet');
    return slug;
  }

  private async backfill(tenantId: string) {
    await runWithoutTenant(async () => {
      for (const name of TENANT_COLLECTIONS) {
        try {
          await this.connection.collection(name).updateMany({ tenantId: { $exists: false } }, { $set: { tenantId } });
        } catch {
          /* collection may not exist yet */
        }
      }
      await this.dropLegacyUnique('vehicles', 'registrationNumber_1');
      await this.dropLegacyUnique('customers', 'username_1');
      await this.dropLegacyUnique('customers', 'phone_1');
      await this.dropLegacyUnique('admin_users', 'email_1');
    });
  }

  private async dropLegacyUnique(collection: string, indexName: string) {
    try {
      await this.connection.collection(collection).dropIndex(indexName);
    } catch {
      /* index may already be gone */
    }
  }
}
