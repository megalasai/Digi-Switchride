"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, API_BASE, Branding } from "@/lib/api";

const BrandingContext = createContext<{ branding: Branding | null; reload: () => void }>({
  branding: null,
  reload: () => {},
});

const PRODUCT = "Fleetel-Switchride";
const FALLBACK_LOGO = "/brand/partner.png";

const FALLBACK: Branding = {
  productName: PRODUCT,
  companyName: null,
  hasOptionalLogo: false,
  optionalLogoCleared: false,
  optionalLogoUrl: null,
  optionalLogoDataUrl: null,
};

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<Branding>(FALLBACK);
  const load = useCallback(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("adminToken") : null;
    const req = token ? api.getBranding() : api.publicBranding();
    req.then((next) => setBranding({ ...FALLBACK, ...next })).catch(() => setBranding(FALLBACK));
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return <BrandingContext.Provider value={{ branding, reload: load }}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  return useContext(BrandingContext);
}

export function tenantLogoSrc(branding: Branding | null, slug?: string | null) {
  if (branding?.optionalLogoDataUrl) return branding.optionalLogoDataUrl;
  if (branding?.optionalLogoUrl) {
    if (branding.optionalLogoUrl.startsWith("http") || branding.optionalLogoUrl.startsWith("data:")) {
      return branding.optionalLogoUrl;
    }
    if (branding.optionalLogoUrl.startsWith("/api/")) return branding.optionalLogoUrl;
    return `${API_BASE}${branding.optionalLogoUrl.startsWith("/") ? branding.optionalLogoUrl : `/${branding.optionalLogoUrl}`}`;
  }
  if (branding?.hasOptionalLogo || slug) {
    const query = slug || branding?.companySlug;
    return query ? `${API_BASE}/branding/optional-logo?slug=${encodeURIComponent(query)}` : `${API_BASE}/branding/optional-logo`;
  }
  return null;
}

export function ProductBrand({
  variant = "light",
  size = "md",
  showName = true,
  companyName,
}: {
  variant?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  companyName?: string | null;
}) {
  const { branding } = useBranding();
  const name = branding?.productName ?? PRODUCT;
  const company = companyName ?? branding?.companyName;
  const pin = size === "lg" ? "h-14 w-14" : size === "sm" ? "h-9 w-9" : "h-11 w-11";
  const nameColor = variant === "dark" ? "text-white" : "text-text-primary";
  const subColor = variant === "dark" ? "text-[#9aa3bc]" : "text-text-muted";

  return (
    <div className="flex min-w-0 items-center gap-3">
      <img src="/brand/switchride.svg" alt="Fleetel-Switchride" className={`${pin} shrink-0`} />
      {showName ? (
        <div className="min-w-0">
          <p className={`truncate text-base font-bold tracking-tight ${nameColor}`}>{company || name}</p>
          <p className={`text-xs ${subColor}`}>{company ? "Company portal" : "Operations portal"}</p>
        </div>
      ) : null}
    </div>
  );
}

export function TenantLogo({
  branding,
  slug,
  size = "md",
  label = true,
  fallback = false,
}: {
  branding?: Branding | null;
  slug?: string | null;
  size?: "sm" | "md";
  label?: boolean;
  fallback?: boolean;
}) {
  const ctx = useBranding();
  const resolved = branding === undefined ? ctx.branding : branding;
  const src = tenantLogoSrc(resolved, slug) ?? (fallback ? FALLBACK_LOGO : null);
  const [shown, setShown] = useState(src);
  useEffect(() => {
    setShown(src);
  }, [src]);
  if (!shown) return null;
  const height = size === "sm" ? "h-8" : "h-12";
  return (
    <div className="min-w-0">
      {label ? <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">Company logo</p> : null}
      <div className="inline-flex max-w-full items-center rounded-xl border border-border bg-white px-3 py-2">
        <img
          src={shown}
          alt="Company logo"
          className={`${height} w-auto max-w-[160px] object-contain object-left`}
          onError={() => {
            if (fallback && shown !== FALLBACK_LOGO) setShown(FALLBACK_LOGO);
            else setShown(null);
          }}
        />
      </div>
    </div>
  );
}

export function BrandLogos(props: {
  variant?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  layout?: "row" | "stack" | "header";
}) {
  return <ProductBrand variant={props.variant} size={props.size} showName={props.showName} />;
}
