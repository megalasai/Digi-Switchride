# Standalone India location API.
# Build from the repository root:
#   docker build -f apps/location/Dockerfile -t digi-switchride-location .
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin-web/package.json apps/admin-web/package.json
COPY apps/telemetry/package.json apps/telemetry/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY apps/location/package.json apps/location/package.json
COPY apps/location/tsconfig.json apps/location/tsconfig.json
COPY apps/location/src apps/location/src
RUN npm ci -w @digi-switchride/location && npm run build -w @digi-switchride/location

FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin-web/package.json apps/admin-web/package.json
COPY apps/telemetry/package.json apps/telemetry/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY apps/location/package.json apps/location/package.json
RUN npm ci -w @digi-switchride/location --omit=dev
COPY --from=build /app/apps/location/dist apps/location/dist
WORKDIR /app/apps/location
ENV NODE_ENV=production
ENV PORT=4100
ENV HOST=0.0.0.0
ENV LOCATION_DB=/data/india.sqlite
VOLUME ["/data"]
EXPOSE 4100
HEALTHCHECK --interval=30s --timeout=5s --start-period=600s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4100)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/entrypoint.js"]
