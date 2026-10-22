"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormPanel } from "@/components/ui/Card";
import { DataTable, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/DataTable";
import { Field, Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { api, TenantOrg } from "@/lib/api";

const emptyForm = { name: "", slug: "", contactEmail: "", notes: "" };

export default function TenantsPage() {
  const [items, setItems] = useState<TenantOrg[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState(emptyForm);

  const load = () => api.tenants().then((r) => setItems(r.items)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      if (editId) {
        await api.updateTenant(editId, { name: form.name, contactEmail: form.contactEmail, notes: form.notes });
        setSuccess("Organization updated");
      } else {
        await api.createTenant(form);
        setSuccess("Organization created");
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  };

  return (
    <div>
      <PageHeader
        title="Organizations"
        description="Fleetel is the parent company. Digi-Switchride is the product. Every other organization is a tenant customer with its own fleet, riders, branding and payment gateway."
        actions={<Button onClick={() => { setEditId(null); setForm(emptyForm); setShowForm(true); }}>Add tenant</Button>}
      />
      {success && <div className="mb-4"><Alert variant="success" message={success} /></div>}
      {error && <div className="mb-4"><Alert message={error} /></div>}
      {showForm && (
        <FormPanel title={editId ? "Edit tenant" : "New tenant company"}>
          <form onSubmit={save} className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
            {!editId && (
              <Field label="Slug" hint="Used by web and mobile, e.g. acme-fleet">
                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required />
              </Field>
            )}
            <Field label="Contact email"><Input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></Field>
            <Field label="Notes"><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
            <div className="md:col-span-2 flex gap-2">
              <Button type="submit">Save</Button>
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        </FormPanel>
      )}
      <DataTable>
        <Table>
          <TableHead>
            <TableHeaderCell>Name</TableHeaderCell>
            <TableHeaderCell>Kind</TableHeaderCell>
            <TableHeaderCell>Slug</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell></TableHeaderCell>
          </TableHead>
          <TableBody>
            {items.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-semibold">{t.name}{t.isDefault ? " (sample tenant)" : ""}</TableCell>
                <TableCell>{t.kind === "Parent" ? "Parent (Fleetel)" : "Tenant"}</TableCell>
                <TableCell>{t.slug}</TableCell>
                <TableCell><Badge status={t.status} /></TableCell>
                <TableCell>
                  <Button variant="ghost" className="text-xs" onClick={() => { setEditId(t.id); setForm({ name: t.name, slug: t.slug, contactEmail: t.contactEmail ?? "", notes: t.notes ?? "" }); setShowForm(true); }}>Edit</Button>
                  {t.kind !== "Parent" && (
                  <Button variant="ghost" className="text-xs" onClick={() => {
                    localStorage.setItem("adminTenantId", t.id);
                    window.location.href = "/branding";
                  }}>Logo</Button>
                  )}
                  {t.kind !== "Parent" && (
                  <Button variant="ghost" className="text-xs" onClick={() => {
                    localStorage.setItem("adminTenantId", t.id);
                    window.location.href = "/finance";
                  }}>Gateway</Button>
                  )}
                  {t.kind !== "Parent" && !t.isDefault && (
                    <Button
                      variant="ghost"
                      className="text-xs"
                      onClick={() => api.updateTenant(t.id, { status: t.status === "Active" ? "Suspended" : "Active" }).then(load)}
                    >
                      {t.status === "Active" ? "Suspend" : "Activate"}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataTable>
    </div>
  );
}
