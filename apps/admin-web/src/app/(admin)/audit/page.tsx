"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { DataTable, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Select } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { IconShield } from "@/components/icons";
import { api, AuditLog } from "@/lib/api";

export default function AuditPage() {
  const [items, setItems] = useState<AuditLog[]>([]);
  const [entityType, setEntityType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .auditLogs({
        entityType: entityType || undefined,
        from: from || undefined,
        to: to || undefined,
      })
      .then((r) => setItems(r.items))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load audit trail"))
      .finally(() => setLoading(false));
  }, [entityType, from, to]);

  return (
    <div>
      <PageHeader
        title="Audit trail"
        description="Append-only record of rider, vehicle and admin changes. This log cannot be edited."
        actions={
          <div className="flex flex-wrap gap-2">
            <Select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
              <option value="">All entities</option>
              <option value="Rider">Rider</option>
              <option value="Vehicle">Vehicle</option>
              <option value="AdminUser">Admin user</option>
            </Select>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        }
      />
      {error && <div className="mb-4"><Alert message={error} /></div>}
      {loading ? (
        <p className="text-sm text-text-secondary">Loading audit trail…</p>
      ) : items.length === 0 ? (
        <EmptyState icon={<IconShield className="h-7 w-7" />} title="No audit entries" description="Actions such as creating a rider or assigning a vehicle will appear here." />
      ) : (
        <DataTable>
          <Table>
            <TableHead>
              <TableHeaderCell>When</TableHeaderCell>
              <TableHeaderCell>Actor</TableHeaderCell>
              <TableHeaderCell>Action</TableHeaderCell>
              <TableHeaderCell>Record</TableHeaderCell>
            </TableHead>
            <TableBody>
              {items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"}</TableCell>
                  <TableCell>{row.actorEmail ?? row.actorId ?? "—"}</TableCell>
                  <TableCell>{row.action}</TableCell>
                  <TableCell>{row.entityType} · {row.entityId}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTable>
      )}
    </div>
  );
}
