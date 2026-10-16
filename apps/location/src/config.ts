import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(moduleDir, '..');

function loadEnvFile(): void {
  const envPath = path.join(packageRoot, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export type Config = {
  port: number;
  host: string;
  dbPath: string;
  rawDir: string;
  cacheSize: number;
  workers: number;
  corsOrigin: string;
  apiKeys: Map<string, string>;
  env: string;
};

function parseApiKeys(raw: string | undefined): Map<string, string> {
  const keys = new Map<string, string>();
  if (!raw?.trim()) return keys;
  for (const part of raw.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const separator = trimmed.indexOf(':');
    if (separator <= 0) {
      throw new Error('LOCATION_API_KEYS entries must look like app-name:secret');
    }
    const name = trimmed.slice(0, separator).trim();
    const key = trimmed.slice(separator + 1).trim();
    if (!name || !key) {
      throw new Error('LOCATION_API_KEYS entries must look like app-name:secret');
    }
    keys.set(key, name);
  }
  return keys;
}

function parseWorkers(raw: string | undefined): number {
  if (!raw || raw === '1') return 1;
  if (raw === 'auto') return os.availableParallelism();
  const workers = Number(raw);
  if (!Number.isInteger(workers) || workers < 1 || workers > 64) {
    throw new Error('LOCATION_WORKERS must be a positive integer up to 64, or "auto"');
  }
  return workers;
}

function parseCacheSize(raw: string | undefined): number {
  if (raw === undefined || raw === '') return 50_000;
  const size = Number(raw);
  if (!Number.isInteger(size) || size < 0 || size > 2_000_000) {
    throw new Error('LOCATION_CACHE_SIZE must be an integer from 0 to 2000000');
  }
  return size;
}

function parsePort(raw: string | undefined): number {
  if (!raw) return 4100;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer from 1 to 65535');
  }
  return port;
}

export function loadConfig(): Config {
  loadEnvFile();
  const major = Number(process.versions.node.split('.')[0]);
  const minor = Number(process.versions.node.split('.')[1]);
  if (major < 22 || (major === 22 && minor < 13)) {
    throw new Error('The location service requires Node.js 22.13 or newer (built-in node:sqlite).');
  }

  const dbPath = path.resolve(process.env.LOCATION_DB ?? path.join(packageRoot, 'data', 'india.sqlite'));
  return {
    port: parsePort(process.env.PORT),
    host: process.env.HOST?.trim() || '0.0.0.0',
    dbPath,
    rawDir: path.resolve(process.env.LOCATION_RAW_DIR ?? path.join(path.dirname(dbPath), 'raw')),
    cacheSize: parseCacheSize(process.env.LOCATION_CACHE_SIZE),
    workers: parseWorkers(process.env.LOCATION_WORKERS),
    corsOrigin: process.env.LOCATION_CORS_ORIGIN?.trim() || '*',
    apiKeys: parseApiKeys(process.env.LOCATION_API_KEYS),
    env: process.env.NODE_ENV?.trim() || 'development',
  };
}

export function ensureParentDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}
