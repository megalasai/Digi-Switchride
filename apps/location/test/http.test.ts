import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApp } from '../src/app.ts';
import { createCityFixture } from './fixture.ts';

test('reverse endpoint accepts GET and POST with optional altitude', async () => {
  const db = createCityFixture();
  const { app } = buildApp(db, { apiKeys: new Map(), corsOrigin: '*', cacheSize: 10, env: 'test' });
  const query = await app.inject({
    method: 'GET',
    url: '/v1/locations/reverse?latitude=12.9716&longitude=77.5946&altitude=930',
  });
  assert.equal(query.statusCode, 200);
  assert.equal(query.headers['x-cache'], 'miss');
  const body = query.json();
  assert.equal(body.locality, 'Bengaluru');
  assert.equal(body.postalCode, '560001');
  assert.equal(body.altitudeAboveTerrain, 10);

  const posted = await app.inject({
    method: 'POST',
    url: '/v1/locations/reverse',
    payload: { latitude: 19.076, longitude: 72.8777 },
  });
  assert.equal(posted.statusCode, 200);
  assert.equal(posted.json().locality, 'Mumbai');
  assert.equal(posted.json().altitude, null);

  const invalid = await app.inject({ method: 'GET', url: '/v1/locations/reverse?latitude=12.97' });
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.json().error, 'VALIDATION');

  const outside = await app.inject({
    method: 'GET',
    url: '/v1/locations/reverse?latitude=51.5&longitude=-0.12',
  });
  assert.equal(outside.statusCode, 422);
  assert.equal(outside.json().error, 'OUTSIDE_INDIA');

  const health = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(health.statusCode, 200);
  await app.close();
  db.close();
});

test('API keys let separate applications call the same service', async () => {
  const db = createCityFixture();
  const keys = new Map<string, string>([
    ['switchride-key', 'switchride'],
    ['fleet-key', 'fleet'],
  ]);
  const { app } = buildApp(db, { apiKeys: keys, corsOrigin: '*', cacheSize: 0, env: 'test' });

  const open = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(open.statusCode, 200);

  const denied = await app.inject({
    method: 'GET',
    url: '/v1/locations/reverse?latitude=12.97&longitude=77.59',
  });
  assert.equal(denied.statusCode, 401);

  const allowed = await app.inject({
    method: 'GET',
    url: '/v1/locations/reverse?latitude=12.97&longitude=77.59',
    headers: { authorization: 'Bearer fleet-key' },
  });
  assert.equal(allowed.statusCode, 200);
  assert.equal(allowed.headers['x-app-id'], 'fleet');
  assert.equal(allowed.json().stateCode, 'KA');
  await app.close();
  db.close();
});
