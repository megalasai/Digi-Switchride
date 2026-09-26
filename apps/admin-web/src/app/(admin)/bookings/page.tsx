"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { DataTable, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Input";
import { api, Booking } from "@/lib/api";

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    api.bookings(filter || undefined).then((r) => setBookings(r.items)).catch(() => {});
  }, [filter]);

  return (
    <div>
      <PageHeader
        title="Bookings"
        description="All ride reservations and their status"
        actions={
          <Select className="w-48" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Active">Active</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </Select>
        }
      />
      <DataTable>
        <Table>
          <TableHead>
            <TableHeaderCell>ID</TableHeaderCell>
            <TableHeaderCell>Type</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell>Amount</TableHeaderCell>
            <TableHeaderCell>Created</TableHeaderCell>
          </TableHead>
          <TableBody>
            {bookings.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-mono text-xs text-text-secondary">{b.id.slice(0, 8)}…</TableCell>
                <TableCell>{b.bookingType}</TableCell>
                <TableCell><Badge status={b.status} /></TableCell>
                <TableCell className="font-semibold">₹{b.estimatedAmount}</TableCell>
                <TableCell className="text-text-secondary">{new Date(b.createdAt).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataTable>
    </div>
  );
}
