# Determinism Certification & Badges

VibeCheck provides tools to verify scan determinism and generate badges for your README.

## Determinism Verification

Security scanners must produce consistent output. Non-deterministic scans lead to:
- Flaky CI/CD pipelines
- Unreliable baseline comparisons
- Difficult debugging

The `verify-determinism` command certifies that VibeCheck produces identical output across multiple runs.

### Usage

```bash
# Basic verification (3 runs)
vibecheck verify-determinism

# Specify target directory
vibecheck verify-determinism ./my-app

# More runs for higher confidence
vibecheck verify-determinism --runs 5

# Include SARIF verification
vibecheck verify-determinism --sarif

# Write certificate to file
vibecheck verify-determinism --out ./determinism-cert.json

# Verbose output (show differences on failure)
vibecheck verify-determinism -v
```

### How It Works

1. **Multiple Runs**: Scans the target N times
2. **Normalization**: Removes expected variations (timestamps, durations)
3. **Hashing**: Computes SHA-256 of normalized JSON output
4. **Comparison**: Verifies all hashes match
5. **Certification**: Generates report with pass/fail status

### Certificate Output

```json
{
  "certified": true,
  "timestamp": "2025-01-04T12:00:00.000Z",
  "targetPath": "/path/to/project",
  "targetPathHash": "abc123...",
  "runs": 3,
  "cliVersion": "0.2.3",
  "artifactVersion": "0.4",
  "totalFindings": 5,
  "jsonHashes": [
    "sha256hash...",
    "sha256hash...",
    "sha256hash..."
  ],
  "comparisonDetails": {
    "allJsonMatch": true,
    "allSarifMatch": true,
    "differences": []
  },
  "runDurations": [1234, 1198, 1256]
}
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Determinism certified - all runs identical |
| 1 | Verification failed - output differs between runs |

### CI Integration

```yaml
# GitHub Actions - verify determinism on schedule
name: Determinism Check
on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly
  workflow_dispatch:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx vibecheck verify-determinism --runs 3
```

---

## Badge Generation

Generate static SVG badges for your README without external services.

### Usage

```bash
# Generate badges from scan artifact
vibecheck badge --artifact scan.json

# Custom output directory
vibecheck badge -a scan.json -o ./docs/badges

# Flat-square style
vibecheck badge -a scan.json --style flat-square
```

### Generated Badges

| Badge | Filename | Description |
|-------|----------|-------------|
| Status | `vibecheck-status.svg` | PASS/CRITICAL/HIGH based on findings |
| Findings | `vibecheck-findings.svg` | Total findings count |
| Severity | `vibecheck-severity.svg` | Breakdown (e.g., "2C 5H 10M") |
| Score | `vibecheck-score.svg` | Security score (0-100) |
| Coverage | `vibecheck-coverage.svg` | Auth coverage % (if available) |

### Badge Colors

Badges use color coding to indicate status:

| Color | Meaning |
|-------|---------|
| Bright Green | Excellent (no issues or score 90+) |
| Green | Good (low findings or score 70+) |
| Yellow | Warning (medium findings or score 50+) |
| Orange | Concerning (high findings or score 30+) |
| Red | Critical (critical findings or score <30) |

### Example Output

```
Generated badges:
  ✓ vibecheck-status.svg (vibecheck: PASS)
  ✓ vibecheck-findings.svg (findings: 3)
  ✓ vibecheck-severity.svg (severity: 1H 2M)
  ✓ vibecheck-score.svg (security score: 87/100)
  ✓ vibecheck-coverage.svg (auth coverage: 75%)
```

### README Usage

Add to your README.md:

```markdown
![VibeCheck Status](./badges/vibecheck-status.svg)
![Security Score](./badges/vibecheck-score.svg)
![Findings](./badges/vibecheck-findings.svg)
```

### CI Integration

```yaml
# GitHub Actions - update badges on push
name: Security Badges
on:
  push:
    branches: [main]

jobs:
  badges:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run scan
        run: npx vibecheck scan -o scan.json --fail-on off

      - name: Generate badges
        run: npx vibecheck badge -a scan.json -o ./badges

      - name: Commit badges
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add badges/
          git diff --staged --quiet || git commit -m "chore: update security badges"
          git push
```

---

## Deterministic Guarantees

VibeCheck guarantees determinism through:

### Stable Ordering
- Findings sorted by fingerprint
- Routes sorted by route ID
- Intents sorted by intent ID

### Normalized Output
- Timestamps removed during comparison
- Scan duration excluded
- File paths normalized

### Fingerprinting
- Hash-based fingerprints using:
  - Rule ID
  - File path
  - Symbol/function name
  - Route pattern
  - Line number (when stable)

### Testing
- Determinism tests run in CI
- Multiple fixture scans verified
- SARIF output included in verification

---

## Troubleshooting

### Verification Fails

If `verify-determinism` fails:

1. **Check for dynamic content**: Look for code that generates random values at scan time
2. **Check file ordering**: Some filesystems return files in non-deterministic order
3. **Check timestamps**: Ensure no timestamps leak into finding data
4. **Report issue**: If determinism fails on a clean codebase, please report it

### Badge Generation Fails

If `badge` fails:

1. **Check artifact file**: Ensure it's a valid VibeCheck artifact
2. **Check permissions**: Ensure write access to output directory
3. **Check artifact version**: Older artifacts may not have all required fields

### Verbose Mode

Use `-v` or `--verbose` to see detailed differences:

```bash
vibecheck verify-determinism -v
```

This shows:
- Which fingerprints differ
- Finding count changes
- Route map differences
