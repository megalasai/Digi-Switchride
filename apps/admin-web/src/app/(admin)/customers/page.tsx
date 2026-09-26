"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormPanel } from "@/components/ui/Card";
import { FormModeLabel, RowActions } from "@/components/ui/RowActions";
import { DataTable, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/DataTable";
import { Input, Select } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { api, Customer } from "@/lib/api";

const emptyForm = { phone: "", fullName: "", email: "", accountStatus: "Active" };

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState(emptyForm);

  const load = () => api.customers({ search: search || undefined }).then((r) => setCustomers(r.items)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [search]);

  const openCreate = () => { setEditId(null); setForm(emptyForm); setShowForm(true); setError(""); };
  const openEdit = (c: Customer) => {
    setEditId(c.id);
    setForm({ phone: c.phone, fullName: c.fullName ?? "", email: c.email ?? "", accountStatus: c.accountStatus });
    setShowForm(true); setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess("");
    try {
      if (editId) {
        await api.updateCustomer(editId, { phone: form.phone, fullName: form.fullName, email: form.email || undefined, accountStatus: form.accountStatus });
        setSuccess("Customer updated");
      } else {
        await api.createCustomer({ phone: form.phone, fullName: form.fullName, email: form.email || undefined });
        setSuccess("Customer created");
      }
      setShowForm(false); setEditId(null); load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  };

  return (
    <div>
      <PageHeader title="Customers" description="Search and manage registered riders"
        actions={<><Input type="text" placeholder="Search…" className="w-56" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button variant={showForm && !editId ? "secondary" : "primary"} onClick={() => showForm && !editId ? setShowForm(false) : openCreate()}>{showForm && !editId ? "Cancel" : "Add Customer"}</Button></>} />
      {success && <div className="mb-4"><Alert variant="success" message={success} /></div>}

      {showForm && (
        <FormPanel title={editId ? "Edit customer" : "Register customer"}>
          <FormModeLabel editing={!!editId} />
          <form onSubmit={handleSubmit} className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
            <Input placeholder="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
            <Input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            {editId && (
              <Select value={form.accountStatus} onChange={(e) => setForm({ ...form, accountStatus: e.target.value })}>
                <option value="Active">Active</option>
                <option value="Suspended">Suspended</option>
                <option value="Deactivated">Deactivated</option>
              </Select>
            )}
            {error && <div className="md:col-span-2"><Alert message={error} /></div>}
            <div className="md:col-span-2 flex gap-2">
              <Button type="submit">{editId ? "Save changes" : "Create customer"}</Button>
              <Button type="button" variant="secondary" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</Button>
            </div>
          </form>
        </FormPanel>
      )}

      <DataTable>
        <Table>
          <TableHead><TableHeaderCell>Phone</TableHeaderCell><TableHeaderCell>Name</TableHeaderCell><TableHeaderCell>KYC</TableHeaderCell><TableHeaderCell>Account</TableHeaderCell><TableHeaderCell /></TableHead>
          <TableBody>
            {customers.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.phone}</TableCell>
                <TableCell>{c.fullName ?? "—"}</TableCell>
                <TableCell><Badge status={c.kycStatus} /></TableCell>
                <TableCell><Badge status={c.accountStatus} /></TableCell>
                <TableCell><RowActions onEdit={() => openEdit(c)} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataTable>
    </div>
  );
}
