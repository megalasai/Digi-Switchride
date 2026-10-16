"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { ACCESS, canAccess } from "@/lib/access";
import { api, API_BASE, Branding, TenantOrg } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useBranding } from "@/components/BrandLogos";

export default function BrandingPage() {
  const { user } = useAuth();
  const canWrite = canAccess(user?.role, ACCESS.branding);
  const isSuper = user?.role === "SuperAdmin";
  const { reload } = useBranding();
  const [companies, setCompanies] = useState<TenantOrg[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [branding, setBranding] = useState<Branding | null>(null);
  const [productName, setProductName] = useState("Digi-Switchride");
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isSuper) return;
    api.tenants().then((r) => {
      setCompanies(r.items);
      const current = localStorage.getItem("adminTenantId") || r.items[0]?.id || "";
      setCompanyId(current);
    }).catch(() => {});
  }, [isSuper]);

  const load = (id?: string) => {
    api
      .getBranding(isSuper ? id || companyId : undefined)
      .then((b) => {
        setBranding(b);
        setProductName(b.productName);
        setPreview(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load branding"));
  };

  useEffect(() => {
    if (isSuper && !companyId) return;
    load(companyId);
  }, [companyId, isSuper]);

  const onFile = (file?: File) => {
    if (!file) return;
    if (file.size > 400_000) {
      setError("Logo must be under 400 KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPreview(String(reader.result));
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (isSuper && !companyId) return setError("Select a company first");
    setError("");
    setSaving(true);
    try {
      const next = await api.updateBranding(
        { productName, optionalLogoDataUrl: preview ?? undefined },
        isSuper ? companyId : undefined,
      );
      setBranding(next);
      setPreview(null);
      setSuccess("Company branding saved. Logo appears on that company’s login and header only.");
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const clearLogo = async () => {
    if (!window.confirm("Remove this company’s logo?")) return;
    setSaving(true);
    try {
      const next = await api.updateBranding({ clearOptionalLogo: true }, isSuper ? companyId : undefined);
      setBranding(next);
      setPreview(null);
      setSuccess("Company logo removed");
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove logo");
    } finally {
      setSaving(false);
    }
  };

  const tenantSrc =
    preview ??
    branding?.optionalLogoDataUrl ??
    (branding?.hasOptionalLogo ? `${API_BASE}/branding/optional-logo` : null);
  const companyName = companies.find((c) => c.id === companyId)?.name || branding?.companyName || user?.tenantName;

  return (
    <div>
      <PageHeader
        title="Company branding"
        description="Upload a logo and display name for each company. SuperAdmin login never shows a company logo."
      />
      {error && <div className="mb-4"><Alert message={error} /></div>}
      {success && <div className="mb-4"><Alert variant="success" message={success} /></div>}
      {isSuper && (
        <div className="mb-6 max-w-md">
          <Field label="Company">
            <Select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              <option value="">Select company</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
        </div>
      )}
      <Card className="max-w-xl space-y-4 p-6">
        <h3 className="font-semibold">{companyName ? `${companyName} logo` : "Company logo"}</h3>
        <p className="text-sm text-text-secondary">Shown on that company’s sign-in screen and the top-right of its admin header. Not shown for SuperAdmin.</p>
        {tenantSrc ? (
          <div className="rounded-xl border border-border bg-white p-3">
            <img src={tenantSrc} alt="Company logo" className="h-14 max-w-full object-contain" />
          </div>
        ) : (
          <p className="text-sm text-text-secondary">No company logo uploaded yet.</p>
        )}
        {canWrite && (
          <>
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => onFile(e.target.files?.[0])} />
            <p className="text-xs text-text-muted">PNG, JPEG, WebP or SVG, under 400 KB.</p>
            <Field label="Display name">
              <Input value={productName} onChange={(e) => setProductName(e.target.value)} maxLength={60} />
            </Field>
            <div className="flex gap-2">
              <Button type="button" onClick={() => void save()} disabled={saving || (isSuper && !companyId)}>
                {saving ? "Saving…" : "Save company branding"}
              </Button>
              {branding?.hasOptionalLogo && (
                <Button type="button" variant="secondary" onClick={() => void clearLogo()} disabled={saving}>
                  Remove logo
                </Button>
              )}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
