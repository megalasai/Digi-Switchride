import mongoose, { Types } from 'mongoose';

/** JSON restores often store `_id` as a 24-char string; mongoose `findById` only matches ObjectId. */
export function isHexObjectId(id: string): boolean {
  return /^[a-fA-F0-9]{24}$/.test(id);
}

export function mongoIdCandidates(id: string): unknown[] {
  const values: unknown[] = [id];
  if (isHexObjectId(id)) {
    try {
      values.push(new Types.ObjectId(id));
    } catch {
      /* ignore invalid constructor */
    }
  }
  return values;
}

export function extractMongoId(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    const record = value as { $oid?: unknown; oid?: unknown; toHexString?: () => string; toString?: () => string };
    if (typeof record.$oid === 'string') return record.$oid;
    if (typeof record.oid === 'string') return record.oid;
    if (typeof record.toHexString === 'function') return record.toHexString();
    if (typeof record.toString === 'function') {
      const text = record.toString();
      if (text && text !== '[object Object]') return text;
    }
  }
  return '';
}

export function relatedIdFilter(field: string, id: string) {
  const value = extractMongoId(id) || String(id);
  const values = mongoIdCandidates(value);
  return {
    $or: [
      { [field]: { $in: values } },
      { [`${field}.$oid`]: value },
      { $expr: { $eq: [{ $toString: { $ifNull: [`$${field}.$oid`, `$${field}`] } }, value] } },
    ],
  };
}

export function relatedIdsFilter(field: string, ids: string[]) {
  const values = [...new Set(ids.map((id) => extractMongoId(id) || String(id)).filter(Boolean))];
  const objectIds = values.flatMap((id) => mongoIdCandidates(id));
  return {
    $or: [
      { [field]: { $in: objectIds } },
      { [`${field}.$oid`]: { $in: values } },
      { $expr: { $in: [{ $toString: { $ifNull: [`$${field}.$oid`, `$${field}`] } }, values] } },
    ],
  };
}

export function mongoIdFilter(id: string) {
  return { $or: mongoIdCandidates(id).map((value) => ({ _id: value })) };
}

export function stringFieldEquals(field: string, id: string) {
  return { $expr: { $eq: [{ $toString: `$${field}` }, String(id)] } };
}

export function stringFieldIn(field: string, ids: string[]) {
  const values = [...new Set(ids.map(String).filter(Boolean))];
  return { $expr: { $in: [{ $toString: `$${field}` }, values] } };
}

export async function findByEitherId(
  model: { findOne: (filter: object) => unknown },
  id: string | null | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  if (!id) return null;
  const byExpr = await model.findOne({ $expr: { $eq: [{ $toString: '$_id' }, id] } } as never);
  if (byExpr) return byExpr;
  return model.findOne(mongoIdFilter(id) as never);
}

let savePatched = false;

/** JSON restore stored `_id` as a string; mongoose `save()` looks up ObjectId and throws DocumentNotFoundError. */
export function patchMongooseRestoredIds() {
  if (savePatched) return;
  savePatched = true;
  const proto = mongoose.Document.prototype;
  const originalSave = proto.save;
  proto.save = function patchedSave(this: mongoose.Document, options?: unknown, callback?: unknown) {
    let opts = options;
    let cb = callback;
    if (typeof options === 'function') {
      cb = options;
      opts = undefined;
    }
    const run = async () => {
      try {
        return await originalSave.call(this, opts as never);
      } catch (err) {
        if (!isOptimisticSaveError(err)) throw err;
        const id = this._id != null ? String(this._id) : '';
        if (!id) throw err;
        const matched = await persistById(this.$model().collection, id, snapshotForPersist(this));
        if (!matched) throw err;
        return this;
      }
    };
    const promise = run();
    if (typeof cb === 'function') {
      void promise.then(
        (doc) => (cb as (err: unknown, doc?: unknown) => void)(null, doc),
        (err) => (cb as (err: unknown) => void)(err),
      );
    }
    return promise as ReturnType<typeof originalSave>;
  };
}

export async function removeByEitherId(
  collection: { deleteOne: (filter: object) => Promise<{ deletedCount?: number }> },
  id: string,
) {
  const filters = [
    { $expr: { $eq: [{ $toString: '$_id' }, id] } },
    ...mongoIdCandidates(id).map((value) => ({ _id: value })),
  ];
  for (const filter of filters) {
    const res = await collection.deleteOne(filter as never);
    if (res.deletedCount) return res.deletedCount;
  }
  return 0;
}

export async function patchByEitherId(
  collection: { updateOne: (filter: object, update: object) => Promise<{ matchedCount: number }> },
  id: string,
  update: object,
) {
  const filters = [
    { $expr: { $eq: [{ $toString: '$_id' }, id] } },
    ...mongoIdCandidates(id).map((value) => ({ _id: value })),
  ];
  for (const filter of filters) {
    const res = await collection.updateOne(filter as never, update as never);
    if (res.matchedCount) return res.matchedCount;
  }
  return 0;
}

export async function persistById(
  collection: { updateOne: (filter: object, update: object) => Promise<{ matchedCount: number }> },
  id: string,
  set: Record<string, unknown>,
) {
  const { _id: _omitId, __v: _omitV, ...rest } = set;
  const filters = [
    { $expr: { $eq: [{ $toString: '$_id' }, id] } },
    ...mongoIdCandidates(id).map((value) => ({ _id: value })),
  ];
  for (const filter of filters) {
    const res = await collection.updateOne(filter as never, { $set: rest } as never);
    if (res.matchedCount) return res.matchedCount;
  }
  return 0;
}

function snapshotForPersist(doc: mongoose.Document) {
  const changes = (typeof doc.getChanges === 'function' ? doc.getChanges() : {}) as { $set?: Record<string, unknown> };
  if (changes.$set && Object.keys(changes.$set).length) {
    const { _id: _a, __v: _b, ...rest } = changes.$set;
    return rest;
  }
  const raw = doc.toObject({ depopulate: true }) as Record<string, unknown>;
  const { _id: _c, __v: _d, ...rest } = raw;
  return rest;
}

export function isOptimisticSaveError(err: unknown) {
  if (!err || typeof err !== 'object') return false;
  const name = (err as { name?: string }).name;
  const message = String((err as { message?: string }).message ?? '');
  return name === 'DocumentNotFoundError' || name === 'VersionError' || message.includes('No matching document found');
}

patchMongooseRestoredIds();
