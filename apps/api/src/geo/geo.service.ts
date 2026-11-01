import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { readSecret } from '../config/secrets';
import { GeoPlace, GeoPlaceDocument } from '../schemas/geo-place.schema';
import { findByEitherId, removeByEitherId } from '../common/mongo-id';
import type { CreateGeoPlaceDto, UpdateGeoPlaceDto } from './geo.dto';

@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);

  constructor(
    private config: ConfigService,
    @InjectModel(GeoPlace.name) private placeModel: Model<GeoPlaceDocument>,
  ) {}

  async listPlaces() {
    const items = await this.placeModel.find().sort({ kind: 1, name: 1 }).limit(400);
    return items.map((item) => this.toPlace(item));
  }

  async createPlace(data: CreateGeoPlaceDto) {
    const radiusM = data.kind === 'geofence' ? data.radiusM ?? 200 : undefined;
    const created = await this.placeModel.create({
      kind: data.kind,
      name: data.name.trim(),
      lat: data.lat,
      lng: data.lng,
      radiusM,
      notes: data.notes?.trim(),
    });
    return this.toPlace(created);
  }

  async updatePlace(id: string, data: UpdateGeoPlaceDto) {
    const item = await findByEitherId(this.placeModel, id);
    if (!item) throw new NotFoundException('Place not found');
    if (data.name != null) item.name = data.name.trim();
    if (data.lat != null) item.lat = data.lat;
    if (data.lng != null) item.lng = data.lng;
    if (data.radiusM != null) {
      if (item.kind !== 'geofence') throw new BadRequestException('Radius applies only to geofences');
      item.radiusM = data.radiusM;
    }
    if (data.notes != null) item.notes = data.notes.trim();
    await item.save();
    return this.toPlace(item);
  }

  async removePlace(id: string) {
    const item = await findByEitherId(this.placeModel, id);
    if (!item) throw new NotFoundException('Place not found');
    const deleted = await removeByEitherId(this.placeModel.collection, item._id.toString());
    if (!deleted) throw new NotFoundException('Place not found');
    return { deleted: true };
  }

  private toPlace(item: GeoPlaceDocument) {
    return {
      id: item._id.toString(),
      kind: item.kind,
      name: item.name,
      lat: item.lat,
      lng: item.lng,
      radiusM: item.radiusM,
      notes: item.notes,
    };
  }

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
        'User-Agent': 'MoventraX/1.0 (operations)',
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
          'User-Agent': 'MoventraX/1.0 (operations)',
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
