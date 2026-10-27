# Build from repository root:
#   docker build -f apps/admin-web/Dockerfile -t digi-switchride-admin .
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin-web/package.json apps/admin-web/package.json
COPY apps/location/package.json apps/location/package.json
COPY apps/telemetry/package.json apps/telemetry/package.json
COPY libs/shared/package.json libs/shared/package.json
ENV NODE_ENV=development
RUN npm ci -w admin-web --include=dev --include=optional
RUN npm install -w admin-web --no-save lightningcss-linux-x64-gnu@1.32.0 @tailwindcss/oxide-linux-x64-gnu@4.3.3
COPY apps/admin-web apps/admin-web
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_URL=/api/v1
ENV NODE_OPTIONS=--max-old-space-size=1536
ENV NODE_ENV=production
RUN npm run build -w admin-web

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=build /app/apps/admin-web/public ./apps/admin-web/public
COPY --from=build /app/apps/admin-web/.next/standalone ./
COPY --from=build /app/apps/admin-web/.next/static ./apps/admin-web/.next/static
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/admin-web/server.js"]
