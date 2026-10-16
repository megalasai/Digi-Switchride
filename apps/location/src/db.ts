import { DatabaseSync } from 'node:sqlite';

export function createSchema(db: DatabaseSync): void {
  db.exec(`
    PRAGMA page_size = 8192;

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin1 (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      ascii_name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin2 (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      ascii_name TEXT NOT NULL,
      admin1_code TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS places (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      ascii_name TEXT NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      feature_code TEXT NOT NULL,
      admin1_code TEXT,
      admin2_code TEXT,
      population INTEGER NOT NULL DEFAULT 0,
      elevation INTEGER,
      dem INTEGER,
      timezone TEXT
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS places_rtree USING rtree(
      id,
      min_lat, max_lat,
      min_lon, max_lon
    );

    CREATE TABLE IF NOT EXISTS postal_codes (
      id INTEGER PRIMARY KEY,
      postal_code TEXT NOT NULL,
      place_name TEXT NOT NULL,
      admin1_name TEXT,
      admin2_name TEXT,
      admin1_key TEXT,
      admin2_key TEXT,
      lat REAL NOT NULL,
      lon REAL NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_postal_admin ON postal_codes(admin1_key, admin2_key);

    CREATE VIRTUAL TABLE IF NOT EXISTS postal_rtree USING rtree(
      id,
      min_lat, max_lat,
      min_lon, max_lon
    );

    CREATE TABLE IF NOT EXISTS osm_places (
      id INTEGER PRIMARY KEY,
      osm_id INTEGER NOT NULL,
      osm_type TEXT NOT NULL,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS osm_places_rtree USING rtree(
      id,
      min_lat, max_lat,
      min_lon, max_lon
    );

    CREATE TABLE IF NOT EXISTS osm_roads (
      id INTEGER PRIMARY KEY,
      name TEXT,
      ref TEXT,
      highway TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS osm_road_points (
      id INTEGER PRIMARY KEY,
      road_id INTEGER NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS osm_road_points_rtree USING rtree(
      id,
      min_lat, max_lat,
      min_lon, max_lon
    );

    CREATE TABLE IF NOT EXISTS osm_sites (
      id INTEGER PRIMARY KEY,
      osm_id INTEGER NOT NULL,
      osm_type TEXT NOT NULL,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS osm_sites_rtree USING rtree(
      id,
      min_lat, max_lat,
      min_lon, max_lon
    );

    CREATE TABLE IF NOT EXISTS coverage (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      min_lat REAL NOT NULL,
      max_lat REAL NOT NULL,
      min_lon REAL NOT NULL,
      max_lon REAL NOT NULL,
      geometry_json TEXT NOT NULL
    );
  `);
}

export function openDatabase(filePath: string, readOnly: boolean): DatabaseSync {
  const db = new DatabaseSync(filePath, { readOnly, timeout: 5_000 });
  db.exec('PRAGMA temp_store = MEMORY');
  db.exec('PRAGMA cache_size = -65536');
  db.exec('PRAGMA mmap_size = 268435456');
  if (readOnly) {
    db.exec('PRAGMA query_only = ON');
  }
  return db;
}
