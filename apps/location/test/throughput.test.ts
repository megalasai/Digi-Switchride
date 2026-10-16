import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import { buildApp } from '../src/app.ts';
import { createDenseFixture } from './fixture.ts';

function requestOnce(port: number, path: string, agent: http.Agent): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = http.get({ hostname: '127.0.0.1', port, path, agent }, (response) => {
      response.resume();
      response.on('end', () => {
        if (response.statusCode === 200) resolve();
        else reject(new Error(`unexpected status ${response.statusCode}`));
      });
    });
    request.on('error', reject);
  });
}

test('API serves more than 100,000 reverse lookups in 10 minutes', async () => {
  const db = createDenseFixture();
  const { app } = buildApp(db, { apiKeys: new Map(), corsOrigin: '*', cacheSize: 0, env: 'test' });
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  assert.ok(address && typeof address !== 'string');

  const seconds = 3;
  const concurrency = 32;
  const agent = new http.Agent({ keepAlive: true, maxSockets: concurrency });
  const deadline = performance.now() + seconds * 1000;
  let completed = 0;

  await Promise.all(
    Array.from({ length: concurrency }, (_, worker) =>
      (async () => {
        let n = 0;
        while (performance.now() < deadline) {
          const lat = 12.55 + ((worker + n) % 60) * 0.01;
          const lon = 77.35 + ((worker * 2 + n) % 60) * 0.01;
          await requestOnce(address.port, `/v1/locations/reverse?latitude=${lat}&longitude=${lon}`, agent);
          completed += 1;
          n += 1;
        }
      })(),
    ),
  );

  agent.destroy();
  await app.close();
  db.close();

  const perTenMinutes = (completed / seconds) * 600;
  console.log(
    `${completed} requests in ${seconds}s with cache disabled (${Math.round(perTenMinutes).toLocaleString('en-IN')} / 10 minutes)`,
  );
  assert.ok(
    perTenMinutes > 100_000,
    `projected ${Math.round(perTenMinutes)} requests / 10 minutes from ${completed} requests in ${seconds}s`,
  );
});
