"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "@/lib/api";

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  tenantId?: string;
  hubIds?: string[];
  tenantName?: string;
}

interface AuthContextValue {
  user: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string, tenantSlug?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    const stored = localStorage.getItem("adminUser");
    if (token && stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem("adminToken");
        localStorage.removeItem("adminUser");
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string, tenantSlug?: string) => {
    let res: Response;
    try {
      res = await fetch(`${API_BASE}/auth/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password, tenantSlug: tenantSlug || undefined }),
      });
    } catch {
      throw new Error("Cannot reach the API. Start it with npm run dev:api (port 4000), then refresh this page.");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(Array.isArray(data.message) ? data.message.join(", ") : data.message ?? "Login failed");
    }
    if (!data.accessToken || !data.user) {
      throw new Error("Login succeeded but the API did not return a session. Restart the API and try again.");
    }
    localStorage.setItem("adminToken", data.accessToken);
    localStorage.setItem("adminUser", JSON.stringify(data.user));
    if (data.user?.tenantId && data.user.role !== "SuperAdmin") {
      localStorage.setItem("adminTenantId", data.user.tenantId);
    }
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminUser");
    localStorage.removeItem("adminTenantId");
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-text-secondary">
        Loading…
      </div>
    );
  }
  if (!user) return null;
  return <>{children}</>;
}
