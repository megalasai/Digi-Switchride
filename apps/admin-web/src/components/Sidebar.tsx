"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ProductBrand } from "@/components/BrandLogos";
import {
  IconActivity,
  IconBolt,
  IconCalendar,
  IconChart,
  IconDashboard,
  IconHeadphones,
  IconMapPin,
  IconRadio,
  IconScooter,
  IconShield,
  IconTag,
  IconUsers,
  IconWallet,
} from "@/components/icons";
import { cn } from "@/lib/cn";
import { ACCESS, canAccess } from "@/lib/access";
import { useAuth } from "@/lib/auth-context";

const sections = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: IconDashboard, access: ACCESS.dashboard },
      { href: "/reports", label: "Reports", icon: IconChart, access: ACCESS.reports },
    ],
  },
  {
    label: "Riders & Fleet",
    items: [
      { href: "/riders", label: "Riders", icon: IconUsers, access: ACCESS.riders },
      { href: "/vehicles", label: "Vehicles", icon: IconScooter, access: ACCESS.vehicles },
      { href: "/hubs", label: "Rental Hubs", icon: IconMapPin, access: ACCESS.hubs },
      { href: "/stations", label: "Charging", icon: IconBolt, access: ACCESS.stations },
      { href: "/kyc", label: "KYC Review", icon: IconShield, access: ACCESS.kyc },
      { href: "/plans", label: "Rental Plans", icon: IconTag, access: ACCESS.plans },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/bookings", label: "Bookings", icon: IconCalendar, access: ACCESS.bookings },
      { href: "/rides", label: "Active Rides", icon: IconActivity, access: ACCESS.bookings },
      { href: "/breakdowns", label: "Breakdowns", icon: IconHeadphones, access: ACCESS.breakdowns },
      { href: "/service", label: "Service", icon: IconCalendar, access: ACCESS.service },
      { href: "/iot", label: "IoT Devices", icon: IconRadio, access: ACCESS.iot },
      { href: "/support", label: "Support", icon: IconHeadphones, access: ACCESS.support },
    ],
  },
  {
    label: "Business",
    items: [
      { href: "/promotions", label: "Promotions", icon: IconTag, access: ACCESS.promotions },
      { href: "/finance", label: "Finance", icon: IconWallet, access: ACCESS.finance },
      { href: "/engagement", label: "Engagement", icon: IconTag, access: ACCESS.engagement },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/users", label: "Admin Users", icon: IconUsers, access: ACCESS.users },
      { href: "/tenants", label: "Organizations", icon: IconUsers, access: ACCESS.tenants },
      { href: "/audit", label: "Audit trail", icon: IconShield, access: ACCESS.audit },
      { href: "/branding", label: "Branding", icon: IconBolt, access: ACCESS.branding },
      { href: "/integrations", label: "Integrations", icon: IconBolt, access: ACCESS.integrations },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-white">
      <div className="border-b border-sidebar-border px-4 py-5">
        <ProductBrand variant="dark" size="sm" />
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {sections.map((section) => {
          const items = section.items.filter((item) => canAccess(user?.role, item.access));
          if (!items.length) return null;
          return (
            <div key={section.label}>
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-[#8b93ab]">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-white/12 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                          : "text-[#b7bdd0] hover:bg-sidebar-hover hover:text-white",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border px-5 py-4">
        <p className="text-xs text-[#9aa3bc]">Fleetel-Switchride · Fleetel</p>
      </div>
    </aside>
  );
}
