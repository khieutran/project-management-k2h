FROM node:24-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable \
    && corepack prepare pnpm@12.3.4 --activate

WORKDIR /workspace


FROM base AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/config/package.json ./packages/config/package.json

RUN pnpm install --frozen-lockfile


FROM dependencies AS builder

COPY apps/web ./apps/web
COPY packages/config ./packages/config

RUN pnpm --filter @project-management/web build


FROM nginxinc/nginx-unprivileged:1.28-alpine AS runtime

COPY apps/web/nginx.conf \
    /etc/nginx/conf.d/default.conf

COPY --from=builder \
    /workspace/apps/web/dist \
    /usr/share/nginx/html

EXPOSE 8080