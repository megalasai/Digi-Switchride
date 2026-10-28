"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormPanel } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormModeLabel, RowActions } from "@/components/ui/RowActions";
import { DataTable, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/DataTable";
import { Input, Select } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { IconRadio } from "@/components/icons";
import { api, IoTDevice, Vehicle } from "@/lib/api";
import { CompanyCell, CompanyField } from "@/lib/companies";

const emptyForm = { deviceId: "", vendorType: "WanWay", vehicleId: "", tenantId: "", vehicleNumber: "", imei: "" };

export default function IoTPage() {
  const [devices, setDevices] = useState<IoTDevice[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [linkVehicleId, setLinkVehicleId] = useState<Record<string, string>>({});
  const [syncInfo, setSyncInfo] = useState<{ at: string; ok: boolean; synced: number; message: string } | null>(null);

  const load = () => {
    api.iotDevices().then((r) => {
      setDevices(r.items);
      setSyncInfo(r.sync ?? null);
      if (!r.sync || r.sync.ok) setError("");
    }).catch((e) => setError(e.message));
    api.vehicles().then((r) => setVehicles(r.items)).catch(() => {});
  };
  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return devices;
    return devices.filter((d) =>
      [d.id, d.imei, d.displayName, d.vehicleRegistration, d.vendorType, d.vendorStatus, d.vehicleStatus]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [devices, search]);

  const openCreate = () => { setEditId(null); setForm(emptyForm); setShowForm(true); setError(""); };
  const openEdit = (d: IoTDevice) => {
    setEditId(d.id);
    setForm({ deviceId: d.id, vendorType: d.vendorType, vehicleId: d.vehicleId ?? "", tenantId: d.tenantId ?? "", vehicleNumber: d.vehicleRegistration ?? "", imei: d.imei ?? "" });
    setShowForm(true); setError("");
  };

  const syncTrack360 = async () => {
    setError(""); setSuccess(""); setSyncing(true);
    try {
      const result = await api.syncIotDevices();
      setSuccess(result.message ?? `Synced ${result.synced} devices`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Track360 sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess("");
    try {
      if (editId) {
        await api.updateIoTDevice(editId, {
          vendorType: form.vendorType,
          vehicleId: form.vehicleId || null,
        });
        setSuccess("Device updated");
      } else {
        await api.createIoTDevice({
          deviceId: form.deviceId,
          vendorType: form.vendorType,
          vehicleId: form.vehicleId || undefined,
          tenantId: form.tenantId || undefined,
          vehicleNumber: form.vehicleNumber || undefined,
          imei: form.imei || undefined,
        });
        setSuccess("Device registered");
      }
      setShowForm(false); setEditId(null); load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  };

  const quickLink = async (deviceId: string) => {
    const vehicleId = linkVehicleId[deviceId];
    if (!vehicleId) return;
    setError(""); setSuccess("");
    try {
      await api.linkIoTDevice(deviceId, vehicleId);
      setSuccess(`Linked ${deviceId} to vehicle`);
      setLinkVehicleId((s) => ({ ...s, [deviceId]: "" }));
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Link failed");
    }
  };

  const handleUnlink = async (deviceId: string) => {
    try {
      await api.unlinkIoTDevice(deviceId);
      setSuccess("Device unlinked — use Link or Edit to assign a new vehicle");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unlink failed");
    }
  };

  return (
    <div>
      <PageHeader
        title="IoT Devices"
        description="Register a tracker IMEI or link it to a vehicle. Connect Track360 and other GPS APIs, including JSON import, under Integrations."
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => void syncTrack360()} disabled={syncing}>
              {syncing ? "Syncing…" : "Sync GPS APIs"}
            </Button>
            <Button variant={showForm && !editId ? "secondary" : "primary"} onClick={() => showForm && !editId ? setShowForm(false) : openCreate()}>
              {showForm && !editId ? "Cancel" : "Add Device"}
            </Button>
          </div>
        }
      />
      {success && <div className="mb-4"><Alert variant="success" message={success} /></div>}
      {error && !showForm && <div className="mb-4"><Alert message={error} /></div>}

      <Card className="mb-6 p-4">
        <p className="text-sm text-text-secondary">
          {devices.length} device{devices.length === 1 ? "" : "s"} in the application
          {devices.filter((d) => d.vendorType === "Track360").length ? ` · ${devices.filter((d) => d.vendorType === "Track360").length} from Track360` : ""}
          {devices.filter((d) => d.vendorType === "WanWay").length ? ` · ${devices.filter((d) => d.vendorType === "WanWay").length} WanWay` : ""}
          {devices.filter((d) => d.connectionStatus === "Connected").length ? ` · ${devices.filter((d) => d.connectionStatus === "Connected").length} online` : ""}
          {syncInfo ? ` · last sync ${new Date(syncInfo.at).toLocaleTimeString()} (${syncInfo.ok ? `${syncInfo.synced} devices` : syncInfo.message})` : ""}
        </p>
        <p className="mt-2 text-xs text-text-muted">
          WanWay trackers must send TCP to the telemetry droplet (ports 21100, 5001, 8821), not to this admin/API host. Point the device at that public IP and use the same MongoDB as the platform.
        </p>
        <div className="mt-3">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search IMEI, registration, status…" />
        </div>
      </Card>

      {showForm && (
        <FormPanel title={editId ? "Edit IoT device" : "Register IoT device"}>
          <FormModeLabel editing={!!editId} />
          <form onSubmit={handleSubmit} className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
            <CompanyField value={form.tenantId} onChange={(tenantId) => setForm({ ...form, tenantId })} />
            {!editId && <Input placeholder="Device ID / IMEI" value={form.deviceId} onChange={(e) => setForm({ ...form, deviceId: e.target.value })} required />}
            {!editId && <Input placeholder="Vehicle number (optional)" value={form.vehicleNumber} onChange={(e) => setForm({ ...form, vehicleNumber: e.target.value })} />}
            {!editId && <Input placeholder="IMEI if different from device ID" value={form.imei} onChange={(e) => setForm({ ...form, imei: e.target.value })} />}
            <Select value={form.vendorType} onChange={(e) => setForm({ ...form, vendorType: e.target.value })}>
              <option value="WanWay">WanWay (IMEI TCP)</option>
              <option value="Track360">Track360</option>
              <option value="GenericPull">Generic HTTP GPS</option>
              <option value="Traccar">Traccar</option>
              <option value="PushIngest">Push ingest API</option>
              <option value="Simulator">Simulator</option>
              <option value="AzureIoTHub">Azure IoT Hub</option>
              <option value="GenericMQTT">Generic MQTT</option>
            </Select>
            <Select value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}>
              <option value="">No vehicle (unlink)</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.registrationNumber}{v.iotDeviceId && v.iotDeviceId !== editId ? ` (linked: ${v.iotDeviceId})` : ""}</option>)}
            </Select>
            {error && <div className="md:col-span-2"><Alert message={error} /></div>}
            <div className="md:col-span-2 flex gap-2">
              <Button type="submit">{editId ? "Save changes" : "Register device"}</Button>
              <Button type="button" variant="secondary" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</Button>
            </div>
          </form>
        </FormPanel>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={<IconRadio className="h-7 w-7" />}
          title={devices.length === 0 ? "No devices yet" : "No matching devices"}
          description={devices.length === 0 ? "Add a device, import JSON, or sync a GPS API under Integrations." : "Try a different search."}
        />
      ) : (
        <DataTable>
          <Table>
            <TableHead>
              <TableHeaderCell>Device</TableHeaderCell>
              <TableHeaderCell>Company</TableHeaderCell>
              <TableHeaderCell>Vehicle</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Location</TableHeaderCell>
              <TableHeaderCell>Last seen</TableHeaderCell>
              <TableHeaderCell />
            </TableHead>
            <TableBody>
              {filtered.map((d) => (
                <TableRow key={`${d.tenantId ?? "none"}-${d.id}`}>
                  <TableCell>
                    <p className="font-semibold">{d.displayName || d.id}</p>
                    <p className="text-xs text-text-muted">IMEI {d.imei ?? d.id}</p>
                    <p className="text-xs text-text-muted">{d.vendorType}</p>
                  </TableCell>
                  <TableCell><CompanyCell tenantId={d.tenantId} /></TableCell>
                  <TableCell>
                    {d.vehicleRegistration ? (
                      <span className="text-sm font-medium text-brand">{d.vehicleRegistration}</span>
                    ) : (
                      <div className="flex min-w-[200px] gap-2">
                        <Select className="flex-1" value={linkVehicleId[d.id] ?? ""} onChange={(e) => setLinkVehicleId((s) => ({ ...s, [d.id]: e.target.value }))}>
                          <option value="">Link…</option>
                          {vehicles.map((v) => <option key={v.id} value={v.id}>{v.registrationNumber}</option>)}
                        </Select>
                        <Button variant="secondary" className="shrink-0" onClick={() => void quickLink(d.id)}>Link</Button>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge status={d.connectionStatus === "Connected" ? "Connected" : "Offline"} />
                    <p className="mt-1 text-xs text-text-muted">{d.vehicleStatus ?? d.vendorStatus ?? "—"}</p>
                    {d.speedKmh != null && <p className="text-xs text-text-muted">{Math.round(d.speedKmh)} km/h · ign {d.ignition ?? "—"}</p>}
                  </TableCell>
                  <TableCell>
                    {d.lastPlace ?? (d.lastLocation ? `${d.lastLocation.lat.toFixed(5)}, ${d.lastLocation.lng.toFixed(5)}` : "—")}
                  </TableCell>
                  <TableCell>{d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : "—"}</TableCell>
                  <TableCell>
                    <RowActions
                      onEdit={() => openEdit(d)}
                      onDelete={() => {
                        api.deleteIoTDevice(d.id).then(() => load()).catch((err) => setError(err instanceof Error ? err.message : "Delete failed"));
                      }}
                    />
                    {d.vehicleId && (
                      <Button variant="ghost" className="text-xs text-danger" onClick={() => void handleUnlink(d.id)}>Unlink</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTable>
      )}
    </div>
  );
}
