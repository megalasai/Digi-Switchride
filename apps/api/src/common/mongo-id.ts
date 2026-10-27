import mongoose, { Types } from 'mongoose';

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
        if (!isDocumentNotFound(err)) throw err;
        const id = this._id != null ? String(this._id) : '';
        if (!id) throw err;
        const changes = (
          typeof this.getChanges === 'function' ? this.getChanges() : { $set: this.toObject({ depopulate: true }) }
        ) as Record<string, unknown>;
        const update =
          changes && (changes.$set || changes.$unset || changes.$inc)
            ? changes
            : { $set: this.toObject({ depopulate: true }) };
        const res = await this.$model().collection.updateOne(mongoIdFilter(id) as never, update as never);
        if (!res.matchedCount) throw err;
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

function isDocumentNotFound(err: unknown) {
  return Boolean(err && typeof err === 'object' && (err as { name?: string }).name === 'DocumentNotFoundError');
}

patchMongooseRestoredIds();
