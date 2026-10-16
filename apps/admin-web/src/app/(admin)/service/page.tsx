"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormPanel } from "@/components/ui/Card";
import { DataTable, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/DataTable";
import { Field, Input, Select } from "@/components/ui/Input";
import { LocationPicker } from "@/components/ui/LocationMap";
import { PageHeader } from "@/components/ui/PageHeader";
import { ACCESS, canAccess } from "@/lib/access";
import { api, Appointment, Rider, ServiceCentre, ServiceRequestItem, ServiceSlot } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { validatePhone } from "@/lib/validation";

type Tab = "Centres" | "Slots" | "Requests" | "Appointments";

export default function ServicePage() {
  const { user } = useAuth();
  const canWrite = canAccess(user?.role, ACCESS.serviceWrite);
  const [tab, setTab] = useState<Tab>("Requests");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [centres, setCentres] = useState<ServiceCentre[]>([]);
  const [slots, setSlots] = useState<ServiceSlot[]>([]);
  const [requests, setRequests] = useState<ServiceRequestItem[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [centreForm, setCentreForm] = useState({ name: "", address: "", contactName: "", contactPhone: "", lat: "", lng: "" });
  const [slotForm, setSlotForm] = useState({ centreId: "", date: "", startTime: "09:00", endTime: "10:00", capacity: "4" });
  const [reqForm, setReqForm] = useState({ riderId: "", category: "General service", description: "" });
  const [apptForm, setApptForm] = useState({ riderId: "", centreId: "", slotId: "" });

  const reload = () => {
    api.serviceCentres().then((r) => setCentres(r.items)).catch((e) => setError(e.message));
    api.serviceSlots().then((r) => setSlots(r.items)).catch(() => {});
    api.serviceRequests().then((r) => setRequests(r.items)).catch(() => {});
    api.appointments().then((r) => setAppointments(r.items)).catch(() => {});
  };
  useEffect(() => {
    reload();
    api.riders({ accountStatus: "Active" }).then((r) => setRiders(r.items)).catch(() => {});
  }, []);

  return (
    <div>
      <PageHeader title="Service management" description="Workshops, slots, service requests and appointments" />
      {error && <div className="mb-4"><Alert message={error} /></div>}
      {success && <div className="mb-4"><Alert variant="success" message={success} /></div>}
      <div className="mb-4 flex flex-wrap gap-2">
        {(["Requests", "Centres", "Slots", "Appointments"] as Tab[]).map((item) => (
          <Button key={item} type="button" variant={tab === item ? "primary" : "secondary"} onClick={() => setTab(item)}>{item}</Button>
        ))}
      </div>

      {tab === "Centres" && (
        <>
          {canWrite && (
            <FormPanel title="Add service centre">
              <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={async (e) => {
                e.preventDefault();
                const phoneErr = validatePhone(centreForm.contactPhone);
                if (phoneErr) return setError(phoneErr);
                try {
                  await api.createServiceCentre({
                    ...centreForm,
                    lat: centreForm.lat ? Number(centreForm.lat) : undefined,
                    lng: centreForm.lng ? Number(centreForm.lng) : undefined,
                  });
                  setSuccess("Centre saved");
                  setCentreForm({ name: "", address: "", contactName: "", contactPhone: "", lat: "", lng: "" });
                  reload();
                } catch (err) { setError(err instanceof Error ? err.message : "Save failed"); }
              }}>
                <Field label="Name"><Input value={centreForm.name} onChange={(e) => setCentreForm({ ...centreForm, name: e.target.value })} /></Field>
                <Field label="Address"><Input value={centreForm.address} onChange={(e) => setCentreForm({ ...centreForm, address: e.target.value })} /></Field>
                <Field label="Contact name"><Input value={centreForm.contactName} onChange={(e) => setCentreForm({ ...centreForm, contactName: e.target.value })} /></Field>
                <Field label="Contact phone"><Input value={centreForm.contactPhone} onChange={(e) => setCentreForm({ ...centreForm, contactPhone: e.target.value })} /></Field>
                <LocationPicker
                  optional
                  lat={centreForm.lat}
                  lng={centreForm.lng}
                  onChange={(lat, lng) => setCentreForm((current) => ({ ...current, lat, lng }))}
                  onAddress={(address) => setCentreForm((current) => ({ ...current, address: current.address || address }))}
                />
                <div className="md:col-span-2"><Button type="submit">Create centre</Button></div>
              </form>
            </FormPanel>
          )}
          <DataTable>
            <Table>
              <TableHead><TableHeaderCell>Name</TableHeaderCell><TableHeaderCell>Contact</TableHeaderCell><TableHeaderCell>Status</TableHeaderCell></TableHead>
              <TableBody>
                {centres.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.name}<div className="text-xs text-text-muted">{c.address}</div>
                      {c.lat != null && c.lng != null && <div className="text-xs text-text-muted">{c.lat.toFixed(4)}, {c.lng.toFixed(4)}</div>}
                    </TableCell>
                    <TableCell>{c.contactName} · {c.contactPhone}</TableCell>
                    <TableCell><Badge status={c.isActive ? "Active" : "Inactive"} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataTable>
        </>
      )}

      {tab === "Slots" && (
        <>
          {canWrite && (
            <FormPanel title="Add slot">
              <form className="grid grid-cols-1 gap-4 md:grid-cols-5" onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await api.createServiceSlot({ ...slotForm, capacity: Number(slotForm.capacity) });
                  setSuccess("Slot created");
                  reload();
                } catch (err) { setError(err instanceof Error ? err.message : "Save failed"); }
              }}>
                <Field label="Centre">
                  <Select value={slotForm.centreId} onChange={(e) => setSlotForm({ ...slotForm, centreId: e.target.value })}>
                    <option value="">Select</option>
                    {centres.filter((c) => c.isActive).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                </Field>
                <Field label="Date"><Input type="date" value={slotForm.date} onChange={(e) => setSlotForm({ ...slotForm, date: e.target.value })} /></Field>
                <Field label="Start"><Input type="time" value={slotForm.startTime} onChange={(e) => setSlotForm({ ...slotForm, startTime: e.target.value })} /></Field>
                <Field label="End"><Input type="time" value={slotForm.endTime} onChange={(e) => setSlotForm({ ...slotForm, endTime: e.target.value })} /></Field>
                <Field label="Capacity"><Input type="number" min="1" value={slotForm.capacity} onChange={(e) => setSlotForm({ ...slotForm, capacity: e.target.value })} /></Field>
                <div className="md:col-span-5"><Button type="submit">Create slot</Button></div>
              </form>
            </FormPanel>
          )}
          <DataTable>
            <Table>
              <TableHead><TableHeaderCell>Date</TableHeaderCell><TableHeaderCell>Time</TableHeaderCell><TableHeaderCell>Capacity</TableHeaderCell></TableHead>
              <TableBody>
                {slots.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.date}</TableCell>
                    <TableCell>{s.startTime}–{s.endTime}</TableCell>
                    <TableCell>{s.bookedCount}/{s.capacity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataTable>
        </>
      )}

      {tab === "Requests" && (
        <>
          {canWrite && (
            <FormPanel title="Create service request">
              <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={async (e) => {
                e.preventDefault();
                if (reqForm.description.trim().length < 10) return setError("Description must be at least 10 characters");
                try {
                  await api.createServiceRequest(reqForm);
                  setSuccess("Request created");
                  reload();
                } catch (err) { setError(err instanceof Error ? err.message : "Save failed"); }
              }}>
                <Field label="Rider">
                  <Select value={reqForm.riderId} onChange={(e) => setReqForm({ ...reqForm, riderId: e.target.value })}>
                    <option value="">Select</option>
                    {riders.map((r) => <option key={r.id} value={r.id}>{r.fullName ?? r.phone}</option>)}
                  </Select>
                </Field>
                <Field label="Category"><Input value={reqForm.category} onChange={(e) => setReqForm({ ...reqForm, category: e.target.value })} /></Field>
                <Field label="Description"><Input value={reqForm.description} onChange={(e) => setReqForm({ ...reqForm, description: e.target.value })} /></Field>
                <div className="md:col-span-2"><Button type="submit">Create request</Button></div>
              </form>
            </FormPanel>
          )}
          <DataTable>
            <Table>
              <TableHead><TableHeaderCell>Rider</TableHeaderCell><TableHeaderCell>Category</TableHeaderCell><TableHeaderCell>Status</TableHeaderCell><TableHeaderCell /></TableHead>
              <TableBody>
                {requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.riderName ?? r.riderPhone}</TableCell>
                    <TableCell>{r.category}</TableCell>
                    <TableCell><Badge status={r.status} /></TableCell>
                    <TableCell>
                      {canWrite && r.status !== "Completed" && r.status !== "Cancelled" && (
                        <Button variant="ghost" className="text-xs" type="button" onClick={async () => {
                          const note = window.prompt("Completion note (required)") ?? "";
                          if (note.trim().length < 5) return;
                          await api.updateServiceRequest(r.id, { status: "Completed", completionNote: note.trim() });
                          reload();
                        }}>Complete</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataTable>
        </>
      )}

      {tab === "Appointments" && (
        <>
          {canWrite && (
            <FormPanel title="Schedule appointment">
              <form className="grid grid-cols-1 gap-4 md:grid-cols-3" onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await api.createAppointment(apptForm);
                  setSuccess("Appointment scheduled");
                  reload();
                } catch (err) { setError(err instanceof Error ? err.message : "Save failed"); }
              }}>
                <Field label="Rider">
                  <Select value={apptForm.riderId} onChange={(e) => setApptForm({ ...apptForm, riderId: e.target.value })}>
                    <option value="">Select</option>
                    {riders.map((r) => <option key={r.id} value={r.id}>{r.fullName ?? r.phone}</option>)}
                  </Select>
                </Field>
                <Field label="Centre">
                  <Select value={apptForm.centreId} onChange={(e) => setApptForm({ ...apptForm, centreId: e.target.value, slotId: "" })}>
                    <option value="">Select</option>
                    {centres.filter((c) => c.isActive).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                </Field>
                <Field label="Slot">
                  <Select value={apptForm.slotId} onChange={(e) => setApptForm({ ...apptForm, slotId: e.target.value })}>
                    <option value="">Select</option>
                    {slots.filter((s) => s.centreId === apptForm.centreId && s.remaining > 0).map((s) => (
                      <option key={s.id} value={s.id}>{s.date} {s.startTime} ({s.remaining} left)</option>
                    ))}
                  </Select>
                </Field>
                <div className="md:col-span-3"><Button type="submit">Schedule</Button></div>
              </form>
            </FormPanel>
          )}
          <DataTable>
            <Table>
              <TableHead><TableHeaderCell>Rider</TableHeaderCell><TableHeaderCell>Centre / slot</TableHeaderCell><TableHeaderCell>Status</TableHeaderCell><TableHeaderCell /></TableHead>
              <TableBody>
                {appointments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.riderName}</TableCell>
                    <TableCell>{a.centreName} {a.slot ? `· ${a.slot.date} ${a.slot.startTime}` : ""}</TableCell>
                    <TableCell><Badge status={a.status} /></TableCell>
                    <TableCell>
                      {canWrite && a.status !== "Cancelled" && a.status !== "Completed" && (
                        <div className="flex gap-2">
                          <Button variant="ghost" className="text-xs" type="button" onClick={async () => { await api.completeAppointment(a.id); reload(); }}>Complete</Button>
                          <Button variant="ghost" className="text-xs" type="button" onClick={async () => {
                            const reason = window.prompt("Cancel reason") ?? "";
                            if (reason.trim().length < 5) return;
                            await api.cancelAppointment(a.id, reason.trim());
                            reload();
                          }}>Cancel</Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataTable>
        </>
      )}
    </div>
  );
}
