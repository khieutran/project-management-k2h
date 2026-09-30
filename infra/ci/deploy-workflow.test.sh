#!/usr/bin/env bash

set -euo pipefail

REPOSITORY_ROOT="$(
  cd "$(dirname "${BASH_SOURCE[0]}")/../.." &&
    pwd
)"

WORKFLOW_FILE="$REPOSITORY_ROOT/.github/workflows/deploy-dev.yml"

if [[ ! -f "$WORKFLOW_FILE" ]]; then
  echo "FAIL: missing $WORKFLOW_FILE" >&2
  exit 1
fi

node - "$WORKFLOW_FILE" <<'NODE'
const fs = require('node:fs');

const workflowFile = process.argv[2];
const source = fs.readFileSync(workflowFile, 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function getJob(name, nextName) {
  const startMarker = `  ${name}:`;
  const start = source.indexOf(startMarker);

  assert(start >= 0, `workflow must define the ${name} job`);

  if (!nextName) {
    return source.slice(start);
  }

  const end = source.indexOf(`  ${nextName}:`, start + startMarker.length);

  assert(end > start, `${name} must appear before ${nextName}`);

  return source.slice(start, end);
}

assert(
  /on:\s*\n\s+push:\s*\n\s+branches:\s*\n\s+- dev/.test(source),
  'push trigger must target dev',
);

assert(
  source.includes('  workflow_dispatch:'),
  'workflow must support workflow_dispatch',
);

assert(
  !source.includes('pull_request:'),
  'deployment workflow must not run on pull_request',
);

assert(
  /concurrency:\s*\n\s+group: deploy-dev\s*\n\s+cancel-in-progress: false/.test(
    source,
  ),
  'deployment concurrency must serialize DEV deployments',
);

assert(
  source.includes('refs/heads/dev'),
  'workflow must explicitly gate deployments to refs/heads/dev',
);

assert(
  !source.includes('ubuntu-latest'),
  'workflow must pin GitHub-hosted jobs to ubuntu-24.04',
);

assert(
  !source.includes(':latest'),
  'workflow must never publish or deploy a latest image tag',
);

assert(
  !/\bPAT\b|personal[_ -]?access[_ -]?token/i.test(source),
  'workflow must not use a personal access token',
);

assert(
  !source.includes('change-me') &&
    !source.includes('ci-test-password'),
  'workflow must not contain a literal database password',
);

const validateJob = getJob('validate-ref', 'ci');
const ciJob = getJob('ci', 'build-and-publish');
const publishJob = getJob('build-and-publish', 'deploy');
const deployJob = getJob('deploy');

assert(
  validateJob.includes('runs-on: ubuntu-24.04'),
  'validate-ref must use ubuntu-24.04',
);

assert(
  validateJob.includes('refs/heads/dev'),
  'validate-ref must reject non-dev refs',
);

assert(
  ciJob.includes('needs: validate-ref'),
  'CI must wait for ref validation',
);

assert(
  ciJob.includes('uses: ./.github/workflows/ci.yml'),
  'CI job must call the reusable CI workflow',
);

assert(
  ciJob.includes('build_container_images: false'),
  'reusable CI must skip duplicate container builds',
);

assert(
  publishJob.includes('needs: ci'),
  'build-and-publish must wait for CI',
);

assert(
  publishJob.includes('runs-on: ubuntu-24.04'),
  'build-and-publish must use ubuntu-24.04',
);

assert(
  /permissions:\s*\n\s+contents: read\s*\n\s+packages: write/.test(
    publishJob,
  ),
  'build-and-publish must have contents read and packages write',
);

assert(
  publishJob.includes('docker login ghcr.io'),
  'build-and-publish must log in to GHCR',
);

assert(
  publishJob.includes('${{ github.actor }}'),
  'GHCR login must use github.actor',
);

assert(
  publishJob.includes('${{ github.token }}'),
  'GHCR login must use github.token',
);

assert(
  publishJob.includes('sha-${{ github.sha }}'),
  'published images must use the immutable workflow SHA tag',
);

const buildCommands = publishJob.match(/\bdocker build\b/g) ?? [];
const pushCommands = publishJob.match(/\bdocker push\b/g) ?? [];

assert(
  buildCommands.length === 2,
  'build-and-publish must build exactly two images',
);

assert(
  pushCommands.length === 2,
  'build-and-publish must push exactly two images',
);

assert(
  publishJob.lastIndexOf('docker build') <
    publishJob.indexOf('docker push'),
  'both images must build successfully before either image is pushed',
);

assert(
  publishJob.includes('org.opencontainers.image.source'),
  'published images must include the OCI source label',
);

assert(
  publishJob.includes('org.opencontainers.image.revision'),
  'published images must include the OCI revision label',
);

assert(
  publishJob.includes('if: always()'),
  'GHCR logout must always run',
);

assert(
  deployJob.includes('needs: build-and-publish'),
  'deploy must wait for image publication',
);

assert(
  /runs-on:\s*\[self-hosted, Linux, X64, dev\]/.test(deployJob),
  'deploy must use the DEV self-hosted runner',
);

assert(
  deployJob.includes('environment: dev'),
  'deploy must use the GitHub dev environment',
);

assert(
  /permissions:\s*\n\s+contents: read\s*\n\s+packages: read/.test(
    deployJob,
  ),
  'deploy must have contents read and packages read',
);

assert(
  deployJob.includes('timeout-minutes:'),
  'deploy must have a finite timeout',
);

assert(
  deployJob.includes('ref: ${{ github.sha }}'),
  'deploy must checkout the exact workflow SHA',
);

assert(
  deployJob.includes('POSTGRES_PASSWORD: ${{ secrets.POSTGRES_PASSWORD }}'),
  'deploy must read PostgreSQL password from the dev environment secret',
);

const requiredDevAuthEnvironment = [
  [
    'JWT_ACCESS_SECRET',
    '${{ secrets.JWT_ACCESS_SECRET }}',
  ],
  [
    'JWT_ACCESS_TTL_SECONDS',
    '${{ vars.JWT_ACCESS_TTL_SECONDS }}',
  ],
  [
    'REFRESH_TOKEN_PEPPER',
    '${{ secrets.REFRESH_TOKEN_PEPPER }}'
  ],
  [
    'REFRESH_TOKEN_TTL_SECONDS',
    '${{ vars.REFRESH_TOKEN_TTL_SECONDS }}',
  ],
  [
    'AUTH_COOKIE_SECURE',
    '${{ vars.AUTH_COOKIE_SECURE }}',
  ],
  [
    'AUTH_COOKIE_SAME_SITE',
    '${{ vars.AUTH_COOKIE_SAME_SITE }}',
  ]
]

for (
  const [variableName, expectedSource] of requiredDevAuthEnvironment
) {
  assert (
    deployJob.includes(
      `${variableName}: ${expectedSource}`,
    ),
    `deploy must configure ${variableName} from ${expectedSource}`,
  );
}

assert(
  deployJob.includes('IMAGE_TAG: sha-${{ github.sha }}'),
  'deploy must use the immutable workflow SHA image tag',
);

assert(
  deployJob.includes('bash infra/deploy/deploy-dev.sh'),
  'deploy job must invoke the tested deployment engine',
);

assert(
  /install\s+\\\s+-m 0755/.test(deployJob),
  'successful deployment must install its deployment script',
);

assert(
  deployJob.includes('DEPLOY_RESULT_FILE'),
  'deploy must provide a safe result file',
);

assert(
  !/^ {6}DEPLOY_RESULT_FILE:.*runner\.temp/m.test(deployJob),
  'runner.temp must not be evaluated in job-level env',
);

const safeResultKeys = [
  'DEPLOYMENT_STATUS',
  'MIGRATION_STATUS',
  'DOCKER_HEALTH_STATUS',
  'PUBLIC_HEALTH_STATUS',
  'ROLLBACK_STATUS',
  'DEPLOYED_SHA',
];

for (const key of safeResultKeys) {
  assert(
    deployJob.includes(key),
    `deployment summary must whitelist ${key}`,
  );
}

assert(
  deployJob.includes('if: always()'),
  'deployment summary and GHCR logout must run after failures',
);

assert(
  !deployJob.includes('cat "$DEPLOY_PATH/.env"') &&
    !deployJob.includes('cat "${DEPLOY_PATH}/.env"'),
  'deployment summary must never print the deployment environment file',
);

console.log('PASS: DEV deployment workflow contract is valid');
NODE
