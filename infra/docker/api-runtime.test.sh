#!/usr/bin/env bash

set -euo pipefail

SKIP_BUILD=false

case "${1:-}" in
  "")
    ;;
  --skip-build)
    SKIP_BUILD=true
    ;;
  *)
    echo "Usage: $0 [--skip-build]" >&2
    exit 2
    ;;
esac

if [[ "$#" -gt 1 ]]; then
  echo "Usage: $0 [--skip-build]" >&2
  exit 2
fi

REPOSITORY_ROOT="$(
  cd "$(dirname "${BASH_SOURCE[0]}")/../.." &&
    pwd
)"

COMPOSE_FILE="$REPOSITORY_ROOT/infra/docker/compose.dev.yml"
ENV_FILE="$REPOSITORY_ROOT/.env.example"

export COMPOSE_PROJECT_NAME="project-management-k2h-api-runtime-test-$$"
export API_IMAGE="${API_RUNTIME_IMAGE:-project-management-k2h-api}"
export WEB_IMAGE="project-management-k2h-web-runtime-test"
export IMAGE_TAG="${API_RUNTIME_TAG:-dev}"

API_IMAGE_REFERENCE="${API_IMAGE}:${IMAGE_TAG}"

compose() {
  docker compose \
    --env-file "$ENV_FILE" \
    -f "$COMPOSE_FILE" \
    "$@"
}

cleanup() {
  compose \
    down \
    --volumes \
    --remove-orphans \
    >/dev/null 2>&1 || true
}

trap cleanup EXIT

if [[ "$SKIP_BUILD" == false ]]; then
  compose build api
fi

if ! docker image inspect "$API_IMAGE_REFERENCE" >/dev/null 2>&1; then
  echo "FAIL: missing API image $API_IMAGE_REFERENCE" >&2
  exit 1
fi

RUNTIME_USER="$(
  docker image inspect \
    --format '{{.Config.User}}' \
    "$API_IMAGE_REFERENCE"
)"

if [[ "$RUNTIME_USER" != "node" ]]; then
  echo "FAIL: API runtime user must be node; got $RUNTIME_USER" >&2
  exit 1
fi

docker run \
  --rm \
  --entrypoint test \
  "$API_IMAGE_REFERENCE" \
  -f /app/dist/database/data-source.js

compose up \
  -d \
  --wait \
  postgres

compose run \
  --rm \
  --no-deps \
  api \
  npm run migration:run:prod

echo "PASS: API runtime image can run production migrations"