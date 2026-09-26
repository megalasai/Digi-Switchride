export type KycStatus = 'NotSubmitted' | 'Pending' | 'UnderReview' | 'Approved' | 'Rejected';
export type AccountStatus = 'Active' | 'Suspended' | 'Deactivated';
export type VehicleType = 'EScooter' | 'EBike' | 'ERickshaw';
export type VehicleStatus = 'Available' | 'Reserved' | 'InRide' | 'Maintenance' | 'Offline';
export type BookingType = 'PerMinute' | 'Hourly' | 'Daily' | 'Weekly' | 'Monthly';
export type BookingStatus = 'Draft' | 'Confirmed' | 'Active' | 'Completed' | 'Cancelled' | 'NoShow';
export type RideStatus = 'NotStarted' | 'InProgress' | 'Ended' | 'ForceEnded';
export type PaymentStatus = 'Created' | 'Paid' | 'Failed' | 'Refunded';
export type HubStatus = 'Active' | 'Inactive' | 'Maintenance';
export type TicketCategory = 'Ride' | 'Payment' | 'KYC' | 'Vehicle' | 'General';
export type TicketStatus = 'Open' | 'InProgress' | 'Resolved' | 'Closed';
export type DiscountType = 'Percentage' | 'FixedAmount';
export type IoTConnectionStatus = 'Connected' | 'Disconnected' | 'Unknown';
export type DeviceCommand = 'Lock' | 'Unlock' | 'IgnitionOn' | 'IgnitionOff' | 'GetLocation' | 'GetBattery' | 'GetOdometer' | 'GetHealth';
export type BillingFrequency = 'Weekly' | 'Monthly' | 'Quarterly';
export type WalletEntryType = 'Credit' | 'Debit';
export type VehicleEventType = 'StatusChange' | 'Assignment' | 'Unassignment' | 'HubMove' | 'Note';

export const ADMIN_ROLES = [
  'SuperAdmin',
  'Administrator',
  'CommandCenter',
  'Finance',
  'Operations',
  'ServiceTeam',
  'KycTeam',
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export const LEGACY_ADMIN_ROLE_MAP: Record<string, AdminRole> = {
  FleetManager: 'Operations',
  SupportAgent: 'CommandCenter',
  FinanceAdmin: 'Finance',
  KycReviewer: 'KycTeam',
};

export function normalizeAdminRole(role: string | undefined | null): AdminRole | undefined {
  if (!role) return undefined;
  if ((ADMIN_ROLES as readonly string[]).includes(role)) return role as AdminRole;
  return LEGACY_ADMIN_ROLE_MAP[role];
}

export const ACCOUNT_STATUSES: AccountStatus[] = ['Active', 'Suspended', 'Deactivated'];
export const KYC_STATUSES: KycStatus[] = ['NotSubmitted', 'Pending', 'UnderReview', 'Approved', 'Rejected'];
export const VEHICLE_STATUSES: VehicleStatus[] = ['Available', 'Reserved', 'InRide', 'Maintenance', 'Offline'];
export const VEHICLE_TYPES: VehicleType[] = ['EScooter', 'EBike', 'ERickshaw'];
export const BILLING_FREQUENCIES: BillingFrequency[] = ['Weekly', 'Monthly', 'Quarterly'];

export interface GeoPoint {
  lat: number;
  lng: number;
}

export const PRICING_RATES: Record<BookingType, number> = {
  PerMinute: 1.5,
  Hourly: 60,
  Daily: 400,
  Weekly: 1050,
  Monthly: 4000,
};

export const GST_RATE = 0.05;

export const INDIA_MOBILE_PATTERN = /^(?:\+91[\s-]?)?[6-9]\d{9}$/;
export const INDIA_VEHICLE_REG_PATTERN = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/;
