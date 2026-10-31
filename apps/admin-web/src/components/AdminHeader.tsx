"use client";

import { usePathname, useRouter } from "next/navigation";
import { TenantLogo } from "@/components/BrandLogos";
import { IconMenu } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth-context";
import { useSidebarUi } from "@/lib/sidebar-context";
import { api, TenantOrg } from "@/lib/api";
import { useEffect, useState } from "react";

const titles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/users": "Admin Users",
  "/tenants": "Organizations",
  "/riders": "Riders",
  "/customers": "Riders",
  "/plans": "Rental Plans",
  "/audit": "Audit trail",
  "/kyc": "KYC Review",
  "/breakdowns": "Breakdowns",
  "/service": "Service",
  "/hubs": "Rental Hubs",
  "/vehicles": "Vehicles",
  "/track": "Track Vehicle",
  "/bookings": "Bookings",
  "/rides": "Active Rides",
  "/promotions": "Promotions",
  "/finance": "Finance",
  "/reports": "Reports",
  "/iot": "IoT Devices",
  "/support": "Support",
  "/stations": "Charging stations",
  "/engagement": "Engagement",
  "/integrations": "Integrations",
  "/branding": "Branding",
};

export function AdminHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { hidden, toggle } = useSidebarUi();
  const title = Object.entries(titles).find(([path]) => pathname.startsWith(path))?.[1] ?? "Admin";
  const [tenants, setTenants] = useState<TenantOrg[]>([]);
  const [tenantId, setTenantId] = useState("");

  useEffect(() => {
    if (user?.role !== "SuperAdmin") return;
    setTenantId(localStorage.getItem("adminTenantId") ?? "");
    api.tenants().then((r) => setTenants(r.items)).catch(() => {});
  }, [user?.role]);

  return (
    <header className="sticky top-0 z-10 flex min-h-16 items-center justify-between gap-4 border-b border-border bg-white/90 px-4 py-2 backdrop-blur-md lg:px-8">
      <div className="flex min-w-0 items-center gap-4">
        <Button
          type="button"
          variant="ghost"
          className="px-2"
          title={hidden ? "Show menu" : "Hide menu"}
          onClick={toggle}
        >
          <IconMenu className="h-5 w-5" />
        </Button>
        <div className="hidden min-w-0 sm:block">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            {user?.role === "SuperAdmin" ? "Fleetel" : user?.tenantName || "Company portal"}
          </p>
          <h2 className="truncate text-lg font-semibold text-text-primary">{title}</h2>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {user?.role !== "SuperAdmin" ? <TenantLogo size="sm" label={false} fallback /> : null}
        {user?.role === "SuperAdmin" && tenantId ? (
          <TenantLogo
            size="sm"
            label={false}
            fallback
            branding={null}
            slug={tenants.find((t) => t.id === tenantId)?.slug}
          />
        ) : null}
        {user?.role === "SuperAdmin" && tenants.length > 0 && (
          <label className="flex items-center gap-2 text-xs text-text-muted">
            Working in
          <select
            className="max-w-[180px] rounded-lg border border-border bg-white px-2 py-1.5 text-xs"
            value={tenantId}
            onChange={(e) => {
              const value = e.target.value;
              setTenantId(value);
              if (value) localStorage.setItem("adminTenantId", value);
              else localStorage.removeItem("adminTenantId");
              window.location.reload();
            }}
          >
            <option value="">All tenants</option>
            {tenants.filter((t) => t.kind !== "Parent").map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          </label>
        )}
        {user && (
          <>
            <div className="hidden text-right md:block">
              <p className="text-sm font-medium text-text-primary">{user.fullName}</p>
              <p className="text-xs text-text-secondary">{user.role}{user.role === "SuperAdmin" ? " · Fleetel" : user.tenantName ? ` · ${user.tenantName}` : ""}</p>
            </div>
            <Button variant="ghost" className="text-xs" onClick={() => { logout(); router.replace("/login"); }}>
              Logout
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
