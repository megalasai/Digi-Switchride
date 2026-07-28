"use client";

import { useEffect, useState } from "react";
import { api, Promotion } from "@/lib/api";

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: "", description: "", discountType: "Percentage", discountValue: "10", validFrom: "", validTo: "", maxUses: "100" });

  const load = () => api.promotions().then((r) => setPromotions(r.items)).catch(() => {});
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.createPromotion({
      code: form.code,
      description: form.description,
      discountType: form.discountType,
      discountValue: parseFloat(form.discountValue),
      validFrom: new Date(form.validFrom).toISOString(),
      validTo: new Date(form.validTo).toISOString(),
      maxUses: parseInt(form.maxUses),
    });
    setShowForm(false);
    load();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Promotions</h1>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-green-600 text-white rounded-lg">
          {showForm ? "Cancel" : "Create Promotion"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-lg shadow p-6 mb-6 grid grid-cols-2 gap-4">
          <input placeholder="Promo code" className="border rounded px-3 py-2" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <input placeholder="Description" className="border rounded px-3 py-2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <select className="border rounded px-3 py-2" value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })}>
            <option value="Percentage">Percentage</option>
            <option value="FixedAmount">Fixed Amount</option>
          </select>
          <input placeholder="Discount value" type="number" className="border rounded px-3 py-2" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} />
          <input type="date" className="border rounded px-3 py-2" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} required />
          <input type="date" className="border rounded px-3 py-2" value={form.validTo} onChange={(e) => setForm({ ...form, validTo: e.target.value })} required />
          <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg">Create</button>
        </form>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-4">Code</th>
              <th className="text-left p-4">Discount</th>
              <th className="text-left p-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {promotions.map((p) => (
              <tr key={p.id} className="border-b">
                <td className="p-4 font-mono font-bold">{p.code}</td>
                <td className="p-4">{p.discountType === "Percentage" ? `${p.discountValue}%` : `₹${p.discountValue}`}</td>
                <td className="p-4">{p.isActive ? "Active" : "Inactive"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
