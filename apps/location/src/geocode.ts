import type { DatabaseSync } from 'node:sqlite';
import { LruCache } from './cache.js';
import { coverageFromGeoJson, type Coverage } from './coverage.js';
import { haversineMeters, radiusToDelta } from './geo.js';
import { adminKey } from './names.js';
import { stateCodeFor } from './states.js';

const PLACE_RADII_KM = [3, 10, 30, 80];
const POSTAL_RADII_KM = [2, 8, 20, 40];
const COASTAL_TOLERANCE_METERS = 5_000;
const SIGNIFICANT_WINDOW_METERS = 1_000;
const PRECISE_POSTAL_METERS = 5_000;
const ATTRIBUTION =
  'Place and PIN data: GeoNames (CC-BY-4.0). Roads, airports, ports, and industrial areas: OpenStreetMap contributors (ODbL). India boundary: Natural Earth (public domain).';

type PlaceRow = {
  id: number;
  name: string;
  ascii_name: string;
  lat: number;
  lon: number;
  feature_code: string;
  admin1_code: string | null;
  admin2_code: string | null;
  population: number;
  elevation: number | null;
  dem: number | null;
  timezone: string | null;
};

type PostalRow = {
  id: number;
  postal_code: string;
  place_name: string;
  admin1_name: string | null;
  admin2_name: string | null;
  lat: number;
  lon: number;
};

type AdminRow = { code: string; name: string; ascii_name: string };

type StoredMatch = {
  locality: string;
  featureCode: string;
  population: number;
  placeLat: number;
  placeLon: number;
  elevation: number | null;
  timezone: string | null;
  state: string | null;
  stateCode: string | null;
  district: string | null;
  postalCode: string | null;
  postalLat: number | null;
  postalLon: number | null;
  osmPlace: OsmPoint | null;
  osmRoad: OsmRoadPoint | null;
  osmAirport: OsmPoint | null;
  osmPort: OsmPoint | null;
  osmIndustrial: OsmPoint | null;
};

type OsmPoint = { name: string; kind: string; lat: number; lon: number };
type OsmRoadPoint = { name: string | null; ref: string | null; highway: string; lat: number; lon: number };

export type OsmFeature = { name: string; kind: string; distanceMeters: number };
export type OsmRoad = { name: string | null; ref: string | null; highway: string; distanceMeters: number };

export type ReverseInput = {
  latitude: number;
  longitude: number;
  altitude: number | null;
};

export type LocationMatch = {
  latitude: number;
  longitude: number;
  altitude: number | null;
  country: 'India';
  countryCode: 'IN';
  state: string | null;
  stateCode: string | null;
  district: string | null;
  locality: string;
  postalCode: string | null;
  timezone: string | null;
  elevation: number | null;
  altitudeAboveTerrain: number | null;
  distanceMeters: number;
  postalDistanceMeters: number | null;
  matched: {
    name: string;
    latitude: number;
    longitude: number;
    featureCode: string;
    population: number;
  };
  osm: {
    place: OsmFeature | null;
    road: OsmRoad | null;
    airport: OsmFeature | null;
    port: OsmFeature | null;
    industrialArea: OsmFeature | null;
  };
  attribution: string;
};

export class OutsideIndiaError extends Error {
  readonly error = 'OUTSIDE_INDIA';

  constructor() {
    super('Coordinates are outside India.');
  }
}

export class LocationNotFoundError extends Error {
  readonly error = 'NOT_FOUND';

  constructor() {
    super('No Indian locality was found within 80 km of these coordinates.');
  }
}

function isSignificant(place: { population: number; feature_code: string }): boolean {
  return place.population >= 1000 || place.feature_code === 'PPLC' || place.feature_code.startsWith('PPLA');
}

function postalRank(placeName: string, localityKey: string | null): number {
  const text = placeName.toLowerCase();
  if (text.includes('g.p.o') || /\bgpo\b/.test(text)) return 0;
  if (text.includes('head office') || text.includes(' h.o')) return 1;
  if (localityKey && text.includes(localityKey)) return 2;
  return 3;
}

function terrainElevation(elevation: number | null, dem: number | null): number | null {
  if (elevation !== null && elevation > -100) return elevation;
  if (dem !== null && dem > -100) return dem;
  return null;
}

export class Geocoder {
  readonly stats = { lookups: 0, cacheHits: 0, cacheMisses: 0 };
  readonly placeCount: number;
  readonly postalCount: number;
  readonly seededAt: string | null;
  readonly osmPlaceCount: number;
  readonly osmRoadCount: number;
  readonly osmSiteCount: number;

  private readonly coverage: Coverage;
  private readonly cache: LruCache<StoredMatch>;
  private readonly admin1 = new Map<string, AdminRow>();
  private readonly admin2 = new Map<string, AdminRow>();
  private readonly placeQuery;
  private readonly postalQuery;
  private readonly postalByDistrict;
  private readonly osmPlaceQuery;
  private readonly osmRoadQuery;
  private readonly osmSiteQuery;

  constructor(db: DatabaseSync, cacheSize: number) {
    const coverageRow = db
      .prepare(
        'SELECT geometry_json FROM coverage WHERE id = 1',
      )
      .get() as { geometry_json: string } | undefined;
    if (!coverageRow) {
      throw new Error('Location database has no India boundary. Run the seed again.');
    }
    this.coverage = coverageFromGeoJson(JSON.parse(coverageRow.geometry_json) as unknown);

    const places = db.prepare('SELECT COUNT(*) AS n FROM places').get() as { n: number };
    const postal = db.prepare('SELECT COUNT(*) AS n FROM postal_codes').get() as { n: number };
    if (!places.n) {
      throw new Error('Location database has no places. Run the seed again.');
    }
    this.placeCount = places.n;
    this.postalCount = postal.n;

    const seeded = db.prepare("SELECT value FROM meta WHERE key = 'seeded_at'").get() as
      | { value: string }
      | undefined;
    this.seededAt = seeded?.value ?? null;
    const metaValue = (key: string) =>
      (db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined)?.value;
    this.osmPlaceCount = Number(metaValue('osm_places') ?? 0) || 0;
    this.osmRoadCount = Number(metaValue('osm_roads') ?? 0) || 0;
    this.osmSiteCount = Number(metaValue('osm_sites') ?? 0) || 0;
    const osmReady = Boolean(
      db.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'osm_places'").get(),
    );

    for (const row of db.prepare('SELECT code, name, ascii_name FROM admin1').all() as AdminRow[]) {
      this.admin1.set(row.code, row);
    }
    for (const row of db.prepare('SELECT code, name, ascii_name FROM admin2').all() as AdminRow[]) {
      this.admin2.set(row.code, row);
    }

    this.placeQuery = db.prepare(`
      SELECT p.id, p.name, p.ascii_name, p.lat, p.lon, p.feature_code,
             p.admin1_code, p.admin2_code, p.population, p.elevation, p.dem, p.timezone
      FROM places_rtree r
      JOIN places p ON p.id = r.id
      WHERE r.min_lat <= ? AND r.max_lat >= ? AND r.min_lon <= ? AND r.max_lon >= ?
    `);
    this.postalQuery = db.prepare(`
      SELECT z.id, z.postal_code, z.place_name, z.admin1_name, z.admin2_name, z.lat, z.lon
      FROM postal_rtree r
      JOIN postal_codes z ON z.id = r.id
      WHERE r.min_lat <= ? AND r.max_lat >= ? AND r.min_lon <= ? AND r.max_lon >= ?
    `);
    this.postalByDistrict = db.prepare(`
      SELECT id, postal_code, place_name, admin1_name, admin2_name, lat, lon
      FROM postal_codes
      WHERE admin1_key = ? AND admin2_key = ?
      ORDER BY
        CASE
          WHEN place_name LIKE '%G.P.O%' OR upper(place_name) LIKE '%GPO%' THEN 0
          WHEN place_name LIKE '%Head Office%' OR place_name LIKE '% H.O%' THEN 1
          WHEN instr(lower(place_name), ?) > 0 THEN 2
          ELSE 3
        END
      LIMIT 15
    `);
    this.osmPlaceQuery = osmReady
      ? db.prepare(`
          SELECT p.name, p.kind, p.lat, p.lon
          FROM osm_places_rtree r
          JOIN osm_places p ON p.id = r.id
          WHERE r.min_lat <= ? AND r.max_lat >= ? AND r.min_lon <= ? AND r.max_lon >= ?
        `)
      : null;
    this.osmRoadQuery = osmReady
      ? db.prepare(`
          SELECT d.name, d.ref, d.highway, p.lat, p.lon
          FROM osm_road_points_rtree r
          JOIN osm_road_points p ON p.id = r.id
          JOIN osm_roads d ON d.id = p.road_id
          WHERE r.min_lat <= ? AND r.max_lat >= ? AND r.min_lon <= ? AND r.max_lon >= ?
        `)
      : null;
    this.osmSiteQuery = osmReady
      ? db.prepare(`
          SELECT s.name, s.kind, s.lat, s.lon
          FROM osm_sites_rtree r
          JOIN osm_sites s ON s.id = r.id
          WHERE r.min_lat <= ? AND r.max_lat >= ? AND r.min_lon <= ? AND r.max_lon >= ?
            AND s.kind = ?
        `)
      : null;
    this.cache = new LruCache(cacheSize);
  }

  get cacheEntries(): number {
    return this.cache.size;
  }

  reverse(input: ReverseInput): { location: LocationMatch; cache: 'hit' | 'miss' } {
    this.stats.lookups += 1;
    const box = this.coverage.bbox;
    if (
      input.latitude < box.minLat - 0.5 ||
      input.latitude > box.maxLat + 0.5 ||
      input.longitude < box.minLon - 0.5 ||
      input.longitude > box.maxLon + 0.5
    ) {
      throw new OutsideIndiaError();
    }
    const inside = this.coverage.contains(input.latitude, input.longitude);

    const cacheKey = `${input.latitude.toFixed(4)},${input.longitude.toFixed(4)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.stats.cacheHits += 1;
      return { location: this.toResponse(input, cached), cache: 'hit' };
    }

    this.stats.cacheMisses += 1;
    const place = this.nearestPlace(input.latitude, input.longitude);
    if (!inside && (!place || place.distanceMeters > COASTAL_TOLERANCE_METERS)) {
      throw new OutsideIndiaError();
    }
    if (!place) throw new LocationNotFoundError();

    const stateRow = place.admin1_code ? this.admin1.get(place.admin1_code) : undefined;
    const districtRow =
      place.admin1_code && place.admin2_code
        ? this.admin2.get(`${place.admin1_code}.${place.admin2_code}`)
        : undefined;
    const state = stateRow?.name ?? null;
    const district = districtRow?.name ?? null;
    const postal = this.resolvePostal(input.latitude, input.longitude, state, district, place.name);
    const osm = this.lookupOsm(input.latitude, input.longitude);

    const stored: StoredMatch = {
      locality: place.name,
      featureCode: place.feature_code,
      population: place.population,
      placeLat: place.lat,
      placeLon: place.lon,
      elevation: terrainElevation(place.elevation, place.dem),
      timezone: place.timezone,
      state: state ?? postal?.admin1_name ?? null,
      stateCode: stateCodeFor(stateRow?.ascii_name ?? state ?? postal?.admin1_name),
      district: district ?? postal?.admin2_name ?? null,
      postalCode: postal?.postal_code ?? null,
      postalLat: postal?.lat ?? null,
      postalLon: postal?.lon ?? null,
      osmPlace: osm.place,
      osmRoad: osm.road,
      osmAirport: osm.airport,
      osmPort: osm.port,
      osmIndustrial: osm.industrial,
    };
    this.cache.set(cacheKey, stored);
    return { location: this.toResponse(input, stored), cache: 'miss' };
  }

  private nearestPlace(lat: number, lon: number): (PlaceRow & { distanceMeters: number }) | null {
    for (const radiusKm of PLACE_RADII_KM) {
      const rows = this.placeQuery.all(...this.window(lat, lon, radiusKm)) as PlaceRow[];
      const limit = radiusKm * 1000;
      const candidates: Array<PlaceRow & { distanceMeters: number }> = [];
      for (const row of rows) {
        const distanceMeters = haversineMeters(lat, lon, row.lat, row.lon);
        if (distanceMeters <= limit) candidates.push({ ...row, distanceMeters });
      }
      if (candidates.length > 0) return this.choosePlace(candidates);
    }
    return null;
  }

  private choosePlace(
    candidates: Array<PlaceRow & { distanceMeters: number }>,
  ): PlaceRow & { distanceMeters: number } {
    let nearest = candidates[0];
    for (const candidate of candidates) {
      if (candidate.distanceMeters < nearest.distanceMeters) nearest = candidate;
    }
    const horizon = nearest.distanceMeters + SIGNIFICANT_WINDOW_METERS;
    let significant: (PlaceRow & { distanceMeters: number }) | null = null;
    for (const candidate of candidates) {
      if (candidate.distanceMeters > horizon || !isSignificant(candidate)) continue;
      if (!significant || candidate.distanceMeters < significant.distanceMeters) significant = candidate;
    }
    return significant ?? nearest;
  }

  private resolvePostal(
    lat: number,
    lon: number,
    state: string | null,
    district: string | null,
    locality: string,
  ): (PostalRow & { distanceMeters: number }) | null {
    const nearest = this.nearestPostal(lat, lon);
    if (nearest && nearest.distanceMeters <= PRECISE_POSTAL_METERS) return nearest;

    const stateKey = adminKey(state);
    const districtKey = adminKey(district);
    const localityKey = adminKey(locality);
    if (stateKey && districtKey) {
      const rows = this.postalByDistrict.all(stateKey, districtKey, localityKey ?? '\u0000') as PostalRow[];
      let best: (PostalRow & { distanceMeters: number }) | null = null;
      let bestRank = 4;
      for (const row of rows) {
        const rank = postalRank(row.place_name, localityKey);
        const distanceMeters = haversineMeters(lat, lon, row.lat, row.lon);
        if (!best || rank < bestRank || (rank === bestRank && distanceMeters < best.distanceMeters)) {
          best = { ...row, distanceMeters };
          bestRank = rank;
        }
      }
      if (best && bestRank <= 2) return best;
    }

    return nearest;
  }

  private nearestPostal(lat: number, lon: number): (PostalRow & { distanceMeters: number }) | null {
    for (const radiusKm of POSTAL_RADII_KM) {
      const best = this.nearest(this.postalQuery.all(...this.window(lat, lon, radiusKm)) as PostalRow[], lat, lon, radiusKm);
      if (best) return best;
    }
    return null;
  }

  private window(lat: number, lon: number, radiusKm: number): [number, number, number, number] {
    const { dLat, dLon } = radiusToDelta(lat, radiusKm);
    return [lat + dLat, lat - dLat, lon + dLon, lon - dLon];
  }

  private nearest<T extends { lat: number; lon: number; population?: number }>(
    rows: T[],
    lat: number,
    lon: number,
    radiusKm: number,
  ): (T & { distanceMeters: number }) | null {
    const limit = radiusKm * 1000;
    let best: (T & { distanceMeters: number }) | null = null;
    for (const row of rows) {
      const distanceMeters = haversineMeters(lat, lon, row.lat, row.lon);
      if (distanceMeters > limit) continue;
      if (
        !best ||
        distanceMeters < best.distanceMeters - 1 ||
        (Math.abs(distanceMeters - best.distanceMeters) <= 1 && (row.population ?? 0) > (best.population ?? 0))
      ) {
        best = { ...row, distanceMeters };
      }
    }
    return best;
  }

  private toResponse(input: ReverseInput, match: StoredMatch): LocationMatch {
    const elevation = match.elevation;
    const altitude = input.altitude;
    return {
      latitude: input.latitude,
      longitude: input.longitude,
      altitude,
      country: 'India',
      countryCode: 'IN',
      state: match.state,
      stateCode: match.stateCode,
      district: match.district,
      locality: match.locality,
      postalCode: match.postalCode,
      timezone: match.timezone,
      elevation,
      altitudeAboveTerrain:
        altitude === null || elevation === null ? null : Math.round((altitude - elevation) * 10) / 10,
      distanceMeters: Math.round(haversineMeters(input.latitude, input.longitude, match.placeLat, match.placeLon)),
        postalDistanceMeters:
        match.postalLat === null || match.postalLon === null
          ? null
          : Math.round(haversineMeters(input.latitude, input.longitude, match.postalLat, match.postalLon)),
      matched: {
        name: match.locality,
        latitude: match.placeLat,
        longitude: match.placeLon,
        featureCode: match.featureCode,
        population: match.population,
      },
      osm: {
        place: this.toOsmFeature(input, match.osmPlace),
        road: match.osmRoad
          ? {
              name: match.osmRoad.name,
              ref: match.osmRoad.ref,
              highway: match.osmRoad.highway,
              distanceMeters: Math.round(
                haversineMeters(input.latitude, input.longitude, match.osmRoad.lat, match.osmRoad.lon),
              ),
            }
          : null,
        airport: this.toOsmFeature(input, match.osmAirport),
        port: this.toOsmFeature(input, match.osmPort),
        industrialArea: this.toOsmFeature(input, match.osmIndustrial),
      },
      attribution: ATTRIBUTION,
    };
  }

  private lookupOsm(lat: number, lon: number): {
    place: OsmPoint | null;
    road: OsmRoadPoint | null;
    airport: OsmPoint | null;
    port: OsmPoint | null;
    industrial: OsmPoint | null;
  } {
    const empty = { place: null, road: null, airport: null, port: null, industrial: null };
    if (!this.osmPlaceQuery || !this.osmRoadQuery || !this.osmSiteQuery) return empty;
    const place = this.nearestIn(this.osmPlaceQuery, lat, lon, [2, 10]);
    const road = this.nearestIn(this.osmRoadQuery, lat, lon, [0.4, 1.5]);
    const airport = this.nearestIn(this.osmSiteQuery, lat, lon, [3, 12], 'airport');
    const port = this.nearestIn(this.osmSiteQuery, lat, lon, [3, 8], 'port');
    const industrial = this.nearestIn(this.osmSiteQuery, lat, lon, [1, 3], 'industrial');
    return {
      place: place ? { name: String(place.name), kind: String(place.kind), lat: place.lat, lon: place.lon } : null,
      road: road
        ? {
            name: road.name == null ? null : String(road.name),
            ref: road.ref == null ? null : String(road.ref),
            highway: String(road.highway),
            lat: road.lat,
            lon: road.lon,
          }
        : null,
      airport: airport ? { name: String(airport.name), kind: 'airport', lat: airport.lat, lon: airport.lon } : null,
      port: port ? { name: String(port.name), kind: 'port', lat: port.lat, lon: port.lon } : null,
      industrial: industrial
        ? { name: String(industrial.name), kind: 'industrial', lat: industrial.lat, lon: industrial.lon }
        : null,
    };
  }

  private nearestIn(
    query: { all: (...args: Array<number | string>) => unknown[] },
    lat: number,
    lon: number,
    radiiKm: number[],
    kind?: string,
  ): ({ lat: number; lon: number; name?: unknown; kind?: unknown; ref?: unknown; highway?: unknown } & {
    distanceMeters: number;
  }) | null {
    for (const radiusKm of radiiKm) {
      const window = this.window(lat, lon, radiusKm);
      const rows = (kind ? query.all(...window, kind) : query.all(...window)) as Array<{ lat: number; lon: number }>;
      const best = this.nearest(rows, lat, lon, radiusKm);
      if (best) return best;
    }
    return null;
  }

  private toOsmFeature(input: ReverseInput, point: OsmPoint | null): OsmFeature | null {
    if (!point) return null;
    return {
      name: point.name,
      kind: point.kind,
      distanceMeters: Math.round(haversineMeters(input.latitude, input.longitude, point.lat, point.lon)),
    };
  }
}
