"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormPanel } from "@/components/ui/Card";
import { DataTable, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select } from "@/components/ui/Input";
import { LocationPicker } from "@/components/ui/LocationMap";
import { PageHeader } from "@/components/ui/PageHeader";
import { IconHeadphones } from "@/components/icons";
import { ACCESS, canAccess } from "@/lib/access";
import { api, Breakdown, Rider, Vehicle } from "@/lib/api";
import { CompanyCell, CompanyField } from "@/lib/companies";
import { useAuth } from "@/lib/auth-context";

export default function BreakdownsPage() {
  const { user } = useAuth();
  const canWrite = canAccess(user?.role, ACCESS.breakdownsWrite);
  const [items, setItems] = useState<Breakdown[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ riderId: "", vehicleId: "", issueType: "Battery", description: "", lat: "", lng: "", tenantId: "" });

  const load = () => api.breakdowns(status || undefined).then((r) => setItems(r.items)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [status]);
  useEffect(() => {
    api.riders({ accountStatus: "Active" }).then((r) => setRiders(r.items)).catch(() => {});
    api.vehicles().then((r) => setVehicles(r.items)).catch(() => {});
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.riderId || !form.vehicleId) return setError("Rider and vehicle are required");
    if (form.description.trim().length < 10) return setError("Issue information must be at least 10 characters");
    try {
      await api.createBreakdown({
        riderId: form.riderId,
        vehicleId: form.vehicleId,
        issueType: form.issueType,
        description: form.description.trim(),
        lat: form.lat ? Number(form.lat) : undefined,
        lng: form.lng ? Number(form.lng) : undefined,
        tenantId: form.tenantId || undefined,
      });
      setSuccess("Breakdown logged");
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  };

  return (
    <div>
      <PageHeader
        title="Breakdown Command Center"
        description="Alerts with rider, vehicle, location and issue details"
        actions={canWrite ? <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "Log breakdown"}</Button> : undefined}
      />
      {error && <div className="mb-4"><Alert message={error} /></div>}
      {success && <div className="mb-4"><Alert variant="success" message={success} /></div>}
      <Select className="mb-4" value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">All statuses</option>
        <option value="Open">Open</option>
        <option value="Assigned">Assigned</option>
        <option value="InProgress">In progress</option>
        <option value="Escalated">Escalated</option>
        <option value="Closed">Closed</option>
      </Select>
      {showForm && (
        <FormPanel title="Log breakdown">
          <form onSubmit={submit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <CompanyField value={form.tenantId} onChange={(tenantId) => setForm({ ...form, tenantId })} />
            <Field label="Rider">
              <Select value={form.riderId} onChange={(e) => setForm({ ...form, riderId: e.target.value })}>
                <option value="">Select</option>
                {riders.map((r) => <option key={r.id} value={r.id}>{r.fullName ?? r.phone}</option>)}
              </Select>
            </Field>
            <Field label="Vehicle">
              <Select value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}>
                <option value="">Select</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.registrationNumber}</option>)}
              </Select>
            </Field>
            <Field label="Issue type"><Input value={form.issueType} onChange={(e) => setForm({ ...form, issueType: e.target.value })} /></Field>
            <Field label="Description"><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <LocationPicker
              optional
              lat={form.lat}
              lng={form.lng}
              onChange={(lat, lng) => setForm((current) => ({ ...current, lat, lng }))}
            />
            <div className="md:col-span-2"><Button type="submit">Create alert</Button></div>
          </form>
        </FormPanel>
      )}
      {items.length === 0 ? (
        <EmptyState icon={<IconHeadphones className="h-7 w-7" />} title="No breakdowns" description="Rider-app alerts and call-center logs appear here." />
      ) : (
        <DataTable>
          <Table>
            <TableHead>
              <TableHeaderCell>Issue</TableHeaderCell>
              <TableHeaderCell>Company</TableHeaderCell>
              <TableHeaderCell>Rider</TableHeaderCell>
              <TableHeaderCell>Vehicle</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell />
            </TableHead>
            <TableBody>
              {items.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>{b.issueType}</TableCell>
                  <TableCell><CompanyCell tenantId={b.tenantId} /></TableCell>
                  <TableCell>{b.riderName ?? b.riderPhone}</TableCell>
                  <TableCell>{b.vehicleRegistration}</TableCell>
                  <TableCell><Badge status={b.status} /></TableCell>
                  <TableCell><Link className="text-xs font-semibold text-brand" href={`/breakdowns/${b.id}`}>Manage</Link></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTable>
      )}
    </div>
  );
}
