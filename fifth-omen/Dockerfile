## Multi-stage build for the dashboard (Solid + Vite)
FROM node:22-bullseye AS builder
WORKDIR /app

# allow toggling source map generation at build time
ARG ENABLE_SOURCE_MAPS=true
ARG MODE=dev
ENV ENABLE_SOURCE_MAPS=false

# enable corepack and pnpm (lockfile is pnpm-lock.yaml)
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml ./
COPY index.html ./
COPY tsconfig.json vite.config.ts ./
COPY src ./src

RUN pnpm install --frozen-lockfile --prefer-offline --dangerously-allow-all-builds
RUN pnpm build --mode ${MODE:-dev}

FROM nginx:stable-alpine AS runtime
FROM caddy:2-alpine

# Bake the current Git commit hash into the container image so Caddy can expose it at runtime.
ARG GIT_COMMIT=unknown
ENV GIT_COMMIT=${GIT_COMMIT}

# copy static assets and caddy config
COPY --from=builder /app/dist /usr/share/caddy
COPY Caddyfile /etc/caddy/Caddyfile

# copy entrypoint that sources secrets (if available)
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
