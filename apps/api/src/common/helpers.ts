import { createHash, randomInt } from 'crypto';
import { PRICING_RATES, GST_RATE } from '@digi-switchride/shared';
import type { BookingType } from '@digi-switchride/shared';

export function hashOtp(otp: string): string {
  return createHash('sha256').update(otp).digest('base64');
}

export function hashPassword(password: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${password}`).digest('hex');
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

export function readLatLng(location: unknown): { lat: number; lng: number } | null {
  if (!location || typeof location !== 'object') return null;
  const loc = location as { coordinates?: unknown; lat?: unknown; lng?: unknown };
  if (Array.isArray(loc.coordinates) && loc.coordinates.length >= 2) {
    const lng = Number(loc.coordinates[0]);
    const lat = Number(loc.coordinates[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  const lat = Number(loc.lat);
  const lng = Number(loc.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  return null;
}

export function normalizeIndiaPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

export function normalizeVehicleRegistration(value: string): string {
  return value.replace(/[\s-]/g, '').toUpperCase();
}
