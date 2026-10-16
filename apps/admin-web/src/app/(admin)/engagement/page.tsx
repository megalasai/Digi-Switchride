"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormPanel } from "@/components/ui/Card";
import { DataTable, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/DataTable";
import { Field, Input, Select } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { ComingSoonBadge, DisabledAction, DisabledField, ProvisionPanel } from "@/components/ui/Provision";
import { api, AgreementItem, AppNotice, FeedbackItem, ReferralItem, Rider } from "@/lib/api";

type Tab = "Notifications" | "Referrals" | "Feedback" | "Agreements";

export default function EngagementPage() {
  const [tab, setTab] = useState<Tab>("Notifications");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [riders, setRiders] = useState<Rider[]>([]);
  const [notices, setNotices] = useState<AppNotice[]>([]);
  const [referrals, setReferrals] = useState<ReferralItem[]>([]);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [agreements, setAgreements] = useState<AgreementItem[]>([]);
  const [notice, setNotice] = useState({ title: "", body: "", audience: "AllRiders" });
  const [fb, setFb] = useState({ riderId: "", rating: "5", comment: "", category: "App" });
  const [ag, setAg] = useState({ riderId: "", type: "RentalAgreement", content: "This rental agreement covers vehicle use, charges, KYC and damage liability under Digi-Switchride terms.", documentUrl: "" });
  const [ref, setRef] = useState({ riderId: "", code: "" });

  const reload = () => {
    api.notifications().then((r) => setNotices(r.items)).catch((e) => setError(e.message));
    api.referrals().then((r) => setReferrals(r.items)).catch(() => {});
    api.feedback().then((r) => setFeedback(r.items)).catch(() => {});
    api.agreements().then((r) => setAgreements(r.items)).catch(() => {});
  };
  useEffect(() => {
    reload();
    api.riders({ accountStatus: "Active" }).then((r) => setRiders(r.items)).catch(() => {});
  }, []);

  return (
    <div>
      <PageHeader title="Engagement" description="In-app notices work now. SMS, push and document vault are shown as planned provisions." />
      {error && <div className="mb-4"><Alert message={error} /></div>}
      {success && <div className="mb-4"><Alert variant="success" message={success} /></div>}
      <div className="mb-4 flex flex-wrap gap-2">
        {(["Notifications", "Referrals", "Feedback", "Agreements"] as Tab[]).map((item) => (
          <Button key={item} type="button" variant={tab === item ? "primary" : "secondary"} onClick={() => setTab(item)}>{item}</Button>
        ))}
      </div>

      {tab === "Notifications" && (
        <>
          <FormPanel title="Send in-app notice">
            <form className="grid grid-cols-1 gap-4" onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api.sendNotification(notice);
                setSuccess("Notice recorded as sent in-app");
                setNotice({ title: "", body: "", audience: "AllRiders" });
                reload();
              } catch (err) { setError(err instanceof Error ? err.message : "Send failed"); }
            }}>
              <Field label="Title"><Input value={notice.title} onChange={(e) => setNotice({ ...notice, title: e.target.value })} /></Field>
              <Field label="Message"><Input value={notice.body} onChange={(e) => setNotice({ ...notice, body: e.target.value })} /></Field>
              <Field label="Audience">
                <Select value={notice.audience} onChange={(e) => setNotice({ ...notice, audience: e.target.value })}>
                  <option value="AllRiders">All riders</option>
                  <option value="ActiveRiders">Active riders</option>
                </Select>
              </Field>
              <div className="flex flex-wrap items-center gap-3 text-sm text-text-secondary">
                <label className="flex items-center gap-2 opacity-50">
                  <input type="checkbox" disabled /> SMS
                </label>
                <label className="flex items-center gap-2 opacity-50">
                  <input type="checkbox" disabled /> Push
                </label>
                <ComingSoonBadge />
              </div>
              <Button type="submit">Send in-app</Button>
            </form>
          </FormPanel>
          <DataTable>
            <Table>
              <TableHead><TableHeaderCell>Title</TableHeaderCell><TableHeaderCell>Audience</TableHeaderCell><TableHeaderCell>Status</TableHeaderCell></TableHead>
              <TableBody>
                {notices.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell>{n.title}<div className="text-xs text-text-muted">{n.body}</div></TableCell>
                    <TableCell>{n.audience}</TableCell>
                    <TableCell><Badge status={n.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataTable>
        </>
      )}

      {tab === "Referrals" && (
        <>
          <FormPanel title="Apply a referral code">
            <form className="grid grid-cols-1 gap-4 md:grid-cols-3" onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api.applyReferral(ref.riderId, ref.code);
                setSuccess("Referral applied");
                reload();
              } catch (err) { setError(err instanceof Error ? err.message : "Apply failed"); }
            }}>
              <Field label="New rider">
                <Select value={ref.riderId} onChange={(e) => setRef({ ...ref, riderId: e.target.value })}>
                  <option value="">Select</option>
                  {riders.map((r) => <option key={r.id} value={r.id}>{r.fullName ?? r.phone}</option>)}
                </Select>
              </Field>
              <Field label="Code"><Input value={ref.code} onChange={(e) => setRef({ ...ref, code: e.target.value.toUpperCase() })} /></Field>
              <div className="flex items-end"><Button type="submit">Apply</Button></div>
            </form>
          </FormPanel>
          <DataTable>
            <Table>
              <TableHead><TableHeaderCell>Rider</TableHeaderCell><TableHeaderCell>Code</TableHeaderCell><TableHeaderCell>Referred</TableHeaderCell></TableHead>
              <TableBody>
                {referrals.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.fullName ?? r.phone}</TableCell>
                    <TableCell className="font-mono">{r.referralCode}</TableCell>
                    <TableCell>{r.referredCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataTable>
        </>
      )}

      {tab === "Feedback" && (
        <>
          <FormPanel title="Record feedback">
            <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api.createFeedback({ ...fb, rating: Number(fb.rating) });
                setSuccess("Feedback saved");
                reload();
              } catch (err) { setError(err instanceof Error ? err.message : "Save failed"); }
            }}>
              <Field label="Rider">
                <Select value={fb.riderId} onChange={(e) => setFb({ ...fb, riderId: e.target.value })}>
                  <option value="">Select</option>
                  {riders.map((r) => <option key={r.id} value={r.id}>{r.fullName ?? r.phone}</option>)}
                </Select>
              </Field>
              <Field label="Rating">
                <Select value={fb.rating} onChange={(e) => setFb({ ...fb, rating: e.target.value })}>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                </Select>
              </Field>
              <Field label="Category">
                <Select value={fb.category} onChange={(e) => setFb({ ...fb, category: e.target.value })}>
                  <option>App</option><option>Ride</option><option>Service</option><option>Vehicle</option>
                </Select>
              </Field>
              <Field label="Comment"><Input value={fb.comment} onChange={(e) => setFb({ ...fb, comment: e.target.value })} /></Field>
              <div className="md:col-span-2"><Button type="submit">Save</Button></div>
            </form>
          </FormPanel>
          <DataTable>
            <Table>
              <TableHead><TableHeaderCell>Rider</TableHeaderCell><TableHeaderCell>Rating</TableHeaderCell><TableHeaderCell>Comment</TableHeaderCell></TableHead>
              <TableBody>
                {feedback.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>{f.riderName ?? f.riderPhone}</TableCell>
                    <TableCell>{f.rating}/5 · {f.category}</TableCell>
                    <TableCell>{f.comment}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataTable>
        </>
      )}

      {tab === "Agreements" && (
        <>
          <FormPanel title="Issue agreement">
            <form className="grid grid-cols-1 gap-4" onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api.issueAgreement({ ...ag, documentUrl: ag.documentUrl || undefined });
                setSuccess("Agreement issued");
                reload();
              } catch (err) { setError(err instanceof Error ? err.message : "Save failed"); }
            }}>
              <Field label="Rider">
                <Select value={ag.riderId} onChange={(e) => setAg({ ...ag, riderId: e.target.value })}>
                  <option value="">Select</option>
                  {riders.map((r) => <option key={r.id} value={r.id}>{r.fullName ?? r.phone}</option>)}
                </Select>
              </Field>
              <Field label="Type">
                <Select value={ag.type} onChange={(e) => setAg({ ...ag, type: e.target.value })}>
                  <option value="RentalAgreement">Rental agreement</option>
                  <option value="ServiceWaiver">Service waiver</option>
                  <option value="KYCConsent">KYC consent</option>
                </Select>
              </Field>
              <Field label="Content"><Input value={ag.content} onChange={(e) => setAg({ ...ag, content: e.target.value })} /></Field>
              <Field label="Document URL" hint="Optional link until the vault is connected"><Input value={ag.documentUrl} onChange={(e) => setAg({ ...ag, documentUrl: e.target.value })} /></Field>
              <ProvisionPanel title="Upload signed PDF" description="File upload to Azure Blob will be enabled when the document vault is connected.">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <DisabledField label="PDF file" type="file" />
                  <DisabledAction label="Upload to vault" />
                </div>
              </ProvisionPanel>
              <Button type="submit">Issue</Button>
            </form>
          </FormPanel>
          <DataTable>
            <Table>
              <TableHead><TableHeaderCell>Rider</TableHeaderCell><TableHeaderCell>Type</TableHeaderCell><TableHeaderCell>Status</TableHeaderCell><TableHeaderCell /></TableHead>
              <TableBody>
                {agreements.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.riderName}</TableCell>
                    <TableCell>{a.type}</TableCell>
                    <TableCell><Badge status={a.status} /></TableCell>
                    <TableCell>
                      {a.status !== "Signed" && (
                        <Button variant="ghost" className="text-xs" type="button" onClick={async () => { await api.signAgreement(a.id); reload(); }}>Mark signed</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataTable>
        </>
      )}
    </div>
  );
}
