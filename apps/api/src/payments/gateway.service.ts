import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { Model } from 'mongoose';
import { PAYMENT_GATEWAY_PROVIDERS, type PaymentGatewayProvider } from '@digi-switchride/shared';
import { currentTenantId, tenantAls } from '../common/tenant-als';
import { PaymentGateway, PaymentGatewayDocument } from '../schemas/payment-gateway.schema';
import { TenantsService } from '../tenants/tenants.service';

const DEFAULT_METHODS = ['UPI', 'QR', 'NetBanking', 'DebitCard', 'CreditCard'];

export type GatewayUpsert = {
  tenantId?: string;
  provider: string;
  mode?: 'Test' | 'Live';
  enabled?: boolean;
  displayName?: string;
  merchantId?: string;
  keyId?: string;
  keySecret?: string;
  webhookSecret?: string;
  methods?: string[];
  checkoutUrl?: string;
  notes?: string;
};

@Injectable()
export class PaymentGatewayService {
  constructor(
    @InjectModel(PaymentGateway.name) private gatewayModel: Model<PaymentGatewayDocument>,
    private tenants: TenantsService,
  ) {}

  providers() {
    return [...PAYMENT_GATEWAY_PROVIDERS];
  }

  async resolveTenantId(explicit?: string) {
    const tenantId = explicit?.trim() || currentTenantId();
    if (!tenantId) throw new BadRequestException('Select a tenant company to configure its payment gateway');
    const tenant = await this.tenants.peek(tenantId);
    if (!tenant) throw new NotFoundException('Company not found');
    if (this.tenants.isParent(tenant)) {
      throw new BadRequestException('Fleetel is the parent company. Connect a payment gateway on a tenant, not on Fleetel.');
    }
    return tenant._id.toString();
  }

  async getAdmin(explicitTenantId?: string) {
    const tenantId = await this.resolveTenantId(explicitTenantId);
    const tenant = await this.tenants.peek(tenantId);
    const doc = await this.gatewayModel.findOne({ tenantId });
    return {
      tenantId,
      tenantName: tenant?.name,
      tenantSlug: tenant?.slug,
      providers: this.providers(),
      config: doc ? this.toAdmin(doc) : this.emptyConfig(tenantId),
    };
  }

  async listForSuperAdmin() {
    const tenants = await this.tenants.listCustomers();
    const scoped = currentTenantId();
    const visible = scoped ? tenants.filter((t) => t.id === scoped) : tenants;
    const rows = await this.gatewayModel.find({ tenantId: { $in: visible.map((t) => t.id) } });
    const byTenant = Object.fromEntries(rows.map((g) => [g.tenantId, g]));
    return {
      items: visible.map((t) => {
        const g = byTenant[t.id];
        return {
          tenantId: t.id,
          tenantName: t.name,
          tenantSlug: t.slug,
          provider: g?.provider ?? null,
          mode: g?.mode ?? null,
          enabled: g?.enabled === true,
          methods: g?.methods ?? DEFAULT_METHODS,
        };
      }),
    };
  }

  async upsert(data: GatewayUpsert) {
    const tenantId = await this.resolveTenantId(data.tenantId);
    if (!PAYMENT_GATEWAY_PROVIDERS.includes(data.provider as PaymentGatewayProvider)) {
      throw new BadRequestException('Unsupported payment gateway');
    }
    const existing = await this.gatewayModel.findOne({ tenantId });
    const methods = (data.methods ?? existing?.methods ?? DEFAULT_METHODS).filter(Boolean);
    if (!methods.length) throw new BadRequestException('Select at least one payment method');
    const next = existing ?? new this.gatewayModel({ tenantId });
    next.provider = data.provider;
    next.mode = data.mode ?? existing?.mode ?? 'Test';
    next.enabled = data.enabled ?? existing?.enabled ?? false;
    next.displayName = data.displayName?.trim() || data.provider;
    next.merchantId = data.merchantId?.trim() || existing?.merchantId;
    next.keyId = data.keyId?.trim() || existing?.keyId;
    if (data.keySecret?.trim()) next.keySecret = data.keySecret.trim();
    if (data.webhookSecret?.trim()) next.webhookSecret = data.webhookSecret.trim();
    next.methods = methods;
    next.checkoutUrl = data.checkoutUrl?.trim() || existing?.checkoutUrl;
    next.notes = data.notes?.trim() || existing?.notes;
    if (next.enabled && !next.keyId) {
      throw new BadRequestException('Enter the merchant / key ID before enabling the gateway');
    }
    await next.save();
    return this.toAdmin(next);
  }

  async publicForTenant(tenantId?: string | null) {
    if (!tenantId) return { enabled: false, provider: null, methods: ['Wallet'], displayName: null };
    const doc = await this.gatewayModel.findOne({ tenantId, enabled: true });
    if (!doc) return { enabled: false, provider: null, methods: ['Wallet'], displayName: null };
    return {
      enabled: true,
      provider: doc.provider,
      displayName: doc.displayName || doc.provider,
      mode: doc.mode,
      keyId: doc.keyId,
      methods: ['Wallet', ...doc.methods],
      checkoutUrl: doc.checkoutUrl,
    };
  }

  async requireEnabled(tenantId: string) {
    const doc = await this.gatewayModel.findOne({ tenantId, enabled: true });
    if (!doc) {
      throw new BadRequestException('This company has not connected a payment gateway. Ask Fleetel or the company admin to add keys under Finance → Gateway.');
    }
    return doc;
  }

  async createCheckout(tenantId: string, params: { amount: number; currency: string; receipt: string; method?: string }) {
    const gw = await this.requireEnabled(tenantId);
    if (params.method && params.method !== 'Wallet' && !gw.methods.includes(params.method)) {
      throw new BadRequestException(`${params.method} is not enabled on this company's ${gw.provider} gateway`);
    }
    const paise = Math.round(params.amount * 100);
    let orderId = `${gw.provider.toLowerCase()}_${randomUUID().replace(/-/g, '').slice(0, 20)}`;
    let extra: Record<string, unknown> = {};

    if (gw.provider === 'Razorpay' && gw.keyId && gw.keySecret) {
      try {
        const res = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`${gw.keyId}:${gw.keySecret}`).toString('base64')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ amount: paise, currency: params.currency, receipt: params.receipt }),
        });
        if (res.ok) {
          const body = (await res.json()) as { id?: string };
          if (body.id) orderId = body.id;
        }
      } catch {
        /* keep local order id if Razorpay is unreachable */
      }
      extra = { keyId: gw.keyId, amountPaise: paise };
    } else if (gw.provider === 'Stripe') {
      extra = { publishableKey: gw.keyId, amountPaise: paise };
    } else if (gw.provider === 'Cashfree') {
      extra = { appId: gw.keyId, orderAmount: params.amount, checkoutUrl: gw.checkoutUrl };
    } else if (gw.provider === 'PayU' || gw.provider === 'Paytm' || gw.provider === 'PhonePe') {
      extra = { merchantId: gw.merchantId || gw.keyId, checkoutUrl: gw.checkoutUrl, amount: params.amount };
    } else {
      extra = { checkoutUrl: gw.checkoutUrl, merchantId: gw.merchantId || gw.keyId };
    }

    return {
      provider: gw.provider,
      mode: gw.mode,
      orderId,
      amount: params.amount,
      currency: params.currency,
      methods: gw.methods,
      ...extra,
    };
  }

  async handleWebhook(provider: string, tenantSlug: string, payload: string, signature?: string) {
    const tenant = await this.tenants.findBySlug(tenantSlug);
    if (!tenant) throw new NotFoundException('Unknown company');
    return tenantAls.run({ tenantId: tenant._id.toString(), skip: false }, async () => {
      const gw = await this.gatewayModel.findOne({ tenantId: tenant._id.toString() });
      if (!gw || gw.provider.toLowerCase() !== provider.toLowerCase()) {
        throw new BadRequestException('Gateway does not match this company');
      }
      if (gw.webhookSecret && signature) {
        const expected = createHmac('sha256', gw.webhookSecret).update(payload).digest('hex');
        const a = Buffer.from(expected);
        const b = Buffer.from(signature);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          throw new BadRequestException('Invalid webhook signature');
        }
      }
      return { received: true, tenantId: tenant._id.toString(), provider: gw.provider };
    });
  }

  private mask(value?: string) {
    if (!value) return '';
    if (value.length <= 4) return '••••';
    return `${'•'.repeat(Math.min(12, value.length - 4))}${value.slice(-4)}`;
  }

  private emptyConfig(tenantId: string) {
    return {
      tenantId,
      provider: 'Razorpay',
      mode: 'Test' as const,
      enabled: false,
      displayName: '',
      merchantId: '',
      keyId: '',
      keySecretSet: false,
      webhookSecretSet: false,
      methods: DEFAULT_METHODS,
      checkoutUrl: '',
      notes: '',
    };
  }

  private toAdmin(doc: PaymentGatewayDocument) {
    return {
      tenantId: doc.tenantId,
      provider: doc.provider,
      mode: doc.mode,
      enabled: doc.enabled,
      displayName: doc.displayName ?? '',
      merchantId: doc.merchantId ?? '',
      keyId: doc.keyId ?? '',
      keySecretSet: Boolean(doc.keySecret),
      keySecretMasked: this.mask(doc.keySecret),
      webhookSecretSet: Boolean(doc.webhookSecret),
      webhookSecretMasked: this.mask(doc.webhookSecret),
      methods: doc.methods?.length ? doc.methods : DEFAULT_METHODS,
      checkoutUrl: doc.checkoutUrl ?? '',
      notes: doc.notes ?? '',
    };
  }
}
