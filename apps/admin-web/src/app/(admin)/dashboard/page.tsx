"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { api, ReportSummary } from "@/lib/api";

export default function DashboardPage() {
  const [summary, setSummary] = useState<ReportSummary | null>(null);

  useEffect(() => {
    const from = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
    const to = new Date().toISOString().split("T")[0];
    api.reportSummary(from, to).then(setSummary).catch(() => {});
  }, []);

  const cards = [
    { label: "Total Fleet", value: summary?.totalFleet ?? "—", accent: "slate" as const, icon: "🛵" },
    { label: "Available for Booking", value: summary?.availableVehicles ?? "—", accent: "brand" as const, icon: "✓" },
    { label: "IoT Linked", value: summary?.iotLinkedVehicles ?? "—", accent: "blue" as const, icon: "📡" },
    { label: "In Ride Now", value: summary?.inRideVehicles ?? "—", accent: "amber" as const, icon: "⚡" },
    { label: "Total Rides (30d)", value: summary?.totalRides ?? "—", accent: "brand" as const, icon: "📅" },
    { label: "Revenue (30d)", value: summary ? `₹${summary.totalRevenue.toLocaleString()}` : "—", accent: "blue" as const, icon: "₹" },
    { label: "Fleet Utilization", value: summary ? `${summary.fleetUtilizationPercent.toFixed(1)}%` : "—", accent: "amber" as const, icon: "%" },
    { label: "New Customers", value: summary?.newCustomers ?? "—", accent: "slate" as const, icon: "👥" },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" description="Fleet status is live; ride/revenue stats cover the last 30 days" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <StatCard key={card.label} label={card.label} value={card.value} accent={card.accent} icon={<span className="text-base">{card.icon}</span>} />
        ))}
      </div>
    </div>
  );
}
