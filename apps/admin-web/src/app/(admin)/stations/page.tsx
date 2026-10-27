"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormPanel } from "@/components/ui/Card";
import { DataTable, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/DataTable";
import { Field, Input, Select } from "@/components/ui/Input";
import { LocationMarkersMap, LocationPicker } from "@/components/ui/LocationMap";
import { PageHeader } from "@/components/ui/PageHeader";
import { ACCESS, canAccess } from "@/lib/access";
import { api, ChargingStation, Hub } from "@/lib/api";
import { CompanyCell, CompanyField } from "@/lib/companies";
import { useAuth } from "@/lib/auth-context";

export default function StationsPage() {
  const { user } = useAuth();
  const canWrite = canAccess(user?.role, ACCESS.stationsWrite);
  const [items, setItems] = useState<ChargingStation[]>([]);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", address: "", chargerCount: "4", operatingHours: "06:00-22:00", lat: "", lng: "", hubId: "", tenantId: "" });

  const load = () => {
    api.chargingStations().then((r) => setItems(r.items)).catch((e) => setError(e.message));
    api.hubs().then((r) => setHubs(r.items)).catch(() => setHubs([]));
  };
  useEffect(() => { load(); }, []);

  return (
    <div>
      <PageHeader title="Charging stations" description="Locations, charger count and operating hours" />
      {error && <div className="mb-4"><Alert message={error} /></div>}
      <LocationMarkersMap
        points={items
          .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
          .map((s) => ({ id: s.id, lat: s.lat as number, lng: s.lng as number, label: `${s.name}<br/>${s.address}` }))}
      />
      {canWrite && (
        <FormPanel title="Add station">
          <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api.createChargingStation({
                name: form.name,
                address: form.address,
                chargerCount: Number(form.chargerCount),
                operatingHours: form.operatingHours,
                lat: form.lat ? Number(form.lat) : undefined,
                lng: form.lng ? Number(form.lng) : undefined,
                hubId: form.hubId || undefined,
                tenantId: form.tenantId || undefined,
              });
              setForm({ name: "", address: "", chargerCount: "4", operatingHours: "06:00-22:00", lat: "", lng: "", hubId: "", tenantId: "" });
              load();
            } catch (err) { setError(err instanceof Error ? err.message : "Save failed"); }
          }}>
            <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <CompanyField value={form.tenantId} onChange={(tenantId) => setForm({ ...form, tenantId })} />
            <Field label="Address"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
            <Field label="Chargers"><Input type="number" min="1" value={form.chargerCount} onChange={(e) => setForm({ ...form, chargerCount: e.target.value })} /></Field>
            <Field label="Hours"><Input value={form.operatingHours} onChange={(e) => setForm({ ...form, operatingHours: e.target.value })} /></Field>
            <Field label="Hub">
              <Select value={form.hubId} onChange={(e) => setForm({ ...form, hubId: e.target.value })}>
                <option value="">Unassigned</option>
                {hubs.map((hub) => <option key={hub.id} value={hub.id}>{hub.name}</option>)}
              </Select>
            </Field>
            <LocationPicker
              optional
              lat={form.lat}
              lng={form.lng}
              onChange={(lat, lng) => setForm((current) => ({ ...current, lat, lng }))}
              onAddress={(address) => setForm((current) => ({ ...current, address: current.address || address }))}
            />
            <div className="md:col-span-2"><Button type="submit">Create station</Button></div>
          </form>
        </FormPanel>
      )}
      <DataTable>
        <Table>
          <TableHead>
            <TableHeaderCell>Station</TableHeaderCell>
            <TableHeaderCell>Company</TableHeaderCell>
            <TableHeaderCell>Hub</TableHeaderCell>
            <TableHeaderCell>Chargers</TableHeaderCell>
            <TableHeaderCell>Hours</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
          </TableHead>
          <TableBody>
            {items.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.name}<div className="text-xs text-text-muted">{s.address}</div>
                  {s.lat != null && s.lng != null && <div className="text-xs text-text-muted">{s.lat.toFixed(4)}, {s.lng.toFixed(4)}</div>}
                </TableCell>
                <TableCell><CompanyCell tenantId={s.tenantId} /></TableCell>
                <TableCell>{hubs.find((h) => h.id === s.hubId)?.name ?? "—"}</TableCell>
                <TableCell>{s.chargerCount}</TableCell>
                <TableCell>{s.operatingHours ?? "—"}</TableCell>
                <TableCell><Badge status={s.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataTable>
    </div>
  );
}
