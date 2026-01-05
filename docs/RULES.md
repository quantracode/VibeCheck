# VibeCheck Rule Reference

Complete reference of all VibeCheck security rules organized by scanner pack.

## Overview

VibeCheck includes **39 scanner rules** across **13 packs**, plus **6 correlation rules** for cross-pack pattern detection.

All rules are:
- **Deterministic**: Same source code produces identical findings
- **Local-only**: No network requests, no cloud services
- **Evidence-based**: Every finding includes proof traces linking to source code
- **No AI/LLM**: Static analysis only, no probabilistic detection

---

## Scanner Packs

### Authentication & Authorization Pack

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| VC-AUTH-001 | Unprotected API Route | Critical | API route handler missing authentication check |
| VC-AUTH-INFO-001 | Auth Pattern Detected | Info | Informational: auth pattern found but may need review |
| VC-MW-001 | Middleware Gap | High | Middleware matcher pattern doesn't cover all API routes |
| VC-AUTH-010 | Imported Auth Not Used | High | Auth middleware imported but never called in route |

### Validation Pack

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| VC-VAL-001 | Ignored Validation | High | Zod/Yup schema parsed but result not used for decisions |
| VC-VAL-002 | Client-Side Only Validation | High | Validation exists in client code but missing on server |

### Privacy & Data Protection Pack

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| VC-PRIV-001 | Sensitive Data Logging | High | Logging passwords, tokens, or PII to console/files |
| VC-PRIV-002 | Over-Broad Response | Medium | API returning entire database record including sensitive fields |
| VC-PRIV-003 | Debug Flags Exposed | Medium | Debug/verbose mode enabled in production paths |

### Configuration Pack

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| VC-CONFIG-001 | Insecure Defaults | High | Security-critical config using insecure default values |
| VC-CONFIG-002 | Undocumented Env Var | Medium | Required environment variable not documented |

### Network Security Pack

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| VC-NET-001 | SSRF-Prone Fetch | Critical | Fetch/axios call with user-controlled URL without allowlist |
| VC-NET-002 | Open Redirect | High | Redirect using unvalidated user input |
| VC-NET-003 | CORS Misconfiguration | High | CORS allowing all origins or reflecting Origin header |
| VC-NET-004 | Missing Request Timeout | Medium | HTTP client calls without timeout configuration |

### Security Hallucinations Pack

Detects "security theater" - code that looks secure but doesn't actually provide protection.

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| VC-HALL-001 | Unused Security Import | Critical | Security library imported but never used |
| VC-HALL-002 | NextAuth Imported Not Enforced | Critical | `getServerSession` imported but return value not checked |
| VC-HALL-010 | Auth Check Unreachable | Critical | Auth code exists but is never executed |
| VC-HALL-011 | Validation Result Ignored | High | Schema validates but code proceeds regardless of result |
| VC-HALL-012 | Rate Limiter Not Applied | High | Rate limit middleware defined but not in request chain |

### Middleware Pack

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| VC-RATE-001 | Missing Rate Limit | Medium | Public endpoint without rate limiting |

### Cryptography Pack

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| VC-CRYPTO-001 | Math.random for Tokens | Critical | Using Math.random() for security-sensitive token generation |
| VC-CRYPTO-002 | JWT Decode Without Verify | Critical | Decoding JWT without signature verification |
| VC-CRYPTO-003 | Weak Hash Algorithm | High | Using MD5/SHA1 for password hashing or security tokens |

### File Upload Pack

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| VC-UP-001 | Missing Upload Constraints | High | File upload without size/type restrictions |
| VC-UP-002 | Public Upload Path | High | Uploaded files stored in publicly accessible path without sanitization |

### Abuse Detection Pack

Detects compute-intensive endpoints vulnerable to abuse.

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| VC-ABUSE-001 | AI Endpoint No Rate Limit | High | AI/LLM generation endpoint without rate limiting |
| VC-ABUSE-002 | Code Execution Unsandboxed | Critical | User code execution without sandbox/isolation |
| VC-ABUSE-003 | Large File Processing | High | File processing without size limits |
| VC-ABUSE-004 | Expensive API Unauthenticated | High | Compute-expensive operation without auth |

### Authorization Semantics Pack

Detects missing authorization logic beyond authentication checks.

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| VC-AUTHZ-001 | Admin Route No Role Guard | Critical | Route in `/admin` path without role/permission check |
| VC-AUTHZ-002 | Ownership Check Missing | High | Entity modification without verifying user owns resource |
| VC-AUTHZ-003 | Role Declared Not Enforced | High | User role property accessed but not used in access decision |
| VC-AUTHZ-004 | Trusted Client ID | High | Client-provided user ID used without server-side verification |

### Lifecycle Security Pack

Detects security invariant violations across CRUD operations on the same entity.

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| VC-LIFE-001 | Create/Update Asymmetry | High | Create endpoint protected but update endpoint not |
| VC-LIFE-002 | Validation Schema Drift | Medium | POST validates payload but PUT/PATCH doesn't |
| VC-LIFE-003 | Delete Rate Limit Gap | Medium | Other operations rate-limited but delete isn't |

### Supply Chain Pack

Analyzes package.json and lockfiles for supply chain risks.

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| VC-SUP-001 | Postinstall Scripts | Medium | Project has postinstall scripts that run on `npm install` |
| VC-SUP-002 | Version Ranges on Security Libs | High | Security-critical packages using `^` or `~` ranges |
| VC-SUP-003 | Deprecated Package | Medium | Using deprecated or unmaintained packages |
| VC-SUP-004 | Multiple Auth Systems | Medium | Multiple authentication libraries detected (potential confusion) |
| VC-SUP-005 | Suspicious Install Scripts | High | Dependency has suspicious postinstall/preinstall scripts |

---

## Correlation Rules (Phase 4)

Correlation rules detect patterns across multiple scanner findings.

| Rule ID | Name | Severity | Triggers |
|---------|------|----------|----------|
| VC-CORR-001 | Auth/Validation Mismatch | High | Route has auth but no validation, or validation but no auth |
| VC-CORR-002 | Rate Limit Gap | Medium | Similar routes have different rate limiting coverage |
| VC-CORR-003 | High-Impact Cluster | Critical | Multiple high-severity findings on same route |
| VC-CORR-004 | Orphan Sensitive Operation | High | Sensitive operation (delete, admin) without corresponding auth finding |
| VC-CORR-005 | Auth Check Redundancy | Info | Same auth check performed multiple times in request path |
| VC-CORR-006 | Mixed Trust Boundary | High | Route mixes authenticated and unauthenticated data sources |

For detailed correlation rule documentation, see [PHASE4.md](./PHASE4.md).

---

## Severity Levels

| Level | Meaning | Action |
|-------|---------|--------|
| Critical | Exploitable vulnerability, immediate risk | Fix before deploy |
| High | Likely security issue, significant risk | Fix in current sprint |
| Medium | Potential issue, moderate risk | Plan fix soon |
| Low | Minor concern, low risk | Consider fixing |
| Info | Informational only | Review as needed |

---

## Rule ID Conventions

Rule IDs follow the pattern: `VC-{CATEGORY}-{NUMBER}`

| Prefix | Category |
|--------|----------|
| VC-AUTH | Authentication |
| VC-MW | Middleware |
| VC-VAL | Validation |
| VC-PRIV | Privacy |
| VC-CONFIG | Configuration |
| VC-NET | Network |
| VC-HALL | Hallucinations |
| VC-RATE | Rate Limiting |
| VC-CRYPTO | Cryptography |
| VC-UP | Uploads |
| VC-ABUSE | Abuse Detection |
| VC-AUTHZ | Authorization |
| VC-LIFE | Lifecycle |
| VC-SUP | Supply Chain |
| VC-CORR | Correlation |

---

## Waiving Rules

Rules can be waived per-finding using inline comments:

```typescript
// @vibecheck-ignore VC-AUTH-001: Public endpoint by design
export async function GET() {
  return Response.json({ status: "ok" });
}
```

Or via waiver files for bulk waivers. See [POLICY_ENGINE.md](./POLICY_ENGINE.md) for details.

---

## Adding Custom Rules

VibeCheck does not support custom rules at this time. The scanner architecture is designed for consistency and determinism. Feature request? Open an issue.
