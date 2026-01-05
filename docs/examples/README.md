# Example Artifacts

This directory contains example VibeCheck scan artifacts for documentation and testing purposes.

## Files

### example-clean-scan.json

A scan result with **zero findings** - representing a well-secured application. Use this to:
- Understand artifact structure
- Test the viewer with clean results
- Compare against your own scans

### example-findings-scan.json

A scan result with **5 findings** across multiple categories. Includes:
- VC-AUTH-001: Unprotected admin route
- VC-VAL-001: Ignored validation result
- VC-PRIV-001: Sensitive data logging
- VC-NET-001: SSRF-prone fetch
- VC-CRYPTO-002: JWT decode without verify

Use this to:
- Understand finding structure
- Test viewer with real-looking findings
- See example evidence and remediation

## Using These Examples

### View in Browser

```bash
# From the vibecheck repo root
vibecheck view docs/examples/example-findings-scan.json
```

### Programmatic Access

```typescript
import artifact from './example-findings-scan.json';

// Access findings
for (const finding of artifact.findings) {
  console.log(`${finding.severity}: ${finding.title}`);
}

// Access route map
console.log(`Total routes: ${artifact.routeMap.totalRoutes}`);
```

### Schema Validation

These artifacts conform to the VibeCheck schema version 0.4:

```typescript
import { ScanArtifact } from '@vibecheck/schema';

const artifact: ScanArtifact = require('./example-clean-scan.json');
```

## Notes

- All file paths and fingerprints are synthetic examples
- These artifacts are deterministic and can be used in tests
- Timestamps are fixed to 2026-01-04T12:00:00.000Z
