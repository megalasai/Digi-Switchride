"use client";

import { useEffect, useState } from "react";
import { api, FinanceReconciliation } from "@/lib/api";

export default function FinancePage() {
  const [data, setData] = useState<FinanceReconciliation | null>(null);
  const [from, setFrom] = useState(new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0]);
  const [to, setTo] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    api.reconciliation(from, to).then(setData).catch(() => {});
  }, [from, to]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Finance & Reconciliation</h1>
      <div className="flex gap-4 mb-6">
        <input type="date" className="border rounded px-3 py-2" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className="border rounded px-3 py-2" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Collected" value={`₹${data.totalCollected.toLocaleString()}`} />
          <StatCard label="Total Refunded" value={`₹${data.totalRefunded.toLocaleString()}`} />
          <StatCard label="Net Revenue" value={`₹${data.netRevenue.toLocaleString()}`} />
          <StatCard label="GST Amount" value={`₹${data.gstAmount.toLocaleString()}`} />
          <StatCard label="Unmatched Payments" value={String(data.unmatchedPayments)} />
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-xl font-bold mt-2">{value}</p>
    </div>
  );
}
