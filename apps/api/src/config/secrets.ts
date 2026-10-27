import { ConfigService } from '@nestjs/config';

/** Empty App Platform SECRET vars are "" — ConfigService then skips the default. */
export function readSecret(config: ConfigService, key: string, fallback: string): string {
  const value = (config.get<string>(key) ?? process.env[key] ?? '').trim();
  return value.length > 0 ? value : fallback;
}
