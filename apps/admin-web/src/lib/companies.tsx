"use client";

import { useEffect, useState } from "react";
import { Field, Select } from "@/components/ui/Input";
import { api, TenantOrg } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export function useCompanies() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<TenantOrg[]>([]);
  const isSuper = user?.role === "SuperAdmin";

  useEffect(() => {
    if (isSuper) {
      api.tenants().then((r) => setCompanies(r.items)).catch(() => setCompanies([]));
    } else {
      api.publicTenants().then((r) => setCompanies(r.items)).catch(() => setCompanies([]));
    }
  }, [isSuper]);

  const workingId =
    (typeof window !== "undefined" ? localStorage.getItem("adminTenantId") : null) || user?.tenantId || "";
  const nameOf = (id?: string | null) => companies.find((c) => c.id === id)?.name ?? "";
  const customers = companies.filter((c) => c.kind !== "Parent");
  const workingName = isSuper
    ? nameOf(workingId) || (workingId ? "" : "All companies")
    : user?.tenantName || nameOf(user?.tenantId) || nameOf(workingId);

  return { companies: customers, allCompanies: companies, isSuper, workingId, workingName, nameOf };
}

export function CompanyField({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const { companies, isSuper, workingId } = useCompanies();
  useEffect(() => {
    if (isSuper && !value && workingId) onChange(workingId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuper, workingId]);
  if (!isSuper) return null;
  return (
    <Field label="Company">
      <Select value={value} onChange={(e) => onChange(e.target.value)} required>
        <option value="">Select company</option>
        {companies.filter((c) => c.kind !== "Parent").map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </Select>
    </Field>
  );
}

export function CompanyCell({ tenantId }: { tenantId?: string }) {
  const { isSuper, nameOf } = useCompanies();
  if (!isSuper) return null;
  return <span className="text-xs text-text-muted">{nameOf(tenantId) || "—"}</span>;
}
