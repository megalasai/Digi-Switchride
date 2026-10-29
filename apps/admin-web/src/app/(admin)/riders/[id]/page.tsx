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
import { Field, Input, Select } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { IconUsers } from "@/components/icons";
import { ACCESS, canAccess } from "@/lib/access";
import { api, RentalPlan, RiderProfile, Vehicle } from "@/lib/api";
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
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [assignVehicleId, setAssignVehicleId] = useState("");
  const [kycType, setKycType] = useState("Aadhaar");
  const [kycNumber, setKycNumber] = useState("");
  const [kycFile, setKycFile] = useState<string>("");
  const [tab, setTab] = useState<Tab>("Overview");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([api.riderProfile(params.id), api.rentalPlans(), api.vehicles({ availability: "unassigned" }).catch(() => ({ items: [] as Vehicle[] }))])
      .then(([p, planRes, vehicleRes]) => {
        setProfile(p);
        setPlans(planRes.items);
        setPlanId(p.rentalPlan?.id ?? "");
        setVehicles(vehicleRes.items);
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
        <div className="space-y-4">
          {profile.assignedVehicle ? (
            <Card className="p-6">
              <p className="font-semibold">{profile.assignedVehicle.registrationNumber}</p>
              <p className="mt-1 text-sm text-text-secondary">{profile.assignedVehicle.model} · {profile.assignedVehicle.type}</p>
              <p className="mt-2"><Badge status={profile.assignedVehicle.status} /> · Battery {profile.assignedVehicle.batteryPercent}%</p>
              <Link className="mt-3 inline-block text-sm font-semibold text-brand" href={`/vehicles/${profile.assignedVehicle.id}`}>Open vehicle</Link>
              {canWrite && (
                <div className="mt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={async () => {
                      if (!window.confirm("Unassign this vehicle from the rider?")) return;
                      setError("");
                      try {
                        await api.unassignVehicle(profile.assignedVehicle!.id);
                        setSuccess("Vehicle unassigned");
                        load();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Unassign failed");
                      }
                    }}
                  >
                    Unassign vehicle
                  </Button>
                </div>
              )}
            </Card>
          ) : (
            <EmptyState icon={<IconUsers className="h-7 w-7" />} title="No assigned vehicle" description="Pick an available vehicle below to assign this rider." />
          )}
          {canWrite && !profile.assignedVehicle && (
            <Card className="flex flex-wrap items-end gap-3 p-6">
              <Field label="Available vehicle">
                <Select value={assignVehicleId} onChange={(e) => setAssignVehicleId(e.target.value)}>
                  <option value="">Select vehicle</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>{v.registrationNumber} · {v.model}</option>
                  ))}
                </Select>
              </Field>
              <Button
                type="button"
                disabled={!assignVehicleId}
                onClick={async () => {
                  setError("");
                  try {
                    await api.assignVehicle(assignVehicleId, { riderId: params.id });
                    setSuccess("Vehicle assigned to this rider");
                    setAssignVehicleId("");
                    load();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Assignment failed");
                  }
                }}
              >
                Assign vehicle
              </Button>
            </Card>
          )}
        </div>
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
        <div className="space-y-4">
          {canWrite && (
            <Card className="space-y-3 p-6">
              <p className="font-semibold">Upload KYC document for this customer</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Document type">
                  <Select value={kycType} onChange={(e) => setKycType(e.target.value)}>
                    <option value="Aadhaar">Aadhaar</option>
                    <option value="PAN">PAN</option>
                    <option value="DrivingLicence">Driving licence</option>
                    <option value="Selfie">Selfie / photograph</option>
                  </Select>
                </Field>
                <Field label="Document number" hint="Optional">
                  <Input value={kycNumber} onChange={(e) => setKycNumber(e.target.value)} />
                </Field>
                <div className="md:col-span-2">
                  <Field label="File" hint="JPG, PNG or PDF, about 5 MB max">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) {
                          setKycFile("");
                          return;
                        }
                        if (file.size > 5_000_000) {
                          setError("KYC file must be 5 MB or smaller");
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = () => setKycFile(String(reader.result ?? ""));
                        reader.readAsDataURL(file);
                      }}
                    />
                  </Field>
                </div>
              </div>
              <Button
                type="button"
                disabled={!kycFile}
                onClick={async () => {
                  setError("");
                  try {
                    await api.uploadRiderKyc(params.id, {
                      documentType: kycType,
                      documentNumber: kycNumber.trim() || undefined,
                      blobUrl: kycFile,
                    });
                    setSuccess("KYC document uploaded for review");
                    setKycNumber("");
                    setKycFile("");
                    load();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Upload failed");
                  }
                }}
              >
                Upload document
              </Button>
            </Card>
          )}
          {profile.kyc.submissions.length === 0 ? (
            <EmptyState icon={<IconUsers className="h-7 w-7" />} title="No KYC documents" description={`Current status: ${profile.kyc.status}. Upload a file above or wait for the rider app.`} />
          ) : (
            <DataTable>
              <Table>
                <TableHead>
                  <TableHeaderCell>Document</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>File</TableHeaderCell>
                  <TableHeaderCell>Reason</TableHeaderCell>
                </TableHead>
                <TableBody>
                  {profile.kyc.submissions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.documentType}{s.documentNumberMasked ? ` · ${s.documentNumberMasked}` : ""}</TableCell>
                      <TableCell><Badge status={s.status} /></TableCell>
                      <TableCell>
                        {s.blobUrl ? (
                          <a className="text-sm font-semibold text-brand" href={s.blobUrl} target="_blank" rel="noreferrer">Open</a>
                        ) : "—"}
                      </TableCell>
                      <TableCell>{s.rejectionReason ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DataTable>
          )}
        </div>
      )}
    </div>
  );
}
