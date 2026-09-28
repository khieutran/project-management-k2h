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

RENDERED_CONFIG="$(mktemp)"
trap 'rm -f "$RENDERED_CONFIG"' EXIT

docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  config \
  --format json > "$RENDERED_CONFIG"

node - "$RENDERED_CONFIG" <<'NODE'
const fs = require('node:fs');

const renderedConfigPath = process.argv[2];
const config = JSON.parse(
  fs.readFileSync(renderedConfigPath, 'utf8'),
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
