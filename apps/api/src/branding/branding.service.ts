import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { displayProductName, PRODUCT_NAME } from '@digi-switchride/shared';
import { Branding, BrandingDocument } from '../schemas/branding.schema';
import { TenantsService } from '../tenants/tenants.service';
import { currentTenantId, tenantAls } from '../common/tenant-als';
import { patchByEitherId } from '../common/mongo-id';
import { tenantIdClause } from '../common/tenant.plugin';

const KEY = 'default';
const MAX_BYTES = 900_000;
const LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']);

@Injectable()
export class BrandingService {
  constructor(
    @InjectModel(Branding.name) private brandingModel: Model<BrandingDocument>,
    private tenants: TenantsService,
  ) {}

  async getPublic() {
    const doc = await this.ensureDoc();
    const logo = asBuffer(doc.optionalLogo);
    const hasOptionalLogo = Boolean(logo?.length);
    const tenantId = currentTenantId();
    const tenant = tenantId ? await this.tenants.peek(tenantId) : null;
    return {
      productName: displayProductName(doc.productName),
      companyName: tenant?.name ?? null,
      companyId: tenantId,
      companySlug: tenant?.slug ?? null,
      hasOptionalLogo,
      optionalLogoCleared: Boolean(doc.optionalLogoCleared),
      optionalLogoUrl: hasOptionalLogo
        ? `/api/v1/branding/optional-logo${tenant?.slug ? `?slug=${encodeURIComponent(tenant.slug)}` : ''}`
        : null,
      optionalLogoDataUrl: hasOptionalLogo
        ? `data:${doc.optionalLogoMime || 'image/png'};base64,${logo!.toString('base64')}`
        : null,
    };
  }

  async getForSlug(slug?: string) {
    if (!slug?.trim()) return this.emptyPublic();
    const tenant = await this.tenants.findBySlug(slug.trim());
    if (!tenant) return this.emptyPublic();
    return tenantAls.run({ tenantId: tenant._id.toString(), hubIds: null, skip: false }, () => this.getPublic());
  }

  async getOptionalLogo(slug?: string) {
    try {
      if (slug?.trim()) {
        const tenant = await this.tenants.findBySlug(slug.trim());
        if (!tenant) return null;
        return await tenantAls.run({ tenantId: tenant._id.toString(), hubIds: null, skip: false }, () => this.readLogo());
      }
      if (!currentTenantId()) return null;
      return await this.readLogo();
    } catch (error) {
      if (error instanceof NotFoundException) return null;
      throw error;
    }
  }

  async update(data: { productName?: string; optionalLogoDataUrl?: string | null; clearOptionalLogo?: boolean }) {
    const doc = await this.ensureDoc();
    const set: Record<string, unknown> = {};
    const unset: Record<string, 1> = {};
    if (data.productName != null) {
      const name = data.productName.trim();
      if (!name) throw new BadRequestException('Product name is required');
      if (name.length > 60) throw new BadRequestException('Product name is too long');
      set.productName = name;
      doc.productName = name;
    }
    if (data.clearOptionalLogo) {
      unset.optionalLogo = 1;
      unset.optionalLogoMime = 1;
      set.optionalLogoCleared = true;
      doc.optionalLogo = undefined;
      doc.optionalLogoMime = undefined;
      doc.optionalLogoCleared = true;
    } else if (data.optionalLogoDataUrl) {
      const parsed = this.parseDataUrl(data.optionalLogoDataUrl);
      set.optionalLogo = parsed.buffer;
      set.optionalLogoMime = parsed.mime;
      set.optionalLogoCleared = false;
      doc.optionalLogo = parsed.buffer;
      doc.optionalLogoMime = parsed.mime;
      doc.optionalLogoCleared = false;
    }
    const tenantId = currentTenantId();
    if (tenantId) set.tenantId = tenantId;
    const update: Record<string, unknown> = {};
    if (Object.keys(set).length) update.$set = set;
    if (Object.keys(unset).length) update.$unset = unset;
    if (Object.keys(update).length) {
      const matched = await patchByEitherId(this.brandingModel.collection, String(doc._id), update);
      if (!matched) {
        await this.brandingModel.collection.updateOne(
          { key: KEY, ...(tenantId ? tenantIdClause(tenantId) : {}) },
          update as never,
          { upsert: true },
        );
      }
    }
    return this.getPublic();
  }

  private emptyPublic() {
    return {
      productName: PRODUCT_NAME,
      companyName: null,
      companyId: null,
      companySlug: null,
      hasOptionalLogo: false,
      optionalLogoCleared: false,
      optionalLogoUrl: null,
      optionalLogoDataUrl: null,
    };
  }

  private async readLogo() {
    const doc = await this.ensureDoc();
    const logo = asBuffer(doc.optionalLogo);
    if (!logo?.length) throw new NotFoundException('No optional logo uploaded');
    return { mime: doc.optionalLogoMime || 'image/png', buffer: logo };
  }

  private async ensureDoc() {
    const tenantId = currentTenantId();
    let doc = await this.brandingModel.findOne({ key: KEY });
    if (!doc) {
      const raw = await this.brandingModel.collection.findOne({
        key: KEY,
        ...(tenantId ? tenantIdClause(tenantId) : {}),
      } as never);
      if (raw) doc = this.brandingModel.hydrate(raw);
    }
    if (doc) {
      if (displayProductName(doc.productName) !== doc.productName) {
        doc.productName = PRODUCT_NAME;
        await patchByEitherId(this.brandingModel.collection, String(doc._id), { $set: { productName: PRODUCT_NAME } }).catch(
          () => undefined,
        );
      }
      return doc;
    }
    try {
      return await this.brandingModel.create({
        key: KEY,
        productName: PRODUCT_NAME,
        optionalLogoCleared: false,
        ...(tenantId ? { tenantId } : {}),
      });
    } catch (error) {
      if (!isDuplicate(error)) throw error;
      const again = await this.brandingModel.findOne({ key: KEY });
      if (again) return again;
      throw error;
    }
  }

  private parseDataUrl(value: string) {
    const match = /^data:(image\/[a-z0-9.+-]+)(?:;charset=[^;,]+)?;base64,([A-Za-z0-9+/=\s]+)$/i.exec(value.trim());
    if (!match) throw new BadRequestException('Upload a PNG, JPEG, WebP or SVG logo');
    const mimeRaw = match[1].toLowerCase();
    if (!LOGO_TYPES.has(mimeRaw)) throw new BadRequestException('Upload a PNG, JPEG, WebP or SVG logo');
    const buffer = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
    if (!buffer.length) throw new BadRequestException('Logo file is empty');
    if (buffer.length > MAX_BYTES) throw new BadRequestException('Logo must be under 900 KB');
    return { mime: mimeRaw === 'image/jpg' ? 'image/jpeg' : mimeRaw, buffer };
  }
}

function asBuffer(value: unknown): Buffer | null {
  if (!value) return null;
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === 'object' && value && 'buffer' in value) {
    const inner = (value as { buffer?: unknown }).buffer;
    if (Buffer.isBuffer(inner)) return inner;
    if (inner instanceof Uint8Array) return Buffer.from(inner);
  }
  try {
    return Buffer.from(value as ArrayBuffer);
  } catch {
    return null;
  }
}

function isDuplicate(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: number }).code === 11000);
}
