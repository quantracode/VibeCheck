# Local-Only Mode

VibeCheck operates entirely on your local machine. This document explains exactly what happens with your data.

## Privacy Guarantee

**Your code never leaves your machine.**

VibeCheck does not:
- Upload source code to any server
- Send telemetry or analytics
- Phone home for license validation
- Require network access to function
- Store data anywhere except your local filesystem

This is by design, not by accident. Security tools that exfiltrate code create risk. We don't.

## What VibeCheck Reads

When you run `vibecheck scan`, the tool reads:

| File Type | Purpose |
|-----------|---------|
| `*.ts`, `*.tsx`, `*.js`, `*.jsx` | Scan for security patterns |
| `package.json` | Detect dependencies, framework |
| `middleware.ts/js` | Analyze middleware coverage |
| `next.config.*` | Check configuration |
| `.env.example` | Verify documented variables |
| `tsconfig.json` | Resolve path aliases |

VibeCheck **does not read**:
- `.env` files (contains secrets)
- `node_modules/` (excluded by default)
- `.git/` directory
- Build outputs (`dist/`, `.next/`, `build/`)

## What VibeCheck Writes

Scan results are written to files you specify:

```bash
# Default output
vibecheck scan
# Creates: vibecheck-artifacts/vibecheck-scan.json

# Custom output
vibecheck scan -o ./reports/scan.json
```

### Artifact Contents

The scan artifact (`vibecheck-scan.json`) contains:

```json
{
  "artifactVersion": "0.2",
  "generatedAt": "2024-01-15T10:30:00Z",
  "tool": { "name": "vibecheck", "version": "0.0.1" },
  "repo": {
    "name": "my-app",
    "rootPathHash": "sha256:abc123..."
  },
  "summary": { ... },
  "findings": [ ... ]
}
```

**Note:** The artifact contains:
- Finding details (rule ID, severity, file paths, line numbers)
- Code snippets as evidence
- Repository name (derived from directory name)
- Hashed root path (not the actual path)

The artifact does **not** contain:
- Complete source code
- Environment variables or secrets
- Git history or commits
- User information

## Storage Locations

### CLI

The CLI stores nothing persistently. Each scan reads source files, writes artifacts, and exits.

Configuration via command-line flags only—no hidden config files.

### Web UI

The web UI uses browser-local storage:

| Data | Storage | Purpose |
|------|---------|---------|
| Imported artifacts | IndexedDB | View findings locally |
| Policy waivers | localStorage | Persist waiver decisions |
| Profile selection | localStorage | Remember preferences |
| Theme preference | localStorage | UI settings |

**All data stays in your browser.** The web UI is a static site with no backend.

To clear all stored data:
```javascript
// Browser console
indexedDB.deleteDatabase("vibecheck-artifacts");
localStorage.clear();
```

## Network Behavior

VibeCheck makes **zero network requests** during normal operation.

The only network activity occurs if you:
1. Install the package (`npm install @vibecheck/cli`)
2. Update the package (`npm update`)

The tool itself never phones home.

## Air-Gapped Environments

VibeCheck works in air-gapped environments:

1. Install dependencies on a connected machine
2. Copy `node_modules/` to the air-gapped system
3. Run scans normally

No license server, no activation, no network requirements.

## Enterprise Considerations

### Code Exfiltration Risk
VibeCheck eliminates code exfiltration risk entirely. Your intellectual property stays on your infrastructure.

### Audit Trail
Scan artifacts are self-contained JSON files. Store them in your artifact repository for audit purposes.

### Compliance
For SOC 2, HIPAA, or similar compliance frameworks:
- No third-party data processing
- Complete data locality
- Deterministic, reproducible results
- Full audit trail via artifacts

## Verification

You can verify VibeCheck's network behavior:

```bash
# Linux/macOS: Monitor network during scan
sudo tcpdump -i any host not localhost &
vibecheck scan ./my-project
# Should see zero packets

# Or use strace
strace -e network vibecheck scan ./my-project 2>&1 | grep -v ENOENT
```

## Source Code Audit

VibeCheck is designed to be auditable. The scanning logic is in:

```
packages/cli/src/
├── scanners/          # All detection rules
├── utils/             # File reading, no network
└── commands/          # CLI entry points
```

There are no network clients, no HTTP libraries for outbound calls, no telemetry hooks.

## Questions

**Q: Do you collect anonymous usage statistics?**
No. Zero telemetry.

**Q: Can my company audit the source?**
Yes. The codebase is designed for auditability.

**Q: What about the web UI—does it send data anywhere?**
No. The web UI is a static Next.js export. It runs entirely in your browser with no backend.

**Q: Can I run this on proprietary code?**
Yes. That's the point. Your code stays on your machine.
