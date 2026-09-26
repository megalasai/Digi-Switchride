"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormPanel } from "@/components/ui/Card";
import { FormModeLabel } from "@/components/ui/RowActions";
import { RowActions } from "@/components/ui/RowActions";
import { DataTable, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/DataTable";
import { Input, Select } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { api, AdminUser } from "@/lib/api";

const ROLES = ["SuperAdmin", "FleetManager", "SupportAgent", "FinanceAdmin", "KycReviewer"];
const emptyForm = { email: "", password: "", fullName: "", role: "SupportAgent", isActive: true };

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState(emptyForm);

  const load = () => api.adminUsers().then((r) => setUsers(r.items)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditId(null); setForm(emptyForm); setShowForm(true); setError(""); };
  const openEdit = (u: AdminUser) => {
    setEditId(u.id);
    setForm({ email: u.email, password: "", fullName: u.fullName, role: u.role, isActive: u.isActive !== false });
    setShowForm(true);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess("");
    try {
      if (editId) {
        await api.updateAdminUser(editId, {
          fullName: form.fullName,
          role: form.role,
          isActive: form.isActive,
          ...(form.password ? { password: form.password } : {}),
        });
        setSuccess("User updated");
      } else {
        await api.createAdminUser({ email: form.email, password: form.password, fullName: form.fullName, role: form.role });
        setSuccess("User created");
      }
      setShowForm(false); setEditId(null); load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  };

  return (
    <div>
      <PageHeader title="Admin Users" description="Role-based access for platform administration"
        actions={<Button variant={showForm && !editId ? "secondary" : "primary"} onClick={() => showForm && !editId ? setShowForm(false) : openCreate()}>{showForm && !editId ? "Cancel" : "Add User"}</Button>} />
      {success && <div className="mb-4"><Alert variant="success" message={success} /></div>}

      {showForm && (
        <FormPanel title={editId ? "Edit admin user" : "Create admin user"}>
          <FormModeLabel editing={!!editId} />
          <form onSubmit={handleSubmit} className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
            {!editId && <Input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />}
            <Input placeholder="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
            <Input type="password" placeholder={editId ? "New password (leave blank to keep)" : "Password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editId} />
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</Select>
            {editId && (
              <Select value={form.isActive ? "true" : "false"} onChange={(e) => setForm({ ...form, isActive: e.target.value === "true" })}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </Select>
            )}
            {error && <div className="md:col-span-2"><Alert message={error} /></div>}
            <div className="md:col-span-2 flex gap-2">
              <Button type="submit">{editId ? "Save changes" : "Create user"}</Button>
              <Button type="button" variant="secondary" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</Button>
            </div>
          </form>
        </FormPanel>
      )}

      <DataTable>
        <Table>
          <TableHead><TableHeaderCell>Name</TableHeaderCell><TableHeaderCell>Email</TableHeaderCell><TableHeaderCell>Role</TableHeaderCell><TableHeaderCell /></TableHead>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-semibold">{u.fullName}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell><Badge status={u.role} /></TableCell>
                <TableCell><RowActions onEdit={() => openEdit(u)} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataTable>
    </div>
  );
}
