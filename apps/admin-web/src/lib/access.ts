export const ADMIN_ROLES = [
  "SuperAdmin",
  "Administrator",
  "CommandCenter",
  "Finance",
  "Operations",
  "ServiceTeam",
  "KycTeam",
] as const;

export type AdminRoleName = (typeof ADMIN_ROLES)[number];

const LEGACY: Record<string, AdminRoleName> = {
  FleetManager: "Operations",
  SupportAgent: "CommandCenter",
  FinanceAdmin: "Finance",
  KycReviewer: "KycTeam",
};

export function normalizeRole(role?: string | null): AdminRoleName | undefined {
  if (!role) return undefined;
  if ((ADMIN_ROLES as readonly string[]).includes(role)) return role as AdminRoleName;
  return LEGACY[role];
}

export function canAccess(role: string | undefined | null, allowed: AdminRoleName[]) {
  const normalized = normalizeRole(role);
  if (!normalized) return false;
  if (normalized === "SuperAdmin") return true;
  return allowed.includes(normalized);
}

export const ACCESS = {
  dashboard: [...ADMIN_ROLES],
  reports: [...ADMIN_ROLES],
  riders: ["SuperAdmin", "Administrator", "CommandCenter", "Operations", "KycTeam", "Finance"] as AdminRoleName[],
  ridersWrite: ["SuperAdmin", "Administrator", "Operations"] as AdminRoleName[],
  vehicles: ["SuperAdmin", "Administrator", "Operations", "CommandCenter", "ServiceTeam"] as AdminRoleName[],
  track: ["SuperAdmin", "Administrator", "Operations", "CommandCenter", "ServiceTeam"] as AdminRoleName[],
  vehiclesWrite: ["SuperAdmin", "Administrator", "Operations"] as AdminRoleName[],
  hubs: ["SuperAdmin", "Administrator", "Operations", "CommandCenter", "ServiceTeam"] as AdminRoleName[],
  kyc: ["SuperAdmin", "Administrator", "KycTeam"] as AdminRoleName[],
  finance: ["SuperAdmin", "Administrator", "Finance"] as AdminRoleName[],
  plans: ["SuperAdmin", "Administrator", "Operations", "Finance"] as AdminRoleName[],
  plansWrite: ["SuperAdmin", "Administrator"] as AdminRoleName[],
  walletsWrite: ["SuperAdmin", "Administrator", "Finance"] as AdminRoleName[],
  breakdowns: ["SuperAdmin", "Administrator", "CommandCenter", "Operations", "ServiceTeam"] as AdminRoleName[],
  breakdownsWrite: ["SuperAdmin", "Administrator", "CommandCenter"] as AdminRoleName[],
  service: ["SuperAdmin", "Administrator", "CommandCenter", "ServiceTeam", "Operations"] as AdminRoleName[],
  serviceWrite: ["SuperAdmin", "Administrator", "ServiceTeam", "CommandCenter"] as AdminRoleName[],
  users: ["SuperAdmin", "Administrator"] as AdminRoleName[],
  audit: ["SuperAdmin", "Administrator"] as AdminRoleName[],
  support: ["SuperAdmin", "Administrator", "CommandCenter"] as AdminRoleName[],
  promotions: ["SuperAdmin", "Administrator", "Finance"] as AdminRoleName[],
  iot: ["SuperAdmin", "Administrator", "Operations"] as AdminRoleName[],
  bookings: ["SuperAdmin", "Administrator", "Operations", "CommandCenter"] as AdminRoleName[],
  stations: ["SuperAdmin", "Administrator", "Operations", "CommandCenter", "ServiceTeam"] as AdminRoleName[],
  stationsWrite: ["SuperAdmin", "Administrator", "Operations"] as AdminRoleName[],
  engagement: ["SuperAdmin", "Administrator", "CommandCenter", "Operations", "Finance"] as AdminRoleName[],
  integrations: ["SuperAdmin", "Administrator"] as AdminRoleName[],
  branding: ["SuperAdmin", "Administrator"] as AdminRoleName[],
  tenants: ["SuperAdmin"] as AdminRoleName[],
};
