"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormPanel } from "@/components/ui/Card";
import { DataTable, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { IconHeadphones } from "@/components/icons";
import { api, Rider, SupportTicket } from "@/lib/api";

export default function SupportPage() {
  const [items, setItems] = useState<SupportTicket[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({ riderId: "", category: "General", subject: "", description: "" });

  const load = () => api.supportTickets(status || undefined).then((r) => setItems(r.items)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [status]);
  useEffect(() => { api.riders({ accountStatus: "Active" }).then((r) => setRiders(r.items)).catch(() => {}); }, []);

  return (
    <div>
      <PageHeader title="Customer support" description="Tickets from riders and the operations desk" />
      {error && <div className="mb-4"><Alert message={error} /></div>}
      <FormPanel title="Log a ticket">
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api.createSupportTicket(form);
            setForm({ riderId: "", category: "General", subject: "", description: "" });
            load();
          } catch (err) { setError(err instanceof Error ? err.message : "Save failed"); }
        }}>
          <Field label="Rider">
            <Select value={form.riderId} onChange={(e) => setForm({ ...form, riderId: e.target.value })}>
              <option value="">Select</option>
              {riders.map((r) => <option key={r.id} value={r.id}>{r.fullName ?? r.phone}</option>)}
            </Select>
          </Field>
          <Field label="Category">
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option>General</option><option>Ride</option><option>Payment</option><option>KYC</option><option>Vehicle</option>
            </Select>
          </Field>
          <Field label="Subject"><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></Field>
          <Field label="Description"><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <div className="md:col-span-2"><Button type="submit">Create ticket</Button></div>
        </form>
      </FormPanel>
      <Select className="mb-4" value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">All statuses</option>
        <option value="Open">Open</option>
        <option value="InProgress">In progress</option>
        <option value="Resolved">Resolved</option>
        <option value="Closed">Closed</option>
      </Select>
      {items.length === 0 ? (
        <EmptyState icon={<IconHeadphones className="h-7 w-7" />} title="No tickets" description="New tickets appear here as riders or operators log them." />
      ) : (
        <DataTable>
          <Table>
            <TableHead>
              <TableHeaderCell>Subject</TableHeaderCell>
              <TableHeaderCell>Rider</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell />
            </TableHead>
            <TableBody>
              {items.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.subject}<div className="text-xs text-text-muted">{t.category} · {t.description}</div></TableCell>
                  <TableCell>{t.riderName ?? t.riderPhone}</TableCell>
                  <TableCell><Badge status={t.status} /></TableCell>
                  <TableCell>
                    {t.status !== "Closed" && (
                      <Button variant="ghost" className="text-xs" type="button" onClick={async () => {
                        const note = window.prompt("Progress note") ?? "";
                        if (note.trim().length < 5) return;
                        await api.updateSupportTicket(t.id, { status: t.status === "Open" ? "InProgress" : "Resolved", note: note.trim() });
                        load();
                      }}>Update</Button>
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
