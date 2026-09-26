"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormPanel } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormModeLabel, RowActions } from "@/components/ui/RowActions";
import { Input, Select } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { IconRadio } from "@/components/icons";
import { api, IoTDevice, Vehicle } from "@/lib/api";

const emptyForm = { deviceId: "", vendorType: "Simulator", vehicleId: "" };

export default function IoTPage() {
  const [devices, setDevices] = useState<IoTDevice[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [linkVehicleId, setLinkVehicleId] = useState<Record<string, string>>({});

  const load = () => {
    api.iotDevices().then((r) => setDevices(r.items)).catch((e) => setError(e.message));
    api.vehicles().then((r) => setVehicles(r.items)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditId(null); setForm(emptyForm); setShowForm(true); setError(""); };
  const openEdit = (d: IoTDevice) => {
    setEditId(d.id);
    setForm({ deviceId: d.id, vendorType: d.vendorType, vehicleId: d.vehicleId ?? "" });
    setShowForm(true); setError("");
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
        await api.createIoTDevice({ deviceId: form.deviceId, vendorType: form.vendorType, vehicleId: form.vehicleId || undefined });
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
      <PageHeader title="IoT Devices" description="Register, edit, unlink and re-link devices to vehicles"
        actions={<Button variant={showForm && !editId ? "secondary" : "primary"} onClick={() => showForm && !editId ? setShowForm(false) : openCreate()}>{showForm && !editId ? "Cancel" : "Add Device"}</Button>} />
      {success && <div className="mb-4"><Alert variant="success" message={success} /></div>}
      {error && !showForm && <div className="mb-4"><Alert message={error} /></div>}

      {showForm && (
        <FormPanel title={editId ? "Edit IoT device" : "Register IoT device"}>
          <FormModeLabel editing={!!editId} />
          <form onSubmit={handleSubmit} className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
            {!editId && <Input placeholder="Device ID" value={form.deviceId} onChange={(e) => setForm({ ...form, deviceId: e.target.value })} required />}
            <Select value={form.vendorType} onChange={(e) => setForm({ ...form, vendorType: e.target.value })}>
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

      {devices.length === 0 ? (
        <EmptyState icon={<IconRadio className="h-7 w-7" />} title="No devices registered" description="Add a device or register one when creating a vehicle." />
      ) : (
        <div className="space-y-4">
          {devices.map((d) => (
            <Card key={d.id} className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-text-primary">{d.id}</p>
                    <RowActions onEdit={() => openEdit(d)} />
                  </div>
                  <p className="text-sm text-text-secondary">Vendor: {d.vendorType}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge status={d.connectionStatus === "Connected" ? "Connected" : "Offline"} />
                    {d.vehicleRegistration ? (
                      <span className="rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-semibold text-brand-dark">→ {d.vehicleRegistration}</span>
                    ) : (
                      <span className="text-xs text-warning">Not linked to a vehicle</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2 lg:min-w-[280px]">
                  {!d.vehicleId ? (
                    <div className="flex gap-2">
                      <Select className="flex-1" value={linkVehicleId[d.id] ?? ""} onChange={(e) => setLinkVehicleId((s) => ({ ...s, [d.id]: e.target.value }))}>
                        <option value="">Link to vehicle…</option>
                        {vehicles.map((v) => <option key={v.id} value={v.id}>{v.registrationNumber}</option>)}
                      </Select>
                      <Button variant="secondary" className="shrink-0" onClick={() => quickLink(d.id)}>Link</Button>
                    </div>
                  ) : (
                    <Button variant="ghost" className="text-xs text-danger" onClick={() => handleUnlink(d.id)}>Unlink vehicle</Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
