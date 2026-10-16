"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { IconShield } from "@/components/icons";
import { ACCESS, canAccess } from "@/lib/access";
import { api, KycDocument } from "@/lib/api";
import { ProvisionPanel, DisabledField, DisabledSelect, DisabledAction } from "@/components/ui/Provision";
import { useAuth } from "@/lib/auth-context";

export default function KycReviewPage() {
  const { user } = useAuth();
  const canWrite = canAccess(user?.role, ACCESS.kyc);
  const [items, setItems] = useState<KycDocument[]>([]);
  const [status, setStatus] = useState("");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.kycSubmissions(status || undefined)
      .then((r) => setItems(r.items))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load KYC"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [status]);

  const approve = async (id: string) => {
    if (!window.confirm("Approve this document?")) return;
    try {
      await api.reviewKycDocument(id, "Approve");
      setSuccess("Document approved");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed");
    }
  };

  const reject = async () => {
    if (!rejectId) return;
    if (reason.trim().length < 10) {
      setError("Rejection reason must be at least 10 characters");
      return;
    }
    try {
      await api.reviewKycDocument(rejectId, "Reject", reason.trim());
      setSuccess("Document rejected");
      setRejectId(null);
      setReason("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed");
    }
  };

  return (
    <div>
      <PageHeader title="KYC documents" description="Review submitted identity documents. Rider KYC is approved only when Aadhaar, PAN and Driving Licence are approved." />
      <ProvisionPanel
        title="Document vault and KYC vendor"
        description="Image preview from blob storage and Digio/Signzy verification will be planned next. Review can already run on submitted records."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <DisabledField label="Vault container" placeholder="kyc-docs" />
          <DisabledSelect label="Vendor" options={["Digio", "Signzy"]} />
          <DisabledAction label="Run vendor check" />
        </div>
      </ProvisionPanel>
      {error && <div className="mb-4"><Alert message={error} /></div>}
      {success && <div className="mb-4"><Alert variant="success" message={success} /></div>}
      <div className="mb-4">
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Pending / under review</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
        </Select>
      </div>
      {loading ? <p className="text-sm text-text-secondary">Loading…</p> : items.length === 0 ? (
        <EmptyState icon={<IconShield className="h-7 w-7" />} title="No documents" description="Pending KYC submissions from riders appear here." />
      ) : (
        <div className="space-y-4">
          {items.map((d) => (
            <Card key={d.id} className="p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold">{d.documentType}</p>
                  <p className="text-sm text-text-secondary">{d.riderName ?? d.riderPhone} · {d.documentNumberMasked ?? "No number on file"}</p>
                  <div className="mt-2 flex gap-2"><Badge status={d.status} />{d.riderKycStatus && <Badge status={d.riderKycStatus} />}</div>
                  {d.blobUrl && <a className="mt-2 inline-block text-sm font-semibold text-brand" href={d.blobUrl} target="_blank" rel="noreferrer">Open document</a>}
                  <div className="mt-2"><Link className="text-sm text-brand" href={`/riders/${d.riderId}`}>Rider profile</Link></div>
                </div>
                {canWrite && (d.status === "Pending" || d.status === "UnderReview") && (
                  <div className="flex gap-2">
                    <Button type="button" onClick={() => approve(d.id)}>Approve</Button>
                    <Button type="button" variant="danger" onClick={() => { setRejectId(d.id); setReason(""); }}>Reject</Button>
                  </div>
                )}
              </div>
              {rejectId === d.id && (
                <div className="mt-4">
                  <Field label="Rejection reason" hint="Minimum 10 characters">
                    <Input value={reason} onChange={(e) => setReason(e.target.value)} />
                  </Field>
                  <div className="mt-2 flex gap-2">
                    <Button type="button" variant="danger" onClick={reject}>Confirm reject</Button>
                    <Button type="button" variant="secondary" onClick={() => setRejectId(null)}>Cancel</Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
