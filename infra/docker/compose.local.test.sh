#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
compose_file="${repo_root}/infra/docker/compose.local.yml"
env_file="${repo_root}/.env.example"

if [[ ! -f "${compose_file}" ]]; then
  echo "FAIL: missing ${compose_file}" >&2
  exit 1
fi

if [[ ! -f "${env_file}" ]]; then
  echo "FAIL: missing ${env_file}" >&2
  exit 1
fi

default_config="$(
  POSTGRES_HOST_PORT=5432 \
    docker compose \
      --env-file "${env_file}" \
      -f "${compose_file}" \
      config \
      --format json
)"

alternate_config="$(
  POSTGRES_HOST_PORT=55432 \
    docker compose \
      --env-file "${env_file}" \
      -f "${compose_file}" \
      config \
      --format json
)"

DEFAULT_CONFIG="${default_config}" \
ALTERNATE_CONFIG="${alternate_config}" \
node <<'NODE'
const assert = require('node:assert/strict');

const defaultConfig = JSON.parse(process.env.DEFAULT_CONFIG);
const alternateConfig = JSON.parse(process.env.ALTERNATE_CONFIG);

const postgres = defaultConfig.services?.postgres;

assert.ok(postgres, 'postgres service must exist');
assert.equal(
  postgres.image,
  'postgres:17-alpine',
  'postgres image must be postgres:17-alpine',
);

const defaultPort = postgres.ports?.[0];

assert.ok(defaultPort, 'postgres must publish one local port');
assert.equal(
  defaultPort.host_ip,
  '127.0.0.1',
  'postgres port must bind to 127.0.0.1',
);
assert.equal(
  String(defaultPort.published),
  '5432',
  'default host port must be 5432',
);
assert.equal(
  Number(defaultPort.target),
  5432,
  'container port must be 5432',
);

const alternatePort =
  alternateConfig.services?.postgres?.ports?.[0];

assert.equal(
  String(alternatePort?.published),
  '55432',
  'POSTGRES_HOST_PORT must override the default host port',
);

const healthCommand = postgres.healthcheck?.test?.join(' ') ?? '';

assert.match(
  healthCommand,
  /pg_isready/,
  'postgres health check must use pg_isready',
);

const postgresVolume = postgres.volumes?.find(
  (volume) => volume.target === '/var/lib/postgresql/data',
);

assert.ok(postgresVolume, 'postgres data volume must exist');
assert.equal(
  postgresVolume.type,
  'volume',
  'postgres data must use a named volume',
);
assert.ok(
  defaultConfig.volumes?.postgres_local_data,
  'postgres_local_data named volume must be declared',
);

console.log('PASS: local PostgreSQL Compose contract is valid');
NODE