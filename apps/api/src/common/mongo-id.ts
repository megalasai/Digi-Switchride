import { Types } from 'mongoose';

/** JSON restores often store `_id` as a 24-char string; mongoose `findById` only matches ObjectId. */
export function mongoIdCandidates(id: string): unknown[] {
  const values: unknown[] = [id];
  if (Types.ObjectId.isValid(id)) {
    try {
      values.push(new Types.ObjectId(id));
    } catch {
      /* ignore invalid constructor */
    }
  }
  return values;
}

export function mongoIdFilter(id: string) {
  return { $or: mongoIdCandidates(id).map((value) => ({ _id: value })) };
}

export async function findByEitherId(
  model: { findOne: (filter: object) => unknown },
  id: string | null | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  if (!id) return null;
  return model.findOne(mongoIdFilter(id) as never);
}
