"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormPanel } from "@/components/ui/Card";
import { DataTable, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { IconTag } from "@/components/icons";
import { ACCESS, canAccess } from "@/lib/access";
import { api, RentalPlan } from "@/lib/api";
import { CompanyCell, CompanyField } from "@/lib/companies";
import { useAuth } from "@/lib/auth-context";

const empty = { name: "", charges: "4000", durationDays: "30", billingFrequency: "Monthly", eligibility: "", terms: "", tenantId: "" };

export default function PlansPage() {
  const { user } = useAuth();
  const canWrite = canAccess(user?.role, ACCESS.plansWrite);
  const [items, setItems] = useState<RentalPlan[]>([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);

  const load = () => api.plans().then((r) => setItems(r.items)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.name.trim().length < 2) return setError("Name is required");
    const charges = Number(form.charges);
    const durationDays = Number(form.durationDays);
    if (Number.isNaN(charges) || charges < 0) return setError("Charges must be 0 or more");
    if (!durationDays || durationDays < 1) return setError("Duration must be at least 1 day");
    try {
      const payload = {
        name: form.name.trim(),
        charges,
        durationDays,
        billingFrequency: form.billingFrequency,
        eligibility: form.eligibility.trim() || undefined,
        terms: form.terms.trim() || undefined,
        tenantId: form.tenantId || undefined,
      };
      if (editId) await api.updatePlan(editId, payload);
      else await api.createPlan(payload);
      setSuccess(editId ? "Plan updated" : "Plan created");
      setShowForm(false);
      setEditId(null);
      setForm(empty);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  };

  return (
    <div>
      <PageHeader
        title="Rental plans"
        description="Configure charges, duration, billing frequency, eligibility and terms"
        actions={canWrite ? <Button onClick={() => { setShowForm((v) => !v); setEditId(null); setForm(empty); }}>{showForm ? "Cancel" : "Add plan"}</Button> : undefined}
      />
      {error && <div className="mb-4"><Alert message={error} /></div>}
      {success && <div className="mb-4"><Alert variant="success" message={success} /></div>}
      {showForm && (
        <FormPanel title={editId ? "Edit plan" : "Create plan"}>
          <form onSubmit={submit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <CompanyField value={form.tenantId} onChange={(tenantId) => setForm({ ...form, tenantId })} />
            <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Charges (INR)"><Input type="number" min="0" value={form.charges} onChange={(e) => setForm({ ...form, charges: e.target.value })} /></Field>
            <Field label="Duration (days)"><Input type="number" min="1" value={form.durationDays} onChange={(e) => setForm({ ...form, durationDays: e.target.value })} /></Field>
            <Field label="Billing frequency">
              <Select value={form.billingFrequency} onChange={(e) => setForm({ ...form, billingFrequency: e.target.value })}>
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
              </Select>
            </Field>
            <Field label="Eligibility"><Input value={form.eligibility} onChange={(e) => setForm({ ...form, eligibility: e.target.value })} /></Field>
            <Field label="Terms and conditions"><Input value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} /></Field>
            <div className="md:col-span-2"><Button type="submit">Save plan</Button></div>
          </form>
        </FormPanel>
      )}
      {items.length === 0 ? (
        <EmptyState icon={<IconTag className="h-7 w-7" />} title="No plans" description="Create a rental plan to assign to riders." />
      ) : (
        <DataTable>
          <Table>
            <TableHead>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Company</TableHeaderCell>
              <TableHeaderCell>Charges</TableHeaderCell>
              <TableHeaderCell>Duration</TableHeaderCell>
              <TableHeaderCell>Billing</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell />
            </TableHead>
            <TableBody>
              {items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-semibold">{p.name}</TableCell>
                  <TableCell><CompanyCell tenantId={p.tenantId} /></TableCell>
                  <TableCell>₹{p.charges.toLocaleString("en-IN")}</TableCell>
                  <TableCell>{p.durationDays} days</TableCell>
                  <TableCell>{p.billingFrequency}</TableCell>
                  <TableCell><Badge status={p.isActive ? "Active" : "Inactive"} /></TableCell>
                  <TableCell>
                    {canWrite && (
                      <div className="flex gap-2">
                        <Button variant="ghost" className="text-xs" type="button" onClick={() => { setEditId(p.id); setForm({ name: p.name, charges: String(p.charges), durationDays: String(p.durationDays), billingFrequency: p.billingFrequency, eligibility: p.eligibility ?? "", terms: p.terms ?? "", tenantId: p.tenantId ?? "" }); setShowForm(true); }}>Edit</Button>
                        <Button variant="ghost" className="text-xs" type="button" onClick={async () => { await api.updatePlan(p.id, { isActive: !p.isActive }); load(); }}>{p.isActive ? "Deactivate" : "Activate"}</Button>
                        <Button
                          variant="ghost"
                          className="text-xs text-red-700"
                          type="button"
                          onClick={() => {
                            if (!window.confirm(`Delete plan ${p.name}?`)) return;
                            api.deletePlan(p.id).then(load).catch((e) => setError(e instanceof Error ? e.message : "Delete failed"));
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTable>
      )}
    </div>
  );
}
