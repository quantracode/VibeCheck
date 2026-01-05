# Policy Engine

VibeCheck's Policy Engine provides automated pass/fail decisions for CI/CD integration. Instead of manually reviewing findings, define policies that enforce your security requirements.

## Overview

The policy engine evaluates scan findings against configurable rules:

```
Scan Findings → Policy Rules → Pass/Fail Decision
```

A policy defines:
- **Thresholds**: Maximum allowed findings by severity
- **Required rules**: Specific rules that must pass
- **Waivers**: Acknowledged findings to exclude from evaluation

## Built-in Profiles

VibeCheck ships with three profiles for common use cases.

### `startup` (Default)

Balanced policy for early-stage projects. Blocks critical issues while allowing teams to iterate.

```json
{
  "name": "startup",
  "thresholds": {
    "critical": 0,
    "high": 3,
    "medium": 10,
    "low": -1,
    "info": -1
  }
}
```

- **Critical**: 0 allowed (blocks deployment)
- **High**: Up to 3 allowed
- **Medium**: Up to 10 allowed
- **Low/Info**: Unlimited (`-1` = no limit)

### `strict`

Zero-tolerance policy for production-critical applications.

```json
{
  "name": "strict",
  "thresholds": {
    "critical": 0,
    "high": 0,
    "medium": 0,
    "low": -1,
    "info": -1
  }
}
```

Blocks any Critical, High, or Medium finding.

### `compliance-lite`

Compliance-focused policy that requires specific security controls.

```json
{
  "name": "compliance-lite",
  "thresholds": {
    "critical": 0,
    "high": 0,
    "medium": 5,
    "low": -1,
    "info": -1
  },
  "requiredRules": [
    "VC-AUTH-001",
    "VC-AUTH-002",
    "VC-VAL-001"
  ]
}
```

In addition to thresholds, specific rules must pass (no findings).

## Using Policies

### CLI

```bash
# Evaluate with default profile (startup)
vibecheck scan --policy

# Evaluate with specific profile
vibecheck scan --policy strict

# Evaluate with custom policy file
vibecheck scan --policy ./my-policy.json
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Policy passed |
| 1 | Policy failed (thresholds exceeded) |
| 2 | Scan error |

### CI Integration

```yaml
# GitHub Actions
- name: Security Scan
  run: npx @quantracode/vibecheck scan --policy strict
  # Fails the job if policy violated
```

## Custom Policies

Create a JSON file with your policy definition:

```json
{
  "name": "my-team-policy",
  "description": "Custom policy for our requirements",
  "thresholds": {
    "critical": 0,
    "high": 1,
    "medium": 5,
    "low": -1,
    "info": -1
  },
  "requiredRules": [
    "VC-AUTH-001",
    "VC-AUTH-002"
  ],
  "blockedRules": [
    "VC-CRYPTO-001"
  ]
}
```

### Policy Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Policy identifier |
| `description` | string | Human-readable description |
| `thresholds` | object | Max findings per severity (`-1` = unlimited) |
| `requiredRules` | string[] | Rules that must have zero findings |
| `blockedRules` | string[] | Rules that automatically fail if triggered |

## Waivers

Waivers acknowledge specific findings that shouldn't block the policy. Use them for:
- Accepted risks with mitigating controls
- False positives in specific contexts
- Findings scheduled for future remediation

### Waiver Structure

```json
{
  "id": "waiver-001",
  "findingId": "VC-AUTH-001-abc123",
  "reason": "Rate limiting handled at CDN layer",
  "approvedBy": "security-team",
  "expiresAt": "2025-06-01T00:00:00Z",
  "createdAt": "2024-12-01T00:00:00Z"
}
```

### Waiver Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique waiver identifier |
| `findingId` | string | The specific finding being waived |
| `reason` | string | Justification for the waiver |
| `approvedBy` | string | Who approved this waiver |
| `expiresAt` | string | ISO date when waiver expires (optional) |
| `createdAt` | string | ISO date when waiver was created |

### Managing Waivers

**Web UI**: The Findings page includes a Waiver Manager for creating and managing waivers interactively.

**CLI**: Export waivers from the web UI and include them in your policy file:

```json
{
  "name": "my-policy",
  "thresholds": { ... },
  "waivers": [
    {
      "findingId": "VC-AUTH-001-abc123",
      "reason": "Accepted risk - CDN rate limiting",
      "expiresAt": "2025-06-01"
    }
  ]
}
```

### Waiver Best Practices

1. **Always document the reason**: Future you will thank past you
2. **Set expiration dates**: Waivers shouldn't live forever
3. **Review regularly**: Quarterly waiver audits catch stale exceptions
4. **Require approval**: Track who approved each waiver

## Regression Detection

The policy engine can detect security regressions by comparing scans:

```bash
# Compare current scan to baseline
vibecheck scan --baseline ./previous-scan.json --policy
```

Regression detection flags:
- **New findings**: Issues that didn't exist in the baseline
- **Reopened findings**: Previously fixed issues that returned
- **Severity increases**: Findings that became more severe

### Baseline Management

```bash
# Create a baseline after a clean scan
vibecheck scan -o ./baseline.json

# CI: Compare PRs against main branch baseline
vibecheck scan --baseline ./main-baseline.json --policy
```

## Policy Evaluation Flow

```
1. Load scan findings
2. Apply waivers (remove waived findings)
3. Check required rules (fail if any have findings)
4. Check blocked rules (fail if any triggered)
5. Count findings by severity
6. Compare against thresholds
7. Return pass/fail with details
```

## Web UI Integration

The web UI displays policy evaluation results on the Findings page:

- **Pass/Fail Badge**: Visual indicator of policy status
- **Threshold Progress**: Shows finding counts vs. limits
- **Waiver Management**: Create/edit/delete waivers
- **Export**: Download policy results for CI integration

## Examples

### Startup Team Workflow

```bash
# Development: Run scans, review findings
vibecheck scan

# CI: Block critical issues only
vibecheck scan --policy startup
```

### Enterprise Workflow

```bash
# Create strict policy with approved waivers
vibecheck scan --policy ./enterprise-policy.json

# Require baseline comparison for PRs
vibecheck scan --baseline ./main.json --policy strict
```

### Compliance Workflow

```bash
# Ensure specific controls are enforced
vibecheck scan --policy compliance-lite

# Generate audit report
vibecheck scan --policy compliance-lite -o ./audit/scan-$(date +%Y%m%d).json
```

## Troubleshooting

### Policy fails unexpectedly

1. Run without `--policy` to see all findings
2. Check if new rules were added in a VibeCheck update
3. Review waiver expiration dates

### Waivers not applying

1. Verify `findingId` matches exactly (includes hash)
2. Check waiver hasn't expired
3. Ensure waiver file is being loaded

### Threshold confusion

Remember: `-1` means unlimited, not "negative one finding allowed."

```json
{
  "low": -1,  // Unlimited low findings allowed
  "low": 0    // Zero low findings allowed
}
```
