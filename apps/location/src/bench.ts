import http from 'node:http';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { openDatabase } from './db.js';

const POINTS: Array<[number, number]> = [
  [12.9716, 77.5946],
  [19.076, 72.8777],
  [28.6139, 77.209],
  [13.0827, 80.2707],
  [22.5726, 88.3639],
  [17.385, 78.4867],
  [26.9124, 75.7873],
  [9.9312, 76.2673],
];

function requestOnce(port: number, path: string, agent: http.Agent): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = http.get({ hostname: '127.0.0.1', port, path, agent }, (response) => {
      response.resume();
      response.on('end', () => {
        if (response.statusCode === 200) resolve();
        else reject(new Error(`HTTP ${response.statusCode} for ${path}`));
      });
    });
    request.on('error', reject);
  });
}

async function measure(port: number, seconds: number, concurrency: number): Promise<number> {
  const agent = new http.Agent({ keepAlive: true, maxSockets: concurrency });
  const deadline = performance.now() + seconds * 1000;
  let completed = 0;
  const workers = Array.from({ length: concurrency }, (_, worker) =>
    (async () => {
      let n = 0;
      while (performance.now() < deadline) {
        const [lat, lon] = POINTS[(worker + n) % POINTS.length];
        const jitter = ((n + worker) % 25) * 0.0001;
        await requestOnce(
          port,
          `/v1/locations/reverse?latitude=${lat + jitter}&longitude=${lon + jitter}`,
          agent,
        );
        completed += 1;
        n += 1;
      }
    })(),
  );
  await Promise.all(workers);
  agent.destroy();
  return completed;
}

const config = loadConfig();
const db = openDatabase(config.dbPath, true);
const { app } = buildApp(db, { ...config, cacheSize: 0, env: 'test' });
await app.listen({ port: 0, host: '127.0.0.1' });
const address = app.server.address();
if (!address || typeof address === 'string') throw new Error('Benchmark server did not bind a port');

const seconds = 8;
const concurrency = 32;
const completed = await measure(address.port, seconds, concurrency);
const perSecond = completed / seconds;
const perTenMinutes = Math.round(perSecond * 600);
console.log(`${completed} requests in ${seconds}s`);
console.log(`${perSecond.toFixed(0)} requests/second with the cache disabled`);
console.log(`${perTenMinutes.toLocaleString('en-IN')} requests / 10 minutes`);

await app.close();
db.close();
if (perTenMinutes <= 100_000) {
  console.error('Throughput is below 100,000 requests / 10 minutes');
  process.exit(1);
}
