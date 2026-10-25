# Build from repository root:
#   docker build -f apps/api/Dockerfile -t digi-switchride-api .
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin-web/package.json apps/admin-web/package.json
COPY apps/location/package.json apps/location/package.json
COPY apps/telemetry/package.json apps/telemetry/package.json
COPY libs/shared/package.json libs/shared/package.json
RUN npm ci -w @digi-switchride/shared -w @digi-switchride/api
COPY libs/shared libs/shared
COPY apps/api apps/api
RUN npm run build -w @digi-switchride/shared && npm run build -w @digi-switchride/api

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin-web/package.json apps/admin-web/package.json
COPY apps/location/package.json apps/location/package.json
COPY apps/telemetry/package.json apps/telemetry/package.json
COPY libs/shared/package.json libs/shared/package.json
RUN npm ci -w @digi-switchride/shared -w @digi-switchride/api --omit=dev
COPY --from=build /app/libs/shared/dist libs/shared/dist
COPY --from=build /app/libs/shared/package.json libs/shared/package.json
COPY --from=build /app/apps/api/dist apps/api/dist
WORKDIR /app/apps/api
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
