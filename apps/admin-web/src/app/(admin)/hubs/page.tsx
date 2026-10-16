"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormPanel } from "@/components/ui/Card";
import { FormModeLabel, RowActions } from "@/components/ui/RowActions";
import { Input, Select } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { LocationMarkersMap, LocationPicker } from "@/components/ui/LocationMap";
import { IconMapPin } from "@/components/icons";
import { api, Hub } from "@/lib/api";
import { CompanyCell, CompanyField } from "@/lib/companies";

const emptyForm = { name: "", address: "", lat: "21.1458", lng: "79.0882", capacity: "20", status: "Active", tenantId: "" };

export default function HubsPage() {
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState(emptyForm);

  const load = () => api.hubs().then((r) => setHubs(r.items)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditId(null); setForm(emptyForm); setShowForm(true); setError(""); };
  const openEdit = (hub: Hub) => {
    setEditId(hub.id);
    setForm({ name: hub.name, address: hub.address, lat: String(hub.location.lat), lng: String(hub.location.lng), capacity: String(hub.capacity), status: hub.status });
    setShowForm(true); setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess("");
    const payload = {
      name: form.name,
      address: form.address,
      location: { lat: parseFloat(form.lat), lng: parseFloat(form.lng) },
      capacity: parseInt(form.capacity, 10),
      status: form.status,
      tenantId: form.tenantId || undefined,
    };
    try {
      if (editId) { await api.updateHub(editId, payload); setSuccess("Hub updated"); }
      else { await api.createHub(payload); setSuccess("Hub created"); }
      setShowForm(false); setEditId(null); load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  };

  return (
    <div>
      <PageHeader title="Rental Hubs" description="Manage pickup locations with GPS coordinates"
        actions={<Button variant={showForm && !editId ? "secondary" : "primary"} onClick={() => showForm && !editId ? setShowForm(false) : openCreate()}>{showForm && !editId ? "Cancel" : "Add Hub"}</Button>} />
      {success && <div className="mb-4"><Alert variant="success" message={success} /></div>}
      {error && !showForm && <div className="mb-4"><Alert message={error} /></div>}
      <LocationMarkersMap
        points={hubs
          .filter((h) => Number.isFinite(h.location?.lat) && Number.isFinite(h.location?.lng))
          .map((h) => ({ id: h.id, lat: h.location.lat, lng: h.location.lng, label: `${h.name}<br/>${h.address}` }))}
      />

      {showForm && (
        <FormPanel title={editId ? "Edit hub" : "Create new hub"}>
          <FormModeLabel editing={!!editId} />
          <form onSubmit={handleSubmit} className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
            <CompanyField value={form.tenantId} onChange={(tenantId) => setForm({ ...form, tenantId })} />
            <Input placeholder="Hub name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Input placeholder="Full address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
            <LocationPicker
              key={editId ?? "new"}
              lat={form.lat}
              lng={form.lng}
              onChange={(lat, lng) => setForm((current) => ({ ...current, lat, lng }))}
              onAddress={(address) => setForm((current) => ({ ...current, address: current.address || address }))}
            />
            <Input placeholder="Capacity" type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} required />
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Maintenance">Maintenance</option>
            </Select>
            {error && <div className="md:col-span-2"><Alert message={error} /></div>}
            <div className="md:col-span-2 flex gap-2">
              <Button type="submit">{editId ? "Save changes" : "Create hub"}</Button>
              <Button type="button" variant="secondary" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</Button>
            </div>
          </form>
        </FormPanel>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {hubs.map((hub) => (
          <Card key={hub.id} className="p-5">
            <div className="mb-3 flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-light text-brand"><IconMapPin className="h-5 w-5" /></div>
              <RowActions onEdit={() => openEdit(hub)} />
            </div>
            <h3 className="text-lg font-semibold text-text-primary">{hub.name}</h3>
            <div className="mt-1"><CompanyCell tenantId={hub.tenantId} /></div>
            <p className="mt-1 text-sm text-text-secondary">{hub.address}</p>
            <p className="mt-1 text-xs text-text-muted">{hub.location.lat.toFixed(4)}, {hub.location.lng.toFixed(4)}</p>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-sm">
              <span className="text-text-secondary">{hub.availableVehicles} available</span>
              <span className="text-text-secondary">{hub.capacity} capacity</span>
              <Badge status={hub.status} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
