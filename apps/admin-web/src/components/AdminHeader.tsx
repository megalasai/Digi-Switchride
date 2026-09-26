"use client";

import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth-context";

const titles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/users": "Admin Users",
  "/customers": "Customers",
  "/kyc": "KYC Review",
  "/hubs": "Rental Hubs",
  "/vehicles": "Vehicles",
  "/bookings": "Bookings",
  "/rides": "Active Rides",
  "/promotions": "Promotions",
  "/finance": "Finance",
  "/reports": "Reports",
  "/iot": "IoT Devices",
  "/support": "Support",
};

export function AdminHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const title = Object.entries(titles).find(([path]) => pathname.startsWith(path))?.[1] ?? "Admin";

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-surface-card/80 px-6 backdrop-blur-md lg:px-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Digi-Switchride</p>
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
      </div>
      <div className="flex items-center gap-3">
        {user && (
          <>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-text-primary">{user.fullName}</p>
              <p className="text-xs text-text-secondary">{user.role}</p>
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
