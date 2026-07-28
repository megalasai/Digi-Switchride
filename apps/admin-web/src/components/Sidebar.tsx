"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/customers", label: "Customers", icon: "👥" },
  { href: "/kyc", label: "KYC Review", icon: "📋" },
  { href: "/hubs", label: "Rental Hubs", icon: "📍" },
  { href: "/vehicles", label: "Vehicles", icon: "🛵" },
  { href: "/bookings", label: "Bookings", icon: "📅" },
  { href: "/rides", label: "Active Rides", icon: "🚦" },
  { href: "/promotions", label: "Promotions", icon: "🏷️" },
  { href: "/finance", label: "Finance", icon: "💰" },
  { href: "/reports", label: "Reports", icon: "📈" },
  { href: "/iot", label: "IoT Devices", icon: "📡" },
  { href: "/support", label: "Support", icon: "🎧" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-gray-900 text-white min-h-screen flex flex-col">
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-xl font-bold">Digi-Switchride</h1>
        <p className="text-xs text-gray-400 mt-1">Admin Portal</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-green-600 text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
