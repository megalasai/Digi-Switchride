"use client";

import { useEffect, useState } from "react";
import { api, Booking } from "@/lib/api";

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    api.bookings(filter || undefined).then((r) => setBookings(r.items)).catch(() => {});
  }, [filter]);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Bookings</h1>
        <select className="border rounded-lg px-4 py-2" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="Confirmed">Confirmed</option>
          <option value="Active">Active</option>
          <option value="Completed">Completed</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-4">ID</th>
              <th className="text-left p-4">Type</th>
              <th className="text-left p-4">Status</th>
              <th className="text-left p-4">Amount</th>
              <th className="text-left p-4">Created</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} className="border-b hover:bg-gray-50">
                <td className="p-4 font-mono text-xs">{b.id.slice(0, 8)}...</td>
                <td className="p-4">{b.bookingType}</td>
                <td className="p-4">{b.status}</td>
                <td className="p-4">₹{b.estimatedAmount}</td>
                <td className="p-4">{new Date(b.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
