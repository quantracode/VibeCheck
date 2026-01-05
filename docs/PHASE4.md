# Phase 4: Correlation & Cross-Pack Analysis

Phase 4 introduces cross-pack correlation analysis, enabling VibeCheck to detect complex security patterns that span multiple scanner packs. This document describes the additions and constraints.

## Key Properties

- **Deterministic**: Same source code always produces identical correlation findings
- **No Network**: All correlation analysis runs locally
- **No AI/LLM**: Pattern detection uses static rules, not machine learning
- **Explainable**: Every correlation finding links back to source findings with proof traces

## Overview

Phase 4 adds:
- **Correlation Pass**: Post-scan analysis that links related findings
- **Schema Extensions**: New fields for correlation data and graph visualization
- **Determinism Guarantees**: Identical inputs produce byte-identical outputs
- **Migration Layer**: Backward compatibility with 0.2/0.3 artifacts

```
Phase 3 Scanners → Correlation Pass → Final Artifact
                         ↓
              Cross-Pack Pattern Detection
```

> **Related Docs**: For detailed examples of each correlation rule, see [CORRELATION_RULES.md](./CORRELATION_RULES.md).

## Correlation Rules

The correlator detects 6 cross-pack patterns:

### VC-CORR-001: Auth×Validation

**Pattern**: `auth_without_validation` | **Severity**: Medium | **Confidence**: 75%

State-changing route has authentication evidence but missing server-side validation.

**Triggers when**:
- Route is state-changing (POST/PUT/PATCH/DELETE)
- Route has auth category findings
- No validation category findings for that route

**Risk**: Authenticated users can still submit malicious input leading to injection attacks.

**Example**:
```typescript
// app/api/users/route.ts
export async function POST(request: Request) {
  const session = await getServerSession(); // ✓ Auth
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json(); // ✗ No validation!
  await db.user.create({ data: body }); // Malformed input passes through
}
```

### VC-CORR-002: Middleware×Upload

**Pattern**: `middleware_upload_gap` | **Severity**: High | **Confidence**: 80%

Upload endpoints not covered by middleware matcher.

**Triggers when**:
- File has upload-related findings (VC-UP-*)
- Middleware coverage shows route is uncovered

**Risk**: Upload endpoints without rate limiting or auth middleware are vulnerable to abuse.

**Example**:
```typescript
// middleware.ts - Upload route excluded from protection
export const config = {
  matcher: ["/((?!api/upload|_next/static).*)"], // ✗ Excludes /api/upload
};
```

### VC-CORR-003: Network×Auth

**Pattern**: `network_auth_leak` | **Severity**: Critical | **Confidence**: 70%

Token/session forwarded to outbound fetch without allowlist.

**Triggers when**:
- File has SSRF findings (VC-NET-001)
- Same file has auth-related findings (tokens, sessions)

**Risk**: Tokens or session data may be forwarded to attacker-controlled servers.

**Example**:
```typescript
// app/api/proxy/route.ts
const session = await getServerSession();
const { url } = await request.json();

// ✗ Attacker can set url to https://evil.com/steal-token
const response = await fetch(url, {
  headers: { Authorization: `Bearer ${session.accessToken}` },
});
```

### VC-CORR-004: Privacy×Logging

**Pattern**: `privacy_auth_context` | **Severity**: High | **Confidence**: 80%

Sensitive logging occurs in authenticated context (higher impact).

**Triggers when**:
- File has privacy/logging findings (VC-PRIV-*)
- File is an API route (authenticated context)

**Risk**: Authenticated user data (tokens, sessions, PII) exposed in logs.

**Example**:
```typescript
// app/api/login/route.ts
export async function POST(request: Request) {
  const { email, password } = await request.json();
  console.log("Login attempt:", { email, password }); // ✗ Logs credentials!
}
```

### VC-CORR-005: Crypto×Auth

**Pattern**: `crypto_auth_gate` | **Severity**: Critical | **Confidence**: 85%

jwt.decode() used on auth gate paths.

**Triggers when**:
- File has JWT decode without verify findings (VC-CRYPTO-002)
- File is an API route or auth-related file (middleware, session, auth)

**Risk**: Attackers can forge JWT tokens and bypass auth entirely.

**Example**:
```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  const payload = jwt.decode(token); // ✗ No signature verification!
  if (!payload) return NextResponse.redirect("/login");
  // Attacker can forge: { userId: "admin", role: "superuser" }
}
```

### VC-CORR-006: Hallucination×Coverage

**Pattern**: `hallucination_coverage_gap` | **Severity**: High | **Confidence**: 80%

Comment claims protection but proof trace shows gap.

**Triggers when**:
- File has hallucination findings (VC-HALL-*)
- Route's proof trace shows "No protection proven"

**Risk**: False confidence from misleading comments or unused imports.

**Example**:
```typescript
// app/api/admin/route.ts
import { withAuth } from "@/lib/auth"; // Imported but not used!

// @security: Protected by withAuth middleware
export async function DELETE(request: Request) {
  // ✗ No actual auth - comment is misleading
  await db.user.deleteMany();
}
```

## Schema Extensions

### Artifact Version

Phase 4 uses artifact version `0.4`. The schema supports loading `0.1`, `0.2`, `0.3`, and `0.4` artifacts.

> **Example Artifacts**: See [docs/examples/](./examples/) for sample scan artifacts.

### Finding Extensions

```typescript
interface Finding {
  // ... existing fields ...

  /** Optional correlation data for cross-pack findings */
  correlationData?: {
    /** Related finding IDs/fingerprints */
    relatedFindingIds: string[];
    /** Correlation pattern type */
    pattern: CorrelationPattern;
    /** Human-readable explanation */
    explanation: string;
  };

  /** References to related finding IDs/fingerprints */
  relatedFindings?: string[];
}
```

### Artifact Extensions

```typescript
interface ScanArtifact {
  // ... existing fields ...

  /** Phase 4: Correlation summary */
  correlationSummary?: {
    /** Total correlation findings generated */
    totalCorrelations: number;
    /** Count by pattern type */
    byPattern: Record<string, number>;
    /** Correlation pass duration in ms */
    correlationDurationMs?: number;
  };

  /** Phase 4: Proof trace graph for visualization */
  graph?: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
}
```

### Graph Schema

The proof trace graph enables visualization of finding relationships:

```typescript
interface GraphNode {
  id: string;
  type: 'route' | 'middleware' | 'finding' | 'intent' | 'function';
  label: string;
  file?: string;
  line?: number;
  metadata?: Record<string, unknown>;
}

interface GraphEdge {
  source: string;
  target: string;
  type: 'calls' | 'protects' | 'validates' | 'correlates' | 'references';
  label?: string;
}
```

## CLI Integration

### Pipeline Hook

The correlator runs automatically after Phase 3 scanners complete:

```
1. Index files
2. Run Phase 1-3 scanners
3. Build route map, intents, proof traces
4. Run correlation pass (Phase 4)  ← NEW
5. Write artifact
```

### Output

```
✓ Indexed 42 source files
✓ Scanned with 26 rules (12 findings)
✓ Built Phase 3 data (8 routes, 5 intents, 8 traces)
✓ Phase 4 correlation: 2 pattern(s) detected
```

Correlation findings appear in the artifact alongside other findings, with `category: "correlation"`.

## Policy Integration

Correlated findings participate in policy evaluation just like any other finding:

### Counting

Correlated findings are counted in:
- `summary.byCategory.correlation`
- `summary.bySeverity.*`
- Total finding count

### Overrides

Ignore all correlation findings:
```json
{
  "overrides": [
    { "category": "correlation", "action": "ignore" }
  ]
}
```

Downgrade a specific rule:
```json
{
  "overrides": [
    { "ruleId": "VC-CORR-005", "action": "downgrade", "severity": "low" }
  ]
}
```

### Waivers

Waive by fingerprint or ruleId pattern:
```json
{
  "waivers": [
    {
      "id": "w-corr",
      "match": { "ruleId": "VC-CORR-*" },
      "reason": "All correlations waived for initial release",
      "createdBy": "security@example.com",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

## Determinism

Phase 4 maintains determinism guarantees:

- Identical source files produce identical artifacts (excluding timestamps and timing)
- Fingerprints are stable across scans
- Finding order is deterministic

### Excluded from Comparison

These fields vary between scans and are excluded from determinism checks:

- `generatedAt`: Timestamp of scan
- `metrics.scanDurationMs`: Scan duration
- `correlationSummary.correlationDurationMs`: Correlation pass duration

### Testing Determinism

```typescript
// Scan twice, compare results
const artifact1 = await scan(fixture);
const artifact2 = await scan(fixture);

// Strip non-deterministic fields
const stripped1 = stripTimestamps(artifact1);
const stripped2 = stripTimestamps(artifact2);

// Should be byte-identical
expect(JSON.stringify(stripped1)).toBe(JSON.stringify(stripped2));
```

## Migration & Compatibility

### Loading Old Artifacts

The web viewer automatically migrates `0.1` and `0.2` artifacts:

```typescript
import { migrateArtifact } from "./migrate";

// Normalizes older artifacts to 0.3 compatible shape
const migrated = migrateArtifact(oldArtifact);
```

### Migration Process

1. Adds missing Phase 4 categories to `byCategory` (with zero counts)
2. Preserves original `artifactVersion` (not modified)
3. Ensures `relatedFindings` is properly handled

### Supported Versions

| Version | Status |
|---------|--------|
| `0.1`   | Migrated automatically |
| `0.2`   | Migrated automatically |
| `0.3`   | Migrated automatically |
| `0.4`   | Native support (current) |

## Categories

Phase 4 adds these finding categories:

| Category | Description |
|----------|-------------|
| `correlation` | Cross-pack correlation findings |
| `authorization` | Authorization/access control issues |
| `lifecycle` | Component lifecycle issues |
| `supply-chain` | Dependency and supply chain risks |

All categories initialized to zero in `byCategory` for backward compatibility.

## Constraints

### Correlator Constraints

1. **Runs after all scanners**: Must have complete finding set
2. **Read-only**: Cannot modify existing findings, only adds new ones
3. **Deterministic IDs**: Correlation finding IDs derived from related finding IDs
4. **No external calls**: Pure computation, no network/file I/O

### Schema Constraints

1. **Optional fields only**: All Phase 4 fields are optional
2. **Version preserved**: Original `artifactVersion` not changed during migration
3. **Additive changes**: No breaking changes to existing schema

## File Locations

```
packages/cli/src/phase4/
  correlator.ts         # Correlation pass implementation

packages/schema/src/schemas/
  artifact.ts           # CorrelationSummary, Graph schemas
  finding.ts            # relatedFindings field

apps/web/lib/
  migrate.ts            # Migration/compatibility layer
  db.ts                 # Uses migration when storing artifacts
```

## Testing

### Schema Tests

```bash
pnpm --filter @vibecheck/schema test
# 40 tests including Phase 4 schema validation
```

### CLI Tests

```bash
pnpm --filter @quantracode/vibecheck test
# Includes determinism tests (scan twice, byte-compare)
```

### Determinism Tests

Located in `packages/cli/src/__tests__/cli.test.ts`:

- `produces identical output when scanning the same fixture twice`
- `produces identical fingerprints for identical code patterns`

## Related Documentation

- [RULES.md](./RULES.md) - Complete rule reference with all 39+ rule IDs
- [CORRELATION_RULES.md](./CORRELATION_RULES.md) - Detailed correlation rule examples
- [AUTHORIZATION_GUIDE.md](./AUTHORIZATION_GUIDE.md) - Authorization semantics (VC-AUTHZ-*)
- [VIEWER_GUIDE.md](./VIEWER_GUIDE.md) - Graph visualization, heatmap, what-if mode
- [DETERMINISM_BADGES.md](./DETERMINISM_BADGES.md) - CI badges and determinism certification
- [SECURITY_PHILOSOPHY.md](./SECURITY_PHILOSOPHY.md) - Core principles (no AI, no network, deterministic)

## Future Work

- Additional correlation patterns (e.g., lifecycle × rate limiting)
- Supply chain correlation (dependency findings linked to code usage)
