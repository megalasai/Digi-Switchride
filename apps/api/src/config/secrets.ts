import { ConfigService } from '@nestjs/config';

/** Empty App Platform SECRET vars are "" — ConfigService then skips the default. */
export function readSecret(config: ConfigService, key: string, fallback: string): string {
  const value = normalizeSecret(config.get<string>(key) ?? process.env[key] ?? '');
  return value.length > 0 ? value : fallback;
}

export function normalizeSecret(value: string): string {
  return String(value ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .trim();
}
