import { BadRequestException, ConflictException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { Tenant, TenantDocument } from '../schemas/tenant.schema';
import { AdminUser, AdminUserDocument } from '../schemas/admin.schema';
import { runWithoutTenant } from '../common/tenant-als';

export const DEFAULT_TENANT_SLUG = 'digi-switchride';

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
    const tenant = await this.ensureDefaultTenant();
    this.defaultId = tenant._id.toString();
    await this.backfill(this.defaultId);
  }

  async ensureDefaultTenant() {
    let tenant = await this.tenantModel.findOne({ slug: DEFAULT_TENANT_SLUG });
    if (!tenant) {
      tenant = await this.tenantModel.create({
        slug: DEFAULT_TENANT_SLUG,
        name: 'Digi-Switchride',
        status: 'Active',
        isDefault: true,
        contactEmail: 'admin@digiswitchride.com',
      });
    }
    return tenant;
  }

  defaultTenantId() {
    return this.defaultId;
  }

  async findById(id: string) {
    const tenant = await this.tenantModel.findById(id);
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
        const byId = await this.tenantModel.findOne({ _id: slugOrId, status: 'Active' });
        if (byId) return byId._id.toString();
      }
      const bySlug = await this.findBySlug(slugOrId);
      if (bySlug) return bySlug._id.toString();
    }
    const fallback = await this.ensureDefaultTenant();
    return fallback._id.toString();
  }

  async list() {
    const items = await this.tenantModel.find().sort({ isDefault: -1, name: 1 });
    return items.map((t) => this.toTenant(t));
  }

  async create(data: { name: string; slug: string; contactEmail?: string; notes?: string }) {
    const slug = this.normalizeSlug(data.slug);
    const existing = await this.tenantModel.findOne({ slug });
    if (existing) throw new ConflictException('Tenant slug already exists');
    const tenant = await this.tenantModel.create({
      name: data.name.trim(),
      slug,
      contactEmail: data.contactEmail?.trim().toLowerCase(),
      notes: data.notes?.trim(),
      status: 'Active',
      isDefault: false,
    });
    return this.toTenant(tenant);
  }

  async peek(id: string) {
    return this.tenantModel.findById(id);
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
      if (tenant.isDefault && data.status === 'Suspended') {
        throw new BadRequestException('The default tenant cannot be suspended');
      }
      tenant.status = data.status;
    }
    await tenant.save();
    return this.toTenant(tenant);
  }

  toTenant(tenant: TenantDocument) {
    return {
      id: tenant._id.toString(),
      slug: tenant.slug,
      name: tenant.name,
      contactEmail: tenant.contactEmail,
      status: tenant.status,
      isDefault: tenant.isDefault,
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
