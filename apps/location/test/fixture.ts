import { DatabaseSync } from 'node:sqlite';
import { createSchema } from '../src/db.ts';

const SOUTH_INDIA = {
  type: 'Feature',
  properties: { NAME: 'India', ISO_A2: 'IN' },
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [70, 8],
        [85, 8],
        [85, 23],
        [70, 23],
        [70, 8],
      ],
    ],
  },
};

function insertPlace(
  db: DatabaseSync,
  place: {
    id: number;
    name: string;
    lat: number;
    lon: number;
    feature: string;
    admin1: string | null;
    admin2: string | null;
    population: number;
    elevation: number;
  },
): void {
  db.prepare(
    `INSERT INTO places (
      id, name, ascii_name, lat, lon, feature_code, admin1_code, admin2_code, population, elevation, dem, timezone
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Asia/Kolkata')`,
  ).run(
    place.id,
    place.name,
    place.name,
    place.lat,
    place.lon,
    place.feature,
    place.admin1,
    place.admin2,
    place.population,
    place.elevation,
    place.elevation,
  );
  db.prepare('INSERT INTO places_rtree (id, min_lat, max_lat, min_lon, max_lon) VALUES (?, ?, ?, ?, ?)').run(
    place.id,
    place.lat,
    place.lat,
    place.lon,
    place.lon,
  );
}

export function createCityFixture(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  createSchema(db);
  db.prepare('INSERT INTO admin1 (code, name, ascii_name) VALUES (?, ?, ?)').run('19', 'Karnataka', 'Karnataka');
  db.prepare('INSERT INTO admin1 (code, name, ascii_name) VALUES (?, ?, ?)').run('16', 'Maharashtra', 'Maharashtra');
  db.prepare('INSERT INTO admin2 (code, name, ascii_name, admin1_code) VALUES (?, ?, ?, ?)').run(
    '19.583',
    'Bengaluru Urban',
    'Bengaluru Urban',
    '19',
  );
  insertPlace(db, {
    id: 1,
    name: 'Bengaluru',
    lat: 12.9716,
    lon: 77.5946,
    feature: 'PPLA',
    admin1: '19',
    admin2: '583',
    population: 8_443_675,
    elevation: 920,
  });
  insertPlace(db, {
    id: 2,
    name: 'Mumbai',
    lat: 19.076,
    lon: 72.8777,
    feature: 'PPLA',
    admin1: '16',
    admin2: null,
    population: 12_442_373,
    elevation: 14,
  });
  insertPlace(db, {
    id: 3,
    name: 'Mysuru',
    lat: 12.2958,
    lon: 76.6394,
    feature: 'PPL',
    admin1: '19',
    admin2: null,
    population: 920_550,
    elevation: 763,
  });
  const postal = db
    .prepare(
      'INSERT INTO postal_codes (postal_code, place_name, admin1_name, admin2_name, lat, lon) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run('560001', 'Bengaluru GPO', 'Karnataka', 'Bengaluru Urban', 12.9766, 77.5993);
  db.prepare('INSERT INTO postal_rtree (id, min_lat, max_lat, min_lon, max_lon) VALUES (?, ?, ?, ?, ?)').run(
    Number(postal.lastInsertRowid),
    12.9766,
    12.9766,
    77.5993,
    77.5993,
  );
  db.prepare('INSERT INTO coverage (id, min_lat, max_lat, min_lon, max_lon, geometry_json) VALUES (1, ?, ?, ?, ?, ?)').run(
    8,
    23,
    70,
    85,
    JSON.stringify(SOUTH_INDIA),
  );
  db.prepare("INSERT INTO meta (key, value) VALUES ('seeded_at', 'test')").run();
  return db;
}

export function createDenseFixture(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  createSchema(db);
  const insert = db.prepare(
    `INSERT INTO places (
      id, name, ascii_name, lat, lon, feature_code, admin1_code, admin2_code, population, elevation, dem, timezone
    ) VALUES (?, ?, ?, ?, ?, 'PPL', '19', NULL, 1000, 900, 900, 'Asia/Kolkata')`,
  );
  const rtree = db.prepare('INSERT INTO places_rtree (id, min_lat, max_lat, min_lon, max_lon) VALUES (?, ?, ?, ?, ?)');
  const postal = db.prepare(
    "INSERT INTO postal_codes (postal_code, place_name, admin1_name, admin2_name, lat, lon) VALUES ('560001', 'Grid', 'Karnataka', 'Bengaluru Urban', ?, ?)",
  );
  const postalRtree = db.prepare(
    'INSERT INTO postal_rtree (id, min_lat, max_lat, min_lon, max_lon) VALUES (?, ?, ?, ?, ?)',
  );
  db.exec('BEGIN');
  let id = 1;
  for (let latStep = 0; latStep < 80; latStep += 1) {
    for (let lonStep = 0; lonStep < 80; lonStep += 1) {
      const lat = 12.4 + latStep * 0.01;
      const lon = 77.2 + lonStep * 0.01;
      insert.run(id, `Place ${id}`, `Place ${id}`, lat, lon);
      rtree.run(id, lat, lat, lon, lon);
      id += 1;
    }
  }
  for (let latStep = 0; latStep < 16; latStep += 1) {
    for (let lonStep = 0; lonStep < 16; lonStep += 1) {
      const lat = 12.45 + latStep * 0.05;
      const lon = 77.25 + lonStep * 0.05;
      const inserted = postal.run(lat, lon);
      postalRtree.run(Number(inserted.lastInsertRowid), lat, lat, lon, lon);
    }
  }
  db.exec('COMMIT');
  db.prepare('INSERT INTO coverage (id, min_lat, max_lat, min_lon, max_lon, geometry_json) VALUES (1, 12, 14, 77, 79, ?)').run(
    JSON.stringify({
      type: 'Polygon',
      coordinates: [
        [
          [77, 12],
          [79, 12],
          [79, 14],
          [77, 14],
          [77, 12],
        ],
      ],
    }),
  );
  db.prepare("INSERT INTO meta (key, value) VALUES ('seeded_at', 'dense')").run();
  return db;
}
