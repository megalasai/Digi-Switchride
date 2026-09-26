const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

async function parseError(res: Response) {
  const data = await res.json().catch(() => ({}));
  const message = Array.isArray(data.message) ? data.message.join(", ") : data.message;
  return message ?? `API error: ${res.status}`;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("adminToken") : null;
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(await parseError(res));
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  adminUsers: () => request<{ items: AdminUser[] }>("/admin/users"),
  createAdminUser: (data: CreateAdminUser) =>
    request<AdminUser>("/admin/users", { method: "POST", body: JSON.stringify(data) }),
  updateAdminUser: (id: string, data: UpdateAdminUser) =>
    request<AdminUser>(`/admin/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),
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
  updateHub: (id: string, data: UpdateHub) =>
    request<Hub>(`/admin/hubs/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  vehicles: () => request<{ items: Vehicle[] }>("/admin/vehicles"),
  createVehicle: (data: CreateVehicle) =>
    request<Vehicle>("/admin/vehicles", { method: "POST", body: JSON.stringify(data) }),
  updateVehicle: (id: string, data: UpdateVehicle) =>
    request<Vehicle>(`/admin/vehicles/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  updateVehicleStatus: (vehicleId: string, status: string) =>
    request<Vehicle>(`/admin/vehicles/${vehicleId}/status`, { method: "POST", body: JSON.stringify({ status }) }),
  bookings: (status?: string) =>
    request<{ items: Booking[]; totalCount: number }>(`/admin/bookings${status ? `?status=${status}` : ""}`),
  activeRides: () => request<{ items: Ride[] }>("/admin/rides/active"),
  promotions: () => request<{ items: Promotion[] }>("/admin/promotions"),
  createPromotion: (data: CreatePromotion) =>
    request<Promotion>("/admin/promotions", { method: "POST", body: JSON.stringify(data) }),
  updatePromotion: (id: string, data: UpdatePromotion) =>
    request<Promotion>(`/admin/promotions/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  reportSummary: (from: string, to: string) =>
    request<ReportSummary>(`/admin/reports/summary?from=${from}&to=${to}`),
  reconciliation: (from: string, to: string) =>
    request<FinanceReconciliation>(`/admin/finance/reconciliation?from=${from}&to=${to}`),
  iotDevices: () => request<{ items: IoTDevice[] }>("/admin/iot/devices"),
  createIoTDevice: (data: CreateIoTDevice) =>
    request("/admin/iot/devices", { method: "POST", body: JSON.stringify(data) }),
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
};

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isActive?: boolean;
  createdAt?: string;
}

export interface CreateAdminUser {
  email: string;
  password: string;
  fullName: string;
  role: string;
}

export interface UpdateAdminUser {
  fullName?: string;
  role?: string;
  password?: string;
  isActive?: boolean;
}

export interface UpdateCustomer {
  phone?: string;
  fullName?: string;
  email?: string;
  accountStatus?: string;
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
  hubId?: string;
  model?: string;
  iotDeviceId?: string | null;
  status?: string;
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

export interface Hub {
  id: string;
  name: string;
  location: { lat: number; lng: number };
  address: string;
  capacity: number;
  availableVehicles: number;
  status: string;
}

export interface CreateHub {
  name: string;
  location: { lat: number; lng: number };
  address: string;
  capacity: number;
  operatingHours?: string;
  geoFenceRadiusM?: number;
}

export interface Vehicle {
  id: string;
  registrationNumber: string;
  type: string;
  status: string;
  batteryPercent: number;
  model: string;
  hubId: string;
  odometerKm?: number;
  iotDeviceId?: string;
  lastLat?: number;
  lastLng?: number;
  lastTelemetryAt?: string;
}

export interface CreateVehicle {
  registrationNumber: string;
  type: string;
  hubId: string;
  model: string;
  iotDeviceId?: string;
}

export interface CreateIoTDevice {
  deviceId: string;
  vendorType?: string;
  vehicleId?: string;
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
  status: string;
  startedAt?: string;
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
}
