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
import { api, Vehicle, Hub } from "@/lib/api";

const emptyForm = { registrationNumber: "", type: "EScooter", hubId: "", model: "", iotDeviceId: "", status: "Available" };

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState(emptyForm);

  const load = () => {
    api.vehicles().then((r) => setVehicles(r.items)).catch((e) => setError(e.message));
    api.hubs().then((r) => setHubs(r.items)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditId(null); setForm(emptyForm); setShowForm(true); setError(""); };
  const openEdit = (v: Vehicle) => {
    setEditId(v.id);
    setForm({ registrationNumber: v.registrationNumber, type: v.type, hubId: v.hubId, model: v.model, iotDeviceId: v.iotDeviceId ?? "", status: v.status });
    setShowForm(true); setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess("");
    try {
      const iotDeviceId = form.iotDeviceId.trim() || null;
      if (editId) {
        await api.updateVehicle(editId, {
          registrationNumber: form.registrationNumber,
          type: form.type,
          hubId: form.hubId,
          model: form.model,
          status: form.status,
          iotDeviceId,
        });
        setSuccess("Vehicle updated");
      } else {
        await api.createVehicle({ ...form, iotDeviceId: form.iotDeviceId || undefined });
        setSuccess("Vehicle registered");
      }
      setShowForm(false); setEditId(null); load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  };

  return (
    <div>
      <PageHeader title="Vehicles" description="Edit vehicles and change IoT device mapping"
        actions={<Button variant={showForm && !editId ? "secondary" : "primary"} onClick={() => showForm && !editId ? setShowForm(false) : openCreate()}>{showForm && !editId ? "Cancel" : "Add Vehicle"}</Button>} />
      {success && <div className="mb-4"><Alert variant="success" message={success} /></div>}
      {error && !showForm && <div className="mb-4"><Alert message={error} /></div>}

      {showForm && (
        <FormPanel title={editId ? "Edit vehicle" : "Register vehicle"}>
          <FormModeLabel editing={!!editId} />
          <form onSubmit={handleSubmit} className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input placeholder="Registration number" value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} required />
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="EScooter">E-Scooter</option><option value="EBike">E-Bike</option><option value="ERickshaw">E-Rickshaw</option>
            </Select>
            <Select value={form.hubId} onChange={(e) => setForm({ ...form, hubId: e.target.value })} required>
              <option value="">Select hub</option>
              {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </Select>
            <Input placeholder="Model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} required />
            <Input placeholder="IoT Device ID (blank to unlink)" value={form.iotDeviceId} onChange={(e) => setForm({ ...form, iotDeviceId: e.target.value })} />
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="Available">Available</option><option value="Reserved">Reserved</option><option value="InRide">InRide</option>
              <option value="Maintenance">Maintenance</option><option value="Offline">Offline</option>
            </Select>
            {error && <div className="md:col-span-2"><Alert message={error} /></div>}
            <div className="md:col-span-2 flex gap-2">
              <Button type="submit">{editId ? "Save changes" : "Register vehicle"}</Button>
              <Button type="button" variant="secondary" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</Button>
            </div>
          </form>
        </FormPanel>
      )}

      <DataTable>
        <Table>
          <TableHead>
            <TableHeaderCell>Registration</TableHeaderCell><TableHeaderCell>Model</TableHeaderCell><TableHeaderCell>IoT Device</TableHeaderCell>
            <TableHeaderCell>Battery</TableHeaderCell><TableHeaderCell>Status</TableHeaderCell><TableHeaderCell />
          </TableHead>
          <TableBody>
            {vehicles.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-semibold">{v.registrationNumber}</TableCell>
                <TableCell>{v.model}</TableCell>
                <TableCell className="font-mono text-xs text-text-secondary">{v.iotDeviceId ?? "—"}</TableCell>
                <TableCell>{v.batteryPercent}%</TableCell>
                <TableCell><Badge status={v.status} /></TableCell>
                <TableCell><RowActions onEdit={() => openEdit(v)} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataTable>
    </div>
  );
}
