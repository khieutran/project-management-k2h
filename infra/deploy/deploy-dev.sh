#!/usr/bin/env bash

set -euo pipefail

require_env() {
  local variable_name="$1"

  if [[ ! "$variable_name" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
    echo "ERROR: invalid environment variable name" >&2
    return 1
  fi

  if [[ ! -v "$variable_name" ]]; then
    printf \
      'ERROR: missing required environment variable: %s\n' \
      "$variable_name" \
      >&2
    return 1
  fi

  if [[ -z "${!variable_name}" ]]; then
    printf \
      'ERROR: empty required environment variable: %s\n' \
      "$variable_name" \
      >&2
    return 1
  fi
}

validate_image_tag() {
  local image_tag="$1"

  if [[ ! "$image_tag" =~ ^sha-[0-9a-f]{40}$ ]]; then
    echo "ERROR: IMAGE_TAG must be sha- followed by 40 lowercase hex characters" >&2
    return 1
  fi
}

validate_deploy_path() {
  local deploy_root="$1"
  local deploy_path="$2"

  if [[ "$deploy_root" != /* || "$deploy_path" != /* ]]; then
    echo "ERROR: deploy root and path must be absolute" >&2
    return 1
  fi

  if [[ "$deploy_root" =~ (^|/)\.\.(/|$) ]] ||
    [[ "$deploy_path" =~ (^|/)\.\.(/|$) ]]; then
    echo "ERROR: deploy paths must not contain parent traversal" >&2
    return 1
  fi

  local normalized_root
  local normalized_path

  normalized_root="$(realpath -m -- "$deploy_root")"
  normalized_path="$(realpath -m -- "$deploy_path")"

  if [[ "$normalized_root" == "/" ]]; then
    echo "ERROR: filesystem root cannot be DEPLOY_ROOT" >&2
    return 1
  fi

  if [[ "$normalized_path" == "$normalized_root" ]]; then
    echo "ERROR: DEPLOY_PATH cannot equal DEPLOY_ROOT" >&2
    return 1
  fi

  if [[ "$(dirname -- "$normalized_path")" != "$normalized_root" ]]; then
    echo "ERROR: DEPLOY_PATH must be a direct child of DEPLOY_ROOT" >&2
    return 1
  fi
}

validate_postgres_password() {
  local password="$1"

  if [[ ! "$password" =~ ^[A-Za-z0-9._~!@%+=:,-]{24,128}$ ]]; then
    echo "ERROR: POSTGRES_PASSWORD does not satisfy the DEV secret contract" >&2
    return 1
  fi
}

write_deployment_result() {
  local result_file="$1"

  mkdir -p -- "$(dirname -- "$result_file")"

  (
    umask 077

    {
      printf 'DEPLOYMENT_STATUS=%s\n' "$DEPLOYMENT_STATUS"
      printf 'MIGRATION_STATUS=%s\n' "$MIGRATION_STATUS"
      printf 'DOCKER_HEALTH_STATUS=%s\n' "$DOCKER_HEALTH_STATUS"
      printf 'PUBLIC_HEALTH_STATUS=%s\n' "$PUBLIC_HEALTH_STATUS"
      printf 'ROLLBACK_STATUS=%s\n' "$ROLLBACK_STATUS"
      printf 'DEPLOYED_SHA=%s\n' "$DEPLOYED_SHA"
    } > "$result_file"
  )

  chmod 600 "$result_file"
}

render_candidate_environment() {
  local target_file="$1"

  (
    umask 077

    {
      printf 'COMPOSE_PROJECT_NAME=%s\n' "$COMPOSE_PROJECT_NAME"

      printf 'NODE_ENV=%s\n' "$NODE_ENV"
      printf 'API_PORT=3000\n'
      printf 'SWAGGER_ENABLED=%s\n' "$SWAGGER_ENABLED"

      printf 'POSTGRES_HOST=postgres\n'
      printf 'POSTGRES_PORT=5432\n'
      printf 'POSTGRES_DB=%s\n' "$POSTGRES_DB"
      printf 'POSTGRES_USER=%s\n' "$POSTGRES_USER"
      printf 'POSTGRES_PASSWORD=%s\n' "$POSTGRES_PASSWORD"

      printf 'API_IMAGE=%s\n' "$API_IMAGE"
      printf 'WEB_IMAGE=%s\n' "$WEB_IMAGE"
      printf 'IMAGE_TAG=%s\n' "$IMAGE_TAG"
    } > "$target_file"
  )

  chmod 600 "$target_file"
}

run_candidate_compose() {
  "$DOCKER_BIN" compose \
    --project-name "$COMPOSE_PROJECT_NAME" \
    --env-file "$CANDIDATE_ENV_FILE" \
    -f "$CANDIDATE_COMPOSE_FILE" \
    "$@"
}

run_current_compose() {
  "$DOCKER_BIN" compose \
    --project-name "$COMPOSE_PROJECT_NAME" \
    --env-file "$DEPLOY_PATH/.env" \
    -f "$DEPLOY_PATH/compose.yml" \
    "$@"
}

current_release_is_available() {
  [[ -f "$DEPLOY_PATH/.env" ]] &&
    [[ -f "$DEPLOY_PATH/compose.yml" ]] &&
    [[ -f "$DEPLOY_PATH/current-release" ]]
}

cleanup_candidate_files() {
  rm -f -- \
    "$CANDIDATE_ENV_FILE" \
    "$CANDIDATE_COMPOSE_FILE"
}

fail_before_application_recreate() {
  write_deployment_result "$DEPLOY_RESULT_FILE"
  cleanup_candidate_files
  return 1
}

mark_deployment_in_progress() {
  (
    umask 077
    printf '%s\n' "$DEPLOYED_SHA" > "$IN_PROGRESS_FILE"
  )

  chmod 600 "$IN_PROGRESS_FILE"
}

check_public_health() {
  local base_url="${DEV_BASE_URL%/}"
  local api_health_response

  if ! "$CURL_BIN" \
    --fail \
    --silent \
    --show-error \
    --location \
    --retry 5 \
    --retry-delay 2 \
    --retry-connrefused \
    "$base_url/" \
    >/dev/null; then
    echo "ERROR: public Web health check failed" >&2
    return 1
  fi

  if ! api_health_response="$(
    "$CURL_BIN" \
      --fail \
      --silent \
      --show-error \
      --location \
      --retry 5 \
      --retry-delay 2 \
      --retry-connrefused \
      "$base_url/api/health"
  )"; then
    echo "ERROR: public API health check failed" >&2
    return 1
  fi

  if [[ "$api_health_response" != *'"status":"ok"'* ]] ||
    [[ "$api_health_response" != *'"database":"up"'* ]]; then
    echo "ERROR: public API returned an unhealthy response" >&2
    return 1
  fi
}

finish_failed_deployment_after_recreate() {
  if ! current_release_is_available; then
    echo "ERROR: no current release is available for rollback" >&2
    ROLLBACK_STATUS='unavailable'
  elif ! run_current_compose \
    up \
    -d \
    --no-build \
    --remove-orphans \
    --wait \
    api \
    web; then
    echo "ERROR: rollback containers are unhealthy" >&2
    ROLLBACK_STATUS='failed'
  elif ! check_public_health; then
    echo "ERROR: rollback public health check failed" >&2
    ROLLBACK_STATUS='failed'
  else
    ROLLBACK_STATUS='success'
  fi

  write_deployment_result "$DEPLOY_RESULT_FILE"

  rm -f -- "$IN_PROGRESS_FILE"
  cleanup_candidate_files

  APPLICATION_RECREATE_STARTED='false'
}

handle_termination() {
  local exit_status="$1"

  trap - INT TERM

  echo "ERROR: deployment interrupted; attempting safe recovery" >&2

  DEPLOYMENT_STATUS='failed'

  if [[ "${APPLICATION_RECREATE_STARTED:-false}" == 'true' ]]; then
    DOCKER_HEALTH_STATUS='failed'
    finish_failed_deployment_after_recreate
  else
    write_deployment_result "$DEPLOY_RESULT_FILE"
    cleanup_candidate_files
  fi

  exit "$exit_status"
}

recover_interrupted_deployment() {
  if [[ ! -e "$IN_PROGRESS_FILE" ]]; then
    return 0
  fi

  echo "INFO: interrupted deployment detected; restoring current release" >&2

  if ! current_release_is_available; then
    echo "ERROR: interrupted deployment has no current release to restore" >&2
    ROLLBACK_STATUS='unavailable'
    return 1
  fi

  if ! run_current_compose \
    up \
    -d \
    --no-build \
    --remove-orphans \
    --wait \
    api \
    web; then
    echo "ERROR: interrupted deployment rollback containers are unhealthy" >&2
    ROLLBACK_STATUS='failed'
    return 1
  fi

  if ! check_public_health; then
    echo "ERROR: interrupted deployment rollback health check failed" >&2
    ROLLBACK_STATUS='failed'
    return 1
  fi

  cleanup_candidate_files
  rm -f -- "$IN_PROGRESS_FILE"

  ROLLBACK_STATUS='not_required'

  echo "INFO: interrupted deployment recovery completed" >&2
}

promote_candidate_release() {
  local current_compose_file="$DEPLOY_PATH/compose.yml"
  local current_env_file="$DEPLOY_PATH/.env"
  local current_release_file="$DEPLOY_PATH/current-release"

  local previous_compose_file="$DEPLOY_PATH/compose.previous.yml"
  local previous_env_file="$DEPLOY_PATH/.env.previous"
  local previous_release_file="$DEPLOY_PATH/previous-release"

  local candidate_release_file="$DEPLOY_PATH/current-release.candidate"

  if [[ -f "$current_compose_file" ]] &&
    [[ -f "$current_env_file" ]] &&
    [[ -f "$current_release_file" ]]; then
    install \
      -m 0644 \
      -- "$current_compose_file" "$previous_compose_file"

    install \
      -m 0600 \
      -- "$current_env_file" "$previous_env_file"

    install \
      -m 0644 \
      -- "$current_release_file" "$previous_release_file"
  fi

  mv -- "$CANDIDATE_COMPOSE_FILE" "$current_compose_file"
  mv -- "$CANDIDATE_ENV_FILE" "$current_env_file"

  (
    umask 077
    printf '%s\n' "$DEPLOYED_SHA" > "$candidate_release_file"
  )

  chmod 644 "$candidate_release_file"
  mv -- "$candidate_release_file" "$current_release_file"
}

main() {
  DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/project-management-k2h}"
  DOCKER_BIN="${DOCKER_BIN:-docker}"
  CURL_BIN="${CURL_BIN:-curl}"

  local required_variables=(
    DEPLOY_PATH
    COMPOSE_PROJECT_NAME
    COMPOSE_SOURCE
    API_IMAGE
    WEB_IMAGE
    IMAGE_TAG
    NODE_ENV
    SWAGGER_ENABLED
    POSTGRES_DB
    POSTGRES_USER
    POSTGRES_PASSWORD
    DEV_BASE_URL
  )

  local variable_name

  for variable_name in "${required_variables[@]}"; do
    require_env "$variable_name"
  done

  validate_image_tag "$IMAGE_TAG"
  validate_deploy_path "$DEPLOY_ROOT" "$DEPLOY_PATH"
  validate_postgres_password "$POSTGRES_PASSWORD"

  DEPLOYED_SHA="${IMAGE_TAG#sha-}"

  DEPLOYMENT_STATUS='failed'
  MIGRATION_STATUS='not_run'
  DOCKER_HEALTH_STATUS='not_run'
  PUBLIC_HEALTH_STATUS='not_run'
  ROLLBACK_STATUS='not_required'
  APPLICATION_RECREATE_STARTED='false'

  mkdir -p -- "$DEPLOY_PATH"

  DEPLOY_RESULT_FILE="${DEPLOY_RESULT_FILE:-$DEPLOY_PATH/deployment-result.env}"

  CANDIDATE_ENV_FILE="$DEPLOY_PATH/.env.candidate"
  CANDIDATE_COMPOSE_FILE="$DEPLOY_PATH/compose.candidate.yml"
  IN_PROGRESS_FILE="$DEPLOY_PATH/deployment-in-progress"

  if ! recover_interrupted_deployment; then
    write_deployment_result "$DEPLOY_RESULT_FILE"
    return 1
  fi

  trap 'handle_termination 130' INT
  trap 'handle_termination 143' TERM

  if [[ ! -f "$COMPOSE_SOURCE" ]]; then
    printf \
      'ERROR: missing Compose source: %s\n' \
      "$COMPOSE_SOURCE" \
      >&2

    write_deployment_result "$DEPLOY_RESULT_FILE"
    return 1
  fi

  install \
    -m 0644 \
    -- "$COMPOSE_SOURCE" "$CANDIDATE_COMPOSE_FILE"

  render_candidate_environment "$CANDIDATE_ENV_FILE"

  if ! run_candidate_compose pull api web; then
    echo "ERROR: failed to pull candidate images" >&2
    fail_before_application_recreate
    return 1
  fi

  if ! run_candidate_compose up -d --wait postgres; then
    echo "ERROR: PostgreSQL did not become healthy" >&2
    fail_before_application_recreate
    return 1
  fi

  if ! run_candidate_compose \
    run \
    --rm \
    --no-deps \
    api \
    npm run migration:run:prod; then
    echo "ERROR: production migration failed" >&2

    MIGRATION_STATUS='failed'

    fail_before_application_recreate
    return 1
  fi

  MIGRATION_STATUS='success'

mark_deployment_in_progress
APPLICATION_RECREATE_STARTED='true'

if ! run_candidate_compose \
  up \
  -d \
  --no-build \
  --remove-orphans \
  --wait \
  api \
  web; then
  echo "ERROR: candidate application containers are unhealthy" >&2

  DOCKER_HEALTH_STATUS='failed'

  finish_failed_deployment_after_recreate
  return 1
fi

DOCKER_HEALTH_STATUS='success'

if ! check_public_health; then
  PUBLIC_HEALTH_STATUS='failed'

  finish_failed_deployment_after_recreate
  return 1
fi

PUBLIC_HEALTH_STATUS='success'

promote_candidate_release

DEPLOYMENT_STATUS='success'
ROLLBACK_STATUS='not_required'

write_deployment_result "$DEPLOY_RESULT_FILE"

rm -f -- "$IN_PROGRESS_FILE"
cleanup_candidate_files

APPLICATION_RECREATE_STARTED='false'
trap - INT TERM

return 0
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi