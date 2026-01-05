# CI/CD Integration

VibeCheck is designed for CI/CD pipelines. This guide covers integration patterns for common platforms.

## Quick Start

```bash
# Install
npm install -D @quantracode/vibecheck

# Scan and evaluate in one flow
npx @quantracode/vibecheck scan --format both --out ./scan.json --fail-on off
npx @quantracode/vibecheck evaluate --artifact ./scan.json --profile startup
```

Exit codes:
- `0` = pass
- `1` = policy violation
- `2` = error

## GitHub Actions

### Official Workflow

VibeCheck includes an official GitHub Actions workflow at `.github/workflows/vibecheck.yml`. This workflow:

- Triggers on push to `main`/`master` and all pull requests
- Builds the CLI from source
- Runs security scan with both JSON and SARIF output
- Downloads baseline from main branch for regression detection (PRs only)
- Evaluates findings against the `startup` policy profile
- Uploads SARIF results to GitHub Code Scanning (Security tab)
- Uploads artifacts for audit trail

To use it, simply copy the workflow to your repository:

```bash
mkdir -p .github/workflows
cp node_modules/@vibecheck/cli/.github/workflows/vibecheck.yml .github/workflows/
```

Or use the workflow directly from this repository as a reference.

### Basic Integration

```yaml
# .github/workflows/security.yml
name: Security Scan

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  vibecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run VibeCheck
        run: npx @quantracode/vibecheck scan --policy startup
```

### With Artifact Upload

```yaml
jobs:
  vibecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run VibeCheck
        run: npx @quantracode/vibecheck scan --policy startup -o vibecheck-scan.json
        continue-on-error: true
        id: scan

      - name: Upload scan artifact
        uses: actions/upload-artifact@v4
        with:
          name: vibecheck-scan
          path: vibecheck-scan.json

      - name: Fail if policy violated
        if: steps.scan.outcome == 'failure'
        run: exit 1
```

### PR Comments (Advanced)

```yaml
jobs:
  vibecheck:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run VibeCheck
        id: scan
        run: |
          npx @quantracode/vibecheck scan --policy startup -o scan.json 2>&1 | tee output.txt
          echo "exit_code=${PIPESTATUS[0]}" >> $GITHUB_OUTPUT
        continue-on-error: true

      - name: Comment on PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const output = fs.readFileSync('output.txt', 'utf8');
            const passed = '${{ steps.scan.outputs.exit_code }}' === '0';

            const body = `## VibeCheck Security Scan

            ${passed ? '✅ **Passed**' : '❌ **Failed**'}

            <details>
            <summary>Scan Output</summary>

            \`\`\`
            ${output}
            \`\`\`

            </details>`;

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: body
            });

      - name: Fail if policy violated
        if: steps.scan.outputs.exit_code != '0'
        run: exit 1
```

### Baseline Comparison

```yaml
jobs:
  vibecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      # Download baseline from main branch
      - name: Download baseline
        uses: dawidd6/action-download-artifact@v3
        with:
          workflow: security.yml
          branch: main
          name: vibecheck-baseline
          path: .vibecheck
        continue-on-error: true

      - name: Run VibeCheck with baseline
        run: |
          if [ -f .vibecheck/baseline.json ]; then
            npx @quantracode/vibecheck scan --policy startup --baseline .vibecheck/baseline.json
          else
            npx @quantracode/vibecheck scan --policy startup
          fi

      # Save baseline on main branch
      - name: Save baseline
        if: github.ref == 'refs/heads/main'
        run: |
          mkdir -p .vibecheck
          npx @quantracode/vibecheck scan -o .vibecheck/baseline.json

      - name: Upload baseline
        if: github.ref == 'refs/heads/main'
        uses: actions/upload-artifact@v4
        with:
          name: vibecheck-baseline
          path: .vibecheck/baseline.json
```

## GitLab CI

```yaml
# .gitlab-ci.yml
vibecheck:
  stage: test
  image: node:20
  script:
    - npm ci
    - npx @quantracode/vibecheck scan --policy startup -o vibecheck-scan.json
  artifacts:
    paths:
      - vibecheck-scan.json
    when: always
    expire_in: 30 days
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == "main"
```

### With Policy File

```yaml
vibecheck:
  stage: test
  image: node:20
  script:
    - npm ci
    - npx @quantracode/vibecheck scan --policy .vibecheck/policy.json
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == "main"
```

## Azure DevOps

```yaml
# azure-pipelines.yml
trigger:
  - main

pr:
  - main

pool:
  vmImage: 'ubuntu-latest'

steps:
  - task: NodeTool@0
    inputs:
      versionSpec: '20.x'
    displayName: 'Install Node.js'

  - script: npm ci
    displayName: 'Install dependencies'

  - script: npx @quantracode/vibecheck scan --policy startup -o $(Build.ArtifactStagingDirectory)/vibecheck-scan.json
    displayName: 'Run VibeCheck'

  - task: PublishBuildArtifacts@1
    inputs:
      pathToPublish: '$(Build.ArtifactStagingDirectory)/vibecheck-scan.json'
      artifactName: 'vibecheck-scan'
    condition: always()
```

## CircleCI

```yaml
# .circleci/config.yml
version: 2.1

jobs:
  vibecheck:
    docker:
      - image: cimg/node:20.0
    steps:
      - checkout
      - restore_cache:
          keys:
            - v1-deps-{{ checksum "package-lock.json" }}
      - run: npm ci
      - save_cache:
          paths:
            - node_modules
          key: v1-deps-{{ checksum "package-lock.json" }}
      - run:
          name: Run VibeCheck
          command: npx @quantracode/vibecheck scan --policy startup -o vibecheck-scan.json
      - store_artifacts:
          path: vibecheck-scan.json

workflows:
  security:
    jobs:
      - vibecheck
```

## Jenkins

```groovy
// Jenkinsfile
pipeline {
    agent any

    tools {
        nodejs 'Node 20'
    }

    stages {
        stage('Install') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Security Scan') {
            steps {
                sh 'npx @quantracode/vibecheck scan --policy startup -o vibecheck-scan.json'
            }
            post {
                always {
                    archiveArtifacts artifacts: 'vibecheck-scan.json', fingerprint: true
                }
            }
        }
    }
}
```

## Bitbucket Pipelines

```yaml
# bitbucket-pipelines.yml
image: node:20

pipelines:
  default:
    - step:
        name: Security Scan
        caches:
          - node
        script:
          - npm ci
          - npx @quantracode/vibecheck scan --policy startup -o vibecheck-scan.json
        artifacts:
          - vibecheck-scan.json

  pull-requests:
    '**':
      - step:
          name: Security Scan
          caches:
            - node
          script:
            - npm ci
            - npx @quantracode/vibecheck scan --policy strict
```

## CLI Reference

### Commands

```bash
vibecheck scan [path]           # Scan a directory (default: current)
vibecheck view                  # Start local viewer for scan results
vibecheck evaluate              # Evaluate scan artifact against policy
vibecheck scan --help           # Show all scan options
vibecheck view --help           # Show all view options
vibecheck evaluate --help       # Show all evaluate options
```

### Scan Options

| Flag | Description |
|------|-------------|
| `-o, --out <file>` | Output artifact path |
| `--format <format>` | Output format: `json`, `sarif`, or `both` |
| `--fail-on <severity>` | Exit non-zero if findings at severity: `off`, `info`, `low`, `medium`, `high`, `critical` |
| `--emit-intent-map` | Include route map, intent claims, and coverage metrics |
| `--exclude <patterns>` | Additional glob patterns to exclude |
| `--include-tests` | Include test files in scan |

### Evaluate Options

| Flag | Description |
|------|-------------|
| `-a, --artifact <path>` | Path to scan artifact (required) |
| `-b, --baseline <path>` | Path to baseline artifact for regression detection |
| `-p, --profile <name>` | Policy profile: `startup`, `growth`, `strict` |
| `-c, --config <path>` | Path to custom policy config (overrides profile) |
| `-w, --waivers <path>` | Path to waivers file |
| `-o, --out <path>` | Output policy report to file |
| `-q, --quiet` | JSON output only (no console summary) |

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Scan complete, policy passed (if enabled) |
| 1 | Policy violation |
| 2 | Scan error (invalid config, file access, etc.) |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `VIBECHECK_POLICY` | Default policy profile |
| `VIBECHECK_OUTPUT` | Default output path |
| `NO_COLOR` | Disable colored output |

## Best Practices

### 1. Start Permissive, Tighten Over Time

```yaml
# Week 1: Just visibility
- run: npx vibecheck scan || true

# Week 2: Block critical only
- run: npx vibecheck scan --policy startup

# Month 2: Full enforcement
- run: npx vibecheck scan --policy strict
```

### 2. Use Baselines for PRs

Compare pull requests against the main branch baseline to catch regressions without blocking on existing issues.

### 3. Archive Scan Artifacts

Always save scan artifacts for:
- Audit trails
- Trend analysis
- Debugging failures

### 4. Fail Fast

Run security scans early in the pipeline to catch issues before expensive build/test steps.

```yaml
stages:
  - lint
  - security  # ← VibeCheck here
  - test
  - build
  - deploy
```

### 5. Use Required Rules for Critical Controls

Some security controls should never be bypassed:

```json
{
  "requiredRules": [
    "VC-AUTH-001",  // Unprotected routes
    "VC-AUTH-002",  // JWT verification
    "VC-CRYPTO-001" // Hardcoded secrets
  ]
}
```

## Troubleshooting

### Scan times out

Large codebases may need extended timeouts:

```yaml
- run: npx vibecheck scan --policy startup
  timeout-minutes: 10
```

### Node.js version issues

VibeCheck requires Node.js 18+. Ensure your CI uses a compatible version.

### Permission errors

If scanning files created by other steps, ensure proper permissions:

```yaml
- run: chmod -R 755 . && npx vibecheck scan
```

### Policy file not found

Use absolute paths or ensure the policy file is in the working directory:

```yaml
- run: npx vibecheck scan --policy ${{ github.workspace }}/.vibecheck/policy.json
```

## SARIF Integration

For GitHub Code Scanning integration:

```yaml
- name: Run VibeCheck
  run: npx vibecheck scan --format sarif -o results.sarif --fail-on off
  continue-on-error: true

- name: Upload SARIF
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: results.sarif
```

This displays findings directly in GitHub's Security tab and PR file views.

## Viewing Results Locally

After downloading scan artifacts from CI, you can view them with the built-in viewer:

```bash
# Download artifact from CI (example using GitHub CLI)
gh run download <run-id> -n vibecheck-scan

# View the results
npx @quantracode/vibecheck view -a vibecheck-scan.json
```

The viewer will:
- Start a local server at http://localhost:3000
- Auto-open your browser
- Load the artifact automatically

This is useful for:
- Debugging failed CI scans
- Reviewing findings in detail
- Sharing results with team members

## Two-Step Workflow: Scan + Evaluate

For production CI pipelines, we recommend separating scan and policy evaluation:

```yaml
# Step 1: Scan (always succeeds, produces artifacts)
- name: Run VibeCheck scan
  run: |
    npx vibecheck scan . \
      --format both \
      --out ./vibecheck-scan.json \
      --fail-on off

# Step 2: Evaluate (controls pass/fail based on policy)
- name: Evaluate against policy
  run: |
    npx vibecheck evaluate \
      --artifact ./vibecheck-scan.json \
      --profile startup
```

Benefits:
- **Artifacts always generated**: Even on policy failure, you get full scan results
- **Flexible gating**: Change policy profile without re-scanning
- **Baseline comparison**: Evaluate can compare against previous scans for regression detection
- **Audit trail**: Separate scan artifacts and policy reports

### With Baseline Comparison

```yaml
- name: Download baseline
  uses: dawidd6/action-download-artifact@v6
  with:
    workflow: security.yml
    branch: main
    name: vibecheck-scan
    path: ./baseline
  continue-on-error: true

- name: Evaluate with baseline
  run: |
    BASELINE_ARG=""
    if [ -f "./baseline/vibecheck-scan.json" ]; then
      BASELINE_ARG="--baseline ./baseline/vibecheck-scan.json"
    fi

    npx vibecheck evaluate \
      --artifact ./vibecheck-scan.json \
      --profile startup \
      $BASELINE_ARG
```
