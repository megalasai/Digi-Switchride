import cluster from 'node:cluster';
import fs from 'node:fs';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { openDatabase } from './db.js';
import { isMainModule } from './module.js';

export async function start(): Promise<void> {
  const config = loadConfig();
  if (config.workers > 1 && cluster.isPrimary) {
    console.log(`India location service starting ${config.workers} workers`);
    for (let index = 0; index < config.workers; index += 1) cluster.fork();
    cluster.on('exit', (worker, code) => {
      console.error(`location worker ${worker.process.pid ?? ''} exited with ${code}; restarting`);
      cluster.fork();
    });
    return;
  }

  if (!fs.existsSync(config.dbPath)) {
    throw new Error(`Location database not found at ${config.dbPath}. Run npm run seed in apps/location.`);
  }

  const db = openDatabase(config.dbPath, true);
  const { app, geocoder } = buildApp(db, config);
  if (config.env === 'production' && config.apiKeys.size === 0) {
    console.warn('LOCATION_API_KEYS is empty. The reverse-geocode API is open to every caller.');
  }

  const shutdown = async () => {
    await app.close();
    db.close();
    process.exit(0);
  };
  process.once('SIGINT', () => {
    void shutdown();
  });
  process.once('SIGTERM', () => {
    void shutdown();
  });

  await app.listen({ port: config.port, host: config.host });
  console.log(
    `India location API listening on http://${config.host}:${config.port} (${geocoder.placeCount} places, ${geocoder.postalCount} PIN codes)`,
  );
}

if (isMainModule(import.meta.url)) {
  start().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
