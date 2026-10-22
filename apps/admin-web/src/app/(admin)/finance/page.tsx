"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { IconWallet } from "@/components/icons";
import { ACCESS, canAccess } from "@/lib/access";
import { api, AdminPayment, FinanceReconciliation, Rider } from "@/lib/api";
import { ProvisionPanel, DisabledField, DisabledAction } from "@/components/ui/Provision";
import { PaymentGatewayForm } from "@/components/PaymentGatewayForm";
import { useAuth } from "@/lib/auth-context";

type Tab = "Payments" | "Wallets" | "Reconciliation" | "Gateway";

export default function FinancePage() {
  const { user } = useAuth();
  const canWrite = canAccess(user?.role, ACCESS.walletsWrite);
  const [tab, setTab] = useState<Tab>("Payments");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [wallets, setWallets] = useState<Rider[]>([]);
  const [recon, setRecon] = useState<FinanceReconciliation | null>(null);
  const [from, setFrom] = useState(new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0]);
  const [to, setTo] = useState(new Date().toISOString().split("T")[0]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [adjust, setAdjust] = useState({ riderId: "", type: "Credit" as "Credit" | "Debit", amount: "", note: "" });

  const loadPayments = () => {
    api.payments({ status: status || undefined, search: search || undefined })
      .then((r) => setPayments(r.items))
      .catch((e) => setError(e.message));
  };
  const loadWallets = () => {
    api.wallets(search || undefined).then((r) => setWallets(r.items)).catch((e) => setError(e.message));
  };

  useEffect(() => {
    if (tab === "Payments") loadPayments();
    if (tab === "Wallets") loadWallets();
  }, [tab, status]);

  useEffect(() => {
    api.reconciliation(from, to).then(setRecon).catch((e) => setError(e.message));
  }, [from, to]);

  const refund = async (id: string) => {
    const reason = window.prompt("Refund reason (min 5 characters)");
    if (!reason || reason.trim().length < 5) {
      setError("Refund reason must be at least 5 characters");
      return;
    }
    if (!window.confirm("Refund this paid transaction?")) return;
    try {
      await api.refundPayment(id, reason.trim());
      setSuccess("Refund recorded");
      loadPayments();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refund failed");
    }
  };

  const submitAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(adjust.amount);
    if (!adjust.riderId) return setError("Select a rider");
    if (!amount || amount <= 0) return setError("Amount must be greater than zero");
    if (adjust.note.trim().length < 5) return setError("Note must be at least 5 characters");
    if (!window.confirm(`${adjust.type} ₹${amount} on this wallet?`)) return;
    try {
      await api.adjustWallet(adjust.riderId, { type: adjust.type, amount, note: adjust.note.trim() });
      setSuccess("Wallet updated");
      setAdjust({ ...adjust, amount: "", note: "" });
      loadWallets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Adjustment failed");
    }
  };

  return (
    <div>
      <PageHeader title="Payments & Wallets" description="Outstanding, received, failed and refunded payments plus rider wallet adjustments" />
      {error && <div className="mb-4"><Alert message={error} /></div>}
      {success && <div className="mb-4"><Alert variant="success" message={success} /></div>}
      <div className="mb-4 flex gap-2">
        {(["Payments", "Wallets", "Reconciliation", "Gateway"] as Tab[]).map((item) => (
          <Button key={item} type="button" variant={tab === item ? "primary" : "secondary"} onClick={() => { setTab(item); setError(""); }}>
            {item}
          </Button>
        ))}
      </div>

      {tab === "Payments" && (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="Created">Outstanding (Created)</option>
              <option value="Paid">Received (Paid)</option>
              <option value="Failed">Failed</option>
              <option value="Refunded">Refunds</option>
            </Select>
            <Input className="w-56" placeholder="Search rider or reference" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Button type="button" variant="secondary" onClick={loadPayments}>Apply</Button>
          </div>
          {payments.length === 0 ? (
            <EmptyState icon={<IconWallet className="h-7 w-7" />} title="No payments" description="Outstanding and received transactions appear here when riders pay." />
          ) : (
            <DataTable>
              <Table>
                <TableHead>
                  <TableHeaderCell>Rider</TableHeaderCell>
                  <TableHeaderCell>Amount</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Reference</TableHeaderCell>
                  <TableHeaderCell />
                </TableHead>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.riderName ?? p.riderPhone ?? p.customerId}</TableCell>
                      <TableCell>₹{p.amount.toLocaleString("en-IN")}</TableCell>
                      <TableCell><Badge status={p.status} /></TableCell>
                      <TableCell className="font-mono text-xs">{p.reference ?? "—"}</TableCell>
                      <TableCell>
                        {canWrite && p.status === "Paid" && (
                          <Button variant="ghost" className="text-xs" type="button" onClick={() => refund(p.id)}>Refund</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DataTable>
          )}
        </>
      )}

      {tab === "Wallets" && (
        <>
          {canWrite && (
            <Card className="mb-4 p-6">
              <form onSubmit={submitAdjust} className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <Field label="Rider">
                  <Select value={adjust.riderId} onChange={(e) => setAdjust({ ...adjust, riderId: e.target.value })}>
                    <option value="">Select rider</option>
                    {wallets.map((w) => <option key={w.id} value={w.id}>{w.fullName ?? w.phone} (₹{w.walletBalance})</option>)}
                  </Select>
                </Field>
                <Field label="Type">
                  <Select value={adjust.type} onChange={(e) => setAdjust({ ...adjust, type: e.target.value as "Credit" | "Debit" })}>
                    <option value="Credit">Credit</option>
                    <option value="Debit">Debit</option>
                  </Select>
                </Field>
                <Field label="Amount (INR)">
                  <Input type="number" min="0.01" step="0.01" value={adjust.amount} onChange={(e) => setAdjust({ ...adjust, amount: e.target.value })} />
                </Field>
                <Field label="Reason">
                  <Input value={adjust.note} onChange={(e) => setAdjust({ ...adjust, note: e.target.value })} />
                </Field>
                <div className="md:col-span-4"><Button type="submit">Post adjustment</Button></div>
              </form>
            </Card>
          )}
          <div className="mb-4 flex gap-2">
            <Input className="w-56" placeholder="Search riders" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Button type="button" variant="secondary" onClick={loadWallets}>Search</Button>
          </div>
          {wallets.length === 0 ? (
            <EmptyState icon={<IconWallet className="h-7 w-7" />} title="No wallets" description="Rider wallets appear after accounts are created." />
          ) : (
            <DataTable>
              <Table>
                <TableHead>
                  <TableHeaderCell>Rider</TableHeaderCell>
                  <TableHeaderCell>Phone</TableHeaderCell>
                  <TableHeaderCell>Balance</TableHeaderCell>
                </TableHead>
                <TableBody>
                  {wallets.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell>{w.fullName ?? "—"}</TableCell>
                      <TableCell>{w.phone}</TableCell>
                      <TableCell>₹{(w.walletBalance ?? 0).toLocaleString("en-IN")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DataTable>
          )}
        </>
      )}

      {tab === "Reconciliation" && recon && (
        <>
          <div className="mb-4 flex gap-2">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard label="Total Collected" value={`₹${recon.totalCollected.toLocaleString()}`} accent="brand" />
            <StatCard label="Total Refunded" value={`₹${recon.totalRefunded.toLocaleString()}`} accent="amber" />
            <StatCard label="Net Revenue" value={`₹${recon.netRevenue.toLocaleString()}`} accent="blue" />
            <StatCard label="GST Amount" value={`₹${recon.gstAmount.toLocaleString()}`} accent="slate" />
            <StatCard label="Unmatched Payments" value={String(recon.unmatchedPayments)} accent="amber" />
          </div>
        </>
      )}

      {tab === "Gateway" && (
        <>
          <PaymentGatewayForm />
          <div className="mt-6">
            <ProvisionPanel
              title="GST e-invoice"
              description="IRN generation and PDF invoices for paid rentals."
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <DisabledField label="GSTIN" placeholder="22AAAAA0000A1Z5" />
                <DisabledAction label="Generate invoices" />
              </div>
            </ProvisionPanel>
          </div>
        </>
      )}
    </div>
  );
}
