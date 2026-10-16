import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Branding, BrandingDocument } from '../schemas/branding.schema';
import { TenantsService } from '../tenants/tenants.service';
import { currentTenantId } from '../common/tenant-als';

const KEY = 'default';
const MAX_BYTES = 450_000;

@Injectable()
export class BrandingService {
  constructor(
    @InjectModel(Branding.name) private brandingModel: Model<BrandingDocument>,
    private tenants: TenantsService,
  ) {}

  async getPublic() {
    const doc = await this.ensureDoc();
    const hasOptionalLogo = Boolean(doc.optionalLogo?.length);
    const tenantId = currentTenantId();
    const tenant = tenantId ? await this.tenants.peek(tenantId) : null;
    return {
      productName: doc.productName || 'Digi-Switchride',
      companyName: tenant?.name ?? null,
      companyId: tenantId,
      hasOptionalLogo,
      optionalLogoCleared: Boolean(doc.optionalLogoCleared),
      optionalLogoUrl: hasOptionalLogo ? '/api/v1/branding/optional-logo' : null,
      optionalLogoDataUrl: hasOptionalLogo
        ? `data:${doc.optionalLogoMime || 'image/png'};base64,${Buffer.from(doc.optionalLogo!).toString('base64')}`
        : null,
    };
  }

  async getOptionalLogo() {
    const doc = await this.ensureDoc();
    if (!doc.optionalLogo?.length) throw new NotFoundException('No optional logo uploaded');
    return { mime: doc.optionalLogoMime || 'image/png', buffer: doc.optionalLogo };
  }

  async update(data: { productName?: string; optionalLogoDataUrl?: string | null; clearOptionalLogo?: boolean }) {
    const doc = await this.ensureDoc();
    if (data.productName != null) {
      const name = data.productName.trim();
      if (!name) throw new BadRequestException('Product name is required');
      if (name.length > 60) throw new BadRequestException('Product name is too long');
      doc.productName = name;
    }
    if (data.clearOptionalLogo) {
      doc.optionalLogo = undefined;
      doc.optionalLogoMime = undefined;
      doc.optionalLogoCleared = true;
    } else if (data.optionalLogoDataUrl) {
      const parsed = this.parseDataUrl(data.optionalLogoDataUrl);
      doc.optionalLogo = parsed.buffer;
      doc.optionalLogoMime = parsed.mime;
      doc.optionalLogoCleared = false;
    }
    await doc.save();
    return this.getPublic();
  }

  private async ensureDoc() {
    let doc = await this.brandingModel.findOne({ key: KEY });
    if (doc) return doc;
    doc = await this.brandingModel.create({
      key: KEY,
      productName: 'Digi-Switchride',
      optionalLogoCleared: true,
    });
    return doc;
  }

  private parseDataUrl(value: string) {
    const match = /^data:(image\/(?:png|jpeg|jpg|webp|svg\+xml));base64,([A-Za-z0-9+/=\s]+)$/i.exec(value.trim());
    if (!match) throw new BadRequestException('Upload a PNG, JPEG, WebP or SVG logo');
    const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
    if (!buffer.length) throw new BadRequestException('Logo file is empty');
    if (buffer.length > MAX_BYTES) throw new BadRequestException('Logo must be under 450 KB');
    return { mime: match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase(), buffer };
  }
}
