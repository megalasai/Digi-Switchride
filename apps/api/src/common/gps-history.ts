/** Keep every GPS ping for reports and history playback. */
export const GPS_HISTORY_TTL_SECONDS = 180 * 24 * 60 * 60;

export async function ensureGpsHistoryTtl(collection: { indexes: (...args: unknown[]) => Promise<unknown>; dropIndex: (name: string) => Promise<unknown>; createIndex: (...args: unknown[]) => Promise<unknown> }) {
  const indexes = (await collection.indexes()) as { name?: string; key?: Record<string, number>; expireAfterSeconds?: number }[];
  const ttl = indexes.find((index) => index.key && Object.keys(index.key).length === 1 && index.key.at === 1);
  if (ttl?.expireAfterSeconds === GPS_HISTORY_TTL_SECONDS) return;
  if (ttl?.name) await collection.dropIndex(ttl.name).catch(() => undefined);
  await collection.createIndex({ at: 1 }, { expireAfterSeconds: GPS_HISTORY_TTL_SECONDS });
}
