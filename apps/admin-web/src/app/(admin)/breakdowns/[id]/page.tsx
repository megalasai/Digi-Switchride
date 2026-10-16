"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";
import { LocationPreview } from "@/components/ui/LocationMap";
import { PageHeader } from "@/components/ui/PageHeader";
import { ACCESS, canAccess } from "@/lib/access";
import { api, Breakdown } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function BreakdownDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const canWrite = canAccess(user?.role, ACCESS.breakdownsWrite);
  const [item, setItem] = useState<Breakdown | null>(null);
  const [note, setNote] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [escalatedTo, setEscalatedTo] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = () => api.breakdown(params.id).then(setItem).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [params.id]);

  const run = async (action: "assign" | "progress" | "escalate" | "close") => {
    if (note.trim().length < 5) return setError("Action note must be at least 5 characters");
    if (action === "assign" && !assignedTo.trim()) return setError("Assign a support person");
    if (action === "escalate" && !escalatedTo.trim()) return setError("Escalate to a named role or person");
    if (action === "close" && !window.confirm("Close this breakdown?")) return;
    try {
      const next = await api.breakdownAction(params.id, action, {
        note: note.trim(),
        assignedTo: assignedTo.trim() || undefined,
        escalatedTo: escalatedTo.trim() || undefined,
      });
      setItem(next);
      setSuccess("Updated");
      setNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  };

  if (!item) return error ? <Alert message={error} /> : <p className="text-sm text-text-secondary">Loading…</p>;

  return (
    <div>
      <PageHeader title={item.issueType} description="Track, assign, escalate and close" actions={<Link href="/breakdowns"><Button variant="secondary">Back</Button></Link>} />
      {error && <div className="mb-4"><Alert message={error} /></div>}
      {success && <div className="mb-4"><Alert variant="success" message={success} /></div>}
      <Card className="mb-6 space-y-2 p-6 text-sm">
        <p><Badge status={item.status} /></p>
        <p>Rider: <Link className="text-brand" href={`/riders/${item.riderId}`}>{item.riderName ?? item.riderPhone}</Link></p>
        <p>Vehicle: <Link className="text-brand" href={`/vehicles/${item.vehicleId}`}>{item.vehicleRegistration}</Link></p>
        <p>Location: {item.lat != null && item.lng != null ? `${item.lat}, ${item.lng}` : "Not provided"}</p>
        <LocationPreview lat={item.lat} lng={item.lng} label={item.issueType} />
        <p>{item.description}</p>
        {item.assignedTo && <p>Assigned to {item.assignedTo}</p>}
        {item.escalatedTo && <p>Escalated to {item.escalatedTo}</p>}
      </Card>
      <h3 className="mb-2 text-sm font-semibold">Actions taken</h3>
      <ul className="mb-6 space-y-2 text-sm">
        {item.actions.map((a, i) => (
          <li key={i} className="rounded-xl border border-border bg-white p-3">
            {a.note} · {a.actorEmail ?? "system"} · {a.at ? new Date(a.at).toLocaleString() : ""}
          </li>
        ))}
      </ul>
      {canWrite && item.status !== "Closed" && (
        <Card className="space-y-3 p-6">
          <Field label="Action note"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <Field label="Assign support person"><Input value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} /></Field>
          <Field label="Escalate to"><Input value={escalatedTo} onChange={(e) => setEscalatedTo(e.target.value)} /></Field>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => run("assign")}>Assign</Button>
            <Button type="button" variant="secondary" onClick={() => run("progress")}>In progress</Button>
            <Button type="button" variant="secondary" onClick={() => run("escalate")}>Escalate</Button>
            <Button type="button" variant="danger" onClick={() => run("close")}>Close</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
