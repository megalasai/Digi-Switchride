import { Logger } from '@nestjs/common';

export function resolveMongoUri(rawUri: string, logger?: Logger): string {
  const directOverride = process.env.MONGODB_URI_DIRECT?.trim();
  if (directOverride) {
    logger?.log('Using MONGODB_URI_DIRECT (non-SRV connection)');
    return directOverride;
  }
  if (!rawUri.startsWith('mongodb+srv://')) return rawUri;

  const converted = convertSrvToStandard(rawUri);
  logger?.warn('Converted mongodb+srv URI to standard mongodb:// (avoids SRV DNS issues on Windows)');
  return converted;
}

function convertSrvToStandard(srvUri: string): string {
  const withoutScheme = srvUri.replace('mongodb+srv://', '');
  const atIndex = withoutScheme.lastIndexOf('@');
  if (atIndex === -1) return srvUri;

  const credentials = withoutScheme.slice(0, atIndex);
  const rest = withoutScheme.slice(atIndex + 1);
  const slashIndex = rest.indexOf('/');
  const host = slashIndex === -1 ? rest : rest.slice(0, slashIndex);
  const pathAndQuery = slashIndex === -1 ? '' : rest.slice(slashIndex + 1);

  const questionIndex = pathAndQuery.indexOf('?');
  const database = questionIndex === -1 ? pathAndQuery : pathAndQuery.slice(0, questionIndex);
  const query = questionIndex === -1 ? '' : pathAndQuery.slice(questionIndex + 1);

  const params = new URLSearchParams(query);
  params.set('ssl', 'true');
  params.set('retryWrites', 'true');
  params.set('w', 'majority');
  if (!params.has('authSource')) params.set('authSource', 'admin');

  const dbPath = database || 'switchride';
  return `mongodb://${credentials}@${host}:27017/${dbPath}?${params.toString()}`;
}

export function getMongooseOptions(uri: string) {
  return {
    uri,
    family: 4 as const,
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
  };
}
