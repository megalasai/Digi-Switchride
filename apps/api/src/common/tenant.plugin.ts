import { Schema, Types } from 'mongoose';
import { getTenantStore } from './tenant-als';

export function tenantIdValues(tenantId: string): unknown[] {
  const values: unknown[] = [tenantId];
  if (Types.ObjectId.isValid(tenantId)) {
    try {
      const oid = new Types.ObjectId(tenantId);
      if (oid.toString() === tenantId) values.push(oid);
    } catch {
      /* keep string match only */
    }
  }
  return values;
}

export function tenantIdClause(tenantId: string) {
  return { tenantId: { $in: tenantIdValues(tenantId) } };
}

export function tenantPlugin(schema: Schema) {
  if (!schema.path('tenantId')) {
    schema.add({ tenantId: { type: String } });
  }

  const apply = function (this: { getFilter: () => Record<string, unknown>; where: (q: object) => void }) {
    const store = getTenantStore();
    if (!store || store.skip || !store.tenantId) return;
    this.where(tenantIdClause(store.tenantId));
  };

  schema.pre('find', apply);
  schema.pre('findOne', apply);
  schema.pre('findOneAndUpdate', apply);
  schema.pre('findOneAndDelete', apply);
  schema.pre('countDocuments', apply);
  schema.pre('updateMany', apply);
  schema.pre('deleteMany', apply);
  schema.pre('deleteOne', apply);
  schema.pre('aggregate', function () {
    const store = getTenantStore();
    if (!store || store.skip || !store.tenantId) return;
    this.pipeline().unshift({ $match: tenantIdClause(store.tenantId) });
  });
  schema.pre('save', function () {
    const store = getTenantStore();
    const doc = this as { tenantId?: string };
    if (store?.tenantId && !store.skip) {
      doc.tenantId = String(doc.tenantId || store.tenantId);
    }
  });
}
