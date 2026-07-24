# SSR shop platform — tenant resolution reads the Host header on every
# request (<slug>.peptora.app), so this runs as a node server via
# adapter-node rather than a static bundle.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/build ./build
# Tenant config + product markdown are read from the filesystem at
# runtime (gray-matter/marked are runtime deps) — ship them with the app.
COPY --from=build /app/content ./content
# Traefik terminates TLS in front; trust its forwarded headers so
# event.url and origin checks see the tenant hostname, not the container.
ENV PORT=3000 \
    PROTOCOL_HEADER=x-forwarded-proto \
    HOST_HEADER=x-forwarded-host
EXPOSE 3000
CMD ["node", "build"]
