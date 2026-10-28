"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormPanel } from "@/components/ui/Card";
import { FormModeLabel } from "@/components/ui/RowActions";
import { DataTable, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { IconUsers } from "@/components/icons";
import { ACCESS, canAccess } from "@/lib/access";
import { api, Rider } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { CompanyCell, CompanyField } from "@/lib/companies";
import { validateEmail, validateFullName, validatePhone } from "@/lib/validation";

const emptyForm = { phone: "", fullName: "", email: "", accountStatus: "Active", tenantId: "" };

export default function RidersPage() {
  const { user } = useAuth();
  const canWrite = canAccess(user?.role, ACCESS.ridersWrite);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [accountStatus, setAccountStatus] = useState("");
  const [kycStatus, setKycStatus] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = () => {
    setLoading(true);
    api
      .riders({
        search: search || undefined,
        accountStatus: accountStatus || undefined,
        kycStatus: kycStatus || undefined,
      })
      .then((r) => {
        setRiders(r.items);
        setTotal(r.totalCount);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load riders"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [search, accountStatus, kycStatus]);

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setFieldErrors({});
    setShowForm(true);
    setError("");
  };

  const openEdit = (r: Rider) => {
    setEditId(r.id);
    setForm({ phone: r.phone, fullName: r.fullName ?? "", email: r.email ?? "", accountStatus: r.accountStatus, tenantId: r.tenantId ?? "" });
    setFieldErrors({});
    setShowForm(true);
    setError("");
  };

  const validate = () => {
    const next = {
      phone: validatePhone(form.phone),
      fullName: validateFullName(form.fullName),
      email: validateEmail(form.email),
    };
    setFieldErrors(next);
    return !next.phone && !next.fullName && !next.email;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      if (editId) {
        const current = riders.find((r) => r.id === editId);
        let forceUnassign = false;
        if (form.accountStatus === "Deactivated" && current?.assignedVehicleId) {
          if (!window.confirm("This rider has an assigned vehicle. Deactivate and unassign the vehicle?")) {
            setSaving(false);
            return;
          }
          forceUnassign = true;
        } else if (form.accountStatus !== "Active" && !window.confirm(`Change account status to ${form.accountStatus}?`)) {
          setSaving(false);
          return;
        }
        await api.updateRider(editId, {
          phone: form.phone,
          fullName: form.fullName,
          email: form.email || undefined,
          accountStatus: form.accountStatus,
          forceUnassign,
        });
        setSuccess("Rider updated");
      } else {
        await api.createRider({ phone: form.phone, fullName: form.fullName, email: form.email || undefined, tenantId: form.tenantId || undefined });
        setSuccess("Rider created");
      }
      setShowForm(false);
      setEditId(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const filtersActive = useMemo(() => Boolean(search || accountStatus || kycStatus), [search, accountStatus, kycStatus]);

  return (
    <div>
      <PageHeader
        title="Rider Management"
        description="Search, create, and maintain rider accounts"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Input className="w-56" placeholder="Search name, phone, email" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
            {canWrite && (
              <Button variant={showForm && !editId ? "secondary" : "primary"} onClick={() => (showForm && !editId ? setShowForm(false) : openCreate())}>
                {showForm && !editId ? "Cancel" : "Add rider"}
              </Button>
            )}
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <Select value={accountStatus} onChange={(e) => setAccountStatus(e.target.value)}>
          <option value="">All account statuses</option>
          <option value="Active">Active</option>
          <option value="Suspended">Suspended</option>
          <option value="Deactivated">Deactivated</option>
        </Select>
        <Select value={kycStatus} onChange={(e) => setKycStatus(e.target.value)}>
          <option value="">All KYC statuses</option>
          <option value="NotSubmitted">Not submitted</option>
          <option value="Pending">Pending</option>
          <option value="UnderReview">Under review</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
        </Select>
      </div>
      {success && <div className="mb-4"><Alert variant="success" message={success} /></div>}
      {error && !showForm && <div className="mb-4"><Alert message={error} /></div>}

      {showForm && (
        <FormPanel title={editId ? "Edit rider" : "Create rider"}>
          <FormModeLabel editing={!!editId} />
          <form onSubmit={handleSubmit} className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2" noValidate>
            <Field label="Mobile number" error={fieldErrors.phone} hint="10-digit Indian mobile">
              <Input invalid={!!fieldErrors.phone} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Full name" error={fieldErrors.fullName}>
              <Input invalid={!!fieldErrors.fullName} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </Field>
            <Field label="Email" error={fieldErrors.email} hint="Optional">
              <Input type="email" invalid={!!fieldErrors.email} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <CompanyField value={form.tenantId} onChange={(tenantId) => setForm({ ...form, tenantId })} />
            {editId && (
              <Field label="Account status">
                <Select value={form.accountStatus} onChange={(e) => setForm({ ...form, accountStatus: e.target.value })}>
                  <option value="Active">Active</option>
                  <option value="Suspended">Suspended</option>
                  <option value="Deactivated">Deactivated</option>
                </Select>
              </Field>
            )}
            {error && <div className="md:col-span-2"><Alert message={error} /></div>}
            <div className="md:col-span-2 flex gap-2">
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : editId ? "Save changes" : "Create rider"}</Button>
              <Button type="button" variant="secondary" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</Button>
            </div>
          </form>
        </FormPanel>
      )}

      {loading ? (
        <p className="text-sm text-text-secondary">Loading riders…</p>
      ) : riders.length === 0 ? (
        <EmptyState
          icon={<IconUsers className="h-7 w-7" />}
          title={filtersActive ? "No matching riders" : "No riders yet"}
          description={filtersActive ? "Try a different search or status filter." : "Create the first rider to start the rental lifecycle."}
        />
      ) : (
        <>
          <p className="mb-2 text-xs text-text-muted">{total} rider{total === 1 ? "" : "s"}</p>
          <DataTable>
            <Table>
              <TableHead>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Company</TableHeaderCell>
                <TableHeaderCell>Phone</TableHeaderCell>
                <TableHeaderCell>KYC</TableHeaderCell>
                <TableHeaderCell>Account</TableHeaderCell>
                <TableHeaderCell>Wallet</TableHeaderCell>
                <TableHeaderCell />
              </TableHead>
              <TableBody>
                {riders.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-semibold">{r.fullName ?? "—"}</TableCell>
                    <TableCell><CompanyCell tenantId={r.tenantId} /></TableCell>
                    <TableCell>{r.phone}</TableCell>
                    <TableCell><Badge status={r.kycStatus} /></TableCell>
                    <TableCell><Badge status={r.accountStatus} /></TableCell>
                    <TableCell>₹{(r.walletBalance ?? 0).toLocaleString("en-IN")}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Link href={`/riders/${r.id}`} className="text-xs font-semibold text-brand">Profile</Link>
                        {canWrite && (
                          <>
                            <Button variant="ghost" className="px-2 py-1 text-xs" type="button" onClick={() => openEdit(r)}>
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              className="px-2 py-1 text-xs text-red-700"
                              type="button"
                              onClick={() => {
                                if (!window.confirm(`Delete rider ${r.fullName ?? r.phone}?`)) return;
                                api.deleteRider(r.id).then(load).catch((err) => setError(err instanceof Error ? err.message : "Delete failed"));
                              }}
                            >
                              Delete
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataTable>
        </>
      )}
    </div>
  );
}
