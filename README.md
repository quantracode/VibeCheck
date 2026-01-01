# VibeCheck

A security scanner for modern web applications with a local-first artifact viewer.

## Overview

VibeCheck scans your codebase for security issues and generates a structured JSON artifact that can be viewed in a polished web UI. **Everything runs locally** - no code is uploaded to any server.

### Features

- **CLI Scanner**: Detect authentication gaps, unused security imports, hardcoded secrets, and more
- **Artifact Viewer**: Beautiful web UI to explore findings, filter by severity, and export reports
- **Local-Only**: Your code never leaves your machine. The UI runs entirely in your browser with IndexedDB storage
- **Policy Enforcement**: Risk posture widget shows if a scan would block deployment based on configurable thresholds

## Project Structure

```
vibecheck/
├── packages/
│   ├── schema/     # Zod schemas for the artifact format
│   └── cli/        # Command-line scanner
└── apps/
    └── web/        # Next.js artifact viewer
```

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 8+

### Installation

**Bash / macOS / Linux:**
```bash
# Clone the repository
git clone https://github.com/ben-ingram/VibeCheck.git
cd vibecheck

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

**PowerShell (Windows):**
```powershell
# Clone the repository
git clone https://github.com/ben-ingram/VibeCheck.git
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
pnpm --filter "@vibecheck/cli" exec vibecheck demo-artifact --out demo-artifact.json
```

This creates `demo-artifact.json` with 7 realistic security findings across different severity levels.

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
pnpm --filter "@vibecheck/cli" exec vibecheck scan C:\path\to\your\project --out scan-results.json

# Or scan with repo name
pnpm --filter "@vibecheck/cli" exec vibecheck scan . --repo-name my-project --out scan-results.json
```

#### CLI Options

```
vibecheck scan <directory> [options]

Options:
  -o, --out <path>       Output file path (default: stdout)
  -f, --format <format>  Output format: json or pretty (default: json)
  --repo-name <name>     Repository name for the artifact
  --fail-on <severity>   Exit with code 1 if findings at or above severity (critical|high|medium|low)
  --changed              Only scan files changed in git
```

### View Results in the UI

```bash
# Start the web UI
pnpm dev:web
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

1. Drag and drop your artifact JSON file onto the upload zone
2. Explore findings on the Dashboard
3. Click through to the Findings page for filtering and details
4. Use "Copy Report" to get a markdown summary for sharing

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

#### @vibecheck/cli

Command-line scanner with pluggable rules:

- `scan`: Analyze a codebase and generate an artifact
- `explain`: Get details about a specific rule
- `demo-artifact`: Generate a sample artifact for testing

Current scanners:
- **VC-CONFIG-001**: Hardcoded secrets in .env files
- **VC-HALL-001**: Unused security imports (helmet, cors, etc.)
- **VC-MW-001**: Next.js middleware without authentication

#### @vibecheck/web

Next.js App Router application with:

- Dashboard with severity breakdown and risk posture
- Findings list with search and filtering
- Detailed finding view with evidence and remediation
- Dark/light theme support
- Markdown report export

## Artifact Format

Artifacts follow a versioned schema (currently `0.1`):

```json
{
  "artifactVersion": "0.1",
  "generatedAt": "2024-01-01T12:00:00.000Z",
  "tool": { "name": "vibecheck", "version": "0.0.1" },
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
  ]
}
```

## License

MIT
