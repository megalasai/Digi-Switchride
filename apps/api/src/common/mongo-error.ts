export function mongoDuplicateMessage(err: unknown): string | null {
  const e = err as { code?: number; message?: string; keyPattern?: Record<string, unknown>; keyValue?: Record<string, unknown> };
  if (e?.code !== 11000 && !String(e?.message ?? '').includes('E11000')) return null;
  const keys = Object.keys(e.keyPattern ?? e.keyValue ?? {});
  const key = keys.find((k) => k !== 'tenantId') ?? keys[0] ?? '';
  const blob = `${key} ${e.message ?? ''}`.toLowerCase();
  if (blob.includes('phone')) return 'A rider with this mobile number already exists in this company';
  if (blob.includes('username')) return 'A rider with this username already exists in this company';
  if (blob.includes('referral')) return 'Could not allocate a referral code. Try again.';
  if (blob.includes('email')) return 'A rider with this email already exists in this company';
  return 'This rider already exists';
}
