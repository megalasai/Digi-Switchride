"use client";

import { useEffect, useState } from "react";
import { api, Customer } from "@/lib/api";

export default function KycReviewPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);

  const load = () => {
    api.customers({ kycStatus: "Pending" }).then((r) => setCustomers(r.items)).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const handleReview = async (customerId: string, action: "Approve" | "Reject") => {
    const reason = action === "Reject" ? prompt("Rejection reason:") ?? undefined : undefined;
    await api.reviewKyc(customerId, action, reason);
    load();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">KYC Review Queue</h1>
      {customers.length === 0 ? (
        <p className="text-gray-500">No pending KYC submissions.</p>
      ) : (
        <div className="space-y-4">
          {customers.map((c) => (
            <div key={c.id} className="bg-white rounded-lg shadow p-6 flex justify-between items-center">
              <div>
                <p className="font-medium">{c.fullName ?? c.phone}</p>
                <p className="text-sm text-gray-500">{c.phone}</p>
                <p className="text-sm text-gray-500">Submitted: {new Date(c.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleReview(c.id, "Approve")}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleReview(c.id, "Reject")}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
