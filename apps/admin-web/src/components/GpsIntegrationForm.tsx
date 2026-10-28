"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Input";
import { api, GpsIntegrationConfig, TenantOrg } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export function GpsIntegrationForm({ tenantId: forcedTenantId }: { tenantId?: string }) {
  const { user } = useAuth();
  const isSuper = user?.role === "SuperAdmin";
  const [tenants, setTenants] = useState<TenantOrg[]>([]);
  const [tenantId, setTenantId] = useState(forcedTenantId || "");
  const [providers, setProviders] = useState<string[]>(["Track360", "GenericPull"]);
  const [form, setForm] = useState<GpsIntegrationConfig | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [overview, setOverview] = useState<
    { tenantId: string; tenantName: string; tenantSlug: string; provider: string | null; enabled: boolean; lastSyncMessage?: string }[]
  >([]);

  const load = (id?: string) => {
    setError("");
    api
      .gpsIntegration(id || undefined)
      .then((r) => {
        setProviders(r.providers);
        setForm(r.config);
        if (!tenantId && r.tenantId) setTenantId(r.tenantId);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load GPS integration"));
  };

  useEffect(() => {
    if (isSuper) {
      api.tenants().then((r) => setTenants(r.items.filter((t) => t.kind !== "Parent"))).catch(() => {});
      api.gpsIntegrations().then((r) => setOverview(r.items)).catch(() => {});
    }
    const working = forcedTenantId || (typeof window !== "undefined" ? localStorage.getItem("adminTenantId") : "") || "";
    if (working) setTenantId(working);
    load(working || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuper, forcedTenantId]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const saved = await api.saveGpsIntegration({
        ...form,
        tenantId: tenantId || form.tenantId,
        password: password || undefined,
      });
      setForm(saved);
      setPassword("");
      setSuccess(`${saved.provider} saved for this company${saved.enabled ? " and enabled" : " (disabled until you turn it on)"}`);
      if (isSuper) api.gpsIntegrations().then((r) => setOverview(r.items)).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const syncNow = async () => {
    setSyncing(true);
    setError("");
    setSuccess("");
    try {
      const result = await api.syncIotDevices(tenantId || form?.tenantId || undefined);
      setSuccess(result.message ?? `Synced ${result.synced} devices`);
      if (tenantId) load(tenantId);
      if (isSuper) api.gpsIntegrations().then((r) => setOverview(r.items)).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {isSuper && overview.length > 0 && (
        <Card className="p-5">
          <p className="font-semibold text-text-primary">Tenant GPS accounts</p>
          <p className="mt-1 text-sm text-text-secondary">
            Each customer company uses its own Track360 (or other HTTP GPS) username and password. Devices pulled for a tenant stay on that tenant.
          </p>
          <ul className="mt-4 divide-y divide-border">
            {overview.map((row) => (
              <li key={row.tenantId} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
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
        <p className="font-semibold text-text-primary">Connect a GPS / telematics API</p>
        <p className="mt-1 text-sm text-text-secondary">
          Track360 pull API, or any vendor that returns JSON device rows with IMEI/lat/lng. The password is stored on the API and is never shown again.
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
                  <option key={p} value={p}>{p === "GenericPull" ? "Generic HTTP pull" : p}</option>
                ))}
              </Select>
            </Field>
            <Field label="Display name">
              <Input value={form.displayName ?? ""} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder={form.provider} />
            </Field>
            <Field label="API username">
              <Input value={form.username ?? ""} onChange={(e) => setForm({ ...form, username: e.target.value })} autoComplete="off" />
            </Field>
            <Field label="API password" hint={form.passwordSet ? `Saved ${form.passwordMasked}` : "Not set"}>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank to keep current" autoComplete="new-password" />
            </Field>
            <div className="md:col-span-2">
              <Field label="Pull URL">
                <Input
                  value={form.pullUrl ?? ""}
                  onChange={(e) => setForm({ ...form, pullUrl: e.target.value })}
                  placeholder="https://prod-s1.track360.net.in/api/v1/auth/pull_api"
                />
              </Field>
            </div>
            <Field label="Enabled">
              <Select value={form.enabled ? "yes" : "no"} onChange={(e) => setForm({ ...form, enabled: e.target.value === "yes" })}>
                <option value="yes">Yes — poll this account</option>
                <option value="no">No</option>
              </Select>
            </Field>
            {form.lastSyncAt && (
              <p className="md:col-span-2 text-sm text-text-muted">
                Last sync {form.lastSyncOk === false ? "failed" : "ok"}: {form.lastSyncMessage}
              </p>
            )}
            <div className="md:col-span-2 flex flex-wrap gap-2">
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save GPS integration"}</Button>
              <Button type="button" variant="secondary" onClick={() => void syncNow()} disabled={syncing}>
                {syncing ? "Syncing…" : "Sync now"}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
