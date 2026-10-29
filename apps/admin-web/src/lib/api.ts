export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.trim() ||
  (typeof window === "undefined" ? "http://127.0.0.1:4000/api/v1" : "/api-proxy/v1");

async function parseError(res: Response) {
  const data = await res.json().catch(() => ({}));
  const message = Array.isArray(data.message) ? data.message.join(", ") : data.message;
  return message ?? `API error: ${res.status}`;
}

function handleUnauthorized() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("adminToken");
  localStorage.removeItem("adminUser");
  if (!window.location.pathname.startsWith("/login")) window.location.replace("/login");
}

async function request<T>(path: string, options: RequestInit = {}, opts?: { public?: boolean }): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("adminToken") : null;
  const tenantId = typeof window !== "undefined" ? localStorage.getItem("adminTenantId") : null;
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && !opts?.public ? { Authorization: `Bearer ${token}` } : {}),
      ...(!opts?.public && tenantId ? { "X-Tenant-Id": tenantId } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401 && !opts?.public) {
    const path = typeof window !== "undefined" ? window.location.pathname : "";
    if (!path.startsWith("/login")) handleUnauthorized();
    throw new Error("Session expired. Please sign in again.");
  }
  if (!res.ok) throw new Error(await parseError(res));
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  tenants: () => request<{ items: TenantOrg[] }>("/admin/tenants"),
  publicTenants: () => request<{ items: TenantOrg[] }>("/tenants/current", {}, { public: true }),
  createTenant: (data: { name: string; slug: string; contactEmail?: string; notes?: string }) =>
    request<TenantOrg>("/admin/tenants", { method: "POST", body: JSON.stringify(data) }),
  updateTenant: (id: string, data: { name?: string; contactEmail?: string; status?: string; notes?: string }) =>
    request<TenantOrg>(`/admin/tenants/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTenant: (id: string) => request<{ deleted: boolean }>(`/admin/tenants/${id}`, { method: "DELETE" }),
  adminUsers: () => request<{ items: AdminUser[] }>("/admin/users"),
  createAdminUser: (data: CreateAdminUser) =>
    request<AdminUser>("/admin/users", { method: "POST", body: JSON.stringify(data) }),
  updateAdminUser: (id: string, data: UpdateAdminUser) =>
    request<AdminUser>(`/admin/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteAdminUser: (id: string) => request<{ deleted: boolean }>(`/admin/users/${id}`, { method: "DELETE" }),
  dashboard: () => request<DashboardSnapshot>("/admin/dashboard"),
  publicBranding: (tenantSlug?: string) =>
    request<Branding>(
      tenantSlug ? `/branding?slug=${encodeURIComponent(tenantSlug)}` : "/branding",
      { headers: tenantSlug ? { "X-Tenant-Slug": tenantSlug } : {} },
      { public: true },
    ),
  getBranding: (tenantId?: string) =>
    request<Branding>("/admin/branding", { headers: tenantId ? { "X-Tenant-Id": tenantId } : {} }),
  updateBranding: (data: { productName?: string; optionalLogoDataUrl?: string | null; clearOptionalLogo?: boolean }, tenantId?: string) =>
    request<Branding>("/admin/branding", {
      method: "PUT",
      body: JSON.stringify(data),
      headers: tenantId ? { "X-Tenant-Id": tenantId } : {},
    }),
  riders: (params?: { search?: string; kycStatus?: string; accountStatus?: string; page?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set("search", params.search);
    if (params?.kycStatus) q.set("kycStatus", params.kycStatus);
    if (params?.accountStatus) q.set("accountStatus", params.accountStatus);
    if (params?.page) q.set("page", String(params.page));
    return request<{ items: Rider[]; totalCount: number }>(`/admin/riders?${q}`);
  },
  riderProfile: (id: string) => request<RiderProfile>(`/admin/riders/${id}`),
  createRider: (data: CreateCustomer) =>
    request<Rider>("/admin/riders", { method: "POST", body: JSON.stringify(data) }),
  updateRider: (id: string, data: UpdateCustomer) =>
    request<Rider>(`/admin/riders/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteRider: (id: string) => request<{ deleted: boolean }>(`/admin/riders/${id}`, { method: "DELETE" }),
  assignRiderPlan: (id: string, rentalPlanId: string) =>
    request<RiderProfile>(`/admin/riders/${id}/plan`, { method: "POST", body: JSON.stringify({ rentalPlanId }) }),
  uploadRiderKyc: (id: string, data: { documentType: string; documentNumber?: string; blobUrl?: string }) =>
    request<{ id: string; documentType: string; status: string }>(`/admin/riders/${id}/kyc`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  rentalPlans: () => request<{ items: RentalPlan[] }>("/admin/riders/plans"),
  auditLogs: (params?: { entityType?: string; from?: string; to?: string; page?: number }) => {
    const q = new URLSearchParams();
    if (params?.entityType) q.set("entityType", params.entityType);
    if (params?.from) q.set("from", params.from);
    if (params?.to) q.set("to", params.to);
    if (params?.page) q.set("page", String(params.page));
    return request<{ items: AuditLog[]; totalCount: number }>(`/admin/audit?${q}`);
  },
  customers: (params?: { search?: string; kycStatus?: string; page?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set("search", params.search);
    if (params?.kycStatus) q.set("kycStatus", params.kycStatus);
    if (params?.page) q.set("page", String(params.page));
    return request<{ items: Customer[]; totalCount: number }>(`/admin/customers?${q}`);
  },
  createCustomer: (data: CreateCustomer) =>
    request<Customer>("/admin/customers", { method: "POST", body: JSON.stringify(data) }),
  updateCustomer: (id: string, data: UpdateCustomer) =>
    request<Customer>(`/admin/customers/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  reviewKyc: (customerId: string, action: "Approve" | "Reject", reason?: string) =>
    request(`/admin/customers/${customerId}/kyc/review`, {
      method: "POST",
      body: JSON.stringify({ action, reason }),
    }),
  hubs: () => request<{ items: Hub[] }>("/admin/hubs"),
  createHub: (data: CreateHub) =>
    request<Hub>("/admin/hubs", { method: "POST", body: JSON.stringify(data) }),
  deleteHub: (id: string) => request<{ deleted: boolean }>(`/admin/hubs/${id}`, { method: "DELETE" }),
  updateHub: (id: string, data: UpdateHub) =>
    request<Hub>(`/admin/hubs/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  vehicles: (params?: { status?: string; hubId?: string; search?: string; availability?: string; page?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.hubId) q.set("hubId", params.hubId);
    if (params?.search) q.set("search", params.search);
    if (params?.availability) q.set("availability", params.availability);
    if (params?.page) q.set("page", String(params.page));
    return request<{ items: Vehicle[]; totalCount: number }>(`/admin/vehicles?${q}`);
  },
  vehicleDetail: (id: string) => request<VehicleDetail>(`/admin/vehicles/${id}`),
  createVehicle: (data: CreateVehicle) =>
    request<Vehicle>("/admin/vehicles", { method: "POST", body: JSON.stringify(data) }),
  updateVehicle: (id: string, data: UpdateVehicle) =>
    request<Vehicle>(`/admin/vehicles/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteVehicle: (id: string) => request<{ deleted: boolean }>(`/admin/vehicles/${id}`, { method: "DELETE" }),
  updateVehicleStatus: (vehicleId: string, status: string, reason?: string) =>
    request<Vehicle>(`/admin/vehicles/${vehicleId}/status`, { method: "POST", body: JSON.stringify({ status, reason }) }),
  assignVehicle: (vehicleId: string, data: { riderId: string; override?: boolean; reason?: string }) =>
    request<VehicleDetail>(`/admin/vehicles/${vehicleId}/assign`, { method: "POST", body: JSON.stringify(data) }),
  unassignVehicle: (vehicleId: string, reason?: string) =>
    request<VehicleDetail>(`/admin/vehicles/${vehicleId}/unassign`, { method: "POST", body: JSON.stringify({ reason }) }),
  bookings: (status?: string) =>
    request<{ items: Booking[]; totalCount: number }>(`/admin/bookings${status ? `?status=${status}` : ""}`),
  activeRides: () => request<{ items: Ride[] }>("/admin/rides/active"),
  promotions: () => request<{ items: Promotion[] }>("/admin/promotions"),
  createPromotion: (data: CreatePromotion) =>
    request<Promotion>("/admin/promotions", { method: "POST", body: JSON.stringify(data) }),
  updatePromotion: (id: string, data: UpdatePromotion) =>
    request<Promotion>(`/admin/promotions/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deletePromotion: (id: string) => request<{ deleted: boolean }>(`/admin/promotions/${id}`, { method: "DELETE" }),
  reportSummary: (from: string, to: string) =>
    request<ReportSummary>(`/admin/reports/summary?from=${from}&to=${to}`),
  reconciliation: (from: string, to: string) =>
    request<FinanceReconciliation>(`/admin/finance/reconciliation?from=${from}&to=${to}`),
  geoSearch: (q: string) =>
    request<{ items: { display_name: string; lat: string; lon: string }[] }>(`/geo/search?q=${encodeURIComponent(q)}`).then((r) => r.items),
  geoReverse: (lat: number, lng: number) =>
    request<{ display_name?: string; source?: string } | null>(`/geo/reverse?lat=${lat}&lng=${lng}`),
  geoStatus: () => request<{ ok: boolean; url: string; error?: string; status?: string }>("/geo/status"),
  iotDevices: () => request<{ items: IoTDevice[]; sync?: { at: string; ok: boolean; synced: number; message: string } | null }>("/admin/iot/devices"),
  syncIotDevices: (tenantId?: string) =>
    request<{ synced: number; linked: number; created?: number; message: string }>(
      `/admin/iot/devices/sync${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ""}`,
      { method: "POST" },
    ),
  createIoTDevice: (data: CreateIoTDevice) =>
    request("/admin/iot/devices", { method: "POST", body: JSON.stringify(data) }),
  importIotDevices: (data: { tenantId?: string; vendorType?: string; items: unknown }) =>
    request<{ synced: number; created: number; linked: number; failed: number; message: string }>(
      "/admin/iot/devices/import",
      { method: "POST", body: JSON.stringify(data) },
    ),
  updateIoTDevice: (deviceId: string, data: UpdateIoTDevice) =>
    request(`/admin/iot/devices/${deviceId}`, { method: "PUT", body: JSON.stringify(data) }),
  sendIoTCommand: (deviceId: string, command: string) =>
    request(`/admin/iot/devices/${deviceId}/command`, {
      method: "POST",
      body: JSON.stringify({ command }),
    }),
  linkIoTDevice: (deviceId: string, vehicleId: string) =>
    request(`/admin/iot/devices/${deviceId}/link`, {
      method: "POST",
      body: JSON.stringify({ vehicleId }),
    }),
  unlinkIoTDevice: (deviceId: string) =>
    request(`/admin/iot/devices/${deviceId}/link`, { method: "DELETE" }),
  deleteIoTDevice: (deviceId: string) =>
    request<{ deleted: boolean }>(`/admin/iot/devices/${deviceId}`, { method: "DELETE" }),
  payments: (params?: { status?: string; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.search) q.set("search", params.search);
    return request<{ items: AdminPayment[] }>(`/admin/payments?${q}`);
  },
  refundPayment: (id: string, reason: string) =>
    request(`/admin/payments/${id}/refund`, { method: "POST", body: JSON.stringify({ reason }) }),
  paymentGateway: (tenantId?: string) =>
    request<{ tenantId: string; tenantName?: string; tenantSlug?: string; providers: string[]; config: PaymentGatewayConfig }>(
      `/admin/payments/gateway${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ""}`,
    ),
  paymentGateways: () =>
    request<{ items: { tenantId: string; tenantName: string; tenantSlug: string; provider: string | null; mode: string | null; enabled: boolean; methods: string[] }[] }>(
      "/admin/payments/gateways",
    ),
  savePaymentGateway: (data: Partial<PaymentGatewayConfig> & { provider: string; tenantId?: string; keySecret?: string; webhookSecret?: string }) =>
    request<PaymentGatewayConfig>("/admin/payments/gateway", { method: "PUT", body: JSON.stringify(data) }),
  gpsIntegration: (tenantId?: string) =>
    request<{
      tenantId: string;
      tenantName?: string;
      tenantSlug?: string;
      providers: string[];
      ingestUrl?: string;
      integrations?: GpsIntegrationConfig[];
      config: GpsIntegrationConfig;
    }>(`/admin/iot/gps-integration${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ""}`),
  gpsIntegrations: () =>
    request<{
      items: {
        tenantId: string;
        tenantName: string;
        tenantSlug: string;
        provider: string | null;
        enabled: boolean;
        usernameSet?: boolean;
        lastSyncAt?: string;
        lastSyncOk?: boolean;
        lastSyncMessage?: string;
        lastSyncedCount?: number;
      }[];
    }>("/admin/iot/gps-integrations"),
  saveGpsIntegration: (data: Partial<GpsIntegrationConfig> & { provider: string; tenantId?: string; password?: string; apiToken?: string }) =>
    request<GpsIntegrationConfig & { ingestKeyOnce?: string }>("/admin/iot/gps-integration", { method: "PUT", body: JSON.stringify(data) }),
  wallets: (search?: string) =>
    request<{ items: Rider[] }>(`/admin/wallets${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  adjustWallet: (riderId: string, data: { type: "Credit" | "Debit"; amount: number; note: string; reference?: string }) =>
    request(`/admin/riders/${riderId}/wallet`, { method: "POST", body: JSON.stringify(data) }),
  plans: () => request<{ items: RentalPlan[] }>("/admin/plans"),
  createPlan: (data: CreateRentalPlan) =>
    request<RentalPlan>("/admin/plans", { method: "POST", body: JSON.stringify(data) }),
  updatePlan: (id: string, data: Partial<CreateRentalPlan> & { isActive?: boolean }) =>
    request<RentalPlan>(`/admin/plans/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deletePlan: (id: string) => request<{ deleted: boolean }>(`/admin/plans/${id}`, { method: "DELETE" }),
  kycSubmissions: (status?: string) =>
    request<{ items: KycDocument[] }>(`/admin/kyc/submissions${status ? `?status=${status}` : ""}`),
  reviewKycDocument: (id: string, action: "Approve" | "Reject", reason?: string) =>
    request(`/admin/kyc/submissions/${id}/review`, { method: "POST", body: JSON.stringify({ action, reason }) }),
  breakdowns: (status?: string) =>
    request<{ items: Breakdown[] }>(`/admin/breakdowns${status ? `?status=${status}` : ""}`),
  breakdown: (id: string) => request<Breakdown>(`/admin/breakdowns/${id}`),
  createBreakdown: (data: CreateBreakdown) =>
    request<Breakdown>("/admin/breakdowns", { method: "POST", body: JSON.stringify(data) }),
  breakdownAction: (id: string, action: "assign" | "progress" | "escalate" | "close", data: { note: string; assignedTo?: string; escalatedTo?: string }) =>
    request<Breakdown>(`/admin/breakdowns/${id}/${action}`, { method: "POST", body: JSON.stringify(data) }),
  serviceCentres: () => request<{ items: ServiceCentre[] }>("/admin/service-centres"),
  createServiceCentre: (data: CreateServiceCentre) =>
    request<ServiceCentre>("/admin/service-centres", { method: "POST", body: JSON.stringify(data) }),
  updateServiceCentre: (id: string, data: Partial<CreateServiceCentre> & { isActive?: boolean }) =>
    request<ServiceCentre>(`/admin/service-centres/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteServiceCentre: (id: string) =>
    request<{ deleted: boolean }>(`/admin/service-centres/${id}`, { method: "DELETE" }),
  serviceSlots: (params?: { centreId?: string; date?: string }) => {
    const q = new URLSearchParams();
    if (params?.centreId) q.set("centreId", params.centreId);
    if (params?.date) q.set("date", params.date);
    return request<{ items: ServiceSlot[] }>(`/admin/service-slots?${q}`);
  },
  createServiceSlot: (data: CreateServiceSlot) =>
    request<ServiceSlot>("/admin/service-slots", { method: "POST", body: JSON.stringify(data) }),
  serviceRequests: (status?: string) =>
    request<{ items: ServiceRequestItem[] }>(`/admin/service-requests${status ? `?status=${status}` : ""}`),
  createServiceRequest: (data: CreateServiceRequest) =>
    request<ServiceRequestItem>("/admin/service-requests", { method: "POST", body: JSON.stringify(data) }),
  updateServiceRequest: (id: string, data: { status?: string; assignedTo?: string; progressNote?: string; completionNote?: string }) =>
    request<ServiceRequestItem>(`/admin/service-requests/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  appointments: (status?: string) =>
    request<{ items: Appointment[] }>(`/admin/appointments${status ? `?status=${status}` : ""}`),
  createAppointment: (data: CreateAppointment) =>
    request<Appointment>("/admin/appointments", { method: "POST", body: JSON.stringify(data) }),
  rescheduleAppointment: (id: string, slotId: string, notes?: string) =>
    request<Appointment>(`/admin/appointments/${id}/reschedule`, { method: "POST", body: JSON.stringify({ slotId, notes }) }),
  cancelAppointment: (id: string, reason: string) =>
    request<Appointment>(`/admin/appointments/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) }),
  completeAppointment: (id: string) =>
    request<Appointment>(`/admin/appointments/${id}/complete`, { method: "POST" }),
  chargingStations: () => request<{ items: ChargingStation[] }>("/admin/charging-stations"),
  createChargingStation: (data: CreateChargingStation) =>
    request<ChargingStation>("/admin/charging-stations", { method: "POST", body: JSON.stringify(data) }),
  updateChargingStation: (id: string, data: Partial<CreateChargingStation> & { status?: string }) =>
    request<ChargingStation>(`/admin/charging-stations/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteChargingStation: (id: string) =>
    request<{ deleted: boolean }>(`/admin/charging-stations/${id}`, { method: "DELETE" }),
  notifications: () => request<{ items: AppNotice[] }>("/admin/notifications"),
  sendNotification: (data: { title: string; body: string; audience: string }) =>
    request("/admin/notifications", { method: "POST", body: JSON.stringify(data) }),
  feedback: () => request<{ items: FeedbackItem[] }>("/admin/feedback"),
  createFeedback: (data: { riderId: string; rating: number; comment: string; category?: string }) =>
    request("/admin/feedback", { method: "POST", body: JSON.stringify(data) }),
  agreements: (riderId?: string) =>
    request<{ items: AgreementItem[] }>(`/admin/agreements${riderId ? `?riderId=${riderId}` : ""}`),
  issueAgreement: (data: { riderId: string; type: string; content: string; documentUrl?: string }) =>
    request("/admin/agreements", { method: "POST", body: JSON.stringify(data) }),
  signAgreement: (id: string) =>
    request(`/admin/agreements/${id}/sign`, { method: "POST" }),
  referrals: () => request<{ items: ReferralItem[] }>("/admin/referrals"),
  applyReferral: (riderId: string, code: string) =>
    request("/admin/referrals/apply", { method: "POST", body: JSON.stringify({ riderId, code }) }),
  supportTickets: (status?: string) =>
    request<{ items: SupportTicket[] }>(`/admin/support/tickets${status ? `?status=${status}` : ""}`),
  createSupportTicket: (data: { riderId: string; category: string; subject: string; description: string }) =>
    request("/admin/support/tickets", { method: "POST", body: JSON.stringify(data) }),
  updateSupportTicket: (id: string, data: { status?: string; assignedTo?: string; note?: string }) =>
    request(`/admin/support/tickets/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  reportExport: (from: string, to: string) =>
    request<{ csv: string; fileName: string }>(`/admin/reports/export?from=${from}&to=${to}`),
};

export interface TenantOrg {
  id: string;
  slug: string;
  name: string;
  contactEmail?: string;
  status: string;
  isDefault?: boolean;
  kind?: "Parent" | "Tenant";
  notes?: string;
  logoUrl?: string | null;
}

export interface GpsIntegrationConfig {
  tenantId: string;
  provider: string;
  enabled: boolean;
  displayName?: string;
  username?: string;
  passwordSet?: boolean;
  passwordMasked?: string | null;
  pullUrl?: string;
  authType?: string;
  apiTokenSet?: boolean;
  ingestKeySet?: boolean;
  ingestKeyMasked?: string | null;
  headerName?: string;
  lastSyncAt?: string;
  lastSyncOk?: boolean;
  lastSyncMessage?: string;
  lastSyncedCount?: number;
}

export interface PaymentGatewayConfig {
  tenantId: string;
  provider: string;
  mode: "Test" | "Live";
  enabled: boolean;
  displayName?: string;
  merchantId?: string;
  keyId?: string;
  keySecretSet?: boolean;
  keySecretMasked?: string;
  webhookSecretSet?: boolean;
  webhookSecretMasked?: string;
  methods: string[];
  checkoutUrl?: string;
  notes?: string;
}

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isActive?: boolean;
  tenantId?: string;
  hubIds?: string[];
  tenantName?: string;
  createdAt?: string;
}

export interface CreateAdminUser {
  email: string;
  password: string;
  fullName: string;
  role: string;
  tenantId?: string;
  hubIds?: string[];
}

export interface UpdateAdminUser {
  fullName?: string;
  role?: string;
  password?: string;
  isActive?: boolean;
  tenantId?: string;
  hubIds?: string[];
}

export interface UpdateCustomer {
  phone?: string;
  fullName?: string;
  email?: string;
  accountStatus?: string;
  forceUnassign?: boolean;
}

export interface UpdateHub {
  name?: string;
  location?: { lat: number; lng: number };
  address?: string;
  capacity?: number;
  operatingHours?: string;
  geoFenceRadiusM?: number;
  status?: string;
}

export interface UpdateVehicle {
  registrationNumber?: string;
  type?: string;
  wheelClass?: string;
  hubId?: string;
  model?: string;
  iotDeviceId?: string | null;
  status?: string;
  notes?: string;
}

export interface UpdateIoTDevice {
  vendorType?: string;
  vehicleId?: string | null;
}

export interface UpdatePromotion {
  description?: string;
  discountType?: string;
  discountValue?: number;
  validFrom?: string;
  validTo?: string;
  maxUses?: number;
  isActive?: boolean;
}

export interface CreateCustomer {
  phone: string;
  fullName: string;
  email?: string;
  tenantId?: string;
}

export interface Customer {
  id: string;
  phone: string;
  email?: string;
  fullName?: string;
  kycStatus: string;
  accountStatus: string;
  createdAt: string;
}

export interface Rider extends Customer {
  assignedVehicleId?: string;
  rentalPlanId?: string;
  walletBalance: number;
  referralCode?: string;
  referredBy?: string;
  tenantId?: string;
}

export interface RentalPlan {
  id: string;
  name: string;
  charges: number;
  durationDays: number;
  billingFrequency: string;
  eligibility?: string;
  terms?: string;
  isActive: boolean;
  tenantId?: string;
}

export interface RiderProfile {
  rider: Rider;
  assignedVehicle: {
    id: string;
    registrationNumber: string;
    model: string;
    type: string;
    status: string;
    batteryPercent: number;
    hubId: string;
  } | null;
  rentalPlan: RentalPlan | null;
  wallet: {
    balance: number;
    transactions: { id: string; type: string; amount: number; reference?: string; note?: string; balanceAfter: number; createdAt?: string }[];
  };
  payments: { id: string; bookingId: string; amount: number; currency: string; status: string; method?: string; createdAt?: string }[];
  rentalActivity: {
    bookings: { id: string; vehicleId: string; bookingType: string; status: string; estimatedAmount: number; createdAt?: string }[];
    rides: { id: string; vehicleId: string; status: string; startedAt?: string; endedAt?: string; durationMinutes?: number }[];
  };
  kyc: {
    status: string;
    submissions: { id: string; documentType: string; status: string; documentNumberMasked?: string; blobUrl?: string; rejectionReason?: string; submittedAt?: string; reviewedAt?: string }[];
  };
}

export interface DashboardSnapshot {
  riders: { total: number; active: number; inactive: number; suspended: number; deactivated: number };
  vehicles: { total: number; byStatus: Record<string, number> };
  outstandingPayments: { count: number; amount: number };
  kyc: Record<string, number>;
  upcomingModules: {
    serviceRequests: { count: number; operational: boolean };
    breakdownAlerts: { count: number; operational: boolean };
    chargingStations: { count: number; operational: boolean };
  };
  last30Days: { totalRides: number; totalRevenue: number };
  recentRiders: { id: string; fullName?: string; phone?: string; accountStatus: string; kycStatus: string; createdAt?: string }[];
  vehiclesNeedingAttention: { id: string; registrationNumber: string; status: string; batteryPercent: number; assignedRiderId?: string }[];
  activeRideVehicles: ActiveRideVehicle[];
  locatedVehicles: LocatedVehicle[];
}

export interface Branding {
  productName: string;
  companyName?: string | null;
  companyId?: string | null;
  companySlug?: string | null;
  hasOptionalLogo: boolean;
  optionalLogoCleared?: boolean;
  optionalLogoUrl: string | null;
  optionalLogoDataUrl?: string | null;
}

export interface LocationPing {
  lat: number;
  lng: number;
  at?: string;
}

export interface LocatedVehicle {
  id: string;
  rideId?: string;
  registrationNumber: string;
  type?: string;
  wheelClass?: string;
  status?: string;
  lastPlace?: string | null;
  lastPlaceKind?: string;
  lastLocation?: { lat: number; lng: number } | null;
  lastTelemetryAt?: string;
}

export interface ActiveRideVehicle {
  id: string;
  rideId?: string;
  registrationNumber: string;
  type?: string;
  wheelClass?: string;
  batteryPercent?: number;
  riderName?: string;
  riderPhone?: string;
  lastPlace?: string | null;
  lastPlaceKind?: string;
  lastLocation?: { lat: number; lng: number } | null;
  lastTelemetryAt?: string;
  locationTrail?: LocationPing[];
}

export interface AuditLog {
  id: string;
  actorId?: string;
  actorEmail?: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  createdAt: string;
}

export interface VehicleDetail {
  vehicle: Vehicle;
  assignedRider: { id: string; fullName?: string; phone?: string; accountStatus: string; kycStatus: string } | null;
  hub: { id: string; name: string; address: string; status: string } | null;
  events: { id: string; type: string; summary: string; reason?: string; actorEmail?: string; createdAt?: string }[];
}

export interface Hub {
  id: string;
  name: string;
  location: { lat: number; lng: number };
  address: string;
  capacity: number;
  availableVehicles: number;
  status: string;
  tenantId?: string;
}

export interface CreateHub {
  name: string;
  location: { lat: number; lng: number };
  address: string;
  capacity: number;
  operatingHours?: string;
  geoFenceRadiusM?: number;
  tenantId?: string;
}

export interface Vehicle {
  id: string;
  registrationNumber: string;
  type: string;
  wheelClass?: string;
  status: string;
  batteryPercent: number;
  model: string;
  hubId: string;
  odometerKm?: number;
  iotDeviceId?: string;
  lastLat?: number;
  lastLng?: number;
  lastTelemetryAt?: string;
  lastPlace?: string;
  lastPlaceKind?: string;
  lastHubId?: string;
  locationTrail?: LocationPing[];
  assignedRiderId?: string;
  assignedRiderName?: string;
  assignedRiderPhone?: string;
  notes?: string;
  tenantId?: string;
}

export interface CreateVehicle {
  registrationNumber: string;
  type: string;
  wheelClass?: string;
  hubId: string;
  model: string;
  iotDeviceId?: string;
  notes?: string;
  tenantId?: string;
}

export interface CreateIoTDevice {
  deviceId: string;
  vendorType?: string;
  vehicleId?: string;
  tenantId?: string;
  vehicleNumber?: string;
  imei?: string;
}

export interface Booking {
  id: string;
  customerId: string;
  vehicleId: string;
  bookingType: string;
  status: string;
  estimatedAmount: number;
  createdAt: string;
}

export interface Ride {
  id: string;
  bookingId: string;
  vehicleId: string;
  customerId?: string;
  status: string;
  startedAt?: string;
  customerName?: string;
  customerPhone?: string;
  vehicleRegistration?: string;
  vehicleType?: string;
  wheelClass?: string;
  batteryPercent?: number;
  odometerKm?: number;
  speedKmh?: number;
  ignition?: string;
  model?: string;
  vehicleStatus?: string;
  lastPlace?: string | null;
  lastPlaceKind?: string;
  lastLocation?: { lat: number; lng: number } | null;
  lastTelemetryAt?: string;
  locationTrail?: LocationPing[];
}

export interface Promotion {
  id: string;
  code: string;
  description?: string;
  discountType: string;
  discountValue: number;
  isActive: boolean;
  validFrom?: string;
  validTo?: string;
  maxUses?: number;
}

export interface CreatePromotion {
  code: string;
  description?: string;
  discountType: string;
  discountValue: number;
  validFrom: string;
  validTo: string;
  maxUses?: number;
}

export interface ReportSummary {
  totalRides: number;
  totalRevenue: number;
  totalFleet: number;
  availableVehicles: number;
  inRideVehicles: number;
  activeVehicles: number;
  iotLinkedVehicles: number;
  fleetUtilizationPercent: number;
  newCustomers: number;
  averageRideDurationMinutes: number;
}

export interface FinanceReconciliation {
  totalCollected: number;
  totalRefunded: number;
  netRevenue: number;
  gstAmount: number;
  unmatchedPayments: number;
}

export interface IoTDevice {
  id: string;
  vehicleId?: string;
  vehicleRegistration?: string;
  vendorType: string;
  connectionStatus: string;
  lastSeenAt?: string;
  batteryPercent?: number;
  odometerKm?: number;
  lastLocation?: { lat: number; lng: number };
  lastPlace?: string;
  displayName?: string;
  imei?: string;
  externalId?: string;
  speedKmh?: number;
  ignition?: string;
  vendorStatus?: string;
  vehicleStatus?: string;
  tenantId?: string;
}

export interface AdminPayment {
  id: string;
  customerId: string;
  riderName?: string;
  riderPhone?: string;
  bookingId: string;
  amount: number;
  currency: string;
  status: string;
  method?: string;
  reference?: string;
  refundReason?: string;
  createdAt?: string;
}

export interface CreateRentalPlan {
  name: string;
  charges: number;
  durationDays: number;
  billingFrequency: string;
  eligibility?: string;
  terms?: string;
  tenantId?: string;
}

export interface KycDocument {
  id: string;
  riderId: string;
  riderName?: string;
  riderPhone?: string;
  riderKycStatus?: string;
  documentType: string;
  documentNumberMasked?: string;
  blobUrl?: string;
  status: string;
  rejectionReason?: string;
  submittedAt?: string;
}

export interface Breakdown {
  id: string;
  riderId: string;
  riderName?: string;
  riderPhone?: string;
  vehicleId: string;
  vehicleRegistration?: string;
  issueType: string;
  description: string;
  lat?: number;
  lng?: number;
  status: string;
  assignedTo?: string;
  escalatedTo?: string;
  actions: { at: string; actorEmail?: string; note: string }[];
  closeNote?: string;
  createdAt?: string;
  tenantId?: string;
}

export interface CreateBreakdown {
  riderId: string;
  vehicleId: string;
  issueType: string;
  description: string;
  lat?: number;
  lng?: number;
  tenantId?: string;
}

export interface ServiceCentre {
  id: string;
  name: string;
  address: string;
  contactName: string;
  contactPhone: string;
  lat?: number;
  lng?: number;
  isActive: boolean;
}

export interface CreateServiceCentre {
  name: string;
  address: string;
  contactName: string;
  contactPhone: string;
  lat?: number;
  lng?: number;
}

export interface ServiceSlot {
  id: string;
  centreId: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount: number;
  remaining: number;
}

export interface CreateServiceSlot {
  centreId: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
}

export interface ServiceRequestItem {
  id: string;
  riderId: string;
  riderName?: string;
  riderPhone?: string;
  vehicleId?: string;
  category: string;
  description: string;
  status: string;
  assignedTo?: string;
  progressNote?: string;
  completionNote?: string;
  createdAt?: string;
}

export interface CreateServiceRequest {
  riderId: string;
  vehicleId?: string;
  category: string;
  description: string;
}

export interface Appointment {
  id: string;
  riderId: string;
  riderName?: string;
  centreId: string;
  centreName?: string;
  slotId: string;
  slot: ServiceSlot | null;
  status: string;
  notes?: string;
  cancelledReason?: string;
}

export interface CreateAppointment {
  riderId: string;
  centreId: string;
  slotId: string;
  vehicleId?: string;
  serviceRequestId?: string;
  notes?: string;
}

export interface ChargingStation {
  id: string;
  name: string;
  address: string;
  chargerCount: number;
  lat?: number;
  lng?: number;
  operatingHours?: string;
  status: string;
  hubId?: string;
  tenantId?: string;
}

export interface CreateChargingStation {
  name: string;
  address: string;
  chargerCount: number;
  lat?: number;
  lng?: number;
  operatingHours?: string;
  hubId?: string;
  tenantId?: string;
}

export interface AppNotice {
  id: string;
  title: string;
  body: string;
  audience: string;
  channel: string;
  status: string;
  sentAt?: string;
  createdBy?: string;
}

export interface FeedbackItem {
  id: string;
  riderId: string;
  riderName?: string;
  riderPhone?: string;
  rating: number;
  comment: string;
  category: string;
  createdAt?: string;
}

export interface AgreementItem {
  id: string;
  riderId: string;
  riderName?: string;
  type: string;
  content: string;
  documentUrl?: string;
  status: string;
  signedAt?: string;
}

export interface ReferralItem {
  id: string;
  fullName?: string;
  phone?: string;
  referralCode?: string;
  referredCount: number;
}

export interface SupportTicket {
  id: string;
  customerId: string;
  riderName?: string;
  riderPhone?: string;
  category: string;
  subject: string;
  description: string;
  status: string;
  assignedTo?: string;
  notes: { at: string; actorEmail?: string; note: string }[];
  createdAt?: string;
}
