#!/usr/bin/env bash

set -euo pipefail

REPOSITORY_ROOT="$(
  cd "$(dirname "${BASH_SOURCE[0]}")/../.." &&
    pwd
)"

CI_FILE="$REPOSITORY_ROOT/.github/workflows/ci.yml"

if [[ ! -f "$CI_FILE" ]]; then
  echo "FAIL: missing $CI_FILE" >&2
  exit 1
fi

node - "$CI_FILE" <<'NODE'
const fs = require('node:fs');

const ciFile = process.argv[2];
const source = fs.readFileSync(ciFile, 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

assert(
  source.includes('  workflow_call:'),
  'CI workflow must define workflow_call',
);

assert(
  source.includes('      build_container_images:'),
  'workflow_call must define build_container_images input',
);

assert(
  source.includes('        type: boolean'),
  'build_container_images must be a boolean input',
);

assert(
  source.includes('        default: true'),
  'build_container_images must default to true',
);

assert(
  source.includes('runs-on: ubuntu-24.04'),
  'CI jobs must use ubuntu-24.04',
);

assert(
  !source.includes('ubuntu-latest'),
  'CI workflow must not use ubuntu-latest',
);

assert(
  /pull_request:\s*\n\s+branches:\s*\n\s+- dev\s*\n\s+- main/.test(
    source,
  ),
  'CI must run for pull requests into dev and main',
);

assert(
  source.includes('  workflow_dispatch:'),
  'CI must keep the workflow_dispatch trigger',
);

assert(
  /permissions:\s*\n\s+contents: read/.test(source),
  'CI default permissions must only allow contents: read',
);

const buildStepName = '- name: Build DEV container images';
const buildStepStart = source.indexOf(buildStepName);

assert(
  buildStepStart >= 0,
  'CI must contain the DEV container image build step',
);

const buildStep = source.slice(buildStepStart);

const expectedCondition =
  "if: ${{ github.event_name != 'workflow_call' || inputs.build_container_images }}";

assert(
  buildStep.includes(expectedCondition),
  'DEV image build step must honor build_container_images',
);

assert(
  buildStep.indexOf(expectedCondition) < buildStep.indexOf('run:'),
  'build condition must appear before the build command',
);

const runtimeStepName =
  '- name: Verify API runtime migration';

const runtimeStepStart =
  source.indexOf(runtimeStepName);

assert(
  runtimeStepStart >= 0,
  'CI must verify production API migrations',
);

const runtimeStep = source.slice(runtimeStepStart);

assert(
  runtimeStep.includes(expectedCondition),
  'API runtime migration step must honor build_container_images',
);

assert(
  runtimeStep.includes(
    'bash infra/docker/api-runtime.test.sh --skip-build',
  ),
  'CI must run the API runtime migration test',
);

assert(
  runtimeStep.indexOf(expectedCondition) <
    runtimeStep.indexOf('run:'),
  'runtime migration condition must appear before its command',
);

const requiredAuthTestEnvironment = [
  'JWT_ACCESS_SECRET: ci-test-jwt-secret-minimum-32-characters',
  'JWT_ACCESS_TTL_SECONDS: "900"',
  'REFRESH_TOKEN_PEPPER: ci-test-refresh-pepper-minimum-32-characters',
  'REFRESH_TOKEN_TTL_SECONDS: "604800"',
  'AUTH_COOKIE_SECURE: "false"',
  'AUTH_COOKIE_SAME_SITE: lax',
  'AUTH_REGISTER_RATE_LIMIT: "3"',
  'AUTH_REGISTER_RATE_TTL_SECONDS: "3600"',
  'AUTH_LOGIN_RATE_LIMIT: "5"',
  'AUTH_LOGIN_RATE_TTL_SECONDS: "60"',
  'AUTH_REFRESH_RATE_LIMIT: "20"',
  'AUTH_REFRESH_RATE_TTL_SECONDS: "60"',
]

for (const expectedEnvironment of requiredAuthTestEnvironment) {
  assert (
    source.includes(expectedEnvironment),
    `CI environment must contain ${expectedEnvironment.split(':')[0]}`
  );
}

console.log('PASS: CI workflow contract is valid');
NODE
