import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { loadConfig } from '../src/config.ts';
import { openDatabase } from '../src/db.ts';
import { Geocoder } from '../src/geocode.ts';

const samples = [
  { name: 'Bengaluru', latitude: 12.9716, longitude: 77.5946, state: 'Karnataka', locality: /Bengaluru|Bangalore/i, postal: /^560/ },
  { name: 'Mumbai', latitude: 19.076, longitude: 72.8777, state: 'Maharashtra' },
  { name: 'Kochi', latitude: 9.9312, longitude: 76.2673, state: 'Kerala' },
  { name: 'Kavaratti', latitude: 10.5667, longitude: 72.642, state: 'Lakshadweep' },
  { name: 'Delhi', latitude: 28.6139, longitude: 77.209, state: 'Delhi' },
  { name: 'Chennai', latitude: 13.0827, longitude: 80.2707, state: 'Tamil Nadu' },
  { name: 'Kolkata', latitude: 22.5726, longitude: 88.3639, state: 'West Bengal' },
  { name: 'Port Blair', latitude: 11.6234, longitude: 92.7265, state: 'Andaman' },
];

const dbPath = loadConfig().dbPath;

test('seeded India database resolves major cities', { skip: !fs.existsSync(dbPath) }, () => {
  const db = openDatabase(dbPath, true);
  const geocoder = new Geocoder(db, 0);
  assert.ok(geocoder.placeCount > 10_000);

  for (const sample of samples) {
    const { location } = geocoder.reverse({
      latitude: sample.latitude,
      longitude: sample.longitude,
      altitude: 50,
    });
    assert.equal(location.countryCode, 'IN', sample.name);
    assert.match(location.state ?? '', new RegExp(sample.state, 'i'), `${sample.name} state`);
    assert.match(location.locality, sample.locality ?? /[A-Za-z]/, sample.name);
    assert.ok(location.distanceMeters < 25_000, `${sample.name} matched ${location.locality} at ${location.distanceMeters}m`);
    assert.match(location.postalCode ?? '', sample.postal ?? /^\d{6}$/, `${sample.name} PIN`);
    if (sample.name === 'Bengaluru' && location.osm.place) {
      assert.ok(location.osm.place.distanceMeters < 15_000, location.osm.place.name);
    }
  }

  const started = performance.now();
  const iterations = 1_000;
  for (let index = 0; index < iterations; index += 1) {
    const sample = samples[index % samples.length];
    geocoder.reverse({
      latitude: sample.latitude + (index % 7) * 0.0001,
      longitude: sample.longitude + (index % 5) * 0.0001,
      altitude: null,
    });
  }
  const perTenMinutes = (iterations / ((performance.now() - started) / 1000)) * 600;
  assert.ok(perTenMinutes > 100_000, `database path projected ${Math.round(perTenMinutes)} requests / 10 minutes`);
  db.close();
});
