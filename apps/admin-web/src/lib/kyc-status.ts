function normalizeDocStatus(status: string): string {
  const value = String(status ?? "").replace(/[\s_-]/g, "").toLowerCase();
  if (["approved", "approve", "accepted", "verified", "success"].includes(value)) return "Approved";
  if (["pending", "submitted", "underreview", "inreview", "uploaded", "review"].includes(value)) return "Pending";
  if (["rejected", "reject", "declined", "failed"].includes(value)) return "Rejected";
  return String(status ?? "");
}

export function kycStatusFromSubmissions(
  submissions: Array<{ documentType?: string; status: string }> | undefined,
  fallback = "NotSubmitted",
): string {
  if (!submissions?.length) return fallback;
  const latestByType = new Map<string, string>();
  for (const item of submissions) {
    const type = item.documentType || "_doc";
    if (!latestByType.has(type)) latestByType.set(type, normalizeDocStatus(item.status));
  }
  const latest = [...latestByType.values()];
  if (latest.some((status) => status === "Pending")) return "Pending";
  if (latest.length && latest.every((status) => status === "Approved")) return "Approved";
  if (latest.some((status) => status === "Rejected")) return "Rejected";
  if (latest.some((status) => status === "Approved")) return "UnderReview";
  return fallback;
}
