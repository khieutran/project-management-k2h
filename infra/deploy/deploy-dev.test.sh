#!/usr/bin/env bash

set -euo pipefail

REPOSITORY_ROOT="$(
  cd "$(dirname "${BASH_SOURCE[0]}")/../.." &&
    pwd
)"

DEPLOY_SCRIPT="$REPOSITORY_ROOT/infra/deploy/deploy-dev.sh"

if [[ ! -f "$DEPLOY_SCRIPT" ]]; then
  echo "FAIL: missing $DEPLOY_SCRIPT" >&2
  exit 1
fi

# shellcheck source=./deploy-dev.sh
source "$DEPLOY_SCRIPT"

TESTS_PASSED=0

expect_success() {
  local description="$1"
  shift

  if "$@" >/dev/null 2>&1; then
    printf 'PASS: %s\n' "$description"
    ((TESTS_PASSED += 1))
    return
  fi

  printf 'FAIL: expected success: %s\n' "$description" >&2
  exit 1
}

expect_failure() {
  local description="$1"
  shift

  if "$@" >/dev/null 2>&1; then
    printf 'FAIL: expected failure: %s\n' "$description" >&2
    exit 1
  fi

  printf 'PASS: %s\n' "$description"
  ((TESTS_PASSED += 1))
}

TEST_ROOT="$(mktemp -d)"

cleanup() {
  rm -rf -- "$TEST_ROOT"
}

trap cleanup EXIT

expect_failure \
  'rejects an invalid environment variable name' \
  require_env 'INVALID-NAME'

unset REQUIRED_FOR_TEST || true

expect_failure \
  'rejects a missing environment variable' \
  require_env REQUIRED_FOR_TEST

export REQUIRED_FOR_TEST=''

expect_failure \
  'rejects an empty environment variable' \
  require_env REQUIRED_FOR_TEST

export REQUIRED_FOR_TEST='configured'

expect_success \
  'accepts a configured environment variable' \
  require_env REQUIRED_FOR_TEST

expect_success \
  'accepts an immutable SHA image tag' \
  validate_image_tag \
  'sha-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

expect_failure \
  'rejects a short SHA image tag' \
  validate_image_tag \
  'sha-aaaaaaaa'

expect_failure \
  'rejects uppercase SHA characters' \
  validate_image_tag \
  'sha-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

expect_failure \
  'rejects the latest image tag' \
  validate_image_tag \
  'latest'

expect_failure \
  'rejects shell metacharacters in an image tag' \
  validate_image_tag \
  'sha-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa;echo-bad'

expect_success \
  'accepts a direct child deploy path' \
  validate_deploy_path \
  "$TEST_ROOT" \
  "$TEST_ROOT/deploy"

expect_failure \
  'rejects a relative deploy path' \
  validate_deploy_path \
  "$TEST_ROOT" \
  'deploy'

expect_failure \
  'rejects the deploy root itself' \
  validate_deploy_path \
  "$TEST_ROOT" \
  "$TEST_ROOT"

expect_failure \
  'rejects a sibling deploy path' \
  validate_deploy_path \
  "$TEST_ROOT" \
  "${TEST_ROOT}-sibling/deploy"

expect_failure \
  'rejects a parent-directory escape' \
  validate_deploy_path \
  "$TEST_ROOT" \
  "$TEST_ROOT/deploy/../../escaped"

expect_failure \
  'rejects the filesystem root as deploy root' \
  validate_deploy_path \
  '/' \
  '/opt'

expect_success \
  'accepts a strong env-file-safe PostgreSQL password' \
  validate_postgres_password \
  'Correct-Horse_Battery9%Staple'

expect_failure \
  'rejects a short PostgreSQL password' \
  validate_postgres_password \
  'ShortPassword1!'

expect_failure \
  'rejects whitespace in PostgreSQL password' \
  validate_postgres_password \
  'Correct Horse_Battery9%Staple'

expect_failure \
  'rejects hash in PostgreSQL password' \
  validate_postgres_password \
  'Correct#Horse_Battery9%Staple'

expect_failure \
  'rejects dollar sign in PostgreSQL password' \
  validate_postgres_password \
  'Correct$Horse_Battery9%Staple'

expect_failure \
  'rejects quotes in PostgreSQL password' \
  validate_postgres_password \
  "Correct'Horse_Battery9%Staple"

expect_failure \
  'rejects newline in PostgreSQL password' \
  validate_postgres_password \
  $'Correct-Horse_Battery9%Staple\n'

expect_success \
  'accepts a strong env-file-safe Auth secret' \
  validate_auth_secret \
  JWT_ACCESS_SECRET \
  'Correct-JWT_Secret9%AtLeast32Characters'

expect_failure 'rejects a short Auth secret' \
  validate_auth_secret JWT_ACCESS_SECRET \
  'too-short'

expect_failure 'rejects whitespace in Auth secret' \
  validate_auth_secret JWT_ACCESS_SECRET \
  'Correct JWT_Secret9%AtLeast32Characters'

expect_failure 'rejects newline in Auth secret' \
  validate_auth_secret JWT_ACCESS_SECRET \
  $'Correct-JWT_Secret9%AtLeast32Characters\nINJECTED=true'

expect_success 'accepts a valid JWT access TTL' \
  validate_integer_in_range JWT_ACCESS_TTL_SECONDS \
  '900' 60 3600

expect_failure 'rejects a JWT access TTL below minimum' \
  validate_integer_in_range JWT_ACCESS_TTL_SECONDS \
  '59' 60 3600

expect_failure 'rejects a JWT access TTL above maximum' \
  validate_integer_in_range JWT_ACCESS_TTL_SECONDS \
  '3601' 60 3600

expect_failure 'rejects a fractional JWT access TTL' \
  validate_integer_in_range JWT_ACCESS_TTL_SECONDS \
  '900.5' 60 3600

expect_success 'accepts a valid refresh-token TTL' \
  validate_integer_in_range REFRESH_TOKEN_TTL_SECONDS \
  '604800' 3600 2592000

expect_failure 'rejects a refresh-token TTL below minimum' \
  validate_integer_in_range REFRESH_TOKEN_TTL_SECONDS \
  '2592001' 3600 2592000

expect_success \
  'accepts local lax cookie policy' \
  validate_cookie_policy \
  'false' \
  'lax'

expect_success \
  'accepts DEV secure lax cookie policy' \
  validate_cookie_policy \
  'true' \
  'lax'

expect_success \
  'accepts secure SameSite none policy' \
  validate_cookie_policy \
  'true' \
  'none'

expect_failure \
  'rejects insecure SameSite none policy' \
  validate_cookie_policy \
  'false' \
  'none'

expect_failure \
  'rejects an invalid cookie secure value' \
  validate_cookie_policy \
  'yes' \
  'lax'

expect_failure \
  'rejects an invalid cookie SameSite value' \
  validate_cookie_policy \
  'true' \
  'random'

assert_file_contains() {
  local description="$1"
  local file_path="$2"
  local expected="$3"

  if [[ ! -f "$file_path" ]]; then
    printf \
      'FAIL: %s; missing file %s\n' \
      "$description" \
      "$file_path" \
      >&2
    exit 1
  fi

  if ! grep -Fq -- "$expected" "$file_path"; then
    printf \
      'FAIL: %s; expected to find: %s\n' \
      "$description" \
      "$expected" \
      >&2
    exit 1
  fi

  printf 'PASS: %s\n' "$description"
  ((TESTS_PASSED += 1))
}

assert_file_not_contains() {
  local description="$1"
  local file_path="$2"
  local unexpected="$3"

  if [[ ! -f "$file_path" ]]; then
    printf \
      'FAIL: %s; missing file %s\n' \
      "$description" \
      "$file_path" \
      >&2
    exit 1
  fi

  if grep -Fq -- "$unexpected" "$file_path"; then
    printf \
      'FAIL: %s; unexpectedly found: %s\n' \
      "$description" \
      "$unexpected" \
      >&2
    exit 1
  fi

  printf 'PASS: %s\n' "$description"
  ((TESTS_PASSED += 1))
}

assert_file_equals() {
  local description="$1"
  local file_path="$2"
  local expected="$3"

  if [[ ! -f "$file_path" ]]; then
    printf \
      'FAIL: %s; missing file %s\n' \
      "$description" \
      "$file_path" \
      >&2
    exit 1
  fi

  local actual
  actual="$(<"$file_path")"

  if [[ "$actual" != "$expected" ]]; then
    printf \
      'FAIL: %s; expected %s, got %s\n' \
      "$description" \
      "$expected" \
      "$actual" \
      >&2
    exit 1
  fi

  printf 'PASS: %s\n' "$description"
  ((TESTS_PASSED += 1))
}

assert_file_missing() {
  local description="$1"
  local file_path="$2"

  if [[ -e "$file_path" ]]; then
    printf \
      'FAIL: %s; unexpected file %s\n' \
      "$description" \
      "$file_path" \
      >&2
    exit 1
  fi

  printf 'PASS: %s\n' "$description"
  ((TESTS_PASSED += 1))
}

assert_file_occurrences() {
  local description="$1"
  local file_path="$2"
  local expected="$3"
  local expected_count="$4"

  if [[ ! -f "$file_path" ]]; then
    printf \
      'FAIL: %s; missing file %s\n' \
      "$description" \
      "$file_path" \
      >&2
    exit 1
  fi

  local actual_count

  actual_count="$(
    grep -Fc -- "$expected" "$file_path" || true
  )"

  if [[ "$actual_count" -ne "$expected_count" ]]; then
    printf \
      'FAIL: %s; expected %s occurrences, got %s\n' \
      "$description" \
      "$expected_count" \
      "$actual_count" \
      >&2
    exit 1
  fi

  printf 'PASS: %s\n' "$description"
  ((TESTS_PASSED += 1))
}

assert_line_before() {
  local description="$1"
  local file_path="$2"
  local first_text="$3"
  local second_text="$4"

  if [[ ! -f "$file_path" ]]; then
    printf \
      'FAIL: %s; missing file %s\n' \
      "$description" \
      "$file_path" \
      >&2
    exit 1
  fi

  local first_line
  local second_line

  first_line="$(
    grep -nF -- "$first_text" "$file_path" |
      head -n 1 |
      cut -d: -f1 ||
      true
  )"

  second_line="$(
    grep -nF -- "$second_text" "$file_path" |
      head -n 1 |
      cut -d: -f1 ||
      true
  )"

  if [[ -z "$first_line" || -z "$second_line" ]]; then
    printf \
      'FAIL: %s; one or both commands were not found\n' \
      "$description" \
      >&2
    exit 1
  fi

  if ((first_line >= second_line)); then
    printf \
      'FAIL: %s; line %s must be before line %s\n' \
      "$description" \
      "$first_line" \
      "$second_line" \
      >&2
    exit 1
  fi

  printf 'PASS: %s\n' "$description"
  ((TESTS_PASSED += 1))
}

FAKE_BIN="$TEST_ROOT/fake-bin"
mkdir -p "$FAKE_BIN"

FAKE_DOCKER="$FAKE_BIN/docker"

cat > "$FAKE_DOCKER" <<'FAKE_DOCKER_SCRIPT'
#!/usr/bin/env bash

set -euo pipefail

printf '%s\n' "$*" >> "$FAKE_DOCKER_LOG"

if [[ -n "${FAKE_DOCKER_SIGNAL_ON:-}" ]] &&
  [[ "$*" == *"$FAKE_DOCKER_SIGNAL_ON"* ]] &&
  [[ ! -e "${FAKE_DOCKER_SIGNAL_STATE:-}" ]]; then
  : > "$FAKE_DOCKER_SIGNAL_STATE"
  kill -TERM "$PPID"
  exit 0
fi

if [[ -n "${FAKE_DOCKER_FAIL_ON:-}" ]] &&
  [[ "$*" == *"$FAKE_DOCKER_FAIL_ON"* ]]; then
  exit 41
fi

if [[ -n "${FAKE_DOCKER_FAIL_ON_SECONDARY:-}" ]] &&
  [[ "$*" == *"$FAKE_DOCKER_FAIL_ON_SECONDARY"* ]]; then
  exit 42
fi
FAKE_DOCKER_SCRIPT

chmod +x "$FAKE_DOCKER"

FAKE_CURL="$FAKE_BIN/curl"

cat > "$FAKE_CURL" <<'FAKE_CURL_SCRIPT'
#!/usr/bin/env bash

set -euo pipefail

printf '%s\n' "$*" >> "$FAKE_CURL_LOG"

if [[ -n "${FAKE_CURL_FAIL_ON:-}" ]] &&
  [[ "$*" == *"$FAKE_CURL_FAIL_ON"* ]]; then
  if [[ -z "${FAKE_CURL_FAIL_ONCE_FILE:-}" ]]; then
    exit 42
  fi

  if [[ ! -e "$FAKE_CURL_FAIL_ONCE_FILE" ]]; then
    : > "$FAKE_CURL_FAIL_ONCE_FILE"
    exit 42
  fi
fi

if [[ "$*" == *"/api/health"* ]]; then
  printf '%s\n' '{"status":"ok","database":"up","environment":"development"}'
fi
FAKE_CURL_SCRIPT

chmod +x "$FAKE_CURL"

CURRENT_SHA='1111111111111111111111111111111111111111'
CANDIDATE_TAG='sha-2222222222222222222222222222222222222222'

export JWT_ACCESS_SECRET='test-jwt-secret-minimum-32-characters'
export JWT_ACCESS_TTL_SECONDS='900'

export REFRESH_TOKEN_PEPPER='test-refresh-pepper-minimum-32-characters'
export REFRESH_TOKEN_TTL_SECONDS='604800'

export AUTH_COOKIE_SECURE='true'
export AUTH_COOKIE_SAME_SITE='lax'

export AUTH_REGISTER_RATE_LIMIT='3'
export AUTH_REGISTER_RATE_TTL_SECONDS='3600'
export AUTH_LOGIN_RATE_LIMIT='5'
export AUTH_LOGIN_RATE_TTL_SECONDS='60'
export AUTH_REFRESH_RATE_LIMIT='20'
export AUTH_REFRESH_RATE_TTL_SECONDS='60'

run_deploy_failure_case() {
  local case_name="$1"
  local docker_fail_on="$2"

  CASE_ROOT="$TEST_ROOT/$case_name"
  DEPLOY_CASE_PATH="$CASE_ROOT/deploy"
  COMMAND_LOG="$CASE_ROOT/docker.log"
  CURL_LOG="$CASE_ROOT/curl.log"
  RESULT_FILE="$CASE_ROOT/result.env"
  CASE_OUTPUT="$CASE_ROOT/output.log"
  COMPOSE_SOURCE_FILE="$CASE_ROOT/source-compose.yml"

  mkdir -p "$DEPLOY_CASE_PATH"

  printf '%s\n' 'services: {}' > "$COMPOSE_SOURCE_FILE"
  printf '%s\n' 'current compose' > "$DEPLOY_CASE_PATH/compose.yml"
  printf '%s\n' 'CURRENT_RELEASE=true' > "$DEPLOY_CASE_PATH/.env"
  chmod 600 "$DEPLOY_CASE_PATH/.env"

  printf '%s\n' "$CURRENT_SHA" \
    > "$DEPLOY_CASE_PATH/current-release"

  if env \
    DEPLOY_ROOT="$CASE_ROOT" \
    DEPLOY_PATH="$DEPLOY_CASE_PATH" \
    COMPOSE_PROJECT_NAME="project-management-k2h-test" \
    COMPOSE_SOURCE="$COMPOSE_SOURCE_FILE" \
    API_IMAGE="ghcr.io/example/project-management-k2h-api" \
    WEB_IMAGE="ghcr.io/example/project-management-k2h-web" \
    IMAGE_TAG="$CANDIDATE_TAG" \
    NODE_ENV="development" \
    SWAGGER_ENABLED="true" \
    POSTGRES_DB="project_management" \
    POSTGRES_USER="project_management" \
    POSTGRES_PASSWORD="Correct-Horse_Battery9%Staple" \
    DEV_BASE_URL="https://dev.example.test" \
    DEPLOY_RESULT_FILE="$RESULT_FILE" \
    DOCKER_BIN="$FAKE_DOCKER" \
    CURL_BIN="$FAKE_CURL" \
    FAKE_DOCKER_LOG="$COMMAND_LOG" \
    FAKE_DOCKER_FAIL_ON="$docker_fail_on" \
    FAKE_CURL_LOG="$CURL_LOG" \
    FAKE_CURL_FAIL_ON="" \
    bash "$DEPLOY_SCRIPT" \
      >"$CASE_OUTPUT" 2>&1; then
    printf \
      'FAIL: deployment case %s should fail\n' \
      "$case_name" \
      >&2
    exit 1
  fi
}

run_deploy_failure_case \
  'pull-failure' \
  'pull api web'

assert_file_contains \
  'pull failure attempts to pull both application images' \
  "$COMMAND_LOG" \
  'pull api web'

assert_file_not_contains \
  'pull failure does not run migration' \
  "$COMMAND_LOG" \
  'migration:run:prod'

assert_file_not_contains \
  'pull failure does not recreate applications' \
  "$COMMAND_LOG" \
  'up -d --no-build --remove-orphans api web'

assert_file_equals \
  'pull failure preserves current release SHA' \
  "$DEPLOY_CASE_PATH/current-release" \
  "$CURRENT_SHA"

assert_file_contains \
  'pull failure records failed deployment' \
  "$RESULT_FILE" \
  'DEPLOYMENT_STATUS=failed'

assert_file_contains \
  'pull failure records migration as not run' \
  "$RESULT_FILE" \
  'MIGRATION_STATUS=not_run'

assert_file_contains \
  'pull failure does not request rollback' \
  "$RESULT_FILE" \
  'ROLLBACK_STATUS=not_required'

run_deploy_failure_case \
  'migration-failure' \
  'migration:run:prod'

assert_file_contains \
  'migration failure pulls application images first' \
  "$COMMAND_LOG" \
  'pull api web'

assert_file_contains \
  'migration failure starts and waits for PostgreSQL' \
  "$COMMAND_LOG" \
  'up -d --wait postgres'

assert_file_contains \
  'migration failure invokes production migration command' \
  "$COMMAND_LOG" \
  'migration:run:prod'

assert_file_not_contains \
  'migration failure does not recreate applications' \
  "$COMMAND_LOG" \
  'up -d --no-build --remove-orphans api web'

assert_file_equals \
  'migration failure preserves current release SHA' \
  "$DEPLOY_CASE_PATH/current-release" \
  "$CURRENT_SHA"

assert_file_contains \
  'migration failure records failed deployment' \
  "$RESULT_FILE" \
  'DEPLOYMENT_STATUS=failed'

assert_file_contains \
  'migration failure records migration failure' \
  "$RESULT_FILE" \
  'MIGRATION_STATUS=failed'

assert_file_contains \
  'migration failure does not request application rollback' \
  "$RESULT_FILE" \
  'ROLLBACK_STATUS=not_required'

run_deploy_success_case() {
  local case_name="$1"

  CASE_ROOT="$TEST_ROOT/$case_name"
  DEPLOY_CASE_PATH="$CASE_ROOT/deploy"
  COMMAND_LOG="$CASE_ROOT/docker.log"
  CURL_LOG="$CASE_ROOT/curl.log"
  RESULT_FILE="$CASE_ROOT/result.env"
  CASE_OUTPUT="$CASE_ROOT/output.log"
  COMPOSE_SOURCE_FILE="$CASE_ROOT/source-compose.yml"

  mkdir -p "$DEPLOY_CASE_PATH"

  printf '%s\n' 'services: {}' > "$COMPOSE_SOURCE_FILE"
  printf '%s\n' 'current compose' > "$DEPLOY_CASE_PATH/compose.yml"
  printf '%s\n' 'CURRENT_RELEASE=true' > "$DEPLOY_CASE_PATH/.env"
  chmod 600 "$DEPLOY_CASE_PATH/.env"

  printf '%s\n' "$CURRENT_SHA" \
    > "$DEPLOY_CASE_PATH/current-release"

  if ! env \
    DEPLOY_ROOT="$CASE_ROOT" \
    DEPLOY_PATH="$DEPLOY_CASE_PATH" \
    COMPOSE_PROJECT_NAME="project-management-k2h-test" \
    COMPOSE_SOURCE="$COMPOSE_SOURCE_FILE" \
    API_IMAGE="ghcr.io/example/project-management-k2h-api" \
    WEB_IMAGE="ghcr.io/example/project-management-k2h-web" \
    IMAGE_TAG="$CANDIDATE_TAG" \
    NODE_ENV="development" \
    SWAGGER_ENABLED="true" \
    POSTGRES_DB="project_management" \
    POSTGRES_USER="project_management" \
    POSTGRES_PASSWORD="Correct-Horse_Battery9%Staple" \
    DEV_BASE_URL="https://dev.example.test" \
    DEPLOY_RESULT_FILE="$RESULT_FILE" \
    DOCKER_BIN="$FAKE_DOCKER" \
    CURL_BIN="$FAKE_CURL" \
    FAKE_DOCKER_LOG="$COMMAND_LOG" \
    FAKE_DOCKER_FAIL_ON="" \
    FAKE_CURL_LOG="$CURL_LOG" \
    FAKE_CURL_FAIL_ON="" \
    bash "$DEPLOY_SCRIPT" \
      >"$CASE_OUTPUT" 2>&1; then
    printf 'FAIL: deployment case %s should succeed\n' "$case_name" >&2
    tail -n 10 "$CASE_OUTPUT" >&2
    exit 1
  fi
}

run_deploy_success_case 'successful-deployment'

assert_file_contains \
  'successful deployment pulls application images' \
  "$COMMAND_LOG" \
  'pull api web'

assert_file_contains \
  'successful deployment waits for PostgreSQL' \
  "$COMMAND_LOG" \
  'up -d --wait postgres'

assert_file_contains \
  'successful deployment runs production migration' \
  "$COMMAND_LOG" \
  'migration:run:prod'

assert_file_contains \
  'successful deployment recreates and waits for applications' \
  "$COMMAND_LOG" \
  'up -d --no-build --remove-orphans --wait api web'

assert_file_contains \
  'successful deployment checks public Web' \
  "$CURL_LOG" \
  'https://dev.example.test/'

assert_file_contains \
  'successful deployment checks public API health' \
  "$CURL_LOG" \
  'https://dev.example.test/api/health'

assert_file_equals \
  'successful deployment promotes candidate SHA' \
  "$DEPLOY_CASE_PATH/current-release" \
  '2222222222222222222222222222222222222222'

assert_file_equals \
  'successful deployment preserves previous SHA' \
  "$DEPLOY_CASE_PATH/previous-release" \
  "$CURRENT_SHA"

assert_file_equals \
  'successful deployment promotes candidate Compose manifest' \
  "$DEPLOY_CASE_PATH/compose.yml" \
  'services: {}'

assert_file_equals \
  'successful deployment snapshots previous Compose manifest' \
  "$DEPLOY_CASE_PATH/compose.previous.yml" \
  'current compose'

assert_file_contains \
  'successful deployment promotes candidate environment' \
  "$DEPLOY_CASE_PATH/.env" \
  "IMAGE_TAG=$CANDIDATE_TAG"

assert_file_contains \
  'successful deployment writes JWT access secret' \
  "$DEPLOY_CASE_PATH/.env" \
  "JWT_ACCESS_SECRET=$JWT_ACCESS_SECRET"

assert_file_contains \
  'successful deployment writes JWT access TTL' \
  "$DEPLOY_CASE_PATH/.env" \
  "JWT_ACCESS_TTL_SECONDS=$JWT_ACCESS_TTL_SECONDS"

assert_file_contains \
  'successful deployment writes refresh-token pepper' \
  "$DEPLOY_CASE_PATH/.env" \
  "REFRESH_TOKEN_PEPPER=$REFRESH_TOKEN_PEPPER"

assert_file_contains \
  'successful deployment writes refresh-token TTL' \
  "$DEPLOY_CASE_PATH/.env" \
  "REFRESH_TOKEN_TTL_SECONDS=$REFRESH_TOKEN_TTL_SECONDS"

assert_file_contains \
  'successful deployment writes cookie secure policy' \
  "$DEPLOY_CASE_PATH/.env" \
  "AUTH_COOKIE_SECURE=$AUTH_COOKIE_SECURE"

assert_file_contains \
  'successful deployment writes cookie SameSite policy' \
  "$DEPLOY_CASE_PATH/.env" \
  "AUTH_COOKIE_SAME_SITE=$AUTH_COOKIE_SAME_SITE"

assert_file_contains \
  'successful deployment writes register rate limit' \
  "$DEPLOY_CASE_PATH/.env" \
  "AUTH_REGISTER_RATE_LIMIT=$AUTH_REGISTER_RATE_LIMIT"

assert_file_contains \
  'successful deployment writes register rate-limit TTL' \
  "$DEPLOY_CASE_PATH/.env" \
  "AUTH_REGISTER_RATE_TTL_SECONDS=$AUTH_REGISTER_RATE_TTL_SECONDS"

assert_file_contains \
  'successful deployment writes login rate limit' \
  "$DEPLOY_CASE_PATH/.env" \
  "AUTH_LOGIN_RATE_LIMIT=$AUTH_LOGIN_RATE_LIMIT"

assert_file_contains \
  'successful deployment writes login rate-limit TTL' \
  "$DEPLOY_CASE_PATH/.env" \
  "AUTH_LOGIN_RATE_TTL_SECONDS=$AUTH_LOGIN_RATE_TTL_SECONDS"

assert_file_contains \
  'successful deployment writes refresh rate limit' \
  "$DEPLOY_CASE_PATH/.env" \
  "AUTH_REFRESH_RATE_LIMIT=$AUTH_REFRESH_RATE_LIMIT"

assert_file_contains \
  'successful deployment writes refresh rate-limit TTL' \
  "$DEPLOY_CASE_PATH/.env" \
  "AUTH_REFRESH_RATE_TTL_SECONDS=$AUTH_REFRESH_RATE_TTL_SECONDS"

assert_file_not_contains \
  'successful deployment does not log JWT access secret' \
  "$CASE_OUTPUT" \
  "$JWT_ACCESS_SECRET"

assert_file_not_contains \
  'successful deployment does not log refresh-token pepper' \
  "$CASE_OUTPUT" \
  "$REFRESH_TOKEN_PEPPER"

assert_file_contains \
  'successful deployment snapshots previous environment' \
  "$DEPLOY_CASE_PATH/.env.previous" \
  'CURRENT_RELEASE=true'

assert_file_missing \
  'successful deployment removes candidate environment' \
  "$DEPLOY_CASE_PATH/.env.candidate"

assert_file_missing \
  'successful deployment removes candidate Compose manifest' \
  "$DEPLOY_CASE_PATH/compose.candidate.yml"

assert_file_missing \
  'successful deployment removes in-progress marker' \
  "$DEPLOY_CASE_PATH/deployment-in-progress"

assert_file_contains \
  'successful deployment records success' \
  "$RESULT_FILE" \
  'DEPLOYMENT_STATUS=success'

assert_file_contains \
  'successful deployment records migration success' \
  "$RESULT_FILE" \
  'MIGRATION_STATUS=success'

assert_file_contains \
  'successful deployment records Docker health success' \
  "$RESULT_FILE" \
  'DOCKER_HEALTH_STATUS=success'

assert_file_contains \
  'successful deployment records public health success' \
  "$RESULT_FILE" \
  'PUBLIC_HEALTH_STATUS=success'

assert_file_contains \
  'successful deployment does not require rollback' \
  "$RESULT_FILE" \
  'ROLLBACK_STATUS=not_required'

run_docker_health_failure_case() {
  local case_name="$1"

  CASE_ROOT="$TEST_ROOT/$case_name"
  DEPLOY_CASE_PATH="$CASE_ROOT/deploy"
  COMMAND_LOG="$CASE_ROOT/docker.log"
  CURL_LOG="$CASE_ROOT/curl.log"
  RESULT_FILE="$CASE_ROOT/result.env"
  CASE_OUTPUT="$CASE_ROOT/output.log"
  COMPOSE_SOURCE_FILE="$CASE_ROOT/source-compose.yml"

  mkdir -p "$DEPLOY_CASE_PATH"

  printf '%s\n' 'services: {}' > "$COMPOSE_SOURCE_FILE"
  printf '%s\n' 'current compose' > "$DEPLOY_CASE_PATH/compose.yml"
  printf '%s\n' 'CURRENT_RELEASE=true' > "$DEPLOY_CASE_PATH/.env"
  chmod 600 "$DEPLOY_CASE_PATH/.env"

  printf '%s\n' "$CURRENT_SHA" \
    > "$DEPLOY_CASE_PATH/current-release"

  if env \
    DEPLOY_ROOT="$CASE_ROOT" \
    DEPLOY_PATH="$DEPLOY_CASE_PATH" \
    COMPOSE_PROJECT_NAME="project-management-k2h-test" \
    COMPOSE_SOURCE="$COMPOSE_SOURCE_FILE" \
    API_IMAGE="ghcr.io/example/project-management-k2h-api" \
    WEB_IMAGE="ghcr.io/example/project-management-k2h-web" \
    IMAGE_TAG="$CANDIDATE_TAG" \
    NODE_ENV="development" \
    SWAGGER_ENABLED="true" \
    POSTGRES_DB="project_management" \
    POSTGRES_USER="project_management" \
    POSTGRES_PASSWORD="Correct-Horse_Battery9%Staple" \
    DEV_BASE_URL="https://dev.example.test" \
    DEPLOY_RESULT_FILE="$RESULT_FILE" \
    DOCKER_BIN="$FAKE_DOCKER" \
    CURL_BIN="$FAKE_CURL" \
    FAKE_DOCKER_LOG="$COMMAND_LOG" \
    FAKE_DOCKER_FAIL_ON="compose.candidate.yml up -d --no-build --remove-orphans --wait api web" \
    FAKE_DOCKER_FAIL_ON_SECONDARY="" \
    FAKE_CURL_LOG="$CURL_LOG" \
    FAKE_CURL_FAIL_ON="" \
    bash "$DEPLOY_SCRIPT" \
      >"$CASE_OUTPUT" 2>&1; then
    printf \
      'FAIL: deployment case %s should fail\n' \
      "$case_name" \
      >&2
    exit 1
  fi
}

run_docker_health_failure_case 'docker-health-failure'

assert_file_contains \
  'Docker health failure attempts candidate recreation' \
  "$COMMAND_LOG" \
  'compose.candidate.yml up -d --no-build --remove-orphans --wait api web'

assert_file_contains \
  'Docker health failure restores applications with current manifest' \
  "$COMMAND_LOG" \
  'compose.yml up -d --no-build --remove-orphans --wait api web'

assert_file_contains \
  'Docker health rollback verifies public Web' \
  "$CURL_LOG" \
  'https://dev.example.test/'

assert_file_contains \
  'Docker health rollback verifies public API' \
  "$CURL_LOG" \
  'https://dev.example.test/api/health'

assert_file_equals \
  'Docker health failure preserves current release SHA' \
  "$DEPLOY_CASE_PATH/current-release" \
  "$CURRENT_SHA"

assert_file_equals \
  'Docker health failure preserves current Compose manifest' \
  "$DEPLOY_CASE_PATH/compose.yml" \
  'current compose'

assert_file_contains \
  'Docker health failure records failed deployment' \
  "$RESULT_FILE" \
  'DEPLOYMENT_STATUS=failed'

assert_file_contains \
  'Docker health failure records failed Docker health' \
  "$RESULT_FILE" \
  'DOCKER_HEALTH_STATUS=failed'

assert_file_contains \
  'Docker health failure records successful rollback' \
  "$RESULT_FILE" \
  'ROLLBACK_STATUS=success'

assert_file_missing \
  'Docker health rollback removes candidate environment' \
  "$DEPLOY_CASE_PATH/.env.candidate"

assert_file_missing \
  'Docker health rollback removes candidate Compose manifest' \
  "$DEPLOY_CASE_PATH/compose.candidate.yml"

assert_file_missing \
  'Docker health rollback removes in-progress marker' \
  "$DEPLOY_CASE_PATH/deployment-in-progress"

run_public_health_failure_case() {
  local case_name="$1"

  CASE_ROOT="$TEST_ROOT/$case_name"
  DEPLOY_CASE_PATH="$CASE_ROOT/deploy"
  COMMAND_LOG="$CASE_ROOT/docker.log"
  CURL_LOG="$CASE_ROOT/curl.log"
  CURL_FAILURE_STATE="$CASE_ROOT/curl-failure-used"
  RESULT_FILE="$CASE_ROOT/result.env"
  CASE_OUTPUT="$CASE_ROOT/output.log"
  COMPOSE_SOURCE_FILE="$CASE_ROOT/source-compose.yml"

  mkdir -p "$DEPLOY_CASE_PATH"

  printf '%s\n' 'services: {}' > "$COMPOSE_SOURCE_FILE"
  printf '%s\n' 'current compose' > "$DEPLOY_CASE_PATH/compose.yml"
  printf '%s\n' 'CURRENT_RELEASE=true' > "$DEPLOY_CASE_PATH/.env"
  chmod 600 "$DEPLOY_CASE_PATH/.env"

  printf '%s\n' "$CURRENT_SHA" \
    > "$DEPLOY_CASE_PATH/current-release"

  if env \
    DEPLOY_ROOT="$CASE_ROOT" \
    DEPLOY_PATH="$DEPLOY_CASE_PATH" \
    COMPOSE_PROJECT_NAME="project-management-k2h-test" \
    COMPOSE_SOURCE="$COMPOSE_SOURCE_FILE" \
    API_IMAGE="ghcr.io/example/project-management-k2h-api" \
    WEB_IMAGE="ghcr.io/example/project-management-k2h-web" \
    IMAGE_TAG="$CANDIDATE_TAG" \
    NODE_ENV="development" \
    SWAGGER_ENABLED="true" \
    POSTGRES_DB="project_management" \
    POSTGRES_USER="project_management" \
    POSTGRES_PASSWORD="Correct-Horse_Battery9%Staple" \
    DEV_BASE_URL="https://dev.example.test" \
    DEPLOY_RESULT_FILE="$RESULT_FILE" \
    DOCKER_BIN="$FAKE_DOCKER" \
    CURL_BIN="$FAKE_CURL" \
    FAKE_DOCKER_LOG="$COMMAND_LOG" \
    FAKE_DOCKER_FAIL_ON="" \
    FAKE_DOCKER_FAIL_ON_SECONDARY="" \
    FAKE_CURL_LOG="$CURL_LOG" \
    FAKE_CURL_FAIL_ON="/api/health" \
    FAKE_CURL_FAIL_ONCE_FILE="$CURL_FAILURE_STATE" \
    bash "$DEPLOY_SCRIPT" \
      >"$CASE_OUTPUT" 2>&1; then
    printf \
      'FAIL: deployment case %s should fail\n' \
      "$case_name" \
      >&2
    exit 1
  fi
}

run_public_health_failure_case 'public-health-failure'

assert_file_contains \
  'public health failure starts candidate applications' \
  "$COMMAND_LOG" \
  'compose.candidate.yml up -d --no-build --remove-orphans --wait api web'

assert_file_contains \
  'public health failure restores current applications' \
  "$COMMAND_LOG" \
  'compose.yml up -d --no-build --remove-orphans --wait api web'

assert_file_occurrences \
  'public API is checked for candidate and rollback' \
  "$CURL_LOG" \
  'https://dev.example.test/api/health' \
  2

assert_file_contains \
  'public health failure records healthy Docker containers' \
  "$RESULT_FILE" \
  'DOCKER_HEALTH_STATUS=success'

assert_file_contains \
  'public health failure records failed public health' \
  "$RESULT_FILE" \
  'PUBLIC_HEALTH_STATUS=failed'

assert_file_contains \
  'public health failure records successful rollback' \
  "$RESULT_FILE" \
  'ROLLBACK_STATUS=success'

assert_file_equals \
  'public health failure preserves current release SHA' \
  "$DEPLOY_CASE_PATH/current-release" \
  "$CURRENT_SHA"

assert_file_missing \
  'public health rollback removes candidate environment' \
  "$DEPLOY_CASE_PATH/.env.candidate"

assert_file_missing \
  'public health rollback removes candidate Compose manifest' \
  "$DEPLOY_CASE_PATH/compose.candidate.yml"

assert_file_missing \
  'public health rollback removes in-progress marker' \
  "$DEPLOY_CASE_PATH/deployment-in-progress"

run_rollback_failure_case() {
  local case_name="$1"

  CASE_ROOT="$TEST_ROOT/$case_name"
  DEPLOY_CASE_PATH="$CASE_ROOT/deploy"
  COMMAND_LOG="$CASE_ROOT/docker.log"
  CURL_LOG="$CASE_ROOT/curl.log"
  RESULT_FILE="$CASE_ROOT/result.env"
  CASE_OUTPUT="$CASE_ROOT/output.log"
  COMPOSE_SOURCE_FILE="$CASE_ROOT/source-compose.yml"

  mkdir -p "$DEPLOY_CASE_PATH"

  printf '%s\n' 'services: {}' > "$COMPOSE_SOURCE_FILE"
  printf '%s\n' 'current compose' > "$DEPLOY_CASE_PATH/compose.yml"
  printf '%s\n' 'CURRENT_RELEASE=true' > "$DEPLOY_CASE_PATH/.env"
  chmod 600 "$DEPLOY_CASE_PATH/.env"

  printf '%s\n' "$CURRENT_SHA" \
    > "$DEPLOY_CASE_PATH/current-release"

  if env \
    DEPLOY_ROOT="$CASE_ROOT" \
    DEPLOY_PATH="$DEPLOY_CASE_PATH" \
    COMPOSE_PROJECT_NAME="project-management-k2h-test" \
    COMPOSE_SOURCE="$COMPOSE_SOURCE_FILE" \
    API_IMAGE="ghcr.io/example/project-management-k2h-api" \
    WEB_IMAGE="ghcr.io/example/project-management-k2h-web" \
    IMAGE_TAG="$CANDIDATE_TAG" \
    NODE_ENV="development" \
    SWAGGER_ENABLED="true" \
    POSTGRES_DB="project_management" \
    POSTGRES_USER="project_management" \
    POSTGRES_PASSWORD="Correct-Horse_Battery9%Staple" \
    DEV_BASE_URL="https://dev.example.test" \
    DEPLOY_RESULT_FILE="$RESULT_FILE" \
    DOCKER_BIN="$FAKE_DOCKER" \
    CURL_BIN="$FAKE_CURL" \
    FAKE_DOCKER_LOG="$COMMAND_LOG" \
    FAKE_DOCKER_FAIL_ON="compose.candidate.yml up -d --no-build --remove-orphans --wait api web" \
    FAKE_DOCKER_FAIL_ON_SECONDARY="compose.yml up -d --no-build --remove-orphans --wait api web" \
    FAKE_CURL_LOG="$CURL_LOG" \
    FAKE_CURL_FAIL_ON="" \
    bash "$DEPLOY_SCRIPT" \
      >"$CASE_OUTPUT" 2>&1; then
    printf \
      'FAIL: deployment case %s should fail\n' \
      "$case_name" \
      >&2
    exit 1
  fi
}

run_rollback_failure_case 'rollback-failure'

assert_file_contains \
  'rollback failure first attempts candidate recreation' \
  "$COMMAND_LOG" \
  'compose.candidate.yml up -d --no-build --remove-orphans --wait api web'

assert_file_contains \
  'rollback failure attempts to restore current applications' \
  "$COMMAND_LOG" \
  'compose.yml up -d --no-build --remove-orphans --wait api web'

assert_file_contains \
  'rollback failure records failed deployment' \
  "$RESULT_FILE" \
  'DEPLOYMENT_STATUS=failed'

assert_file_contains \
  'rollback failure records failed Docker health' \
  "$RESULT_FILE" \
  'DOCKER_HEALTH_STATUS=failed'

assert_file_contains \
  'rollback failure records failed rollback' \
  "$RESULT_FILE" \
  'ROLLBACK_STATUS=failed'

assert_file_equals \
  'rollback failure preserves current release SHA' \
  "$DEPLOY_CASE_PATH/current-release" \
  "$CURRENT_SHA"

assert_file_not_contains \
  'rollback failure never deletes Docker volumes' \
  "$COMMAND_LOG" \
  'down -v'

assert_file_missing \
  'rollback failure removes completed in-progress marker' \
  "$DEPLOY_CASE_PATH/deployment-in-progress"

run_first_deployment_failure_case() {
  local case_name="$1"

  CASE_ROOT="$TEST_ROOT/$case_name"
  DEPLOY_CASE_PATH="$CASE_ROOT/deploy"
  COMMAND_LOG="$CASE_ROOT/docker.log"
  CURL_LOG="$CASE_ROOT/curl.log"
  RESULT_FILE="$CASE_ROOT/result.env"
  CASE_OUTPUT="$CASE_ROOT/output.log"
  COMPOSE_SOURCE_FILE="$CASE_ROOT/source-compose.yml"

  mkdir -p "$DEPLOY_CASE_PATH"

  printf '%s\n' 'services: {}' > "$COMPOSE_SOURCE_FILE"

  if env \
    DEPLOY_ROOT="$CASE_ROOT" \
    DEPLOY_PATH="$DEPLOY_CASE_PATH" \
    COMPOSE_PROJECT_NAME="project-management-k2h-test" \
    COMPOSE_SOURCE="$COMPOSE_SOURCE_FILE" \
    API_IMAGE="ghcr.io/example/project-management-k2h-api" \
    WEB_IMAGE="ghcr.io/example/project-management-k2h-web" \
    IMAGE_TAG="$CANDIDATE_TAG" \
    NODE_ENV="development" \
    SWAGGER_ENABLED="true" \
    POSTGRES_DB="project_management" \
    POSTGRES_USER="project_management" \
    POSTGRES_PASSWORD="Correct-Horse_Battery9%Staple" \
    DEV_BASE_URL="https://dev.example.test" \
    DEPLOY_RESULT_FILE="$RESULT_FILE" \
    DOCKER_BIN="$FAKE_DOCKER" \
    CURL_BIN="$FAKE_CURL" \
    FAKE_DOCKER_LOG="$COMMAND_LOG" \
    FAKE_DOCKER_FAIL_ON="compose.candidate.yml up -d --no-build --remove-orphans --wait api web" \
    FAKE_DOCKER_FAIL_ON_SECONDARY="" \
    FAKE_CURL_LOG="$CURL_LOG" \
    FAKE_CURL_FAIL_ON="" \
    bash "$DEPLOY_SCRIPT" \
      >"$CASE_OUTPUT" 2>&1; then
    printf \
      'FAIL: deployment case %s should fail\n' \
      "$case_name" \
      >&2
    exit 1
  fi
}

run_first_deployment_failure_case 'first-deployment-failure'

assert_file_contains \
  'first deployment failure attempts candidate recreation' \
  "$COMMAND_LOG" \
  'compose.candidate.yml up -d --no-build --remove-orphans --wait api web'

assert_file_not_contains \
  'first deployment failure cannot run current release Compose' \
  "$COMMAND_LOG" \
  'compose.yml up -d --no-build --remove-orphans --wait api web'

assert_file_contains \
  'first deployment failure records unavailable rollback' \
  "$RESULT_FILE" \
  'ROLLBACK_STATUS=unavailable'

assert_file_contains \
  'first deployment failure explains missing current release' \
  "$CASE_OUTPUT" \
  'no current release is available for rollback'

assert_file_missing \
  'first deployment failure does not create current release SHA' \
  "$DEPLOY_CASE_PATH/current-release"

assert_file_missing \
  'first deployment failure removes candidate environment' \
  "$DEPLOY_CASE_PATH/.env.candidate"

assert_file_missing \
  'first deployment failure removes candidate Compose manifest' \
  "$DEPLOY_CASE_PATH/compose.candidate.yml"

assert_file_missing \
  'first deployment failure removes in-progress marker' \
  "$DEPLOY_CASE_PATH/deployment-in-progress"

run_stale_deployment_recovery_case() {
  local case_name="$1"

  CASE_ROOT="$TEST_ROOT/$case_name"
  DEPLOY_CASE_PATH="$CASE_ROOT/deploy"
  COMMAND_LOG="$CASE_ROOT/docker.log"
  CURL_LOG="$CASE_ROOT/curl.log"
  RESULT_FILE="$CASE_ROOT/result.env"
  CASE_OUTPUT="$CASE_ROOT/output.log"
  COMPOSE_SOURCE_FILE="$CASE_ROOT/source-compose.yml"

  mkdir -p "$DEPLOY_CASE_PATH"

  printf '%s\n' 'services: {}' > "$COMPOSE_SOURCE_FILE"
  printf '%s\n' 'current compose' > "$DEPLOY_CASE_PATH/compose.yml"
  printf '%s\n' 'CURRENT_RELEASE=true' > "$DEPLOY_CASE_PATH/.env"
  chmod 600 "$DEPLOY_CASE_PATH/.env"

  printf '%s\n' "$CURRENT_SHA" \
    > "$DEPLOY_CASE_PATH/current-release"

  printf '%s\n' \
    '3333333333333333333333333333333333333333' \
    > "$DEPLOY_CASE_PATH/deployment-in-progress"

  printf '%s\n' \
    'INTERRUPTED_CANDIDATE=true' \
    > "$DEPLOY_CASE_PATH/.env.candidate"

  printf '%s\n' \
    'interrupted candidate compose' \
    > "$DEPLOY_CASE_PATH/compose.candidate.yml"

  if ! env \
    DEPLOY_ROOT="$CASE_ROOT" \
    DEPLOY_PATH="$DEPLOY_CASE_PATH" \
    COMPOSE_PROJECT_NAME="project-management-k2h-test" \
    COMPOSE_SOURCE="$COMPOSE_SOURCE_FILE" \
    API_IMAGE="ghcr.io/example/project-management-k2h-api" \
    WEB_IMAGE="ghcr.io/example/project-management-k2h-web" \
    IMAGE_TAG="$CANDIDATE_TAG" \
    NODE_ENV="development" \
    SWAGGER_ENABLED="true" \
    POSTGRES_DB="project_management" \
    POSTGRES_USER="project_management" \
    POSTGRES_PASSWORD="Correct-Horse_Battery9%Staple" \
    DEV_BASE_URL="https://dev.example.test" \
    DEPLOY_RESULT_FILE="$RESULT_FILE" \
    DOCKER_BIN="$FAKE_DOCKER" \
    CURL_BIN="$FAKE_CURL" \
    FAKE_DOCKER_LOG="$COMMAND_LOG" \
    FAKE_DOCKER_FAIL_ON="" \
    FAKE_DOCKER_FAIL_ON_SECONDARY="" \
    FAKE_CURL_LOG="$CURL_LOG" \
    FAKE_CURL_FAIL_ON="" \
    bash "$DEPLOY_SCRIPT" \
      >"$CASE_OUTPUT" 2>&1; then
    printf \
      'FAIL: stale deployment recovery case should succeed\n' \
      >&2
    tail -n 10 "$CASE_OUTPUT" >&2
    exit 1
  fi
}

run_stale_deployment_recovery_case 'stale-deployment-recovery'

assert_file_contains \
  'stale deployment restores current applications' \
  "$COMMAND_LOG" \
  'compose.yml up -d --no-build --remove-orphans --wait api web'

assert_file_contains \
  'stale deployment later pulls the new candidate' \
  "$COMMAND_LOG" \
  'pull api web'

assert_line_before \
  'stale deployment recovers current release before candidate pull' \
  "$COMMAND_LOG" \
  'compose.yml up -d --no-build --remove-orphans --wait api web' \
  'pull api web'

assert_file_occurrences \
  'stale recovery checks API for recovery and candidate' \
  "$CURL_LOG" \
  'https://dev.example.test/api/health' \
  2

assert_file_equals \
  'stale recovery eventually promotes the new candidate SHA' \
  "$DEPLOY_CASE_PATH/current-release" \
  '2222222222222222222222222222222222222222'

assert_file_equals \
  'stale recovery retains old current SHA as previous release' \
  "$DEPLOY_CASE_PATH/previous-release" \
  "$CURRENT_SHA"

assert_file_contains \
  'stale recovery records successful candidate deployment' \
  "$RESULT_FILE" \
  'DEPLOYMENT_STATUS=success'

assert_file_missing \
  'stale recovery removes in-progress marker' \
  "$DEPLOY_CASE_PATH/deployment-in-progress"

run_signal_interruption_case() {
  local case_name="$1"

  CASE_ROOT="$TEST_ROOT/$case_name"
  DEPLOY_CASE_PATH="$CASE_ROOT/deploy"
  COMMAND_LOG="$CASE_ROOT/docker.log"
  CURL_LOG="$CASE_ROOT/curl.log"
  SIGNAL_STATE="$CASE_ROOT/signal-sent"
  RESULT_FILE="$CASE_ROOT/result.env"
  CASE_OUTPUT="$CASE_ROOT/output.log"
  COMPOSE_SOURCE_FILE="$CASE_ROOT/source-compose.yml"

  mkdir -p "$DEPLOY_CASE_PATH"

  printf '%s\n' 'services: {}' > "$COMPOSE_SOURCE_FILE"
  printf '%s\n' 'current compose' > "$DEPLOY_CASE_PATH/compose.yml"
  printf '%s\n' 'CURRENT_RELEASE=true' > "$DEPLOY_CASE_PATH/.env"
  chmod 600 "$DEPLOY_CASE_PATH/.env"

  printf '%s\n' "$CURRENT_SHA" \
    > "$DEPLOY_CASE_PATH/current-release"

  local exit_status

  set +e

  env \
    DEPLOY_ROOT="$CASE_ROOT" \
    DEPLOY_PATH="$DEPLOY_CASE_PATH" \
    COMPOSE_PROJECT_NAME="project-management-k2h-test" \
    COMPOSE_SOURCE="$COMPOSE_SOURCE_FILE" \
    API_IMAGE="ghcr.io/example/project-management-k2h-api" \
    WEB_IMAGE="ghcr.io/example/project-management-k2h-web" \
    IMAGE_TAG="$CANDIDATE_TAG" \
    NODE_ENV="development" \
    SWAGGER_ENABLED="true" \
    POSTGRES_DB="project_management" \
    POSTGRES_USER="project_management" \
    POSTGRES_PASSWORD="Correct-Horse_Battery9%Staple" \
    DEV_BASE_URL="https://dev.example.test" \
    DEPLOY_RESULT_FILE="$RESULT_FILE" \
    DOCKER_BIN="$FAKE_DOCKER" \
    CURL_BIN="$FAKE_CURL" \
    FAKE_DOCKER_LOG="$COMMAND_LOG" \
    FAKE_DOCKER_FAIL_ON="" \
    FAKE_DOCKER_FAIL_ON_SECONDARY="" \
    FAKE_DOCKER_SIGNAL_ON="compose.candidate.yml up -d --no-build --remove-orphans --wait api web" \
    FAKE_DOCKER_SIGNAL_STATE="$SIGNAL_STATE" \
    FAKE_CURL_LOG="$CURL_LOG" \
    FAKE_CURL_FAIL_ON="" \
    bash "$DEPLOY_SCRIPT" \
      >"$CASE_OUTPUT" 2>&1

  exit_status=$?

  set -e

  if [[ "$exit_status" -ne 143 ]]; then
    printf \
      'FAIL: SIGTERM deployment should exit 143, got %s\n' \
      "$exit_status" \
      >&2
    exit 1
  fi

  printf 'PASS: SIGTERM deployment exits with status 143\n'
  ((TESTS_PASSED += 1))
}

run_signal_interruption_case 'signal-interruption'

assert_file_contains \
  'SIGTERM occurs during candidate recreation' \
  "$COMMAND_LOG" \
  'compose.candidate.yml up -d --no-build --remove-orphans --wait api web'

assert_file_contains \
  'SIGTERM handler restores current applications' \
  "$COMMAND_LOG" \
  'compose.yml up -d --no-build --remove-orphans --wait api web'

assert_file_contains \
  'SIGTERM deployment records failure' \
  "$RESULT_FILE" \
  'DEPLOYMENT_STATUS=failed'

assert_file_contains \
  'SIGTERM deployment records uncertain candidate health as failed' \
  "$RESULT_FILE" \
  'DOCKER_HEALTH_STATUS=failed'

assert_file_contains \
  'SIGTERM deployment records successful rollback' \
  "$RESULT_FILE" \
  'ROLLBACK_STATUS=success'

assert_file_equals \
  'SIGTERM deployment preserves current release SHA' \
  "$DEPLOY_CASE_PATH/current-release" \
  "$CURRENT_SHA"

assert_file_missing \
  'SIGTERM rollback removes candidate environment' \
  "$DEPLOY_CASE_PATH/.env.candidate"

assert_file_missing \
  'SIGTERM rollback removes candidate Compose manifest' \
  "$DEPLOY_CASE_PATH/compose.candidate.yml"

assert_file_missing \
  'SIGTERM rollback removes in-progress marker' \
  "$DEPLOY_CASE_PATH/deployment-in-progress"

printf 'PASS: %d deployment tests\n' "$TESTS_PASSED"
