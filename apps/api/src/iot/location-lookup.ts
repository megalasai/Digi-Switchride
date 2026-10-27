import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { haversineDistanceKm, readLatLng } from '../common/helpers';
import type { RentalHubDocument } from '../schemas/fleet.schema';

export const TRAIL_WINDOW_MS = 90_000;

export type LocationPing = { lat: number; lng: number; at: Date };

export function pruneTrail(points: LocationPing[] | undefined, now = new Date()): LocationPing[] {
  const cutoff = now.getTime() - TRAIL_WINDOW_MS;
  return (points ?? []).filter((p) => new Date(p.at).getTime() >= cutoff);
}

export function appendTrail(points: LocationPing[] | undefined, lat: number, lng: number, at = new Date()): LocationPing[] {
  const next = pruneTrail(points, at);
  const last = next[next.length - 1];
  if (last && Math.abs(last.lat - lat) < 0.000005 && Math.abs(last.lng - lng) < 0.000005) {
    last.at = at;
    return next;
  }
  next.push({ lat, lng, at });
  return next;
}

type ReverseMatch = {
  locality?: string;
  district?: string;
  state?: string;
  postalCode?: string;
};

export async function reversePlaceName(config: ConfigService, lat: number, lng: number): Promise<string | null> {
  const base = (
    config.get<string>('LOCATION_SERVICE_URL') ??
    config.get<string>('LOCATION_API_URL') ??
    'http://localhost:4100'
  ).replace(/\/$/, '');
  const apiKey = (config.get<string>('LOCATION_API_KEY') ?? '').trim();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const url = `${base}/v1/locations/reverse?latitude=${encodeURIComponent(String(lat))}&longitude=${encodeURIComponent(String(lng))}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(apiKey ? { 'X-Api-Key': apiKey } : {}),
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ReverseMatch;
    const parts = [data.locality, data.district, data.state, data.postalCode].filter(
      (part): part is string => Boolean(part && part.trim()),
    );
    const unique: string[] = [];
    for (const part of parts) {
      if (!unique.includes(part)) unique.push(part);
    }
    return unique.length ? unique.join(', ') : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveHubOrPlace(
  config: ConfigService,
  hubModel: Model<RentalHubDocument>,
  lat: number,
  lng: number,
): Promise<{ lastPlace: string; lastPlaceKind: 'Hub' | 'Location'; lastHubId: string | null }> {
  const hubs = await hubModel.find({ status: { $ne: 'Inactive' } });
  let best: { id: string; name: string; distanceM: number; radiusM: number } | null = null;
  for (const hub of hubs) {
    const point = readLatLng(hub.location);
    if (!point) continue;
    const distanceM = haversineDistanceKm(lat, lng, point.lat, point.lng) * 1000;
    const radiusM = hub.geoFenceRadiusM ?? 100;
    if (distanceM <= radiusM && (!best || distanceM < best.distanceM)) {
      best = { id: hub._id.toString(), name: hub.name, distanceM, radiusM };
    }
  }
  if (best) {
    return { lastPlace: best.name, lastPlaceKind: 'Hub', lastHubId: best.id };
  }
  const place = await reversePlaceName(config, lat, lng);
  return { lastPlace: place ?? 'Unknown location', lastPlaceKind: 'Location', lastHubId: null };
}

