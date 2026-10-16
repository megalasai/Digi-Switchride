type Position = [number, number];
type LinearRing = Position[];
type PolygonCoords = LinearRing[];

export type GeoJsonGeometry =
  | { type: 'Polygon'; coordinates: PolygonCoords }
  | { type: 'MultiPolygon'; coordinates: PolygonCoords[] };

type BBox = { minLon: number; maxLon: number; minLat: number; maxLat: number };

type Part = {
  bbox: BBox;
  polygons: PolygonCoords[];
};

export type Coverage = {
  bbox: BBox;
  contains(latitude: number, longitude: number): boolean;
};

function pointInRing(lon: number, lat: number, ring: LinearRing): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const crosses = yi > lat !== yj > lat;
    if (crosses && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function ringBBox(ring: LinearRing, bbox: BBox): void {
  for (const [lon, lat] of ring) {
    if (lon < bbox.minLon) bbox.minLon = lon;
    if (lon > bbox.maxLon) bbox.maxLon = lon;
    if (lat < bbox.minLat) bbox.minLat = lat;
    if (lat > bbox.maxLat) bbox.maxLat = lat;
  }
}

function polygonContains(lon: number, lat: number, polygon: PolygonCoords): boolean {
  if (!pointInRing(lon, lat, polygon[0])) return false;
  for (let hole = 1; hole < polygon.length; hole += 1) {
    if (pointInRing(lon, lat, polygon[hole])) return false;
  }
  return true;
}

function emptyBBox(): BBox {
  return { minLon: Infinity, maxLon: -Infinity, minLat: Infinity, maxLat: -Infinity };
}

export function coverageFromGeometries(geometries: GeoJsonGeometry[]): Coverage {
  const parts: Part[] = [];
  const bbox = emptyBBox();

  for (const geometry of geometries) {
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
    const partBBox = emptyBBox();
    for (const polygon of polygons) {
      if (polygon[0]) ringBBox(polygon[0], partBBox);
    }
    ringBBox(
      [
        [partBBox.minLon, partBBox.minLat],
        [partBBox.maxLon, partBBox.maxLat],
      ],
      bbox,
    );
    parts.push({ bbox: partBBox, polygons });
  }

  if (parts.length === 0 || !Number.isFinite(bbox.minLat)) {
    throw new Error('India coverage geometry is empty');
  }

  return {
    bbox,
    contains(latitude: number, longitude: number): boolean {
      if (
        latitude < bbox.minLat ||
        latitude > bbox.maxLat ||
        longitude < bbox.minLon ||
        longitude > bbox.maxLon
      ) {
        return false;
      }
      for (const part of parts) {
        const box = part.bbox;
        if (
          longitude < box.minLon ||
          longitude > box.maxLon ||
          latitude < box.minLat ||
          latitude > box.maxLat
        ) {
          continue;
        }
        for (const polygon of part.polygons) {
          if (polygonContains(longitude, latitude, polygon)) return true;
        }
      }
      return false;
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isIndia(properties: Record<string, unknown> | null): boolean {
  if (!properties) return false;
  const iso = String(properties.ISO_A2 ?? properties.iso_a2 ?? properties.ISO_A2_EH ?? '').toUpperCase();
  const adm = String(properties.ADM0_A3 ?? properties.adm0_a3 ?? '').toUpperCase();
  const name = String(properties.NAME ?? properties.name ?? properties.ADMIN ?? '').toLowerCase();
  return iso === 'IN' || adm === 'IND' || name === 'india';
}

function asGeometry(value: unknown): GeoJsonGeometry | null {
  if (!isRecord(value) || !Array.isArray(value.coordinates)) return null;
  if (value.type === 'Polygon' || value.type === 'MultiPolygon') {
    return value as GeoJsonGeometry;
  }
  return null;
}

export function geometriesFromGeoJson(json: unknown): GeoJsonGeometry[] {
  const geometries: GeoJsonGeometry[] = [];

  if (!isRecord(json)) {
    throw new Error('Coverage file is not GeoJSON');
  }

  if (json.type === 'FeatureCollection' && Array.isArray(json.features)) {
    const india = json.features.filter(
      (feature) => isRecord(feature) && isIndia(isRecord(feature.properties) ? feature.properties : null),
    );
    const chosen = india.length > 0 ? india : json.features.length === 1 ? json.features : [];
    for (const feature of chosen) {
      if (!isRecord(feature)) continue;
      const geometry = asGeometry(feature.geometry);
      if (geometry) geometries.push(geometry);
    }
  } else if (json.type === 'Feature') {
    const geometry = asGeometry(json.geometry);
    if (geometry) geometries.push(geometry);
  } else {
    const geometry = asGeometry(json);
    if (geometry) geometries.push(geometry);
  }

  if (geometries.length === 0) {
    throw new Error('No India polygon found in the coverage GeoJSON');
  }
  return geometries;
}

export function coverageFromGeoJson(json: unknown): Coverage {
  return coverageFromGeometries(geometriesFromGeoJson(json));
}
