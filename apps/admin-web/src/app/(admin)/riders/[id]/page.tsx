"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Select } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { IconUsers } from "@/components/icons";
import { ACCESS, canAccess } from "@/lib/access";
import { api, RentalPlan, RiderProfile } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const tabs = ["Overview", "Vehicle", "Plan", "Wallet", "Payments", "Service history", "KYC"] as const;
type Tab = (typeof tabs)[number];

export default function RiderProfilePage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const canWrite = canAccess(user?.role, ACCESS.ridersWrite);
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [plans, setPlans] = useState<RentalPlan[]>([]);
  const [planId, setPlanId] = useState("");
  const [tab, setTab] = useState<Tab>("Overview");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([api.riderProfile(params.id), api.rentalPlans()])
      .then(([p, planRes]) => {
        setProfile(p);
        setPlans(planRes.items);
        setPlanId(p.rentalPlan?.id ?? "");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load rider"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [params.id]);

  const assignPlan = async () => {
    if (!planId) return;
    setError("");
    setSuccess("");
    try {
      const next = await api.assignRiderPlan(params.id, planId);
      setProfile(next);
      setSuccess("Rental plan updated");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Plan update failed");
    }
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Rider profile" description="Loading…" />
        <p className="text-sm text-text-secondary">Loading…</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div>
        <PageHeader title="Rider profile" description="Consolidated customer relationship" />
        {error && <Alert message={error} />}
      </div>
    );
  }

  const r = profile.rider;

  return (
    <div>
      <PageHeader
        title={r.fullName ?? r.phone}
        description="Consolidated rider relationship: vehicle, plan, wallet, payments, KYC"
        actions={<Link href="/riders"><Button variant="secondary">Back to riders</Button></Link>}
      />
      {error && <div className="mb-4"><Alert message={error} /></div>}
      {success && <div className="mb-4"><Alert variant="success" message={success} /></div>}

      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`rounded-xl px-3 py-2 text-sm font-medium ${tab === item ? "bg-brand text-white" : "bg-white text-text-secondary border border-border"}`}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <Card className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
          <p><span className="text-xs text-text-muted">Phone</span><br />{r.phone}</p>
          <p><span className="text-xs text-text-muted">Email</span><br />{r.email ?? "—"}</p>
          <p><span className="text-xs text-text-muted">Account</span><br /><Badge status={r.accountStatus} /></p>
          <p><span className="text-xs text-text-muted">KYC</span><br /><Badge status={profile.kyc.status} /></p>
          <p><span className="text-xs text-text-muted">Wallet</span><br />₹{profile.wallet.balance.toLocaleString("en-IN")}</p>
          <p><span className="text-xs text-text-muted">Plan</span><br />{profile.rentalPlan?.name ?? "Not assigned"}</p>
        </Card>
      )}

      {tab === "Vehicle" && (
        profile.assignedVehicle ? (
          <Card className="p-6">
            <p className="font-semibold">{profile.assignedVehicle.registrationNumber}</p>
            <p className="mt-1 text-sm text-text-secondary">{profile.assignedVehicle.model} · {profile.assignedVehicle.type}</p>
            <p className="mt-2"><Badge status={profile.assignedVehicle.status} /> · Battery {profile.assignedVehicle.batteryPercent}%</p>
            <Link className="mt-3 inline-block text-sm font-semibold text-brand" href={`/vehicles/${profile.assignedVehicle.id}`}>Open vehicle</Link>
          </Card>
        ) : (
          <EmptyState icon={<IconUsers className="h-7 w-7" />} title="No assigned vehicle" description="Assign a vehicle from the vehicle detail screen." />
        )
      )}

      {tab === "Plan" && (
        <Card className="space-y-4 p-6">
          {profile.rentalPlan ? (
            <div>
              <p className="font-semibold">{profile.rentalPlan.name}</p>
              <p className="text-sm text-text-secondary">₹{profile.rentalPlan.charges} · {profile.rentalPlan.durationDays} days · {profile.rentalPlan.billingFrequency}</p>
              <p className="mt-2 text-sm">{profile.rentalPlan.terms}</p>
            </div>
          ) : (
            <p className="text-sm text-text-secondary">No current plan.</p>
          )}
          {canWrite && (
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Assign or change plan">
                <Select value={planId} onChange={(e) => setPlanId(e.target.value)}>
                  <option value="">Select plan</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
              </Field>
              <Button type="button" onClick={assignPlan} disabled={!planId}>Save plan</Button>
            </div>
          )}
        </Card>
      )}

      {tab === "Wallet" && (
        profile.wallet.transactions.length === 0 ? (
          <EmptyState icon={<IconUsers className="h-7 w-7" />} title="No wallet transactions" description="Credits, debits and adjustments will appear here when Finance wallet management is enabled." />
        ) : (
          <DataTable>
            <Table>
              <TableHead>
                <TableHeaderCell>Type</TableHeaderCell>
                <TableHeaderCell>Amount</TableHeaderCell>
                <TableHeaderCell>Reference</TableHeaderCell>
              </TableHead>
              <TableBody>
                {profile.wallet.transactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{t.type}</TableCell>
                    <TableCell>₹{t.amount.toLocaleString("en-IN")}</TableCell>
                    <TableCell>{t.reference ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataTable>
        )
      )}

      {tab === "Payments" && (
        profile.payments.length === 0 ? (
          <EmptyState icon={<IconUsers className="h-7 w-7" />} title="No payments" description="Payment history will appear after rider transactions." />
        ) : (
          <DataTable>
            <Table>
              <TableHead>
                <TableHeaderCell>Amount</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Method</TableHeaderCell>
              </TableHead>
              <TableBody>
                {profile.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>₹{p.amount.toLocaleString("en-IN")}</TableCell>
                    <TableCell><Badge status={p.status} /></TableCell>
                    <TableCell>{p.method ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataTable>
        )
      )}

      {tab === "Service history" && (
        profile.rentalActivity.bookings.length === 0 && profile.rentalActivity.rides.length === 0 ? (
          <EmptyState icon={<IconUsers className="h-7 w-7" />} title="No service history yet" description="Workshop service requests are not operational in this portal slice. Related bookings and rides will show here when present." />
        ) : (
          <Card className="p-6 text-sm text-text-secondary">
            {profile.rentalActivity.bookings.length} booking(s) and {profile.rentalActivity.rides.length} ride(s) on record. Dedicated workshop history arrives with service management.
          </Card>
        )
      )}

      {tab === "KYC" && (
        profile.kyc.submissions.length === 0 ? (
          <EmptyState icon={<IconUsers className="h-7 w-7" />} title="No KYC documents" description={`Current status: ${profile.kyc.status}. Submissions from the rider app appear here.`} />
        ) : (
          <DataTable>
            <Table>
              <TableHead>
                <TableHeaderCell>Document</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Reason</TableHeaderCell>
              </TableHead>
              <TableBody>
                {profile.kyc.submissions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.documentType}</TableCell>
                    <TableCell><Badge status={s.status} /></TableCell>
                    <TableCell>{s.rejectionReason ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataTable>
        )
      )}
    </div>
  );
}
