# VibeCheck

A security scanner for modern web applications, with special focus on detecting issues in AI-generated code.

## Overview

VibeCheck scans your codebase for security issues and generates a structured JSON artifact that can be viewed in a polished web UI. **Everything runs locally** - no code is uploaded to any server.

### Features

- **CLI Scanner**: 30+ scanners detect authentication gaps, unused security imports, hardcoded secrets, supply chain risks, and more
- **Auto-Fix**: Apply security patches automatically with the `--apply-fixes` flag
- **Custom Rules**: Write your own security rules in YAML without touching TypeScript
- **Artifact Viewer**: Beautiful web UI to explore findings, filter by severity, and export reports
- **AI-Native Developer Mode**: Plain English explanations, step-by-step fix wizards, and "Copy to AI" prompts for developers who build with AI assistants
- **Local-Only**: Your code never leaves your machine. The UI runs entirely in your browser with IndexedDB storage
- **Policy Engine**: Configurable risk thresholds and profiles for CI/CD integration
- **SARIF Export**: Generate SARIF files for GitHub Security tab integration

## Project Structure

```
vibecheck/
├── packages/
│   ├── schema/     # Zod schemas for the artifact format
│   ├── cli/        # Command-line scanner
│   ├── policy/     # Policy evaluation engine
│   ├── license/    # License verification
│   └── viewer/     # Standalone viewer server
└── apps/
    └── web/        # Next.js artifact viewer
```

## Quick Start

### No-Install Usage

Run VibeCheck instantly without installation:

```bash
# Using npx
npx @quantracode/vibecheck scan --fail-on off --out vibecheck-scan.json

# Using pnpm dlx
pnpm dlx @quantracode/vibecheck scan --fail-on off --out vibecheck-scan.json
```

### Scan Another Folder

```bash
npx @quantracode/vibecheck scan --target ../my-other-app --out scan.json
```

### Prerequisites

- Node.js 18+
- pnpm 9+

### Installation (Development)

**Bash / macOS / Linux:**
```bash
# Clone the repository
git clone https://github.com/quantracode/VibeCheck.git
cd vibecheck

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

**PowerShell (Windows):**
```powershell
# Clone the repository
git clone https://github.com/quantracode/VibeCheck.git
cd vibecheck

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Generate a Demo Artifact

To quickly test the UI without scanning a real project:

**Bash / macOS / Linux:**
```bash
pnpm --filter @vibecheck/cli exec vibecheck demo-artifact --out demo-artifact.json
```

**PowerShell (Windows):**
```powershell
node packages/cli/dist/index.js demo-artifact --out demo-artifact.json
```

This creates `demo-artifact.json` with realistic security findings across different severity levels.

### Scan a Real Project

**Bash / macOS / Linux:**
```bash
# Scan a project directory
pnpm --filter @vibecheck/cli exec vibecheck scan /path/to/your/project --out scan-results.json

# Or scan with repo name
pnpm --filter @vibecheck/cli exec vibecheck scan . --repo-name my-project --out scan-results.json
```

**PowerShell (Windows):**
```powershell
# Scan a project directory
node packages/cli/dist/index.js scan C:\path\to\your\project --out scan-results.json

# Or scan with repo name
node packages/cli/dist/index.js scan . --repo-name my-project --out scan-results.json
```

#### CLI Options

```
vibecheck scan <directory> [options]

Options:
  -o, --out <path>         Output file path (default: stdout)
  -f, --format <format>    Output format: json, sarif, or both (default: json)
  --repo-name <name>       Repository name for the artifact
  --fail-on <severity>     Exit with code 1 if findings at or above severity (critical|high|medium|low|off)
  --changed                Only scan files changed in git
  --apply-fixes            Apply patches from findings after scan (requires confirmation)
  --force                  Skip confirmation prompts when applying patches
  -r, --rules <path>       Load custom YAML security rules from directory or file
  -e, --exclude <glob>     Additional glob patterns to exclude (repeatable)
  --include-tests          Include test files in scan
  --no-enhance             Disable AI-native developer enhancements (plain English, fix steps)
```

#### Auto-Fix Security Issues

VibeCheck can automatically apply security patches:

```bash
# Apply fixes with confirmation prompts
npx @quantracode/vibecheck scan --apply-fixes

# Apply all fixes without prompts (use with caution)
npx @quantracode/vibecheck scan --apply-fixes --force
```

The `--apply-fixes` flag reads patches from findings and applies them to your source files. Each patch is shown with a preview and requires confirmation unless `--force` is used.

#### Custom Security Rules

Extend VibeCheck with your own YAML-based rules:

```bash
# Load custom rules from a directory
npx @quantracode/vibecheck scan --rules ./my-custom-rules

# Load a single rule file
npx @quantracode/vibecheck scan -r my-rule.yaml
```

**Example Custom Rule:**

```yaml
id: CUSTOM-AUTH-001
severity: high
category: auth
title: "Missing authentication on POST endpoint"
description: "POST endpoints should have authentication checks"

files:
  file_type: [ts, tsx]
  include: ["**/api/**/*.ts"]

match:
  contains: "export async function POST"
  not_contains: "getServerSession"

recommended_fix: "Add authentication to your POST handler"

links:
  owasp: https://owasp.org/API-Security/
```

See [packages/cli/examples/CUSTOM_RULES_GUIDE.md](packages/cli/examples/CUSTOM_RULES_GUIDE.md) for a complete guide and more examples.

### View Results in the UI

The easiest way to view scan results is with the built-in viewer:

```bash
# Start the viewer (auto-detects artifacts)
npx @quantracode/vibecheck view

# Or specify an artifact explicitly
npx @quantracode/vibecheck view -a scan-results.json

# Use a different port
npx @quantracode/vibecheck view --port 8080
```

The viewer will:
- Start a local server on port 3000 (or next available)
- Auto-open your browser
- Auto-detect and load artifacts from common locations
- Work completely offline after initial load

**Alternative: Development Mode**

For development, you can also run the web UI directly:

```bash
pnpm dev:web
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

**Using the Viewer:**

1. Drag and drop your artifact JSON file onto the upload zone (or let it auto-load)
2. Explore findings on the Dashboard
3. Click through to the Findings page for filtering and details
4. Use "Copy Report" to get a markdown summary for sharing

## Policy Evaluation

VibeCheck includes a policy engine for CI/CD integration:

```bash
# Evaluate scan against startup profile
npx @quantracode/vibecheck evaluate \
  --artifact vibecheck-scan.json \
  --profile startup \
  --out policy-report.json

# Compare against a baseline (regression detection)
npx @quantracode/vibecheck evaluate \
  --artifact vibecheck-scan.json \
  --baseline main-branch-scan.json \
  --profile enterprise
```

Available profiles: `startup`, `growth`, `enterprise`

## How Local-Only Mode Works

VibeCheck is designed with privacy in mind:

1. **CLI runs locally**: The scanner executes entirely on your machine. Source code is read from disk and never transmitted anywhere.

2. **Artifacts are portable JSON**: Scan results are saved as JSON files that you control. Share them however you like, or keep them private.

3. **UI uses IndexedDB**: The web viewer stores imported artifacts in your browser's IndexedDB. No backend server, no database, no network requests to external services.

4. **No telemetry**: VibeCheck does not collect any usage data or analytics.

## Development

### Scripts

**Bash / macOS / Linux:**
```bash
# Install all dependencies
pnpm install

# Build all packages
pnpm build

# Run the web UI in development mode
pnpm dev:web

# Type check all packages
pnpm typecheck

# Lint all packages
pnpm lint

# Run CLI tests
pnpm --filter @vibecheck/cli test

# Run schema tests
pnpm --filter @vibecheck/schema test
```

**PowerShell (Windows):**
```powershell
# Install all dependencies
pnpm install

# Build all packages
pnpm build

# Run the web UI in development mode
pnpm dev:web

# Type check all packages
pnpm typecheck

# Lint all packages
pnpm lint

# Run CLI tests
pnpm --filter "@vibecheck/cli" test

# Run schema tests
pnpm --filter "@vibecheck/schema" test
```

> **Note for PowerShell users:** The `@` symbol has special meaning in PowerShell, so package filter names like `@vibecheck/cli` must be wrapped in quotes.

### Package Details

#### @vibecheck/schema

Defines the artifact format using Zod schemas:

- `ScanArtifact`: Root artifact with metadata, findings, and summary
- `Finding`: Individual security issue with evidence, remediation, and links
- `Claim`: Security claims found in code (e.g., "auth enforced" comments)
- `ProofTrace`: Data flow analysis showing how issues propagate

#### @quantracode/vibecheck (CLI)

Command-line scanner with pluggable rules:

- `scan`: Analyze a codebase and generate an artifact
- `view`: Start the local web viewer to explore scan results
- `evaluate`: Run policy evaluation against an artifact
- `explain`: Get details about a specific rule
- `demo-artifact`: Generate a sample artifact for testing

**Scanner Categories (30+ scanners):**

| Category | Scanners | Examples |
|----------|----------|----------|
| Auth | 2 | Unprotected API routes, middleware gaps |
| Authorization | 4 | Missing role guards, ownership checks, IDOR patterns |
| Validation | 2 | Ignored validation, client-side only validation |
| Privacy | 3 | Sensitive logging, over-broad responses, debug flags |
| Config | 2 | Insecure defaults, undocumented env vars |
| Network | 4 | SSRF, open redirects, CORS misconfiguration, missing timeouts |
| Crypto | 3 | Math.random tokens, unverified JWT decode, weak hashing |
| Uploads | 2 | Missing constraints, public upload paths |
| Middleware | 1 | Missing rate limiting |
| Hallucinations | 1 | Unused security imports |
| Lifecycle | 3 | Create/update asymmetry, validation schema drift |
| Supply Chain | 6 | Version ranges, suspicious scripts, deprecated packages |

#### @vibecheck/policy

Policy evaluation engine:

- Risk profiles (startup, growth, enterprise)
- Severity thresholds and category gates
- Baseline comparison for regression detection

#### @vibecheck/web

Next.js App Router application with:

- Dashboard with severity breakdown, risk posture, and "What to Fix First" priority list
- Findings list with search, filtering, and batch operations
- Detailed finding view with evidence, remediation, and AI-native enhancements
- **AI-Native Developer Features:**
  - Plain English explanations ("What's wrong" and "Why it matters")
  - Step-by-step fix wizards with code examples
  - Before/after code comparison
  - "Copy to AI" prompts for Claude, ChatGPT, or other assistants
  - View mode toggle (Simple/Technical/Full) for different expertise levels
  - Smart waiver dialog with educational flow
  - Batch export to Markdown, JSON, or CSV
- Dark/light theme support
- Markdown report export

## Artifact Format

Artifacts follow a versioned schema (currently `0.3`):

```json
{
  "artifactVersion": "0.3",
  "generatedAt": "2024-01-01T12:00:00.000Z",
  "tool": { "name": "vibecheck", "version": "0.3.2" },
  "repo": { "name": "my-project", "rootPathHash": "..." },
  "summary": {
    "totalFindings": 5,
    "bySeverity": { "critical": 1, "high": 2, "medium": 1, "low": 1, "info": 0 },
    "byCategory": { "auth": 1, "injection": 1, ... }
  },
  "findings": [
    {
      "id": "...",
      "ruleId": "VC-AUTH-001",
      "title": "Missing Authentication",
      "severity": "critical",
      "confidence": 0.95,
      "evidence": [...],
      "remediation": { "recommendedFix": "...", "patch": "..." }
    }
  ],
  "routeMap": { ... },
  "middlewareMap": { ... },
  "intentMap": { ... },
  "proofTraces": { ... },
  "metrics": { ... }
}
```

## CI/CD Integration

See [docs/CI_INTEGRATION.md](docs/CI_INTEGRATION.md) for detailed GitHub Actions setup.

## License

MIT
