export function coerceNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

export function coerceInt(value: unknown, fallback = 0): number {
  return Math.trunc(coerceNumber(value, fallback));
}

export function idString(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && 'toString' in value) {
    const s = (value as { toString(): string }).toString();
    return s && s !== '[object Object]' ? s : undefined;
  }
  return String(value);
}
