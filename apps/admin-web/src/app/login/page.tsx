"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProductBrand, TenantLogo } from "@/components/BrandLogos";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import { useAuth } from "@/lib/auth-context";
import { api, Branding, TenantOrg } from "@/lib/api";
import { validateEmail, validatePassword } from "@/lib/validation";

export default function LoginPage() {
  const { login, user } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("admin@digiswitchride.com");
  const [password, setPassword] = useState("Admin@123");
  const [tenantSlug, setTenantSlug] = useState("");
  const [orgs, setOrgs] = useState<TenantOrg[]>([]);
  const [orgBranding, setOrgBranding] = useState<Branding | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);

  useEffect(() => {
    api.publicTenants()
      .then((r) => setOrgs(r.items))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!tenantSlug) {
      setOrgBranding(null);
      return;
    }
    api.publicBranding(tenantSlug).then(setOrgBranding).catch(() => setOrgBranding(null));
  }, [tenantSlug]);

  if (user) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailError = validateEmail(email, true);
    const passwordError = validatePassword(password, true);
    if (emailError || passwordError) {
      setError(emailError || passwordError);
      return;
    }
    setError("");
    setLoading(true);
    try {
      await login(email, password, tenantSlug || undefined);
      const org = orgs.find((o) => o.slug === tenantSlug);
      if (org) localStorage.setItem("adminTenantId", org.id);
      else localStorage.removeItem("adminTenantId");
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-[#171a2b] lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(91,124,250,0.55),transparent_42%),radial-gradient(circle_at_90%_90%,rgba(46,144,250,0.22),transparent_38%)]" />
        <div className="relative">
          <ProductBrand variant="dark" size="lg" />
          <h1 className="mt-8 max-w-sm text-4xl font-semibold tracking-tight text-white">Clear, calm control for electric fleets.</h1>
          <p className="mt-4 max-w-md text-sm leading-6 text-[#c5cffc]">Riders, vehicles, payments and workshops in one operations desk.</p>
        </div>
        <div className="relative">
          <p className="text-xs text-[#9aa3bc]">Digi-Switchride · Fleetel</p>
        </div>
      </div>
      <div className="flex items-center justify-center bg-surface p-6">
        <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4 rounded-3xl border border-border bg-white p-8 shadow-[0_24px_70px_rgba(22,25,43,0.08)]" noValidate>
          <div className="mb-2 space-y-4">
            <div className="lg:hidden">
              <ProductBrand variant="light" size="md" />
            </div>
            {tenantSlug ? (
              <>
                <p className="text-lg font-semibold text-text-primary">{orgs.find((o) => o.slug === tenantSlug)?.name}</p>
                <TenantLogo branding={orgBranding} size="md" />
              </>
            ) : null}
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Operations portal</p>
              <h2 className="mt-2 text-2xl font-semibold text-text-primary">Sign in</h2>
            </div>
          </div>
          <Field label="Organization">
            <Select value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value)}>
              <option value="">Fleetel SuperAdmin — parent company</option>
              {orgs.map((org) => (
                <option key={org.id} value={org.slug}>{org.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
          </Field>
          <Field label="Password">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </Field>
          {error && <Alert message={error} />}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-center text-xs text-text-muted">Tenant users pick their company. Fleetel SuperAdmin leaves Organization on the parent option.</p>
        </form>
      </div>
    </div>
  );
}
