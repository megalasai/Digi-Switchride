"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { IconShield } from "@/components/icons";
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
      <PageHeader title="KYC Review Queue" description="Approve or reject pending identity verifications" />
      {customers.length === 0 ? (
        <EmptyState
          icon={<IconShield className="h-7 w-7" />}
          title="No pending submissions"
          description="New KYC requests from the mobile app will appear here for review."
        />
      ) : (
        <div className="space-y-4">
          {customers.map((c) => (
            <Card key={c.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-text-primary">{c.fullName ?? c.phone}</p>
                <p className="text-sm text-text-secondary">{c.phone}</p>
                <p className="mt-1 text-sm text-text-muted">
                  Submitted {new Date(c.createdAt).toLocaleDateString()}
                </p>
                <div className="mt-2"><Badge status="Pending" /></div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => handleReview(c.id, "Approve")}>Approve</Button>
                <Button variant="danger" onClick={() => handleReview(c.id, "Reject")}>Reject</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
