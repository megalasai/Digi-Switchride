"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
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
      <PageHeader
        title="Finance & Reconciliation"
        description="Payment collection, refunds, and GST summary"
        actions={
          <div className="flex gap-3">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        }
      />
      {data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard label="Total Collected" value={`₹${data.totalCollected.toLocaleString()}`} accent="brand" icon={<span>₹</span>} />
          <StatCard label="Total Refunded" value={`₹${data.totalRefunded.toLocaleString()}`} accent="amber" icon={<span>↩</span>} />
          <StatCard label="Net Revenue" value={`₹${data.netRevenue.toLocaleString()}`} accent="blue" icon={<span>📈</span>} />
          <StatCard label="GST Amount" value={`₹${data.gstAmount.toLocaleString()}`} accent="slate" icon={<span>🧾</span>} />
          <StatCard label="Unmatched Payments" value={String(data.unmatchedPayments)} accent="amber" icon={<span>!</span>} />
        </div>
      )}
    </div>
  );
}
