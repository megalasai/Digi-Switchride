"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Input";
import { api, GpsIntegrationConfig, TenantOrg } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const DEFAULT_TRACK360_URL = "https://prod-s1.track360.net.in/api/v1/auth/pull_api";

function blankConfig(tenantId: string, provider: string): GpsIntegrationConfig {
  return {
    tenantId,
    provider,
    enabled: false,
    displayName: providerLabel(provider),
    username: "",
    passwordSet: false,
    pullUrl: provider === "Track360" ? DEFAULT_TRACK360_URL : "",
    authType: provider === "Track360" ? "basic" : provider === "PushIngest" ? "none" : "bearer",
    apiTokenSet: false,
    ingestKeySet: false,
    headerName: "",
  };
}

function providerLabel(provider: string) {
  if (provider === "GenericPull") return "Generic HTTP pull";
  if (provider === "Traccar") return "Traccar";
  if (provider === "PushIngest") return "Push ingest API";
  return provider;
}

export function GpsIntegrationForm({ tenantId: forcedTenantId }: { tenantId?: string }) {
  const { user } = useAuth();
  const isSuper = user?.role === "SuperAdmin";
  const [tenants, setTenants] = useState<TenantOrg[]>([]);
  const [tenantId, setTenantId] = useState(forcedTenantId || "");
  const [providers, setProviders] = useState<string[]>(["Track360", "GenericPull", "Traccar", "PushIngest"]);
  const [integrations, setIntegrations] = useState<GpsIntegrationConfig[]>([]);
  const [ingestUrl, setIngestUrl] = useState("/api/v1/iot/ingest");
  const [form, setForm] = useState<GpsIntegrationConfig | null>(null);
  const [password, setPassword] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [ingestKeyOnce, setIngestKeyOnce] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [importing, setImporting] = useState(false);
  const [overview, setOverview] = useState<
    { tenantId: string; tenantName: string; tenantSlug: string; provider: string | null; enabled: boolean; lastSyncMessage?: string }[]
  >([]);

  const selectProvider = (provider: string, list = integrations, owner = tenantId) => {
    const existing = list.find((row) => row.provider === provider);
    setForm(existing ?? blankConfig(owner, provider));
    if (form?.provider !== provider) {
      setPassword("");
      setApiToken("");
      setIngestKeyOnce("");
    }
  };

  const load = (id?: string, preferredProvider?: string) => {
    setError("");
    api
      .gpsIntegration(id || undefined)
      .then((r) => {
        setProviders(r.providers?.length ? r.providers : providers);
        setIngestUrl(r.ingestUrl || "/api/v1/iot/ingest");
        const list = r.integrations?.length ? r.integrations : r.config ? [r.config] : [];
        setIntegrations(list);
        if (!tenantId && r.tenantId) setTenantId(r.tenantId);
        const provider = preferredProvider || form?.provider || list[0]?.provider || "Track360";
        selectProvider(provider, list, r.tenantId);
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
        apiToken: apiToken || undefined,
      });
      setForm(saved);
      setPassword("");
      setApiToken("");
      if (saved.ingestKeyOnce) setIngestKeyOnce(saved.ingestKeyOnce);
      setSuccess(`${providerLabel(saved.provider)} saved for this company${saved.enabled ? " and enabled" : " (disabled until you turn it on)"}`);
      load(tenantId || form.tenantId, saved.provider);
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
      if (tenantId) load(tenantId, form?.provider);
      if (isSuper) api.gpsIntegrations().then((r) => setOverview(r.items)).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const isPush = form?.provider === "PushIngest";
  const origin = typeof window !== "undefined" ? window.location.origin.replace(/:\d+$/, "") : "";

  return (
    <div className="space-y-6">
      {isSuper && overview.length > 0 && (
        <Card className="p-5">
          <p className="font-semibold text-text-primary">Tenant GPS accounts</p>
          <p className="mt-1 text-sm text-text-secondary">
            Each customer company can connect Track360 plus other GPS APIs. Devices stay on that tenant.
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
          Track360, Traccar, or any JSON HTTP pull. Use Push ingest when the vendor posts devices to Switchride. Save a separate integration for each API.
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
              <Select value={form.provider} onChange={(e) => selectProvider(e.target.value)}>
                {providers.map((p) => (
                  <option key={p} value={p}>{providerLabel(p)}</option>
                ))}
              </Select>
            </Field>
            <Field label="Display name">
              <Input value={form.displayName ?? ""} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder={form.provider} />
            </Field>
            {!isPush && (
              <>
                <Field label="Auth type">
                  <Select value={form.authType ?? "basic"} onChange={(e) => setForm({ ...form, authType: e.target.value })}>
                    <option value="basic">Username + password</option>
                    <option value="bearer">Bearer token</option>
                    <option value="header">Custom header</option>
                    <option value="query">Query token</option>
                  </Select>
                </Field>
                <Field label="API username">
                  <Input value={form.username ?? ""} onChange={(e) => setForm({ ...form, username: e.target.value })} autoComplete="off" />
                </Field>
                <Field label="API password" hint={form.passwordSet ? `Saved ${form.passwordMasked}` : "Not set"}>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank to keep current" autoComplete="new-password" />
                </Field>
                <Field label="API token" hint={form.apiTokenSet ? "Saved" : "Optional for bearer/header/query auth"}>
                  <Input type="password" value={apiToken} onChange={(e) => setApiToken(e.target.value)} placeholder="Leave blank to keep current" autoComplete="off" />
                </Field>
                {(form.authType === "header" || form.authType === "query") && (
                  <Field label={form.authType === "query" ? "Query parameter name" : "Header name"}>
                    <Input value={form.headerName ?? ""} onChange={(e) => setForm({ ...form, headerName: e.target.value })} placeholder={form.authType === "query" ? "token" : "X-API-Key"} />
                  </Field>
                )}
                <div className="md:col-span-2">
                  <Field label="Pull URL">
                    <Input
                      value={form.pullUrl ?? ""}
                      onChange={(e) => setForm({ ...form, pullUrl: e.target.value })}
                      placeholder={form.provider === "Track360" ? DEFAULT_TRACK360_URL : "https://vendor.example/api/devices"}
                    />
                  </Field>
                </div>
              </>
            )}
            {isPush && (
              <div className="md:col-span-2 space-y-2 rounded-lg border border-border p-3 text-sm">
                <p>Vendors POST JSON devices to this URL with header <code>X-Ingest-Key</code>.</p>
                <p className="break-all font-mono text-xs">{origin}{ingestUrl}</p>
                {form.ingestKeySet && <p>Key saved {form.ingestKeyMasked}. It is shown in full only once when first created.</p>}
                {ingestKeyOnce && <p className="break-all font-mono text-xs">Ingest key (copy now): {ingestKeyOnce}</p>}
              </div>
            )}
            <Field label="Enabled">
              <Select value={form.enabled ? "yes" : "no"} onChange={(e) => setForm({ ...form, enabled: e.target.value === "yes" })}>
                <option value="yes">{isPush ? "Yes — accept posted devices" : "Yes — poll this account"}</option>
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
              {!isPush && (
                <Button type="button" variant="secondary" onClick={() => void syncNow()} disabled={syncing}>
                  {syncing ? "Syncing…" : "Sync now"}
                </Button>
              )}
            </div>
          </form>
        )}
      </Card>

      <Card className="p-5">
        <p className="font-semibold text-text-primary">Import vehicles from a GPS API</p>
        <p className="mt-1 text-sm text-text-secondary">
          Paste JSON (array or a devices list) with imei/deviceId and optional vehicleNumber, lat, lng. Vehicles are created on the tenant selected above.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3">
          <textarea
            className="min-h-[120px] w-full rounded-md border border-border bg-transparent p-2 font-mono text-xs"
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            placeholder='[{"imei":"123456789012345","vehicleNumber":"TN01AB1234","lat":13.08,"lng":80.27}]'
          />
          <Button
            type="button"
            variant="secondary"
            disabled={importing || !form}
            onClick={() => {
              setError("");
              setSuccess("");
              let payload: unknown;
              try {
                payload = JSON.parse(importJson);
              } catch {
                setError("Import JSON is not valid");
                return;
              }
              setImporting(true);
              api
                .importIotDevices({
                  tenantId: tenantId || form?.tenantId,
                  vendorType: form?.provider || "GenericPull",
                  items: payload,
                })
                .then((r) => {
                  setSuccess(r.message);
                  setImportJson("");
                })
                .catch((err) => setError(err instanceof Error ? err.message : "Import failed"))
                .finally(() => setImporting(false));
            }}
          >
            {importing ? "Importing…" : "Import devices"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
