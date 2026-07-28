import { createHash, randomInt } from 'crypto';
import { PRICING_RATES, GST_RATE, type BookingType } from '@digi-switchride/shared';

export function hashOtp(otp: string): string {
  return createHash('sha256').update(otp).digest('base64');
}

export function generateOtp(): string {
  return randomInt(100000, 999999).toString();
}

export function maskAadhaar(aadhaar: string): string {
  if (aadhaar.length < 4) return '****';
  return `XXXX-XXXX-${aadhaar.slice(-4)}`;
}

export function estimateFare(bookingType: BookingType, durationMinutes?: number): number {
  const rate = PRICING_RATES[bookingType] ?? 0;
  if (bookingType === 'PerMinute' && durationMinutes != null) return rate * durationMinutes;
  return rate;
}

export function calculateRideFare(durationMinutes: number, bookingType: BookingType): number {
  if (bookingType !== 'PerMinute') return estimateFare(bookingType);
  return Math.round(PRICING_RATES.PerMinute * durationMinutes * 100) / 100;
}

export function calculateGst(amount: number): number {
  return Math.round(amount * GST_RATE * 100) / 100;
}

export function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function toGeoLocation(lat: number, lng: number) {
  return { type: 'Point' as const, coordinates: [lng, lat] as [number, number] };
}
