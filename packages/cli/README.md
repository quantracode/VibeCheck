# @quantracode/vibecheck

The first AI Enforcement Security tool. Proves whether AI-written code actually enforces the security it claims — not just implied, commented, or assumed.

## What is AI Enforcement Security?

Traditional security tools scan for vulnerabilities. VibeCheck verifies enforcement reality. That's a fundamentally different job.

AI-generated code often hallucinates security guarantees. It writes comments claiming protection exists, imports security libraries but doesn't use them, or creates middleware that never gets wired up. VibeCheck detects these patterns and proves what's actually enforced.

**Key Principles:**
- **Deterministic** — No LLM calls, results are reproducible
- **Local-only** — All analysis runs on your machine, code never uploaded
- **Low false positives** — Precision over recall
- **Framework-aware** — Built for Next.js, Express patterns
- **Enforcement-focused** — Proves what's enforced, not just scanned

## Quick Start

```bash
# Install globally
npm install -g @quantracode/vibecheck

# Or use without installing
npx @quantracode/vibecheck scan --fail-on off --out vibecheck-scan.json

# With auto-fix enabled
npx @quantracode/vibecheck scan --apply-fixes

# With custom security rules
npx @quantracode/vibecheck scan --rules ./my-custom-rules
```

### Scan Another Folder

```bash
npx @quantracode/vibecheck scan --target ../my-other-app --out scan.json
```

## Usage

```bash
# Scan current directory
vibecheck scan

# Scan specific directory with output file
vibecheck scan ./my-project --out ./reports/scan.json

# Use --target as alternative to positional argument
vibecheck scan --target ./my-project

# Output in SARIF format (for GitHub Code Scanning)
vibecheck scan --format sarif

# Output both JSON and SARIF
vibecheck scan --format both

# Fail CI if medium or higher findings
vibecheck scan --fail-on medium

# Disable fail threshold (always exit 0)
vibecheck scan --fail-on off

# Exclude specific directories
vibecheck scan -e "**/legacy/**" -e "**/vendor/**"

# Include test files in scan (excluded by default)
vibecheck scan --include-tests

# Generate intent map with coverage metrics
vibecheck scan --emit-intent-map

# Auto-fix security issues (with confirmation)
vibecheck scan --apply-fixes

# Auto-fix without confirmation prompts
vibecheck scan --apply-fixes --force

# Load custom YAML security rules
vibecheck scan --rules ./my-custom-rules

# Load a single custom rule file
vibecheck scan -r my-rule.yaml

# Explain a scan report
vibecheck explain ./scan.json

# Start the web viewer
vibecheck view

# Open viewer with specific artifact
vibecheck view -a ./scan.json
```

## View Command

The `view` command starts a local web viewer to explore scan results interactively.

```bash
# Start viewer (auto-detects artifacts in current directory)
vibecheck view

# Specify artifact file explicitly
vibecheck view -a ./vibecheck-scan.json
vibecheck view --artifact ./scan-results.json

# Use a different port
vibecheck view --port 8080

# Don't auto-open browser
vibecheck view --no-open

# Force update the viewer to latest version
vibecheck view --update

# Clear cached viewer files
vibecheck view --clear-cache
```

### View Command Options

| Option | Description | Default |
|--------|-------------|---------|
| `-p, --port <port>` | Port to run the viewer on | `3000` |
| `-a, --artifact <path>` | Path to artifact file to open | Auto-detected |
| `--no-open` | Don't automatically open the browser | Opens browser |
| `--update` | Force update the viewer to latest version | - |
| `--clear-cache` | Clear the cached viewer and exit | - |

### How It Works

1. **Auto-download**: The viewer is automatically downloaded from npm on first run and cached in `~/.vibecheck/viewer/`
2. **Auto-detect artifacts**: Looks for scan artifacts in common locations:
   - `vibecheck-artifacts/artifact.json`
   - `vibecheck-artifact.json`
   - `.vibecheck/artifact.json`
   - `scan-results.json`
3. **Auto-load**: When an artifact is detected, it's automatically loaded into the viewer
4. **Local-only**: The viewer runs entirely on your machine with no external connections

### Workflow Example

```bash
# 1. Run a scan
vibecheck scan --out vibecheck-artifacts/artifact.json

# 2. View results (artifact auto-detected)
vibecheck view

# Browser opens to http://localhost:3000 with results loaded
```

## Command Line Options

### Scan Options

| Option | Description | Default |
|--------|-------------|---------|
| `-t, --target <path>` | Target directory to scan | Current directory |
| `-o, --out <path>` | Output file or directory | `vibecheck-artifacts/vibecheck-scan.json` |
| `-f, --format <format>` | Output format: `json`, `sarif`, or `both` | `json` |
| `--repo-name <name>` | Override repository name | Auto-detected |
| `--fail-on <threshold>` | Exit with non-zero if findings >= threshold | `high` |
| `-e, --exclude <glob>` | Glob pattern to exclude (repeatable) | See below |
| `--include-tests` | Include test files in scan | `false` |
| `--emit-intent-map` | Include route map and coverage metrics | `false` |
| `--apply-fixes` | Apply patches from findings after scan | `false` |
| `--force` | Skip confirmation when applying patches | `false` |
| `-r, --rules <path>` | Load custom YAML rules from directory or file | - |

### Default Excludes

The following patterns are excluded by default:

**Core excludes (always applied):**
- `node_modules`, `dist`, `.git`, `build`, `.next`, `coverage`
- `.turbo`, `.cache`, `out`, `.vercel`, `.netlify`

**Test excludes (skipped with `--include-tests`):**
- `__tests__/**`, `*.test.*`, `*.spec.*`
- `test/`, `tests/`, `fixtures/`, `__mocks__/`, `__fixtures__/`
- `cypress/`, `e2e/`, `*.stories.*`

## Auto-Fix Security Issues

VibeCheck can automatically apply security patches from findings:

```bash
# Apply fixes with confirmation prompts for each patch
vibecheck scan --apply-fixes

# Apply all fixes automatically without prompts (use with caution!)
vibecheck scan --apply-fixes --force
```

### How It Works

1. **Scan completes** - VibeCheck identifies security issues
2. **Patches available** - Findings with `remediation.patch` field are candidates for auto-fix
3. **Preview shown** - Each patch is displayed with before/after comparison
4. **User confirmation** - You approve or reject each patch (unless `--force` is used)
5. **Applied to files** - Approved patches are written to your source files

### Safety Features

- **Unified diff format**: Only standard git-style diffs are supported for safety
- **Context validation**: Patches verify that file content matches before applying
- **Confirmation required**: Interactive approval by default
- **Detailed errors**: Clear messages if a patch fails to apply

### Best Practices

1. **Commit first**: Always have a clean git status before applying fixes
2. **Review changes**: Run `git diff` after applying patches
3. **Test thoroughly**: Run your test suite to ensure nothing broke
4. **Use force carefully**: Only use `--force` when you fully trust the patches

**Example:**

```bash
# 1. Ensure clean working directory
git status

# 2. Run scan with auto-fix
vibecheck scan --apply-fixes

# 3. Review what changed
git diff

# 4. Test the changes
npm test

# 5. Commit if everything looks good
git add .
git commit -m "fix: apply VibeCheck security patches"
```

## Custom Security Rules

Extend VibeCheck with your own YAML-based security rules - no TypeScript required!

```bash
# Load custom rules from a directory
vibecheck scan --rules ./my-custom-rules

# Load a single rule file
vibecheck scan -r my-security-rule.yaml
```

### Example Custom Rule

```yaml
id: CUSTOM-AUTH-001
severity: high
category: auth
title: "Missing authentication on POST endpoint"
description: |
  POST endpoints should have authentication checks to prevent
  unauthorized access to state-changing operations.

files:
  file_type: [ts, tsx]
  include: ["**/api/**/*.ts"]
  exclude: ["**/*.test.*"]

match:
  contains: "export async function POST"
  not_contains: "getServerSession"
  case_sensitive: false

context:
  in_function: [POST]
  file_not_contains: ["test", "mock"]

recommended_fix: |
  Add authentication to your POST handler:

  ```typescript
  import { getServerSession } from "next-auth";

  export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }
    // ... rest of handler
  }
  ```

links:
  owasp: https://owasp.org/API-Security/editions/2023/en/0xa2-broken-authentication/
  cwe: https://cwe.mitre.org/data/definitions/306.html

metadata:
  author: "Your Name"
  tags: ["authentication", "api-security"]
  created: "2025-01-07"
```

### Rule Structure

**Required Fields:**
- `id`: Unique identifier (format: `XXX-XXX-000`)
- `severity`: `critical`, `high`, `medium`, `low`, or `info`
- `category`: Security category (auth, validation, secrets, etc.)
- `title`: Short description
- `description`: Detailed explanation
- `match`: What to look for (see Match Conditions below)
- `recommended_fix`: How to fix the issue

**Optional Fields:**
- `files`: File filters (type, include/exclude patterns, directories)
- `context`: Advanced conditions (imports, function types, file content)
- `patch`: Unified diff for auto-fixing
- `links`: Reference URLs (OWASP, CWE, docs)
- `metadata`: Author, tags, version, dates
- `enabled`: Whether the rule is active (default: true)

### Match Conditions

**String Match:**
```yaml
match:
  contains: "eval("
  case_sensitive: true
```

**Negative Match (should NOT contain):**
```yaml
match:
  not_contains: "getServerSession"  # Flag files without auth
```

**Regular Expression:**
```yaml
match:
  regex: "password\\s*=\\s*['\"][^'\"]+['\"]"
  case_sensitive: false
```

**Combined Conditions:**
```yaml
match:
  contains: "export async function POST"
  not_contains: "await auth()"
  regex: "prisma\\.(create|update|delete)"
```

### File Filters

```yaml
files:
  file_type: [ts, tsx, js, jsx]
  include: ["**/api/**/*.ts", "**/routes/**/*.ts"]
  exclude: ["**/*.test.*", "**/*.spec.*"]
  directories: ["/api/", "/routes/"]
```

Available file types: `ts`, `tsx`, `js`, `jsx`, `json`, `env`, `yaml`, `yml`, `md`, `config`, `any`

### Context Conditions

```yaml
context:
  # Only flag if file imports these packages
  requires_import: ["next-auth", "@prisma/client"]

  # Don't flag if file imports these
  excludes_import: ["vitest", "@testing-library"]

  # File must contain all of these
  file_contains: ["database", "user"]

  # File must NOT contain any of these
  file_not_contains: ["test", "mock"]

  # Only match in specific handler types
  in_function: [POST, PUT, DELETE, route_handler]
```

### Multiple Rules in One File

```yaml
schema_version: "1.0"

rules:
  - id: CUSTOM-001
    severity: high
    category: auth
    title: "First rule"
    # ... rule config

  - id: CUSTOM-002
    severity: medium
    category: validation
    title: "Second rule"
    # ... rule config
```

### Complete Guide

See [examples/CUSTOM_RULES_GUIDE.md](./examples/CUSTOM_RULES_GUIDE.md) for:
- Full rule specification
- Advanced examples (SQL injection, hardcoded secrets, etc.)
- Best practices and troubleshooting
- Community contribution guidelines

### Example Rules

Check out [examples/custom-rules/](./examples/custom-rules/) for production-ready examples:
- `hardcoded-secret.yaml` - Detect secrets in .env files
- `missing-rate-limit.yaml` - Find API routes without rate limiting
- `console-log-production.yaml` - Flag console.log in production code
- `collection-example.yaml` - Multiple rules in one file

## Scanner Categories

VibeCheck includes 30+ enforcement verification scanners across these categories:

### Auth & Authorization

| Rule ID | Title | Severity |
|---------|-------|----------|
| VC-AUTH-001 | Unprotected State-Changing API Route | High/Critical |
| VC-MW-001 | Middleware Matcher Gap | High |
| VC-AUTH-010 | Auth-by-UI with Server Gap | Critical |

### Input Validation

| Rule ID | Title | Severity |
|---------|-------|----------|
| VC-VAL-001 | Validation Defined But Output Ignored | Medium |
| VC-VAL-002 | Client-Side Only Validation | Medium |

### Network Security

| Rule ID | Title | Severity |
|---------|-------|----------|
| VC-NET-001 | SSRF-Prone Fetch | High |
| VC-NET-002 | Open Redirect | High |
| VC-NET-003 | Over-permissive CORS with Credentials | High |
| VC-NET-004 | Missing Request Timeout | Low |

### Secrets & Config

| Rule ID | Title | Severity |
|---------|-------|----------|
| VC-CONFIG-001 | Undocumented Environment Variable | Low |
| VC-CONFIG-002 | Insecure Default Secret Fallback | Critical |
| VC-PRIV-003 | Debug Flags in Production | Medium |

### Privacy & Data

| Rule ID | Title | Severity |
|---------|-------|----------|
| VC-PRIV-001 | Sensitive Data Logged | High |
| VC-PRIV-002 | Over-broad API Response | Medium/High |

### Cryptography

| Rule ID | Title | Severity |
|---------|-------|----------|
| VC-CRYPTO-001 | Math.random for Tokens | High |
| VC-CRYPTO-002 | JWT Decode Without Verify | Critical |
| VC-CRYPTO-003 | Weak Password Hashing | High |

### File Uploads

| Rule ID | Title | Severity |
|---------|-------|----------|
| VC-UP-001 | File Upload Without Constraints | High |
| VC-UP-002 | Upload to Public Path | High |

### Middleware

| Rule ID | Title | Severity |
|---------|-------|----------|
| VC-RATE-001 | Missing Rate Limiting | Medium |

### AI Hallucinations

| Rule ID | Title | Severity |
|---------|-------|----------|
| VC-HALL-001 | Security Library Imported But Not Used | Medium |
| VC-HALL-010 | Comment Claims Protection But Unproven | Medium |
| VC-HALL-011 | Middleware Assumed But Not Matching | High |
| VC-HALL-012 | Validation Claimed But Missing/Ignored | Medium |

### Supply Chain

| Rule ID | Title | Severity |
|---------|-------|----------|
| VC-SC-001 | Unpinned Dependencies | Medium |
| VC-SC-002 | Suspicious Postinstall Scripts | High |
| VC-SC-003 | Deprecated Packages | Low |

### Abuse & Compute

| Rule ID | Title | Severity |
|---------|-------|----------|
| VC-ABUSE-001 | Unbounded AI API Calls | High |
| VC-ABUSE-002 | Missing Cost Controls | Medium |

## Output Formats

VibeCheck supports two output formats: JSON and SARIF.

### JSON Format

The default format, defined by `@vibecheck/schema`:

```json
{
  "artifactVersion": "0.3",
  "generatedAt": "2024-01-15T10:30:00.000Z",
  "tool": {
    "name": "vibecheck",
    "version": "0.3.2"
  },
  "summary": {
    "totalFindings": 2,
    "bySeverity": { "critical": 0, "high": 1, "medium": 1, "low": 0, "info": 0 },
    "byCategory": { "auth": 1, "validation": 1, ... }
  },
  "findings": [
    {
      "id": "f-abc123",
      "severity": "high",
      "confidence": 0.85,
      "category": "auth",
      "ruleId": "VC-AUTH-001",
      "title": "Missing authentication on POST /api/users",
      "description": "...",
      "evidence": [
        {
          "file": "app/api/users/route.ts",
          "startLine": 25,
          "endLine": 30,
          "snippet": "...",
          "label": "Unprotected route handler"
        }
      ],
      "remediation": {
        "recommendedFix": "Add authentication middleware"
      },
      "fingerprint": "sha256:..."
    }
  ],
  "metrics": {
    "filesScanned": 50,
    "linesOfCode": 5000,
    "scanDurationMs": 1234
  }
}
```

### SARIF Format

SARIF (Static Analysis Results Interchange Format) is an OASIS standard for static analysis tools. Use `--format sarif` to generate SARIF 2.1.0 output, compatible with:

- **GitHub Code Scanning** — Upload via `github/codeql-action/upload-sarif`
- **Azure DevOps** — Native SARIF support in security reports
- **VS Code** — SARIF Viewer extension
- **Other tools** — Any SARIF 2.1.0 compatible viewer

```bash
# Generate SARIF for GitHub Code Scanning
vibecheck scan --format sarif --out results.sarif
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Security Scan

on: [push, pull_request]

jobs:
  vibecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Run VibeCheck
        run: npx @quantracode/vibecheck scan --format sarif --out results.sarif --fail-on high

      - name: Upload SARIF
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: results.sarif
```

### Policy Evaluation

Compare scans against baselines for regression detection:

```bash
# Evaluate against startup profile
vibecheck evaluate \
  --artifact vibecheck-scan.json \
  --profile startup \
  --out policy-report.json

# Compare against baseline (regression detection)
vibecheck evaluate \
  --artifact vibecheck-scan.json \
  --baseline main-branch-scan.json \
  --profile enterprise
```

Available profiles: `startup`, `growth`, `enterprise`

## Intent Map & Coverage Metrics

With `--emit-intent-map`, the scan artifact includes coverage metrics:

- **authCoverage**: Percentage of state-changing routes with proven auth
- **validationCoverage**: Percentage of routes with request bodies that have validation
- **middlewareCoverage**: Percentage of routes covered by middleware matchers

```bash
# Generate intent map
vibecheck scan ./my-project --emit-intent-map --out scan.json
```

## Architecture

```
packages/cli/src/
├── commands/
│   ├── scan.ts         # Main scan orchestrator
│   ├── evaluate.ts     # Policy evaluation
│   └── explain.ts      # Report viewer
├── scanners/
│   ├── types.ts        # ScanContext, types
│   ├── helpers/
│   │   ├── ast-helpers.ts      # ts-morph utilities
│   │   └── context-builder.ts  # ScanContext factory
│   ├── auth/           # Auth & authorization scanners
│   ├── validation/     # Input validation scanners
│   ├── privacy/        # Privacy & data scanners
│   ├── config/         # Config & secrets scanners
│   ├── network/        # Network security scanners
│   ├── crypto/         # Cryptography scanners
│   ├── uploads/        # File upload scanners
│   ├── middleware/     # Middleware scanners
│   ├── hallucinations/ # AI hallucination scanners
│   ├── supply-chain/   # Supply chain scanners
│   └── abuse/          # Abuse & compute scanners
└── index.ts
```

## License

MIT
