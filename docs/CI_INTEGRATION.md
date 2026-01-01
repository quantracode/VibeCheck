# CI/CD Integration

VibeCheck is designed for CI/CD pipelines. This guide covers integration patterns for common platforms.

## Quick Start

```bash
# Install
npm install -D @vibecheck/cli

# Scan with policy enforcement
npx vibecheck scan --policy strict
```

Exit code `0` = pass, `1` = policy violation, `2` = error.

## GitHub Actions

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
        run: npx @vibecheck/cli scan --policy startup
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
        run: npx @vibecheck/cli scan --policy startup -o vibecheck-scan.json
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
          npx @vibecheck/cli scan --policy startup -o scan.json 2>&1 | tee output.txt
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
            npx @vibecheck/cli scan --policy startup --baseline .vibecheck/baseline.json
          else
            npx @vibecheck/cli scan --policy startup
          fi

      # Save baseline on main branch
      - name: Save baseline
        if: github.ref == 'refs/heads/main'
        run: |
          mkdir -p .vibecheck
          npx @vibecheck/cli scan -o .vibecheck/baseline.json

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
    - npx @vibecheck/cli scan --policy startup -o vibecheck-scan.json
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
    - npx @vibecheck/cli scan --policy .vibecheck/policy.json
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

  - script: npx @vibecheck/cli scan --policy startup -o $(Build.ArtifactStagingDirectory)/vibecheck-scan.json
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
          command: npx @vibecheck/cli scan --policy startup -o vibecheck-scan.json
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
                sh 'npx @vibecheck/cli scan --policy startup -o vibecheck-scan.json'
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
          - npx @vibecheck/cli scan --policy startup -o vibecheck-scan.json
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
            - npx @vibecheck/cli scan --policy strict
```

## CLI Reference

### Commands

```bash
vibecheck scan [path]           # Scan a directory (default: current)
vibecheck scan --help           # Show all options
```

### Options

| Flag | Description |
|------|-------------|
| `-o, --output <file>` | Output artifact path |
| `--policy [profile]` | Enable policy evaluation |
| `--baseline <file>` | Compare against baseline scan |
| `--format <format>` | Output format: `json` (default), `sarif` |
| `--quiet` | Suppress stdout, only exit code |
| `--verbose` | Show detailed scan progress |

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
  run: npx vibecheck scan --format sarif -o results.sarif
  continue-on-error: true

- name: Upload SARIF
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: results.sarif
```

This displays findings directly in GitHub's Security tab and PR file views.
