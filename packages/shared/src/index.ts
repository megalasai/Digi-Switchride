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
