import cluster from 'node:cluster';
import fs from 'node:fs';
import { loadConfig } from './config.js';
import { start } from './main.js';
import { seedDatabase } from './seed.js';

if (cluster.isPrimary) {
  const config = loadConfig();
  if (!fs.existsSync(config.dbPath) || fs.statSync(config.dbPath).size === 0) {
    console.log(`No location database at ${config.dbPath}. Downloading open India data...`);
    await seedDatabase();
  }
}

await start();
