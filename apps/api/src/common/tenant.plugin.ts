import { Schema, Types } from 'mongoose';
import { getTenantStore } from './tenant-als';

export function tenantPlugin(schema: Schema) {
  if (!schema.path('tenantId')) {
    schema.add({ tenantId: { type: String } });
  }

  const apply = function (this: { getFilter: () => Record<string, unknown>; where: (q: object) => void }) {
    const store = getTenantStore();
    if (!store || store.skip || !store.tenantId) return;
    const filter = this.getFilter() ?? {};
    if (filter.tenantId !== undefined) return;
    this.where(tenantIdClause(store.tenantId));
  };

  schema.pre('find', apply);
  schema.pre('findOne', apply);
  schema.pre('findOneAndUpdate', apply);
  schema.pre('countDocuments', apply);
  schema.pre('updateMany', apply);
  schema.pre('deleteMany', apply);
  schema.pre('aggregate', function () {
    const store = getTenantStore();
    if (!store || store.skip || !store.tenantId) return;
    this.pipeline().unshift({ $match: tenantIdClause(store.tenantId) });
  });
  schema.pre('save', function () {
    const store = getTenantStore();
    const doc = this as { tenantId?: string };
    if (store?.tenantId && !store.skip && !doc.tenantId) {
      doc.tenantId = store.tenantId;
    }
  });
}

function tenantIdClause(tenantId: string) {
  const values: unknown[] = [tenantId];
  if (Types.ObjectId.isValid(tenantId)) {
    try {
      const oid = new Types.ObjectId(tenantId);
      if (oid.toString() === tenantId) values.push(oid);
    } catch {
      /* keep string match only */
    }
  }
  return { tenantId: { $in: values } };
}
