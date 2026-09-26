"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
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

const sections = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: IconDashboard },
      { href: "/reports", label: "Reports", icon: IconChart },
    ],
  },
  {
    label: "Administration",
    items: [{ href: "/users", label: "Admin Users", icon: IconUsers }],
  },
  {
    label: "Operations",
    items: [
      { href: "/customers", label: "Customers", icon: IconUsers },
      { href: "/kyc", label: "KYC Review", icon: IconShield },
      { href: "/hubs", label: "Rental Hubs", icon: IconMapPin },
      { href: "/vehicles", label: "Vehicles", icon: IconScooter },
      { href: "/bookings", label: "Bookings", icon: IconCalendar },
      { href: "/rides", label: "Active Rides", icon: IconActivity },
    ],
  },
  {
    label: "Business",
    items: [
      { href: "/promotions", label: "Promotions", icon: IconTag },
      { href: "/finance", label: "Finance", icon: IconWallet },
      { href: "/iot", label: "IoT Devices", icon: IconRadio },
      { href: "/support", label: "Support", icon: IconHeadphones },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-white">
      <div className="border-b border-sidebar-border px-5 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-dark shadow-lg">
            <IconBolt className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight">Digi-Switchride</h1>
            <p className="text-xs text-text-muted">Admin Portal</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-brand text-white shadow-sm"
                        : "text-slate-300 hover:bg-sidebar-hover hover:text-white",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border px-5 py-4">
        <div className="rounded-xl bg-sidebar-hover px-3 py-3">
          <p className="text-xs font-medium text-white">India EV Operations</p>
          <p className="mt-0.5 text-xs text-text-muted">Platform v1.0</p>
        </div>
      </div>
    </aside>
  );
}
