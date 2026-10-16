import Fastify, { LogController, type FastifyReply, type FastifyRequest } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import type { Config } from './config.js';
import { Geocoder, LocationNotFoundError, OutsideIndiaError, type ReverseInput } from './geocode.js';

const coordinateSchema = {
  type: 'object',
  required: ['latitude', 'longitude'],
  additionalProperties: false,
  properties: {
    latitude: { type: 'number', minimum: -90, maximum: 90 },
    longitude: { type: 'number', minimum: -180, maximum: 180 },
    altitude: { type: 'number', minimum: -500, maximum: 9000 },
  },
} as const;

type ReverseQuery = {
  latitude: number;
  longitude: number;
  altitude?: number;
};

function readApiKey(request: FastifyRequest): string | undefined {
  const header = request.headers['x-api-key'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  const authorization = request.headers.authorization;
  if (typeof authorization === 'string' && authorization.toLowerCase().startsWith('bearer ')) {
    const token = authorization.slice(7).trim();
    if (token) return token;
  }
  return undefined;
}

export function buildApp(db: DatabaseSync, config: Pick<Config, 'apiKeys' | 'corsOrigin' | 'cacheSize' | 'env'>) {
  const geocoder = new Geocoder(db, config.cacheSize);
  const app = Fastify({
    logger: config.env === 'test' || config.env === 'production' ? false : { level: 'info' },
    logController: new LogController({ disableRequestLogging: true }),
    requestTimeout: 5_000,
    bodyLimit: 1_024,
  });

  app.addHook('onRequest', async (request, reply) => {
    reply.header('Access-Control-Allow-Origin', config.corsOrigin);
    reply.header('Access-Control-Allow-Headers', 'Content-Type, X-Api-Key, Authorization');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (request.method === 'OPTIONS') return reply.code(204).send();

    const path = request.url.split('?')[0];
    if (!path.startsWith('/v1/')) return;
    if (config.apiKeys.size === 0) return;

    const apiKey = readApiKey(request);
    const appName = apiKey ? config.apiKeys.get(apiKey) : undefined;
    if (!appName) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'A valid API key is required.' });
    }
    reply.header('X-App-Id', appName);
  });

  app.setErrorHandler((error, _request, reply) => {
    if (typeof error === 'object' && error !== null && 'validation' in error) {
      return reply.code(400).send({
        error: 'VALIDATION',
        message: 'latitude and longitude are required numbers. altitude is optional and is in meters.',
        details: (error as { validation?: unknown }).validation ?? null,
      });
    }
    console.error(error instanceof Error ? error.message : error);
    return reply.code(500).send({ error: 'INTERNAL', message: 'Location lookup failed.' });
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({ error: 'NOT_FOUND', message: 'Route not found.' });
  });

  app.get('/', async () => ({
    service: 'digi-switchride-location',
    version: '1.0.0',
    reverse: '/v1/locations/reverse?latitude=&longitude=&altitude=',
  }));

  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/ready', async () => ({
    status: 'ok',
    places: geocoder.placeCount,
    postalCodes: geocoder.postalCount,
    seededAt: geocoder.seededAt,
    cacheEntries: geocoder.cacheEntries,
    lookups: geocoder.stats.lookups,
    cacheHits: geocoder.stats.cacheHits,
    osmPlaces: geocoder.osmPlaceCount,
    osmRoads: geocoder.osmRoadCount,
    osmSites: geocoder.osmSiteCount,
  }));

  const sendReverse = (source: ReverseQuery, reply: FastifyReply) => {
    const input: ReverseInput = {
      latitude: source.latitude,
      longitude: source.longitude,
      altitude: source.altitude === undefined ? null : source.altitude,
    };
    try {
      const result = geocoder.reverse(input);
      reply.header('X-Cache', result.cache);
      reply.header('Cache-Control', 'public, max-age=86400');
      return result.location;
    } catch (error) {
      if (error instanceof OutsideIndiaError) {
        return reply.code(422).send({ error: error.error, message: error.message });
      }
      if (error instanceof LocationNotFoundError) {
        return reply.code(404).send({ error: error.error, message: error.message });
      }
      throw error;
    }
  };

  app.get<{ Querystring: ReverseQuery }>('/v1/locations/reverse', { schema: { querystring: coordinateSchema } }, async (request, reply) =>
    sendReverse(request.query, reply),
  );
  app.post<{ Body: ReverseQuery }>('/v1/locations/reverse', { schema: { body: coordinateSchema } }, async (request, reply) =>
    sendReverse(request.body, reply),
  );

  return { app, geocoder };
}
