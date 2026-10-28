"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormPanel } from "@/components/ui/Card";
import { FormModeLabel, RowActions } from "@/components/ui/RowActions";
import { DataTable, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { IconScooter } from "@/components/icons";
import { ACCESS, canAccess } from "@/lib/access";
import { useAuth } from "@/lib/auth-context";
import { api, Hub, Vehicle } from "@/lib/api";
import { CompanyCell, CompanyField } from "@/lib/companies";
import { wheelClassFromType } from "@/lib/vehicleIcons";
import { normalizeRegistration, validateRegistration, validateRequired } from "@/lib/validation";

const emptyForm = { registrationNumber: "", type: "EScooter", wheelClass: "TwoWheeler", hubId: "", model: "", iotDeviceId: "", notes: "", tenantId: "" };

export default function VehiclesPage() {
  const { user } = useAuth();
  const canWrite = canAccess(user?.role, ACCESS.vehiclesWrite);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [availability, setAvailability] = useState("");
  const [hubId, setHubId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = () => {
    setLoading(true);
    api
      .vehicles({
        search: search || undefined,
        status: status || undefined,
        availability: availability || undefined,
        hubId: hubId || undefined,
      })
      .then((r) => setVehicles(r.items))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load vehicles"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    api.hubs().then((r) => setHubs(r.items)).catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [search, status, availability, hubId]);

  const validate = () => {
    const next = {
      registrationNumber: validateRegistration(form.registrationNumber),
      hubId: validateRequired(form.hubId, "Hub"),
      model: validateRequired(form.model, "Model"),
    };
    setFieldErrors(next);
    return !next.registrationNumber && !next.hubId && !next.model;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const payload = {
        registrationNumber: normalizeRegistration(form.registrationNumber),
        type: form.type,
        wheelClass: form.wheelClass,
        hubId: form.hubId,
        model: form.model.trim(),
        iotDeviceId: form.iotDeviceId.trim() || undefined,
        notes: form.notes.trim() || undefined,
        tenantId: form.tenantId || undefined,
      };
      if (editId) {
        await api.updateVehicle(editId, payload);
        setSuccess("Vehicle updated");
      } else {
        await api.createVehicle(payload);
        setSuccess("Vehicle registered");
      }
      setShowForm(false);
      setEditId(null);
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Vehicle & Fleet"
        description="Availability, assignment and operational status"
        actions={
          <div className="flex flex-wrap gap-2">
            <Input className="w-48" placeholder="Registration" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
            {canWrite && (
              <Button
                variant={showForm ? "secondary" : "primary"}
                onClick={() => {
                  if (showForm) {
                    setShowForm(false);
                    setEditId(null);
                    setForm(emptyForm);
                  } else {
                    setEditId(null);
                    setForm(emptyForm);
                    setShowForm(true);
                  }
                }}
              >
                {showForm ? "Cancel" : "Add vehicle"}
              </Button>
            )}
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="Available">Available</option>
          <option value="Reserved">Reserved</option>
          <option value="InRide">In ride</option>
          <option value="Maintenance">Maintenance</option>
          <option value="Offline">Offline</option>
        </Select>
        <Select value={availability} onChange={(e) => setAvailability(e.target.value)}>
          <option value="">All availability</option>
          <option value="available">Available to assign</option>
          <option value="assigned">Assigned</option>
          <option value="unassigned">Unassigned</option>
        </Select>
        <Select value={hubId} onChange={(e) => setHubId(e.target.value)}>
          <option value="">All hubs</option>
          {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </Select>
      </div>
      {success && <div className="mb-4"><Alert variant="success" message={success} /></div>}
      {error && !showForm && <div className="mb-4"><Alert message={error} /></div>}

      {showForm && (
        <FormPanel title={editId ? "Edit vehicle number" : "Register vehicle"}>
          <FormModeLabel editing={Boolean(editId)} />
          <form onSubmit={handleSubmit} className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2" noValidate>
            <CompanyField value={form.tenantId} onChange={(tenantId) => setForm({ ...form, tenantId })} />
            <Field label="Registration number" error={fieldErrors.registrationNumber} hint="e.g. KA01AB1234">
              <Input invalid={!!fieldErrors.registrationNumber} value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="Type">
              <Select
                value={form.type}
                onChange={(e) => {
                  const type = e.target.value;
                  setForm({ ...form, type, wheelClass: wheelClassFromType(type) });
                }}
              >
                <option value="EScooter">E-Scooter (2-wheeler)</option>
                <option value="EBike">E-Bike (2-wheeler)</option>
                <option value="ERickshaw">E-Rickshaw (3-wheeler)</option>
                <option value="ECar">E-Car (4-wheeler)</option>
              </Select>
            </Field>
            <Field label="Wheel class" hint="Map icon follows this setting">
              <Select value={form.wheelClass} onChange={(e) => setForm({ ...form, wheelClass: e.target.value })}>
                <option value="TwoWheeler">2-wheeler</option>
                <option value="ThreeWheeler">3-wheeler</option>
                <option value="FourWheeler">4-wheeler</option>
              </Select>
            </Field>
            <Field label="Hub" error={fieldErrors.hubId}>
              <Select invalid={!!fieldErrors.hubId} value={form.hubId} onChange={(e) => setForm({ ...form, hubId: e.target.value })}>
                <option value="">Select hub</option>
                {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </Select>
            </Field>
            <Field label="Model" error={fieldErrors.model}>
              <Input invalid={!!fieldErrors.model} value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            </Field>
            <Field label="IoT device ID" hint="Optional">
              <Input value={form.iotDeviceId} onChange={(e) => setForm({ ...form, iotDeviceId: e.target.value })} />
            </Field>
            <Field label="Operational notes" hint="Optional">
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
            {error && <div className="md:col-span-2"><Alert message={error} /></div>}
            <div className="md:col-span-2 flex gap-2">
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : editId ? "Save vehicle" : "Register vehicle"}</Button>
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        </FormPanel>
      )}

      {loading ? (
        <p className="text-sm text-text-secondary">Loading vehicles…</p>
      ) : vehicles.length === 0 ? (
        <EmptyState icon={<IconScooter className="h-7 w-7" />} title="No vehicles" description="Add a vehicle or change filters." />
      ) : (
        <DataTable>
          <Table>
            <TableHead>
              <TableHeaderCell>Registration</TableHeaderCell>
              <TableHeaderCell>Company</TableHeaderCell>
              <TableHeaderCell>Model</TableHeaderCell>
              <TableHeaderCell>Class</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Battery</TableHeaderCell>
              <TableHeaderCell>Assigned rider</TableHeaderCell>
              <TableHeaderCell />
            </TableHead>
            <TableBody>
              {vehicles.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-semibold">{v.registrationNumber}</TableCell>
                  <TableCell><CompanyCell tenantId={v.tenantId} /></TableCell>
                  <TableCell>{v.model}</TableCell>
                  <TableCell>{v.wheelClass ?? v.type}</TableCell>
                  <TableCell><Badge status={v.status} /></TableCell>
                  <TableCell>{v.batteryPercent}%</TableCell>
                  <TableCell>{v.assignedRiderName ?? v.assignedRiderPhone ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {canWrite && (
                        <RowActions
                          onEdit={() => {
                            setEditId(v.id);
                            setForm({
                              registrationNumber: v.registrationNumber,
                              type: v.type,
                              wheelClass: v.wheelClass ?? "TwoWheeler",
                              hubId: v.hubId ?? "",
                              model: v.model ?? "",
                              iotDeviceId: v.iotDeviceId ?? "",
                              notes: v.notes ?? "",
                              tenantId: v.tenantId ?? "",
                            });
                            setShowForm(true);
                            setError("");
                          }}
                        />
                      )}
                      <Link className="text-xs font-semibold text-brand" href={`/vehicles/${v.id}`}>Details</Link>
                    </div>
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
