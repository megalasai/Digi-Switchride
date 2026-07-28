"use client";

import { useEffect, useState } from "react";
import { api, Customer } from "@/lib/api";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.customers({ search: search || undefined }).then((r) => setCustomers(r.items)).catch(() => {});
  }, [search]);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Customers</h1>
        <input
          type="text"
          placeholder="Search by phone or name..."
          className="border rounded-lg px-4 py-2 w-64"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-4">Phone</th>
              <th className="text-left p-4">Name</th>
              <th className="text-left p-4">KYC Status</th>
              <th className="text-left p-4">Account</th>
              <th className="text-left p-4">Joined</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-b hover:bg-gray-50">
                <td className="p-4">{c.phone}</td>
                <td className="p-4">{c.fullName ?? "—"}</td>
                <td className="p-4">
                  <StatusBadge status={c.kycStatus} />
                </td>
                <td className="p-4">{c.accountStatus}</td>
                <td className="p-4">{new Date(c.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Approved: "bg-green-100 text-green-800",
    Pending: "bg-yellow-100 text-yellow-800",
    Rejected: "bg-red-100 text-red-800",
    UnderReview: "bg-blue-100 text-blue-800",
    NotSubmitted: "bg-gray-100 text-gray-800",
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] ?? colors.NotSubmitted}`}>
      {status}
    </span>
  );
}
