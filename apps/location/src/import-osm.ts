import fs from 'node:fs';
import { createRequire } from 'node:module';
import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { DatabaseSync } from 'node:sqlite';
import { loadConfig } from './config.js';
import { createSchema } from './db.js';
import { haversineMeters } from './geo.js';
import { isMainModule } from './module.js';
import { isPlausibleIndiaCoordinate } from './parse.js';

const require = createRequire(import.meta.url);
const parseOsm = require('osm-pbf-parser') as () => NodeJS.ReadWriteStream;

const PBF_URL = 'https://download.geofabrik.de/asia/india-latest.osm.pbf';
const EXPECTED_BYTES = 1_708_156_903;
const PLACE_KINDS = new Set(['city', 'town', 'village', 'hamlet', 'suburb', 'neighbourhood', 'locality']);
const MAJOR_HIGHWAYS = new Set([
  'motorway',
  'trunk',
  'primary',
  'secondary',
  'tertiary',
  'motorway_link',
  'trunk_link',
  'primary_link',
  'secondary_link',
  'tertiary_link',
]);
const NAMED_STREETS = new Set(['residential', 'unclassified', 'living_street']);
const MINOR_REF_BUDGET = 6_000_000;
const ROAD_SPACING_METERS = 350;

type Tags = Record<string, string>;
type OsmNode = { type: 'node'; id: number; lat: number; lon: number; tags: Tags };
type OsmWay = { type: 'way'; id: number; refs: number[]; tags: Tags };
type OsmItem = OsmNode | OsmWay | { type: 'relation'; id: number; tags: Tags };

type WayKind = 'road' | 'place' | 'airport' | 'port' | 'industrial';

function cleanName(value: string | undefined): string | null {
  const name = value?.trim();
  if (!name || name.length < 2 || name.length > 300) return null;
  return name;
}

function siteKind(tags: Tags): 'airport' | 'port' | 'industrial' | null {
  if (tags.aeroway === 'aerodrome') return 'airport';
  if (
    tags.harbour === 'yes' ||
    tags.industrial === 'port' ||
    tags.landuse === 'harbour' ||
    tags.landuse === 'port'
  ) {
    return 'port';
  }
  if (tags.landuse === 'industrial') return 'industrial';
  return null;
}

function featureName(tags: Tags, kind: 'airport' | 'port' | 'industrial'): string | null {
  const name = cleanName(tags.name) ?? cleanName(tags.official_name);
  if (name) return name;
  if (kind === 'airport') return cleanName(tags.ref) ?? 'Airport';
  if (kind === 'port') return cleanName(tags.ref);
  return null;
}

function wayRecord(item: OsmWay): { kind: WayKind; name: string | null; ref: string | null; highway: string | null; placeKind: string | null } | null {
  const highway = item.tags.highway;
  if (highway && (MAJOR_HIGHWAYS.has(highway) || NAMED_STREETS.has(highway))) {
    const name = cleanName(item.tags.name);
    const ref = cleanName(item.tags.ref);
    if (!name && !ref) return null;
    if (NAMED_STREETS.has(highway) && !name) return null;
    return { kind: 'road', name, ref, highway, placeKind: null };
  }
  const place = item.tags.place;
  if (place && PLACE_KINDS.has(place)) {
    const name = cleanName(item.tags.name);
    if (!name) return null;
    return { kind: 'place', name, ref: null, highway: null, placeKind: place };
  }
  const site = siteKind(item.tags);
  if (!site) return null;
  const name = featureName(item.tags, site);
  if (!name) return null;
  if (site === 'industrial' && !cleanName(item.tags.name)) return null;
  return { kind: site, name, ref: null, highway: null, placeKind: null };
}

function refsBlob(refs: number[]): Buffer {
  const buffer = Buffer.allocUnsafe(refs.length * 8);
  for (let index = 0; index < refs.length; index += 1) {
    buffer.writeBigInt64LE(BigInt(refs[index]), index * 8);
  }
  return buffer;
}

function blobIds(value: Uint8Array): BigInt64Array {
  const aligned = new ArrayBuffer(value.byteLength);
  new Uint8Array(aligned).set(value);
  return new BigInt64Array(aligned);
}

function sampleLine(coords: Array<[number, number]>): Array<[number, number]> {
  if (coords.length === 0) return [];
  const sampled: Array<[number, number]> = [coords[0]];
  let walked = 0;
  let previous = coords[0];
  for (let index = 1; index < coords.length; index += 1) {
    const point = coords[index];
    walked += haversineMeters(previous[0], previous[1], point[0], point[1]);
    if (walked >= ROAD_SPACING_METERS) {
      sampled.push(point);
      walked = 0;
    }
    previous = point;
  }
  const last = coords[coords.length - 1];
  const tail = sampled[sampled.length - 1];
  if (tail[0] !== last[0] || tail[1] !== last[1]) sampled.push(last);
  return sampled;
}

function centroid(coords: Array<[number, number]>): [number, number] | null {
  if (coords.length === 0) return null;
  let lat = 0;
  let lon = 0;
  for (const [pointLat, pointLon] of coords) {
    lat += pointLat;
    lon += pointLon;
  }
  return [lat / coords.length, lon / coords.length];
}

function clearOsm(db: DatabaseSync): void {
  db.exec(`
    DELETE FROM osm_places;
    DELETE FROM osm_places_rtree;
    DELETE FROM osm_road_points;
    DELETE FROM osm_road_points_rtree;
    DELETE FROM osm_roads;
    DELETE FROM osm_sites;
    DELETE FROM osm_sites_rtree;
    DROP TABLE IF EXISTS osm_way_import;
  `);
}

export async function importOsm(options?: { force?: boolean }): Promise<void> {
  const config = loadConfig();
  const pbfPath = `${config.rawDir}/india-latest.osm.pbf`;
  if (!fs.existsSync(pbfPath)) {
    throw new Error(`Missing ${pbfPath}. Download ${PBF_URL} into that path, then run the import again.`);
  }
  const size = fs.statSync(pbfPath).size;
  if (size < EXPECTED_BYTES - 1_000_000) {
    throw new Error(`OSM download is incomplete (${size} of about ${EXPECTED_BYTES} bytes) at ${pbfPath}.`);
  }

  const db = new DatabaseSync(config.dbPath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  db.exec('PRAGMA temp_store = MEMORY');
  db.exec('PRAGMA cache_size = -131072');
  createSchema(db);

  const already = db.prepare("SELECT value FROM meta WHERE key = 'osm_imported_at'").get() as { value: string } | undefined;
  if (already && !options?.force) {
    console.log(`OpenStreetMap data was already imported at ${already.value}. Pass --force to import it again.`);
    db.close();
    return;
  }

  console.log('clearing previous OpenStreetMap tables');
  clearOsm(db);
  db.exec(`
    CREATE TABLE osm_way_import (
      id INTEGER PRIMARY KEY,
      kind TEXT NOT NULL,
      name TEXT,
      ref TEXT,
      highway TEXT,
      place_kind TEXT,
      refs BLOB NOT NULL
    );
  `);

  const insertPlace = db.prepare(
    'INSERT INTO osm_places (osm_id, osm_type, name, kind, lat, lon) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const insertPlaceRtree = db.prepare(
    'INSERT INTO osm_places_rtree (id, min_lat, max_lat, min_lon, max_lon) VALUES (?, ?, ?, ?, ?)',
  );
  const insertSite = db.prepare(
    'INSERT INTO osm_sites (osm_id, osm_type, name, kind, lat, lon) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const insertSiteRtree = db.prepare(
    'INSERT INTO osm_sites_rtree (id, min_lat, max_lat, min_lon, max_lon) VALUES (?, ?, ?, ?, ?)',
  );
  const insertWay = db.prepare(
    'INSERT INTO osm_way_import (id, kind, name, ref, highway, place_kind, refs) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );

  let places = 0;
  let sites = 0;
  let ways = 0;
  let minorRefs = 0;
  let minorDropped = 0;
  let nodesSeen = 0;
  let inTransaction = false;
  let pending = 0;

  const begin = () => {
    if (!inTransaction) {
      db.exec('BEGIN');
      inTransaction = true;
    }
  };
  const commit = (force = false) => {
    pending += 1;
    if (!force && pending < 8_000) return;
    if (inTransaction) db.exec('COMMIT');
    inTransaction = false;
    pending = 0;
  };

  const addPointFeature = (
    insert: typeof insertPlace,
    rtree: typeof insertPlaceRtree,
    id: number,
    osmType: string,
    name: string,
    kind: string,
    lat: number,
    lon: number,
  ) => {
    if (!isPlausibleIndiaCoordinate(lat, lon)) return false;
    begin();
    const inserted = insert.run(id, osmType, name, kind, lat, lon);
    rtree.run(Number(inserted.lastInsertRowid), lat, lat, lon, lon);
    commit();
    return true;
  };

  console.log('reading OpenStreetMap nodes and ways');
  await pipeline(
    fs.createReadStream(pbfPath),
    parseOsm(),
    new Writable({
      objectMode: true,
      write(items: OsmItem[], _encoding, callback) {
        try {
          for (const item of items) {
            if (item.type === 'node') {
              nodesSeen += 1;
              if (nodesSeen % 5_000_000 === 0) console.log(`  ${nodesSeen} nodes scanned`);
              if (
                item.tags.place == null &&
                item.tags.name == null &&
                item.tags.aeroway == null &&
                item.tags.harbour == null &&
                item.tags.landuse == null &&
                item.tags.industrial == null
              ) {
                continue;
              }
              const place = item.tags.place;
              if (place && PLACE_KINDS.has(place)) {
                const name = cleanName(item.tags.name);
                if (name && addPointFeature(insertPlace, insertPlaceRtree, item.id, 'node', name, place, item.lat, item.lon)) {
                  places += 1;
                }
              }
              const site = siteKind(item.tags);
              if (site) {
                const name = featureName(item.tags, site);
                if (name && !(site === 'industrial' && !cleanName(item.tags.name))) {
                  if (addPointFeature(insertSite, insertSiteRtree, item.id, 'node', name, site, item.lat, item.lon)) sites += 1;
                }
              }
              continue;
            }
            if (item.type !== 'way' || item.refs.length < 2) continue;
            const record = wayRecord(item);
            if (!record) continue;
            const minor = record.kind === 'road' && record.highway != null && NAMED_STREETS.has(record.highway);
            if (minor && minorRefs >= MINOR_REF_BUDGET) {
              minorDropped += 1;
              continue;
            }
            const refs = item.refs.length > 8_000 ? item.refs.filter((_, index) => index % 4 === 0 || index === item.refs.length - 1) : item.refs;
            begin();
            insertWay.run(item.id, record.kind, record.name, record.ref, record.highway, record.placeKind, refsBlob(refs));
            commit();
            ways += 1;
            if (minor) minorRefs += refs.length;
            if (ways % 100_000 === 0) console.log(`  ${ways} ways kept`);
          }
          callback();
        } catch (error) {
          callback(error instanceof Error ? error : new Error(String(error)));
        }
      },
    }),
  );
  if (inTransaction) db.exec('COMMIT');
  console.log(`kept ${places} places, ${sites} sites, ${ways} ways (${minorDropped} named streets skipped after the memory budget)`);

  const totalRefs = Number(
    (db.prepare('SELECT COALESCE(SUM(length(refs)), 0) AS n FROM osm_way_import').get() as { n: number }).n,
  ) / 8;
  console.log(`resolving ${totalRefs} way nodes`);
  const needed = new Float64Array(totalRefs);
  let offset = 0;
  for (const row of db.prepare('SELECT refs FROM osm_way_import').iterate() as Iterable<{ refs: Uint8Array }>) {
    const ids = blobIds(row.refs);
    for (let index = 0; index < ids.length; index += 1) needed[offset++] = Number(ids[index]);
  }
  needed.sort();
  let uniqueCount = 0;
  for (let index = 0; index < needed.length; index += 1) {
    if (index === 0 || needed[index] !== needed[index - 1]) {
      needed[uniqueCount] = needed[index];
      uniqueCount += 1;
    }
  }
  const lats = new Float64Array(uniqueCount);
  const lons = new Float64Array(uniqueCount);
  let cursor = 0;
  let lastNodeId = -1;
  let resolved = 0;

  const mark = (id: number, lat: number, lon: number) => {
    if (id < lastNodeId) cursor = 0;
    lastNodeId = id;
    while (cursor < uniqueCount && needed[cursor] < id) cursor += 1;
    if (cursor < uniqueCount && needed[cursor] === id) {
      lats[cursor] = lat;
      lons[cursor] = lon;
      cursor += 1;
      resolved += 1;
    }
  };

  console.log('second pass for way coordinates');
  nodesSeen = 0;
  await pipeline(
    fs.createReadStream(pbfPath),
    parseOsm(),
    new Writable({
      objectMode: true,
      write(items: OsmItem[], _encoding, callback) {
        for (const item of items) {
          if (item.type !== 'node') continue;
          nodesSeen += 1;
          mark(item.id, item.lat, item.lon);
        }
        if (nodesSeen % 5_000_000 === 0) console.log(`  located ${resolved} of ${uniqueCount} nodes`);
        callback();
      },
    }),
  );
  console.log(`located ${resolved} of ${uniqueCount} nodes`);

  const findCoord = (id: number): [number, number] | null => {
    let low = 0;
    let high = uniqueCount - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      const value = needed[mid];
      if (value === id) return [lats[mid], lons[mid]];
      if (value < id) low = mid + 1;
      else high = mid - 1;
    }
    return null;
  };

  const insertRoad = db.prepare('INSERT INTO osm_roads (name, ref, highway) VALUES (?, ?, ?)');
  const insertRoadPoint = db.prepare('INSERT INTO osm_road_points (road_id, lat, lon) VALUES (?, ?, ?)');
  const insertRoadRtree = db.prepare(
    'INSERT INTO osm_road_points_rtree (id, min_lat, max_lat, min_lon, max_lon) VALUES (?, ?, ?, ?, ?)',
  );
  const selectWays = db.prepare(
    'SELECT id, kind, name, ref, highway, place_kind, refs FROM osm_way_import WHERE id > ? ORDER BY id LIMIT 2000',
  );
  type WayRow = {
    id: number;
    kind: WayKind;
    name: string | null;
    ref: string | null;
    highway: string | null;
    place_kind: string | null;
    refs: Uint8Array;
  };
  let roads = 0;
  let roadPoints = 0;
  let lastWayId = 0;
  for (;;) {
    const rows = selectWays.all(lastWayId) as WayRow[];
    if (rows.length === 0) break;
    db.exec('BEGIN');
    for (const row of rows) {
      lastWayId = row.id;
      const coords: Array<[number, number]> = [];
      const ids = blobIds(row.refs);
      for (let index = 0; index < ids.length; index += 1) {
        const coord = findCoord(Number(ids[index]));
        if (!coord || (coord[0] === 0 && coord[1] === 0)) continue;
        coords.push(coord);
      }
      if (coords.length === 0) continue;
      if (row.kind === 'road' && row.highway) {
        const inserted = insertRoad.run(row.name, row.ref, row.highway);
        const roadId = Number(inserted.lastInsertRowid);
        for (const [lat, lon] of sampleLine(coords)) {
          if (!isPlausibleIndiaCoordinate(lat, lon)) continue;
          const point = insertRoadPoint.run(roadId, lat, lon);
          insertRoadRtree.run(Number(point.lastInsertRowid), lat, lat, lon, lon);
          roadPoints += 1;
        }
        roads += 1;
      } else {
        const center = centroid(coords);
        if (!center || !isPlausibleIndiaCoordinate(center[0], center[1]) || !row.name) continue;
        if (row.kind === 'place' && row.place_kind) {
          const inserted = insertPlace.run(row.id, 'way', row.name, row.place_kind, center[0], center[1]);
          insertPlaceRtree.run(Number(inserted.lastInsertRowid), center[0], center[0], center[1], center[1]);
          places += 1;
        } else if (row.kind === 'airport' || row.kind === 'port' || row.kind === 'industrial') {
          const inserted = insertSite.run(row.id, 'way', row.name, row.kind, center[0], center[1]);
          insertSiteRtree.run(Number(inserted.lastInsertRowid), center[0], center[0], center[1], center[1]);
          sites += 1;
        }
      }
    }
    db.exec('COMMIT');
    if (roads > 0 && roads % 50_000 < 2000) console.log(`  ${roads} roads, ${roadPoints} points`);
  }
  db.exec('DROP TABLE osm_way_import');

  const meta = db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)');
  const importedAt = new Date().toISOString();
  meta.run('osm_imported_at', importedAt);
  meta.run('osm_places', String(places));
  meta.run('osm_roads', String(roads));
  meta.run('osm_road_points', String(roadPoints));
  meta.run('osm_sites', String(sites));
  meta.run('osm_source', PBF_URL);
  meta.run('osm_license', 'ODbL-1.0');
  db.close();
  console.log(`OpenStreetMap import finished at ${importedAt}`);
  console.log(`${places} places, ${roads} roads (${roadPoints} points), ${sites} airports/ports/industrial areas`);
}

if (isMainModule(import.meta.url)) {
  importOsm({ force: process.argv.includes('--force') }).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
