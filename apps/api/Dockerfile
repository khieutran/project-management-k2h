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

COPY apps/api ./apps/api
COPY packages/config ./packages/config

RUN pnpm --filter @project-management/api build

RUN pnpm --filter @project-management/api \
    deploy --prod /runtime/api


FROM node:24-alpine AS runtime

ENV NODE_ENV="production"

WORKDIR /app

COPY --from=builder \
    --chown=node:node \
    /runtime/api/node_modules \
    ./node_modules

COPY --from=builder \
    --chown=node:node \
    /workspace/apps/api/dist \
    ./dist

COPY --from=builder \
    --chown=node:node \
    /workspace/apps/api/package.json \
    ./package.json

USER node

EXPOSE 3000

CMD ["node", "dist/main.js"]