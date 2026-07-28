"use client";

import { useEffect, useState } from "react";
import { api, ReportSummary } from "@/lib/api";

export default function ReportsPage() {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [from, setFrom] = useState(new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0]);
  const [to, setTo] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    api.reportSummary(from, to).then(setSummary).catch(() => {});
  }, [from, to]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Reports & Analytics</h1>
      <div className="flex gap-4 mb-6">
        <input type="date" className="border rounded px-3 py-2" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className="border rounded px-3 py-2" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard label="Total Rides" value={String(summary.totalRides)} />
          <StatCard label="Total Revenue" value={`₹${summary.totalRevenue.toLocaleString()}`} />
          <StatCard label="Active Vehicles" value={String(summary.activeVehicles)} />
          <StatCard label="Fleet Utilization" value={`${summary.fleetUtilizationPercent.toFixed(1)}%`} />
          <StatCard label="New Customers" value={String(summary.newCustomers)} />
          <StatCard label="Avg Ride Duration" value={`${summary.averageRideDurationMinutes.toFixed(0)} min`} />
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-2">{value}</p>
    </div>
  );
}
