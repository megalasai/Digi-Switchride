# Standalone India location API.
# Build from the repository root:
#   docker build -f apps/location/Dockerfile -t fleetel-switchride-location .
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin-web/package.json apps/admin-web/package.json
COPY apps/telemetry/package.json apps/telemetry/package.json
COPY libs/shared/package.json libs/shared/package.json
COPY apps/location/package.json apps/location/package.json
COPY apps/location/tsconfig.json apps/location/tsconfig.json
COPY apps/location/src apps/location/src
COPY apps/location/data/raw/IN.zip apps/location/data/raw/IN.zip
COPY apps/location/data/raw/postal-IN.zip apps/location/data/raw/postal-IN.zip
COPY apps/location/data/raw/admin1CodesASCII.txt apps/location/data/raw/admin1CodesASCII.txt
COPY apps/location/data/raw/admin2Codes.txt apps/location/data/raw/admin2Codes.txt
COPY apps/location/data/raw/india-coverage.geojson apps/location/data/raw/india-coverage.geojson
RUN npm ci -w @digi-switchride/location --include=dev && npm run build -w @digi-switchride/location
ENV LOCATION_DB=/app/apps/location/data/india.sqlite
ENV LOCATION_RAW_DIR=/app/apps/location/data/raw
WORKDIR /app/apps/location
RUN node dist/seed.js

FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin-web/package.json apps/admin-web/package.json
COPY apps/telemetry/package.json apps/telemetry/package.json
COPY libs/shared/package.json libs/shared/package.json
COPY apps/location/package.json apps/location/package.json
RUN npm ci -w @digi-switchride/location --omit=dev
COPY --from=build /app/apps/location/dist apps/location/dist
COPY --from=build /app/apps/location/data/india.sqlite apps/location/data/india.sqlite
WORKDIR /app/apps/location
ENV NODE_ENV=production
ENV PORT=4100
ENV HOST=0.0.0.0
ENV LOCATION_WORKERS=1
ENV LOCATION_DB=/app/apps/location/data/india.sqlite
EXPOSE 4100
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4100)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/entrypoint.js"]
