"use client";

import { AdminHeader } from "@/components/AdminHeader";
import { Sidebar } from "@/components/Sidebar";
import { useBranding } from "@/components/BrandLogos";
import { AuthGate, useAuth } from "@/lib/auth-context";
import { SidebarUiProvider, useSidebarUi } from "@/lib/sidebar-context";
import { useEffect } from "react";

function BrandingSync({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { reload } = useBranding();
  useEffect(() => {
    reload();
  }, [user?.tenantId, user?.id, reload]);
  return <>{children}</>;
}

function AdminShell({ children }: { children: React.ReactNode }) {
  const { hidden } = useSidebarUi();
  return (
    <div className="flex min-h-screen bg-surface">
      {!hidden ? <Sidebar /> : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader />
        <main className="flex-1 overflow-auto p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <BrandingSync>
        <SidebarUiProvider>
          <AdminShell>{children}</AdminShell>
        </SidebarUiProvider>
      </BrandingSync>
    </AuthGate>
  );
}
