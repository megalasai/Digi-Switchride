import cluster from 'node:cluster';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { start } from './main.js';
import { seedDatabase } from './seed.js';

if (cluster.isPrimary) {
  const baked = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/india.sqlite');
  let config = loadConfig();
  const missing = (file: string) => !fs.existsSync(file) || fs.statSync(file).size === 0;
  if (missing(config.dbPath) && !missing(baked)) {
    process.env.LOCATION_DB = baked;
    config = loadConfig();
    console.log(`Using packaged India location database at ${baked}`);
  }
  if (missing(config.dbPath)) {
    console.log(`No location database at ${config.dbPath}. Building it from cached GeoNames dumps...`);
    await seedDatabase();
  }
}

await start();
