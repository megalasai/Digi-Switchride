"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
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
      <PageHeader
        title="Reports & Analytics"
        description="Fleet counts are current; rides and revenue use the selected date range"
        actions={
          <div className="flex gap-3">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            <Button type="button" variant="secondary" onClick={async () => {
              const file = await api.reportExport(from, to);
              const blob = new Blob([file.csv], { type: "text/csv;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = file.fileName;
              a.click();
              URL.revokeObjectURL(url);
            }}>Export CSV</Button>
          </div>
        }
      />
      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard label="Total Fleet" value={String(summary.totalFleet)} accent="slate" icon={<span>🛵</span>} />
          <StatCard label="Available" value={String(summary.availableVehicles)} accent="brand" icon={<span>✓</span>} />
          <StatCard label="IoT Linked" value={String(summary.iotLinkedVehicles)} accent="blue" icon={<span>📡</span>} />
          <StatCard label="In Ride" value={String(summary.inRideVehicles)} accent="amber" icon={<span>⚡</span>} />
          <StatCard label="Total Rides" value={String(summary.totalRides)} accent="brand" icon={<span>📅</span>} />
          <StatCard label="Total Revenue" value={`₹${summary.totalRevenue.toLocaleString()}`} accent="blue" icon={<span>₹</span>} />
          <StatCard label="Fleet Utilization" value={`${summary.fleetUtilizationPercent.toFixed(1)}%`} accent="amber" icon={<span>%</span>} />
          <StatCard label="New Customers" value={String(summary.newCustomers)} accent="slate" icon={<span>👥</span>} />
          <StatCard label="Avg Ride Duration" value={`${summary.averageRideDurationMinutes.toFixed(0)} min`} accent="blue" icon={<span>⏱</span>} />
        </div>
      )}
    </div>
  );
}
