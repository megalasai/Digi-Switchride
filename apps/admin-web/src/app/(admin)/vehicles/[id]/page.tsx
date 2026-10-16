"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/DataTable";
import { Field, Input, Select } from "@/components/ui/Input";
import { LocationPreview } from "@/components/ui/LocationMap";
import { PageHeader } from "@/components/ui/PageHeader";
import { ACCESS, canAccess } from "@/lib/access";
import { api, Rider, VehicleDetail } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function VehicleDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const canWrite = canAccess(user?.role, ACCESS.vehiclesWrite);
  const [detail, setDetail] = useState<VehicleDetail | null>(null);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [riderId, setRiderId] = useState("");
  const [status, setStatus] = useState("Available");
  const [type, setType] = useState("EScooter");
  const [wheelClass, setWheelClass] = useState("TwoWheeler");
  const [reason, setReason] = useState("");
  const [override, setOverride] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api
      .vehicleDetail(params.id)
      .then((d) => {
        setDetail(d);
        setStatus(d.vehicle.status);
        setType(d.vehicle.type);
        setWheelClass(d.vehicle.wheelClass ?? (d.vehicle.type === "ERickshaw" ? "ThreeWheeler" : d.vehicle.type === "ECar" ? "FourWheeler" : "TwoWheeler"));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load vehicle"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    api.riders({ accountStatus: "Active" }).then((r) => setRiders(r.items)).catch(() => {});
  }, [params.id]);

  const changeStatus = async () => {
    if ((status === "Maintenance" || status === "Offline") && !reason.trim()) {
      setError("Reason is required for Maintenance or Offline");
      return;
    }
    if ((status === "Maintenance" || status === "Offline") && !window.confirm(`Move this vehicle to ${status}?`)) return;
    setError("");
    try {
      await api.updateVehicleStatus(params.id, status, reason.trim() || undefined);
      setSuccess("Status updated");
      setReason("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Status update failed");
    }
  };

  const assign = async () => {
    if (!riderId) {
      setError("Select a rider");
      return;
    }
    if (override && !reason.trim()) {
      setError("Override assignment requires a reason");
      return;
    }
    if (!window.confirm("Assign this vehicle to the selected rider?")) return;
    setError("");
    try {
      const next = await api.assignVehicle(params.id, { riderId, override, reason: reason.trim() || undefined });
      setDetail(next);
      setSuccess("Vehicle assigned");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assignment failed");
    }
  };

  const unassign = async () => {
    if (!window.confirm("Unassign this vehicle from the rider?")) return;
    setError("");
    try {
      const next = await api.unassignVehicle(params.id, reason.trim() || undefined);
      setDetail(next);
      setSuccess("Vehicle unassigned");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unassign failed");
    }
  };

  if (loading) return <p className="text-sm text-text-secondary">Loading vehicle…</p>;
  if (!detail) return error ? <Alert message={error} /> : null;
  const v = detail.vehicle;

  return (
    <div>
      <PageHeader
        title={v.registrationNumber}
        description={`${v.model} · ${v.type} · ${v.wheelClass ?? "TwoWheeler"}`}
        actions={<Link href="/vehicles"><Button variant="secondary">Back to fleet</Button></Link>}
      />
      {error && <div className="mb-4"><Alert message={error} /></div>}
      {success && <div className="mb-4"><Alert variant="success" message={success} /></div>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="space-y-2 p-6 text-sm">
          <p><span className="text-text-muted">Status</span> · <Badge status={v.status} /></p>
          <p>Battery {v.batteryPercent}% · Odometer {v.odometerKm ?? 0} km</p>
          <p>Hub: {detail.hub?.name ?? v.hubId}</p>
          <p>IoT: {v.iotDeviceId ?? "Not linked"}</p>
          <p>Last telemetry: {v.lastTelemetryAt ? new Date(v.lastTelemetryAt).toLocaleString() : "—"}</p>
          {v.lastPlace && <p>Place: {v.lastPlace}{v.lastPlaceKind ? ` (${v.lastPlaceKind === 'Hub' ? 'inside hub' : 'outside hub'})` : ''}</p>}
          {v.notes && <p>Notes: {v.notes}</p>}
          <LocationPreview lat={v.lastLat} lng={v.lastLng} label={v.registrationNumber} trail={v.locationTrail} place={v.lastPlace} vehicleType={v.type} wheelClass={v.wheelClass} />
        </Card>
        <Card className="space-y-3 p-6 text-sm">
          <p className="font-semibold">Assigned rider</p>
          {detail.assignedRider ? (
            <>
              <p>{detail.assignedRider.fullName} · {detail.assignedRider.phone}</p>
              <Link className="font-semibold text-brand" href={`/riders/${detail.assignedRider.id}`}>Open rider</Link>
              {canWrite && <Button variant="secondary" type="button" onClick={unassign}>Unassign</Button>}
            </>
          ) : (
            <p className="text-text-secondary">Not assigned</p>
          )}
        </Card>
      </div>

      {canWrite && (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="space-y-3 p-6">
            <h3 className="font-semibold">Change status</h3>
            <Field label="Status">
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="Available">Available</option>
                <option value="Reserved">Reserved</option>
                <option value="InRide">In ride</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Offline">Offline</option>
              </Select>
            </Field>
            <Field label="Reason" hint="Required for Maintenance or Offline">
              <Input value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <Button type="button" onClick={changeStatus}>Update status</Button>
          </Card>
          <Card className="space-y-3 p-6">
            <h3 className="font-semibold">Vehicle class</h3>
            <Field label="Type">
              <Select
                value={type}
                onChange={(e) => {
                  const next = e.target.value;
                  setType(next);
                  setWheelClass(next === "ERickshaw" ? "ThreeWheeler" : next === "ECar" ? "FourWheeler" : "TwoWheeler");
                }}
              >
                <option value="EScooter">E-Scooter</option>
                <option value="EBike">E-Bike</option>
                <option value="ERickshaw">E-Rickshaw</option>
                <option value="ECar">E-Car</option>
              </Select>
            </Field>
            <Field label="Wheel class">
              <Select value={wheelClass} onChange={(e) => setWheelClass(e.target.value)}>
                <option value="TwoWheeler">2-wheeler</option>
                <option value="ThreeWheeler">3-wheeler</option>
                <option value="FourWheeler">4-wheeler</option>
              </Select>
            </Field>
            <Button
              type="button"
              onClick={async () => {
                setError("");
                try {
                  const next = await api.updateVehicle(params.id, { type, wheelClass });
                  setDetail({ ...detail!, vehicle: next });
                  setSuccess("Vehicle class updated");
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Update failed");
                }
              }}
            >
              Save class
            </Button>
          </Card>
          <Card className="space-y-3 p-6">
            <h3 className="font-semibold">Assign rider</h3>
            <Field label="Active rider">
              <Select value={riderId} onChange={(e) => setRiderId(e.target.value)}>
                <option value="">Select rider</option>
                {riders.map((r) => (
                  <option key={r.id} value={r.id}>{r.fullName ?? r.phone}</option>
                ))}
              </Select>
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
              Override blocked status (Maintenance / Offline / In ride)
            </label>
            <Button type="button" onClick={assign} disabled={!riderId}>Assign vehicle</Button>
          </Card>
        </div>
      )}

      <h3 className="mb-3 mt-8 text-sm font-semibold">Vehicle history</h3>
      {detail.events.length === 0 ? (
        <p className="text-sm text-text-secondary">No history events yet.</p>
      ) : (
        <DataTable>
          <Table>
            <TableHead>
              <TableHeaderCell>When</TableHeaderCell>
              <TableHeaderCell>Type</TableHeaderCell>
              <TableHeaderCell>Summary</TableHeaderCell>
              <TableHeaderCell>Actor</TableHeaderCell>
            </TableHead>
            <TableBody>
              {detail.events.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{e.createdAt ? new Date(e.createdAt).toLocaleString() : "—"}</TableCell>
                  <TableCell>{e.type}</TableCell>
                  <TableCell>{e.summary}{e.reason ? ` · ${e.reason}` : ""}</TableCell>
                  <TableCell>{e.actorEmail ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTable>
      )}
    </div>
  );
}
