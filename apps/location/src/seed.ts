import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { strFromU8, unzipSync } from 'fflate';
import { coverageFromGeometries, geometriesFromGeoJson, type GeoJsonGeometry } from './coverage.js';
import { ensureParentDir, loadConfig } from './config.js';
import { createSchema } from './db.js';
import { isMainModule } from './module.js';
import { adminKey } from './names.js';
import { parseAdmin1Line, parseAdmin2Line, parsePlaceLine, parsePostalLine } from './parse.js';

const PLACES_ZIP = 'https://download.geonames.org/export/dump/IN.zip';
const ADMIN1_URL = 'https://download.geonames.org/export/dump/admin1CodesASCII.txt';
const ADMIN2_URL = 'https://download.geonames.org/export/dump/admin2Codes.txt';
const POSTAL_ZIP = 'https://download.geonames.org/export/zip/IN.zip';
const COVERAGE_URLS = [
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson',
  'https://raw.githubusercontent.com/johan/world.geo.json/master/countries/IND.geojson',
];

function forEachLine(text: string, visit: (line: string) => void): void {
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) === 10) {
      visit(text.slice(start, index));
      start = index + 1;
    }
  }
  if (start < text.length) visit(text.slice(start));
}

async function download(url: string, dest: string, refresh: boolean): Promise<void> {
  if (!refresh && fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    console.log(`using cached ${path.basename(dest)}`);
    return;
  }
  console.log(`downloading ${url}`);
  const response = await fetch(url, {
    headers: { 'user-agent': 'Digi-Switchride-Location/1.0' },
    signal: AbortSignal.timeout(180_000),
    redirect: 'follow',
  });
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}) for ${url}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 100) {
    throw new Error(`Download from ${url} was empty`);
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const partial = `${dest}.part`;
  fs.writeFileSync(partial, bytes);
  fs.renameSync(partial, dest);
  console.log(`saved ${path.basename(dest)} (${bytes.length} bytes)`);
}

function readZipEntry(zipPath: string, entryName: string): string {
  const files = unzipSync(new Uint8Array(fs.readFileSync(zipPath)));
  const match = Object.keys(files).find((name) => name === entryName || name.endsWith(`/${entryName}`));
  if (!match) {
    throw new Error(`${entryName} was not found in ${path.basename(zipPath)} (${Object.keys(files).join(', ')})`);
  }
  return strFromU8(files[match]);
}

function removeSqliteFiles(filePath: string): void {
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    const candidate = `${filePath}${suffix}`;
    if (fs.existsSync(candidate)) fs.rmSync(candidate);
  }
}

function storedCoverage(geometries: GeoJsonGeometry[]): { json: string; bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number } } {
  const coverage = coverageFromGeometries(geometries);
  const json = JSON.stringify({
    type: 'FeatureCollection',
    features: geometries.map((geometry) => ({
      type: 'Feature',
      properties: { NAME: 'India', ISO_A2: 'IN' },
      geometry,
    })),
  });
  return { json, bbox: coverage.bbox };
}

export async function seedDatabase(options?: { force?: boolean; refresh?: boolean }): Promise<void> {
  const force = options?.force ?? false;
  const refresh = options?.refresh ?? false;
  const config = loadConfig();
  ensureParentDir(config.dbPath);
  fs.mkdirSync(config.rawDir, { recursive: true });

  if (fs.existsSync(config.dbPath) && !force) {
    console.log(`Database already exists at ${config.dbPath}. Pass --force to rebuild it.`);
    return;
  }

  const placesZip = path.join(config.rawDir, 'IN.zip');
  const admin1Path = path.join(config.rawDir, 'admin1CodesASCII.txt');
  const admin2Path = path.join(config.rawDir, 'admin2Codes.txt');
  const postalZip = path.join(config.rawDir, 'postal-IN.zip');
  const coveragePath = path.join(config.rawDir, 'india-coverage.geojson');

  await download(PLACES_ZIP, placesZip, refresh);
  await download(ADMIN1_URL, admin1Path, refresh);
  await download(ADMIN2_URL, admin2Path, refresh);
  await download(POSTAL_ZIP, postalZip, refresh);

  if (refresh || !fs.existsSync(coveragePath) || fs.statSync(coveragePath).size === 0) {
    let saved = false;
    let lastError: unknown;
    for (const url of COVERAGE_URLS) {
      try {
        await download(url, coveragePath, true);
        geometriesFromGeoJson(JSON.parse(fs.readFileSync(coveragePath, 'utf8')) as unknown);
        saved = true;
        break;
      } catch (error) {
        lastError = error;
        fs.rmSync(coveragePath, { force: true });
        console.warn(error instanceof Error ? error.message : error);
      }
    }
    if (!saved) throw lastError instanceof Error ? lastError : new Error('Could not download an India boundary');
  } else {
    console.log(`using cached ${path.basename(coveragePath)}`);
  }

  const building = `${config.dbPath}.building`;
  removeSqliteFiles(building);
  const db = new DatabaseSync(building);
  db.exec('PRAGMA journal_mode = OFF');
  db.exec('PRAGMA synchronous = OFF');
  db.exec('PRAGMA temp_store = MEMORY');
  db.exec('PRAGMA cache_size = -131072');
  createSchema(db);

  const insertAdmin1 = db.prepare('INSERT OR REPLACE INTO admin1 (code, name, ascii_name) VALUES (?, ?, ?)');
  const insertAdmin2 = db.prepare(
    'INSERT OR REPLACE INTO admin2 (code, name, ascii_name, admin1_code) VALUES (?, ?, ?, ?)',
  );
  let states = 0;
  let districts = 0;
  db.exec('BEGIN');
  forEachLine(fs.readFileSync(admin1Path, 'utf8'), (line) => {
    const admin = parseAdmin1Line(line);
    if (!admin) return;
    insertAdmin1.run(admin.code, admin.name, admin.asciiName);
    states += 1;
  });
  forEachLine(fs.readFileSync(admin2Path, 'utf8'), (line) => {
    const admin = parseAdmin2Line(line);
    if (!admin?.admin1Code) return;
    insertAdmin2.run(admin.code, admin.name, admin.asciiName, admin.admin1Code);
    districts += 1;
  });
  db.exec('COMMIT');
  console.log(`loaded ${states} states and ${districts} districts`);

  console.log('importing populated places');
  const insertPlace = db.prepare(
    `INSERT OR IGNORE INTO places (
      id, name, ascii_name, lat, lon, feature_code, admin1_code, admin2_code, population, elevation, dem, timezone
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertPlaceRtree = db.prepare(
    'INSERT INTO places_rtree (id, min_lat, max_lat, min_lon, max_lon) VALUES (?, ?, ?, ?, ?)',
  );
  let places = 0;
  db.exec('BEGIN');
  forEachLine(readZipEntry(placesZip, 'IN.txt'), (line) => {
    const place = parsePlaceLine(line);
    if (!place) return;
    const inserted = insertPlace.run(
      place.id,
      place.name,
      place.asciiName,
      place.lat,
      place.lon,
      place.featureCode,
      place.admin1Code,
      place.admin2Code,
      place.population,
      place.elevation,
      place.dem,
      place.timezone,
    );
    if (inserted.changes !== 1) return;
    insertPlaceRtree.run(place.id, place.lat, place.lat, place.lon, place.lon);
    places += 1;
    if (places % 100_000 === 0) console.log(`  ${places} places`);
  });
  db.exec('COMMIT');
  console.log(`imported ${places} places`);
  if (places === 0) throw new Error('GeoNames India dump did not contain populated places');

  console.log('importing PIN codes');
  const insertPostal = db.prepare(
    `INSERT INTO postal_codes (
      postal_code, place_name, admin1_name, admin2_name, admin1_key, admin2_key, lat, lon
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertPostalRtree = db.prepare(
    'INSERT INTO postal_rtree (id, min_lat, max_lat, min_lon, max_lon) VALUES (?, ?, ?, ?, ?)',
  );
  let postalCodes = 0;
  db.exec('BEGIN');
  forEachLine(readZipEntry(postalZip, 'IN.txt'), (line) => {
    const postal = parsePostalLine(line);
    if (!postal) return;
    const inserted = insertPostal.run(
      postal.postalCode,
      postal.placeName,
      postal.admin1Name,
      postal.admin2Name,
      adminKey(postal.admin1Name),
      adminKey(postal.admin2Name),
      postal.lat,
      postal.lon,
    );
    insertPostalRtree.run(Number(inserted.lastInsertRowid), postal.lat, postal.lat, postal.lon, postal.lon);
    postalCodes += 1;
    if (postalCodes % 50_000 === 0) console.log(`  ${postalCodes} PIN codes`);
  });
  db.exec('COMMIT');
  console.log(`imported ${postalCodes} PIN codes`);

  const geometries = geometriesFromGeoJson(JSON.parse(fs.readFileSync(coveragePath, 'utf8')) as unknown);
  const coverage = storedCoverage(geometries);
  db.prepare(
    'INSERT INTO coverage (id, min_lat, max_lat, min_lon, max_lon, geometry_json) VALUES (1, ?, ?, ?, ?, ?)',
  ).run(coverage.bbox.minLat, coverage.bbox.maxLat, coverage.bbox.minLon, coverage.bbox.maxLon, coverage.json);

  const meta = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)');
  const seededAt = new Date().toISOString();
  meta.run('seeded_at', seededAt);
  meta.run('places', String(places));
  meta.run('postal_codes', String(postalCodes));
  meta.run('places_source', PLACES_ZIP);
  meta.run('postal_source', POSTAL_ZIP);
  meta.run('boundary_source', COVERAGE_URLS[0]);
  meta.run('license', 'GeoNames CC-BY-4.0; Natural Earth public domain');

  db.exec('PRAGMA journal_mode = DELETE');
  db.exec('PRAGMA synchronous = NORMAL');
  db.close();

  removeSqliteFiles(config.dbPath);
  fs.renameSync(building, config.dbPath);
  console.log(`wrote ${config.dbPath}`);
  console.log(`${places} places, ${postalCodes} PIN codes, seeded ${seededAt}`);
}

if (isMainModule(import.meta.url)) {
  const force = process.argv.includes('--force');
  const refresh = process.argv.includes('--refresh');
  seedDatabase({ force, refresh }).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
