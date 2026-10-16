# Build from repository root:
#   docker build -f apps/telemetry/Dockerfile -t digi-switchride-telemetry .
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin-web/package.json apps/admin-web/package.json
COPY apps/location/package.json apps/location/package.json
COPY apps/telemetry/package.json apps/telemetry/package.json
COPY apps/telemetry/tsconfig.json apps/telemetry/tsconfig.json
COPY packages/shared/package.json packages/shared/package.json
COPY apps/telemetry/src apps/telemetry/src
RUN npm ci -w @digi-switchride/telemetry && npm run build -w @digi-switchride/telemetry

FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin-web/package.json apps/admin-web/package.json
COPY apps/location/package.json apps/location/package.json
COPY apps/telemetry/package.json apps/telemetry/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci -w @digi-switchride/telemetry --omit=dev
COPY --from=build /app/apps/telemetry/dist apps/telemetry/dist
WORKDIR /app/apps/telemetry
ENV NODE_ENV=production
ENV TELEMETRY_HTTP_HOST=0.0.0.0
ENV TELEMETRY_HTTP_PORT=4200
ENV TELEMETRY_TCP_HOST=0.0.0.0
ENV TELEMETRY_SQLITE=/data/telemetry.sqlite
VOLUME ["/data"]
EXPOSE 4200 4210
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.TELEMETRY_HTTP_PORT||4200)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/entrypoint.js"]
