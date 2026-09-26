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
import { api, Promotion } from "@/lib/api";

const defaultDates = () => {
  const from = new Date().toISOString().split("T")[0];
  const to = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
  return { from, to };
};

const emptyForm = () => {
  const { from, to } = defaultDates();
  return { code: "", description: "", discountType: "Percentage", discountValue: "10", validFrom: from, validTo: to, maxUses: "100", isActive: true };
};

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState(emptyForm());

  const load = () => api.promotions().then((r) => setPromotions(r.items)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm());
    setShowForm(true); setError("");
  };

  const openEdit = (p: Promotion) => {
    setEditId(p.id);
    setForm({
      code: p.code,
      description: p.description ?? "",
      discountType: p.discountType,
      discountValue: String(p.discountValue),
      validFrom: p.validFrom ? new Date(p.validFrom).toISOString().split("T")[0] : defaultDates().from,
      validTo: p.validTo ? new Date(p.validTo).toISOString().split("T")[0] : defaultDates().to,
      maxUses: String(p.maxUses ?? 100),
      isActive: p.isActive,
    });
    setShowForm(true); setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess("");
    try {
      if (editId) {
        await api.updatePromotion(editId, {
          description: form.description || undefined,
          discountType: form.discountType,
          discountValue: parseFloat(form.discountValue),
          validFrom: new Date(form.validFrom).toISOString(),
          validTo: new Date(form.validTo).toISOString(),
          maxUses: parseInt(form.maxUses, 10),
          isActive: form.isActive,
        });
        setSuccess("Promotion updated");
      } else {
        await api.createPromotion({
          code: form.code,
          description: form.description || undefined,
          discountType: form.discountType,
          discountValue: parseFloat(form.discountValue),
          validFrom: new Date(form.validFrom).toISOString(),
          validTo: new Date(form.validTo).toISOString(),
          maxUses: parseInt(form.maxUses, 10),
        });
        setSuccess("Promotion created");
      }
      setShowForm(false); setEditId(null); load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  };

  return (
    <div>
      <PageHeader title="Promotions" description="Create and edit promo codes"
        actions={<Button variant={showForm && !editId ? "secondary" : "primary"} onClick={() => showForm && !editId ? setShowForm(false) : openCreate()}>{showForm && !editId ? "Cancel" : "Add Promotion"}</Button>} />
      {success && <div className="mb-4"><Alert variant="success" message={success} /></div>}

      {showForm && (
        <FormPanel title={editId ? "Edit promotion" : "New promotion"}>
          <FormModeLabel editing={!!editId} />
          <form onSubmit={handleSubmit} className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
            {!editId && <Input placeholder="Promo code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required />}
            <Input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Select value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })}>
              <option value="Percentage">Percentage</option><option value="FixedAmount">Fixed Amount</option>
            </Select>
            <Input type="number" placeholder="Discount value" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} required />
            <Input type="date" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} required />
            <Input type="date" value={form.validTo} onChange={(e) => setForm({ ...form, validTo: e.target.value })} required />
            <Input type="number" placeholder="Max uses" value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} />
            {editId && (
              <Select value={form.isActive ? "true" : "false"} onChange={(e) => setForm({ ...form, isActive: e.target.value === "true" })}>
                <option value="true">Active</option><option value="false">Inactive</option>
              </Select>
            )}
            {error && <div className="md:col-span-2"><Alert message={error} /></div>}
            <div className="md:col-span-2 flex gap-2">
              <Button type="submit">{editId ? "Save changes" : "Create promotion"}</Button>
              <Button type="button" variant="secondary" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</Button>
            </div>
          </form>
        </FormPanel>
      )}

      <DataTable>
        <Table>
          <TableHead><TableHeaderCell>Code</TableHeaderCell><TableHeaderCell>Discount</TableHeaderCell><TableHeaderCell>Status</TableHeaderCell><TableHeaderCell /></TableHead>
          <TableBody>
            {promotions.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono font-bold">{p.code}</TableCell>
                <TableCell>{p.discountType === "Percentage" ? `${p.discountValue}%` : `₹${p.discountValue}`}</TableCell>
                <TableCell><Badge status={p.isActive ? "Active" : "Inactive"} /></TableCell>
                <TableCell><RowActions onEdit={() => openEdit(p)} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataTable>
    </div>
  );
}
