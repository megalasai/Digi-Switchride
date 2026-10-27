import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readSecret } from '../config/secrets';

@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);

  constructor(private config: ConfigService) {}

  locationBase() {
    return (
      this.config.get<string>('LOCATION_SERVICE_URL') ??
      this.config.get<string>('LOCATION_API_URL') ??
      'http://127.0.0.1:4100'
    ).replace(/\/$/, '');
  }

  async status() {
    const url = `${this.locationBase()}/health`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      return { ok: res.ok, url, status: body.status ?? (res.ok ? 'ok' : 'error') };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Location API health failed: ${message}`);
      return { ok: false, url, error: message };
    }
  }

  async reverse(lat: number, lng: number) {
    const local = await this.reverseLocal(lat, lng);
    if (local) return local;
    return this.reverseNominatim(lat, lng);
  }

  async search(query: string) {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=in&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Fleetel-Switchride/1.0 (operations)',
      },
    });
    if (!res.ok) throw new Error(`Place search failed (${res.status})`);
    const data = (await res.json()) as { display_name?: string; lat?: string; lon?: string }[];
    return (data ?? []).map((hit) => ({
      display_name: hit.display_name ?? '',
      lat: hit.lat ?? '',
      lon: hit.lon ?? '',
    }));
  }

  private async reverseLocal(lat: number, lng: number) {
    const key = readSecret(this.config, 'LOCATION_API_KEY', '');
    const url = `${this.locationBase()}/v1/locations/reverse?latitude=${encodeURIComponent(String(lat))}&longitude=${encodeURIComponent(String(lng))}`;
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(4000),
        headers: {
          Accept: 'application/json',
          ...(key ? { 'X-Api-Key': key } : {}),
        },
      });
      if (!res.ok) {
        this.logger.warn(`Location reverse ${res.status} from ${url}`);
        return null;
      }
      const data = (await res.json()) as {
        locality?: string;
        district?: string;
        state?: string;
        postalCode?: string;
        display_name?: string;
      };
      const parts = [data.locality, data.district, data.state, data.postalCode].filter(Boolean);
      const display_name = data.display_name || parts.join(', ');
      return display_name ? { display_name, source: 'location' as const } : null;
    } catch (error) {
      this.logger.warn(`Location reverse failed: ${error instanceof Error ? error.message : error}`);
      return null;
    }
  }

  private async reverseNominatim(lat: number, lng: number) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Fleetel-Switchride/1.0 (operations)',
        },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { display_name?: string };
      return data.display_name ? { display_name: data.display_name, source: 'nominatim' as const } : null;
    } catch {
      return null;
    }
  }
}
