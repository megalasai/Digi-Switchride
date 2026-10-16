import assert from 'node:assert/strict';
import test from 'node:test';
import { coverageFromGeometries } from '../src/coverage.ts';
import { Geocoder, LocationNotFoundError, OutsideIndiaError } from '../src/geocode.ts';
import { stateCodeFor } from '../src/states.ts';
import { createCityFixture } from './fixture.ts';

test('state codes follow ISO 3166-2 for India', () => {
  assert.equal(stateCodeFor('Karnataka'), 'KA');
  assert.equal(stateCodeFor('NCT of Delhi'), 'DL');
  assert.equal(stateCodeFor('Orissa'), 'OR');
  assert.equal(stateCodeFor('Dadra and Nagar Haveli'), 'DH');
  assert.equal(stateCodeFor('Somewhere else'), null);
});

test('point in polygon respects holes', () => {
  const coverage = coverageFromGeometries([
    {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
          [0, 0],
        ],
        [
          [4, 4],
          [6, 4],
          [6, 6],
          [4, 6],
          [4, 4],
        ],
      ],
    },
  ]);
  assert.equal(coverage.contains(1, 1), true);
  assert.equal(coverage.contains(5, 5), false);
  assert.equal(coverage.contains(11, 11), false);
});

test('reverse geocodes the nearest Indian locality from the database', () => {
  const geocoder = new Geocoder(createCityFixture(), 10);
  const { location, cache } = geocoder.reverse({ latitude: 12.98, longitude: 77.6, altitude: 950 });
  assert.equal(cache, 'miss');
  assert.equal(location.locality, 'Bengaluru');
  assert.equal(location.state, 'Karnataka');
  assert.equal(location.stateCode, 'KA');
  assert.equal(location.district, 'Bengaluru Urban');
  assert.equal(location.postalCode, '560001');
  assert.equal(location.countryCode, 'IN');
  assert.equal(location.elevation, 920);
  assert.equal(location.altitude, 950);
  assert.equal(location.altitudeAboveTerrain, 30);
  assert.ok(location.distanceMeters < 5_000);

  const mysuru = geocoder.reverse({ latitude: 12.3, longitude: 76.64, altitude: null });
  assert.equal(mysuru.location.locality, 'Mysuru');
  assert.equal(mysuru.location.altitude, null);
  assert.equal(mysuru.location.altitudeAboveTerrain, null);

  const mumbai = geocoder.reverse({ latitude: 19.08, longitude: 72.88, altitude: null });
  assert.equal(mumbai.location.locality, 'Mumbai');
  assert.equal(mumbai.location.stateCode, 'MH');
});

test('repeated coordinates use the cache and still report distance from the request', () => {
  const geocoder = new Geocoder(createCityFixture(), 10);
  const first = geocoder.reverse({ latitude: 12.97161, longitude: 77.59462, altitude: null });
  const second = geocoder.reverse({ latitude: 12.97164, longitude: 77.59464, altitude: 1000 });
  assert.equal(first.cache, 'miss');
  assert.equal(second.cache, 'hit');
  assert.equal(second.location.locality, 'Bengaluru');
  assert.equal(second.location.altitudeAboveTerrain, 80);
  assert.equal(geocoder.stats.cacheHits, 1);
});

test('prefers a populated city over a zero-population point on the same spot', () => {
  const db = createCityFixture();
  db.prepare(
    `INSERT INTO places (
      id, name, ascii_name, lat, lon, feature_code, admin1_code, admin2_code, population, elevation, dem, timezone
    ) VALUES (99, 'Dobbespet', 'Dobbespet', 12.9716, 77.5946, 'PPL', '19', '583', 0, 900, 900, 'Asia/Kolkata')`,
  ).run();
  db.prepare('INSERT INTO places_rtree (id, min_lat, max_lat, min_lon, max_lon) VALUES (99, 12.9716, 12.9716, 77.5946, 77.5946)').run();
  const geocoder = new Geocoder(db, 0);
  const { location } = geocoder.reverse({ latitude: 12.9716, longitude: 77.5946, altitude: null });
  assert.equal(location.locality, 'Bengaluru');
  db.close();
});

test('keeps a locality a few kilometres outside a coarse coastline', () => {
  const db = createCityFixture();
  db.prepare(
    `INSERT INTO places (
      id, name, ascii_name, lat, lon, feature_code, admin1_code, admin2_code, population, elevation, dem, timezone
    ) VALUES (50, 'Panaji', 'Panaji', 15, 84.98, 'PPLA', '19', NULL, 100000, 7, 7, 'Asia/Kolkata')`,
  ).run();
  db.prepare('INSERT INTO places_rtree (id, min_lat, max_lat, min_lon, max_lon) VALUES (50, 15, 15, 84.98, 84.98)').run();
  const geocoder = new Geocoder(db, 0);
  const coastal = geocoder.reverse({ latitude: 15, longitude: 85.015, altitude: null });
  assert.equal(coastal.location.locality, 'Panaji');
  assert.throws(() => geocoder.reverse({ latitude: 15, longitude: 86.2, altitude: null }), OutsideIndiaError);
  db.close();
});

test('includes a nearby OpenStreetMap place and road', () => {
  const db = createCityFixture();
  const place = db
    .prepare("INSERT INTO osm_places (osm_id, osm_type, name, kind, lat, lon) VALUES (10, 'node', 'Cubbon Park', 'suburb', 12.975, 77.595)")
    .run();
  db.prepare('INSERT INTO osm_places_rtree (id, min_lat, max_lat, min_lon, max_lon) VALUES (?, 12.975, 12.975, 77.595, 77.595)').run(
    Number(place.lastInsertRowid),
  );
  const road = db.prepare("INSERT INTO osm_roads (name, ref, highway) VALUES ('Kasturba Road', NULL, 'secondary')").run();
  const point = db
    .prepare('INSERT INTO osm_road_points (road_id, lat, lon) VALUES (?, 12.9719, 77.5948)')
    .run(Number(road.lastInsertRowid));
  db.prepare('INSERT INTO osm_road_points_rtree (id, min_lat, max_lat, min_lon, max_lon) VALUES (?, 12.9719, 12.9719, 77.5948, 77.5948)').run(
    Number(point.lastInsertRowid),
  );
  const geocoder = new Geocoder(db, 0);
  const { location } = geocoder.reverse({ latitude: 12.9716, longitude: 77.5946, altitude: null });
  assert.equal(location.osm.place?.name, 'Cubbon Park');
  assert.equal(location.osm.place?.kind, 'suburb');
  assert.equal(location.osm.road?.name, 'Kasturba Road');
  assert.equal(location.osm.road?.highway, 'secondary');
  assert.equal(location.osm.airport, null);
  db.close();
});

test('rejects coordinates outside India and empty regions', () => {
  const geocoder = new Geocoder(createCityFixture(), 0);
  assert.throws(() => geocoder.reverse({ latitude: 51.5074, longitude: -0.1278, altitude: null }), OutsideIndiaError);
  assert.throws(() => geocoder.reverse({ latitude: 10, longitude: 71, altitude: 5 }), LocationNotFoundError);
  assert.equal(geocoder.stats.cacheMisses, 1);
});
