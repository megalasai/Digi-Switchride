"use client";

import { useEffect, useState } from "react";
import { api, ReportSummary } from "@/lib/api";

export default function DashboardPage() {
  const [summary, setSummary] = useState<ReportSummary | null>(null);

  useEffect(() => {
    const from = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
    const to = new Date().toISOString().split("T")[0];
    api.reportSummary(from, to).then(setSummary).catch(() => {});
  }, []);

  const cards = [
    { label: "Total Rides (30d)", value: summary?.totalRides ?? "—" },
    { label: "Revenue (30d)", value: summary ? `₹${summary.totalRevenue.toLocaleString()}` : "—" },
    { label: "Active Vehicles", value: summary?.activeVehicles ?? "—" },
    { label: "Fleet Utilization", value: summary ? `${summary.fleetUtilizationPercent.toFixed(1)}%` : "—" },
    { label: "New Customers", value: summary?.newCustomers ?? "—" },
    { label: "Avg Ride Duration", value: summary ? `${summary.averageRideDurationMinutes.toFixed(0)} min` : "—" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className="text-2xl font-bold mt-2">{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
