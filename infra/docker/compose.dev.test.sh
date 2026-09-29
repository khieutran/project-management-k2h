#!/usr/bin/env bash

set -euo pipefail

REPOSITORY_ROOT="$(
  cd "$(dirname "${BASH_SOURCE[0]}")/../.." &&
    pwd
)"

COMPOSE_FILE="$REPOSITORY_ROOT/infra/docker/compose.dev.yml"
ENV_FILE="${ENV_FILE:-$REPOSITORY_ROOT/.env.example}"

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "FAIL: missing $COMPOSE_FILE" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "FAIL: missing environment file $ENV_FILE" >&2
  exit 1
fi

DEFAULT_RENDERED_CONFIG="$(mktemp)"
OVERRIDE_RENDERED_CONFIG="$(mktemp)"

trap '
  rm -f \
    "$DEFAULT_RENDERED_CONFIG" \
    "$OVERRIDE_RENDERED_CONFIG"
' EXIT

env \
  -u API_IMAGE \
  -u WEB_IMAGE \
  -u IMAGE_TAG \
  docker compose \
    --env-file "$ENV_FILE" \
    -f "$COMPOSE_FILE" \
    config \
    --format json > "$DEFAULT_RENDERED_CONFIG"

API_IMAGE="ghcr.io/example/project-management-k2h-api" \
WEB_IMAGE="ghcr.io/example/project-management-k2h-web" \
IMAGE_TAG="sha-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" \
  docker compose \
    --env-file "$ENV_FILE" \
    -f "$COMPOSE_FILE" \
    config \
    --format json > "$OVERRIDE_RENDERED_CONFIG"

node \
  - "$DEFAULT_RENDERED_CONFIG" "$OVERRIDE_RENDERED_CONFIG" \
  <<'NODE'
const fs = require('node:fs');

const defaultRenderedConfigPath = process.argv[2];
const overrideRenderedConfigPath = process.argv[3];

const config = JSON.parse(
  fs.readFileSync(defaultRenderedConfigPath, 'utf8'),
);

const overrideConfig = JSON.parse(
  fs.readFileSync(overrideRenderedConfigPath, 'utf8'),
);

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const services = config.services ?? {};

function getService(name) {
  const service = services[name];

  assert(service, `missing service "${name}"`);

  return service;
}

function assertLoopbackPort(
  serviceName,
  published,
  target,
) {
  const service = getService(serviceName);
  const ports = service.ports ?? [];

  const matchingPort = ports.find(
    (port) =>
      port.host_ip === '127.0.0.1' &&
      String(port.published) === String(published) &&
      String(port.target) === String(target),
  );

  assert(
    matchingPort,
    `${serviceName} must bind 127.0.0.1:${published}:${target}`,
  );
}

const postgres = getService('postgres');
const api = getService('api');
const web = getService('web');

assert(
  api.image === 'project-management-k2h-api:dev',
  'default API image must be project-management-k2h-api:dev',
);

assert(
  web.image === 'project-management-k2h-web:dev',
  'default Web image must be project-management-k2h-web:dev',
);

assert(
  api.build,
  'API service must retain its local build configuration',
);

assert(
  web.build,
  'Web service must retain its local build configuration',
);

const overrideApi = overrideConfig.services?.api;
const overrideWeb = overrideConfig.services?.web;

assert(
  overrideApi,
  'override config must contain API service',
);

assert(
  overrideWeb,
  'override config must contain Web service',
);

assert(
  overrideApi.image ===
    'ghcr.io/example/project-management-k2h-api:sha-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'API image must honor API_IMAGE and IMAGE_TAG',
);

assert(
  overrideWeb.image ===
    'ghcr.io/example/project-management-k2h-web:sha-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'Web image must honor WEB_IMAGE and IMAGE_TAG',
);

for (const [serviceName, service] of Object.entries(services)) {
  const ports = service.ports ?? [];

  if (ports.length > 0) {
    assert(
      serviceName === 'api' || serviceName === 'web',
      `only api and web may publish ports; found ${serviceName}`,
    );
  }
}

assertLoopbackPort('api', 3000, 3000);
assertLoopbackPort('web', 8080, 8080);

assert(
  (postgres.ports ?? []).length === 0,
  'postgres must not publish a host port',
);

assert(
  api.environment?.POSTGRES_HOST === 'postgres',
  'api POSTGRES_HOST must equal "postgres"',
);

assert(
  postgres.healthcheck?.test,
  'postgres must define a healthcheck',
);

assert(
  api.healthcheck?.test,
  'api must define a healthcheck',
);

assert(
  api.depends_on?.postgres?.condition === 'service_healthy',
  'api must wait for healthy postgres',
);

assert(
  web.depends_on?.api?.condition === 'service_healthy',
  'web must wait for healthy api',
);

for (const serviceName of ['api', 'web']) {
  const service = getService(serviceName);

  assert(
    (service.volumes ?? []).length === 0,
    `${serviceName} must not mount source code or Docker socket`,
  );
}

const postgresVolume = (postgres.volumes ?? []).find(
  (volume) =>
    volume.type === 'volume' &&
    volume.source === 'postgres_dev_data' &&
    volume.target === '/var/lib/postgresql/data',
);

assert(
  postgresVolume,
  'postgres must use named volume postgres_dev_data',
);

assert(
  config.volumes?.postgres_dev_data,
  'top-level volume postgres_dev_data must exist',
);

console.log('PASS: compose.dev contract is valid');
NODE
