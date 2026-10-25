"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Input";
import { api, PaymentGatewayConfig, TenantOrg } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const METHOD_OPTIONS = ["UPI", "QR", "NetBanking", "DebitCard", "CreditCard"];

export function PaymentGatewayForm({ tenantId: forcedTenantId }: { tenantId?: string }) {
  const { user } = useAuth();
  const isSuper = user?.role === "SuperAdmin";
  const [tenants, setTenants] = useState<TenantOrg[]>([]);
  const [tenantId, setTenantId] = useState(forcedTenantId || "");
  const [providers, setProviders] = useState<string[]>(["Razorpay"]);
  const [form, setForm] = useState<PaymentGatewayConfig | null>(null);
  const [keySecret, setKeySecret] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [overview, setOverview] = useState<{ tenantId: string; tenantName: string; tenantSlug: string; provider: string | null; enabled: boolean }[]>([]);

  const load = (id?: string) => {
    setError("");
    api
      .paymentGateway(id || undefined)
      .then((r) => {
        setProviders(r.providers);
        setForm(r.config);
        if (!tenantId && r.tenantId) setTenantId(r.tenantId);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load gateway"));
  };

  useEffect(() => {
    if (isSuper) {
      api.tenants().then((r) => setTenants(r.items.filter((t) => t.kind !== "Parent"))).catch(() => {});
      api.paymentGateways().then((r) => setOverview(r.items)).catch(() => {});
    }
    const working = forcedTenantId || (typeof window !== "undefined" ? localStorage.getItem("adminTenantId") : "") || "";
    if (working) setTenantId(working);
    load(working || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuper, forcedTenantId]);

  const toggleMethod = (method: string) => {
    if (!form) return;
    const methods = form.methods.includes(method) ? form.methods.filter((m) => m !== method) : [...form.methods, method];
    setForm({ ...form, methods });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const saved = await api.savePaymentGateway({
        ...form,
        tenantId: tenantId || form.tenantId,
        keySecret: keySecret || undefined,
        webhookSecret: webhookSecret || undefined,
      });
      setForm(saved);
      setKeySecret("");
      setWebhookSecret("");
      setSuccess(`${saved.provider} saved for this tenant${saved.enabled ? " and enabled" : " (disabled until you turn it on)"}`);
      if (isSuper) api.paymentGateways().then((r) => setOverview(r.items)).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {isSuper && overview.length > 0 && (
        <Card className="p-5">
          <p className="font-semibold text-text-primary">Tenant gateways</p>
          <p className="mt-1 text-sm text-text-secondary">Each customer company uses its own merchant account. Fleetel does not collect on their behalf.</p>
          <ul className="mt-4 divide-y divide-border">
            {overview.map((row) => (
              <li key={row.tenantId} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="font-medium">{row.tenantName}</span>
                <span className="text-text-muted">{row.provider ?? "Not connected"}</span>
                <Badge status={row.enabled ? "Active" : "Inactive"} />
                <Button
                  type="button"
                  variant="ghost"
                  className="text-xs"
                  onClick={() => {
                    setTenantId(row.tenantId);
                    load(row.tenantId);
                  }}
                >
                  Configure
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-5">
        <p className="font-semibold text-text-primary">Connect a payment gateway</p>
        <p className="mt-1 text-sm text-text-secondary">
          Razorpay, PayU, Cashfree, PhonePe, Paytm, Stripe or a custom checkout URL. Keys stay on the API, never in the browser.
        </p>
        {error && <div className="mt-3"><Alert message={error} /></div>}
        {success && <div className="mt-3"><Alert variant="success" message={success} /></div>}
        {form && (
          <form onSubmit={save} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {isSuper && (
              <Field label="Tenant company">
                <Select
                  value={tenantId}
                  onChange={(e) => {
                    setTenantId(e.target.value);
                    if (e.target.value) load(e.target.value);
                  }}
                  required
                >
                  <option value="">Select tenant</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label="Provider">
              <Select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })}>
                {providers.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </Select>
            </Field>
            <Field label="Mode">
              <Select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value as "Test" | "Live" })}>
                <option value="Test">Test</option>
                <option value="Live">Live</option>
              </Select>
            </Field>
            <Field label="Display name">
              <Input value={form.displayName ?? ""} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder={form.provider} />
            </Field>
            <Field label="Merchant / key ID">
              <Input value={form.keyId ?? ""} onChange={(e) => setForm({ ...form, keyId: e.target.value })} placeholder="rzp_live_… / merchant id" />
            </Field>
            <Field label="Merchant ID (PayU / Paytm / PhonePe)">
              <Input value={form.merchantId ?? ""} onChange={(e) => setForm({ ...form, merchantId: e.target.value })} />
            </Field>
            <Field label="Key secret" hint={form.keySecretSet ? `Saved ${form.keySecretMasked}` : "Not set"}>
              <Input type="password" value={keySecret} onChange={(e) => setKeySecret(e.target.value)} placeholder="Leave blank to keep current" />
            </Field>
            <Field label="Webhook secret" hint={form.webhookSecretSet ? `Saved ${form.webhookSecretMasked}` : "Not set"}>
              <Input type="password" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} placeholder="Leave blank to keep current" />
            </Field>
            <Field label="Checkout URL (optional)">
              <Input value={form.checkoutUrl ?? ""} onChange={(e) => setForm({ ...form, checkoutUrl: e.target.value })} placeholder="https://…" />
            </Field>
            <Field label="Enabled">
              <Select value={form.enabled ? "yes" : "no"} onChange={(e) => setForm({ ...form, enabled: e.target.value === "yes" })}>
                <option value="no">Disabled</option>
                <option value="yes">Enabled</option>
              </Select>
            </Field>
            <div className="md:col-span-2">
              <p className="mb-2 text-sm font-medium text-text-primary">Methods riders can use</p>
              <div className="flex flex-wrap gap-2">
                {METHOD_OPTIONS.map((m) => (
                  <label key={m} className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-sm">
                    <input type="checkbox" checked={form.methods.includes(m)} onChange={() => toggleMethod(m)} />
                    {m}
                  </label>
                ))}
              </div>
            </div>
            <Field label="Notes">
              <Input value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
            <div className="md:col-span-2 flex gap-2">
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save gateway"}</Button>
            </div>
            {tenantId && form.provider && (
              <p className="md:col-span-2 text-xs text-text-muted">
                Webhook URL: <code>/api/v1/payments/webhooks/{form.provider.toLowerCase()}/TENANT_SLUG</code>
              </p>
            )}
          </form>
        )}
      </Card>
    </div>
  );
}
