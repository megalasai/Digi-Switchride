"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormPanel } from "@/components/ui/Card";
import { FormModeLabel } from "@/components/ui/RowActions";
import { DataTable, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/DataTable";
import { Field, Input, Select } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { ADMIN_ROLES } from "@/lib/access";
import { api, AdminUser, Hub, TenantOrg } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { validateEmail, validateFullName, validatePassword } from "@/lib/validation";

const emptyForm = { email: "", password: "", fullName: "", role: "Operations", isActive: true, tenantId: "", hubIds: [] as string[] };

export default function UsersPage() {
  const { user } = useAuth();
  const isSuper = user?.role === "SuperAdmin";
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [orgs, setOrgs] = useState<TenantOrg[]>([]);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const roles = isSuper ? ADMIN_ROLES : ADMIN_ROLES.filter((r) => r !== "SuperAdmin");
  const orgName = (id?: string) => orgs.find((o) => o.id === id)?.name ?? (id ? id.slice(-6) : "—");
  const hubNames = (ids?: string[]) => {
    if (!ids?.length) return "All hubs";
    return ids.map((id) => hubs.find((h) => h.id === id)?.name ?? id.slice(-6)).join(", ");
  };

  const load = () => {
    api.adminUsers().then((r) => setUsers(r.items)).catch((e) => setError(e.message));
    api.hubs().then((r) => setHubs(r.items)).catch(() => setHubs([]));
    if (isSuper) api.tenants().then((r) => setOrgs(r.items)).catch(() => setOrgs([]));
    else api.publicTenants().then((r) => setOrgs(r.items)).catch(() => setOrgs([]));
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditId(null);
    setForm({ ...emptyForm, tenantId: user?.tenantId ?? "" });
    setFieldErrors({});
    setShowForm(true);
    setError("");
  };
  const openEdit = (u: AdminUser) => {
    setEditId(u.id);
    setForm({
      email: u.email,
      password: "",
      fullName: u.fullName,
      role: u.role,
      isActive: u.isActive !== false,
      tenantId: u.tenantId ?? "",
      hubIds: u.hubIds ?? [],
    });
    setFieldErrors({});
    setShowForm(true);
    setError("");
  };

  const validate = () => {
    const next = {
      fullName: validateFullName(form.fullName),
      email: editId ? "" : validateEmail(form.email, true),
      password: validatePassword(form.password, !editId),
      tenantId: isSuper && !editId && !form.tenantId ? "Choose the tenant this user belongs to" : "",
    };
    setFieldErrors(next);
    return !next.fullName && !next.email && !next.password && !next.tenantId;
  };

  const toggleHub = (id: string) => {
    setForm((current) => ({
      ...current,
      hubIds: current.hubIds.includes(id) ? current.hubIds.filter((h) => h !== id) : [...current.hubIds, id],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setError(""); setSuccess("");
    setSaving(true);
    try {
      if (editId) {
        await api.updateAdminUser(editId, {
          fullName: form.fullName,
          role: form.role,
          isActive: form.isActive,
          hubIds: form.hubIds,
          ...(isSuper && form.tenantId ? { tenantId: form.tenantId } : {}),
          ...(form.password ? { password: form.password } : {}),
        });
        setSuccess("User updated");
      } else {
        await api.createAdminUser({
          email: form.email,
          password: form.password,
          fullName: form.fullName,
          role: form.role,
          hubIds: form.hubIds,
          ...(isSuper && form.tenantId ? { tenantId: form.tenantId } : {}),
        });
        setSuccess("User created");
      }
      setShowForm(false); setEditId(null); load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Admin Users" description="Assign each operator to an organisation and the hubs they may see"
        actions={<Button variant={showForm && !editId ? "secondary" : "primary"} onClick={() => showForm && !editId ? setShowForm(false) : openCreate()}>{showForm && !editId ? "Cancel" : "Add User"}</Button>} />
      {success && <div className="mb-4"><Alert variant="success" message={success} /></div>}

      {showForm && (
        <FormPanel title={editId ? "Edit admin user" : "Create admin user"}>
          <FormModeLabel editing={!!editId} />
          <form onSubmit={handleSubmit} className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2" noValidate>
            {!editId && (
              <Field label="Email" error={fieldErrors.email}>
                <Input type="email" invalid={!!fieldErrors.email} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
            )}
            <Field label="Full name" error={fieldErrors.fullName}>
              <Input invalid={!!fieldErrors.fullName} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </Field>
            <Field label="Password" error={fieldErrors.password} hint={editId ? "Leave blank to keep current password" : "Minimum 8 characters"}>
              <Input type="password" invalid={!!fieldErrors.password} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>
            <Field label="Role">
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {roles.map((r) => <option key={r} value={r}>{r}</option>)}
              </Select>
            </Field>
            {isSuper && (
              <Field label="Organization" error={fieldErrors.tenantId} hint="Tenant users sign in by picking this company on the login page">
                <Select invalid={!!fieldErrors.tenantId} value={form.tenantId} onChange={(e) => setForm({ ...form, tenantId: e.target.value })}>
                  <option value="">Select organization</option>
                  {orgs.filter((org) => org.kind !== "Parent").map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
                </Select>
              </Field>
            )}
            {editId && (
              <Field label="Status">
                <Select value={form.isActive ? "true" : "false"} onChange={(e) => setForm({ ...form, isActive: e.target.value === "true" })}>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </Select>
              </Field>
            )}
            <div className="md:col-span-2">
              <p className="mb-2 text-sm font-medium text-text-primary">Assigned hubs</p>
              <p className="mb-2 text-xs text-text-muted">Leave all unchecked to allow every hub in the organisation.</p>
              <div className="grid gap-2 md:grid-cols-2">
                {hubs.map((hub) => (
                  <label key={hub.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.hubIds.includes(hub.id)} onChange={() => toggleHub(hub.id)} />
                    {hub.name}
                  </label>
                ))}
                {!hubs.length && <p className="text-xs text-text-muted">No hubs in this organisation yet.</p>}
              </div>
            </div>
            {error && <div className="md:col-span-2"><Alert message={error} /></div>}
            <div className="md:col-span-2 flex gap-2">
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : editId ? "Save changes" : "Create user"}</Button>
              <Button type="button" variant="secondary" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</Button>
            </div>
          </form>
        </FormPanel>
      )}

      <DataTable>
        <Table>
          <TableHead>
            <TableHeaderCell>Name</TableHeaderCell>
            <TableHeaderCell>Email</TableHeaderCell>
            <TableHeaderCell>Organization</TableHeaderCell>
            <TableHeaderCell>Hubs</TableHeaderCell>
            <TableHeaderCell>Role</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell />
          </TableHead>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-semibold">{u.fullName}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{orgName(u.tenantId)}</TableCell>
                <TableCell className="text-xs">{hubNames(u.hubIds)}</TableCell>
                <TableCell><Badge status={u.role} /></TableCell>
                <TableCell><Badge status={u.isActive === false ? "Inactive" : "Active"} /></TableCell>
                <TableCell>
                  <Button variant="ghost" className="px-2 py-1 text-xs" type="button" onClick={() => openEdit(u)}>Edit</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataTable>
    </div>
  );
}
