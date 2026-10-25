# India Location Service

Standalone reverse-geocoding API for coordinates in India. Digi-Switchride apps and any other application call it over HTTP. It does not share the platform API process or the rental database.

A request sends latitude, longitude, and an optional altitude in meters. The response is the nearest locality, district, state, PIN code, and how the altitude compares with that locality's elevation.

## Data

The seed downloads open data and builds `data/india.sqlite`:

| Data | Source | Use |
|------|--------|-----|
| Populated places | [GeoNames](https://download.geonames.org/export/dump/IN.zip) India dump | Locality, district, state, elevation |
| PIN codes | [GeoNames postal codes](https://download.geonames.org/export/zip/IN.zip) | Nearest PIN |
| State and district names | GeoNames admin code lists | Labels for admin codes on each place |
| India boundary | [Natural Earth](https://www.naturalearthdata.com/) 1:50m countries | Reject coordinates outside India |
| Cities, towns, villages, main roads, airports, ports, industrial areas | [Geofabrik OpenStreetMap India](https://download.geofabrik.de/asia/india.html) `india-latest.osm.pbf` | Extra `osm` fields on each lookup |

GeoNames is [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/). OpenStreetMap data is [ODbL](https://opendatacommons.org/licenses/odbl/). Credit both when you show these names. Natural Earth is public domain. The API repeats this in the `attribution` field.

GeoNames and OpenStreetMap are different datasets. GeoNames supplies the locality, district, state, and PIN. The OpenStreetMap import adds the nearest place, road, airport, port, and named industrial area from the Geofabrik India extract. It loads cities, towns, villages, hamlets, suburbs, motorway-to-tertiary highways, named streets, airports, ports, and named industrial areas. It does not load buildings, footpaths, or shops. Import it after the GeoNames seed:

```bash
npm run import:osm
```

The extract is about 1.7 GB. `npm run import:osm -- --force` rebuilds the OpenStreetMap tables.

Elevation is the matched place's elevation from GeoNames, not a survey of the exact GPS point. GeoNames also contains street names and a few misplaced points; the lookup prefers a real populated place within 1 km of the nearest hit. PIN codes with only a coarse coordinate are chosen from the matching district (for example the head post office) instead of a distant rural code. A point a few kilometres outside the Natural Earth coastline is still accepted when a locality in the database is within 5 km.

## Requirements

- Node.js 22.13 or newer (this service uses the built-in SQLite module)
- Network access the first time you seed the database

## Run locally

From the repository root:

```bash
npm install
npm run seed:location
npm run dev:location
```

The API listens on `http://localhost:4100`.

```bash
curl "http://localhost:4100/v1/locations/reverse?latitude=12.9716&longitude=77.5946&altitude=950"
```

```bash
curl -X POST http://localhost:4100/v1/locations/reverse \
  -H "content-type: application/json" \
  -d "{\"latitude\":19.076,\"longitude\":72.8777}"
```

Rebuild the database with `npm run seed:location -- --force`. Add `--refresh` to download the source files again.

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET, POST | `/v1/locations/reverse` | Location for a coordinate |
| GET | `/health` | Process is up |
| GET | `/ready` | Database counts |

Query or JSON fields:

- `latitude` (required)
- `longitude` (required)
- `altitude` (optional, meters above mean sea level)

`422` means the point is outside India. `404` means it is inside India but no locality was found within 80 km. Contract: [contracts/openapi/location-v1.yaml](../../contracts/openapi/location-v1.yaml).

## Other applications

Point each app at this service's base URL. When several apps share one deployment, set a key per app:

```bash
LOCATION_API_KEYS=switchride:replace-me,fleet-tracker:replace-me
```

```ts
const response = await fetch(
  `${process.env.LOCATION_API_URL}/v1/locations/reverse?latitude=${latitude}&longitude=${longitude}`,
  { headers: { 'X-Api-Key': process.env.LOCATION_API_KEY } },
);
const location = await response.json();
```

`Authorization: Bearer <key>` is also accepted. `/health` and `/ready` do not require a key. A successful response includes `X-App-Id` so you can see which application key was used.

Leave `LOCATION_API_KEYS` empty only for local development. The process logs a warning if production starts without keys.

## Capacity

One process answers each cache miss from the SQLite R-tree. That path is what the throughput test measures, with the cache disabled, and it is required to exceed 100,000 requests in 10 minutes.

Repeated coordinates (about 11 meters) are served from memory when `LOCATION_CACHE_SIZE` is greater than zero. The default is 50,000 entries. Successful GET responses also send `Cache-Control: public, max-age=86400` so a reverse proxy can absorb repeated traffic.

`LOCATION_WORKERS=auto` forks one process per CPU. Each worker opens the same read-only database. Separate containers scale the same way: copy `india.sqlite` with the image and put a load balancer in front. Do not share one writable database file across hosts.

Check a built database with:

```bash
npm run bench -w @digi-switchride/location
```

## Host it separately

The service is a normal Node process:

```bash
npm run build -w @digi-switchride/location
node apps/location/dist/main.js
```

Or a container, from the repository root:

```bash
docker build -f apps/location/Dockerfile -t digi-switchride-location .
docker run --rm -p 4100:4100 -e LOCATION_DB=/tmp/india.sqlite -e LOCATION_API_KEYS=switchride:replace-me digi-switchride-location
```

The first start downloads open data and writes `LOCATION_DB` (default `/tmp/india.sqlite` in the image).

App Platform: this service is a **separate** web component (`apps/location/Dockerfile`, HTTP **4100**). Do not attach it to the admin or API component — DigitalOcean allows one HTTP port per web service. The source lives in this folder on GitHub; `india.sqlite` is not committed (too large).

Docker Compose profile, so the existing Mongo and Redis stack stays unchanged:

```bash
docker compose --profile location up -d location
```

Environment variables are listed in `.env.example`.
