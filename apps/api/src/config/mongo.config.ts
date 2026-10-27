import { Logger } from '@nestjs/common';
import { patchMongooseRestoredIds } from '../common/mongo-id';

/**
 * App Platform cannot resolve DigitalOcean *private* Mongo hostnames
 * (`private-db-…`) unless the app is attached to that VPC.
 * Do not rewrite mongodb+srv to mongodb://host:27017 — the SRV name is
 * not a mongod A record (ENOTFOUND).
 */
export function resolveMongoUri(rawUri: string, logger?: Logger): string {
  const directOverride = process.env.MONGODB_URI_DIRECT?.trim();
  if (directOverride) {
    logger?.log('Using MONGODB_URI_DIRECT (non-SRV connection)');
    return directOverride;
  }
  if (rawUri.includes('private-db-') && rawUri.includes('ondigitalocean.com')) {
    logger?.warn(
      'MONGODB_URI uses a private VPC hostname. App Platform will fail DNS unless this app is attached to the database VPC. Use the Public network connection string, or attach the cluster in DigitalOcean.',
    );
  }
  return rawUri;
}

export function getMongooseOptions(uri: string) {
  patchMongooseRestoredIds();
  return {
    uri,
    family: 4 as const,
    serverSelectionTimeoutMS: 20000,
    connectTimeoutMS: 20000,
  };
}
