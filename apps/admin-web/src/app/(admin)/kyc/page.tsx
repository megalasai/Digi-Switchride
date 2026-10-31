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
import { api, KycDocument, Rider } from "@/lib/api";
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
  const [riders, setRiders] = useState<Rider[]>([]);
  const [uploadRiderId, setUploadRiderId] = useState("");
  const [uploadType, setUploadType] = useState("Aadhaar");
  const [uploadNumber, setUploadNumber] = useState("");
  const [uploadFile, setUploadFile] = useState("");
  const [uploading, setUploading] = useState(false);

  const load = () => {
    setLoading(true);
    api.kycSubmissions(status || undefined)
      .then((r) => setItems(r.items))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load KYC"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [status]);
  useEffect(() => {
    api.riders().then((r) => setRiders(r.items)).catch(() => {});
  }, []);

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
      {canWrite && (
        <Card className="mb-6 space-y-3 p-5">
          <p className="font-semibold text-text-primary">Upload KYC for a customer</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Customer">
              <Select value={uploadRiderId} onChange={(e) => setUploadRiderId(e.target.value)}>
                <option value="">Select rider</option>
                {riders.map((r) => (
                  <option key={r.id} value={r.id}>{r.fullName ?? r.phone}</option>
                ))}
              </Select>
            </Field>
            <Field label="Document type">
              <Select value={uploadType} onChange={(e) => setUploadType(e.target.value)}>
                <option value="Aadhaar">Aadhaar</option>
                <option value="PAN">PAN</option>
                <option value="DrivingLicence">Driving licence</option>
                <option value="Selfie">Selfie / photograph</option>
              </Select>
            </Field>
            <Field label="Document number" hint="Optional">
              <Input value={uploadNumber} onChange={(e) => setUploadNumber(e.target.value)} />
            </Field>
            <Field label="File">
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) {
                    setUploadFile("");
                    return;
                  }
                  if (file.size > 5_000_000) {
                    setError("KYC file must be 5 MB or smaller");
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => setUploadFile(String(reader.result ?? ""));
                  reader.readAsDataURL(file);
                }}
              />
            </Field>
          </div>
          <Button
            type="button"
            disabled={!uploadRiderId || !uploadFile || uploading}
            onClick={async () => {
              setUploading(true);
              setError("");
              try {
                await api.uploadRiderKyc(uploadRiderId, {
                  documentType: uploadType,
                  documentNumber: uploadNumber.trim() || undefined,
                  blobUrl: uploadFile,
                });
                setSuccess("Document uploaded");
                setUploadFile("");
                setUploadNumber("");
                load();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Upload failed");
              } finally {
                setUploading(false);
              }
            }}
          >
            {uploading ? "Uploading…" : "Upload document"}
          </Button>
        </Card>
      )}
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
                  {d.blobUrl && (
                    d.blobUrl.startsWith("data:") ? (
                      <img
                        src={d.blobUrl}
                        alt={`${d.documentType} preview`}
                        className="mt-3 max-h-64 max-w-full rounded-lg border border-border object-contain"
                      />
                    ) : (
                      <a className="mt-2 inline-block text-sm font-semibold text-brand" href={d.blobUrl} target="_blank" rel="noreferrer">Open document</a>
                    )
                  )}
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
