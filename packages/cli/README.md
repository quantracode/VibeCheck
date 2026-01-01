# @vibecheck/cli

A deterministic, local-only security scanner for modern web applications. Designed to catch common security issues in Next.js, Express, and other Node.js projects with high precision and low false positives.

## Installation

```bash
npm install -g @vibecheck/cli
# or
pnpm add -g @vibecheck/cli
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

# Explain a scan report
vibecheck explain ./scan.json
```

### Command Line Options

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
| `--changed` | Only scan changed files (not implemented) | `false` |

### Default Excludes

The following patterns are excluded by default:

**Core excludes (always applied):**
- `node_modules`, `dist`, `.git`, `build`, `.next`, `coverage`
- `.turbo`, `.cache`, `out`, `.vercel`, `.netlify`

**Test excludes (skipped with `--include-tests`):**
- `__tests__/**`, `*.test.*`, `*.spec.*`
- `test/`, `tests/`, `fixtures/`, `__mocks__/`, `__fixtures__/`
- `cypress/`, `e2e/`, `*.stories.*`

## Scanner Packs

VibeCheck organizes security rules into modular scanner packs. Each pack focuses on a specific security domain.

### Auth Pack

Rules for authentication and authorization issues.

#### VC-AUTH-001: Unprotected State-Changing API Route

**Severity:** High / Critical
**Category:** auth

Detects Next.js App Router API route handlers (POST, PUT, PATCH, DELETE) that perform database operations without authentication checks.

**What it looks for:**
- Route handlers in `app/**/route.ts` files
- Handlers that use Prisma, Drizzle, or other database operations
- Missing calls to `getServerSession`, `auth()`, or similar auth checks

**Example (vulnerable):**
```typescript
// app/api/users/route.ts
export async function POST(request: Request) {
  const body = await request.json();
  await prisma.user.create({ data: body }); // No auth check!
  return Response.json({ success: true });
}
```

**Example (safe):**
```typescript
// app/api/users/route.ts
export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  await prisma.user.create({ data: body });
  return Response.json({ success: true });
}
```

---

#### VC-MW-001: Middleware Matcher Gap

**Severity:** High
**Category:** middleware

Detects Next.js middleware that doesn't cover API routes, potentially leaving them unprotected.

**What it looks for:**
- `middleware.ts` files with `config.matcher` exports
- Matchers that exclude `/api` routes
- Projects using next-auth without middleware protection

**Example (vulnerable):**
```typescript
// middleware.ts
export const config = {
  matcher: ['/dashboard/:path*'] // Missing /api routes!
};
```

**Example (safe):**
```typescript
// middleware.ts
export const config = {
  matcher: ['/api/:path*', '/dashboard/:path*']
};
```

---

### Validation Pack

Rules for input validation issues.

#### VC-VAL-001: Validation Defined But Output Ignored

**Severity:** Medium
**Category:** validation

Detects cases where validation libraries (Zod, Yup, Joi) are called but the validated result is not used.

**What it looks for:**
- Calls to `.parse()`, `.validate()`, `.parseAsync()`, etc.
- Result not assigned to a variable
- Raw `request.body` or `req.body` used after validation

**Example (vulnerable):**
```typescript
const schema = z.object({ name: z.string() });
schema.parse(body); // Result ignored!
await prisma.user.create({ data: body }); // Uses unvalidated body
```

**Example (safe):**
```typescript
const schema = z.object({ name: z.string() });
const validated = schema.parse(body);
await prisma.user.create({ data: validated });
```

---

### Privacy Pack

Rules for data privacy and logging issues.

#### VC-PRIV-001: Sensitive Data Logged

**Severity:** High
**Category:** privacy

Detects logging statements that include sensitive variable names.

**What it looks for:**
- `console.log`, `console.info`, `console.debug`, `logger.info`, etc.
- Variables containing: password, secret, token, apiKey, creditCard, ssn, etc.

**Example (vulnerable):**
```typescript
console.log("User login:", { email, password }); // Logs password!
```

**Example (safe):**
```typescript
console.log("User login:", { email, timestamp: Date.now() });
```

---

### Config Pack

Rules for configuration and secrets management issues.

#### VC-CONFIG-001: Undocumented Environment Variable

**Severity:** Low
**Category:** config

Detects `process.env.VAR` references that aren't documented in `.env.example`.

---

#### VC-CONFIG-002: Insecure Default Secret Fallback

**Severity:** Critical
**Category:** secrets

Detects hardcoded fallback values for security-critical environment variables.

**What it looks for:**
- `process.env.VAR || "fallback"` patterns
- Variables named: SECRET, KEY, TOKEN, PASSWORD, etc.
- Hardcoded string fallbacks

**Example (vulnerable):**
```typescript
const jwtSecret = process.env.JWT_SECRET || "development-secret";
```

**Example (safe):**
```typescript
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) throw new Error("JWT_SECRET is required");
```

---

### Network Pack

Rules for network security issues.

#### VC-NET-001: SSRF-Prone Fetch

**Severity:** High
**Category:** network

Detects fetch/axios calls where the URL is derived from user input without validation.

**What it looks for:**
- `fetch()` or `axios.get()` calls
- URL constructed from request parameters, query strings, or body
- No URL validation or allowlist checks

**Example (vulnerable):**
```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const response = await fetch(url); // SSRF risk!
  return Response.json(await response.json());
}
```

**Example (safe):**
```typescript
const ALLOWED_HOSTS = ["api.example.com", "cdn.example.com"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const parsed = new URL(url);
  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return Response.json({ error: "Invalid host" }, { status: 400 });
  }
  const response = await fetch(url);
  return Response.json(await response.json());
}
```

---

### Hallucinations Pack

Rules for detecting security libraries that are imported but not properly used.

#### VC-HALL-001: Security Library Imported But Not Used

**Severity:** Medium
**Category:** middleware

Detects security libraries (helmet, cors, csurf, etc.) that are imported but the import is never used.

**What it looks for:**
- Imports from security packages: helmet, cors, csurf, express-rate-limit, hpp, etc.
- Import identifier not referenced after the import statement

**Example (vulnerable):**
```typescript
import helmet from "helmet"; // Imported but never used!
import cors from "cors";

const app = express();
app.use(cors());
// Missing: app.use(helmet());
```

---

#### VC-HALL-002: NextAuth Imported But Not Enforced

**Severity:** High
**Category:** auth

Detects next-auth imported but `getServerSession` never called, suggesting auth is configured but not enforced.

**What it looks for:**
- Imports from `next-auth` or `next-auth/next`
- No calls to `getServerSession` anywhere in the file

---

## Phase 2 Rules

### Network Pack (Extended)

#### VC-NET-002: Open Redirect

**Severity:** High
**Category:** network

Detects server-side redirects where user-controlled input determines the destination.

**Two-signal requirement:** Must identify user-controlled source AND redirect call uses that value.

**Example (vulnerable):**
```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const next = searchParams.get("next");
  return NextResponse.redirect(next!); // Open redirect!
}
```

---

#### VC-NET-003: Over-permissive CORS with Credentials

**Severity:** High
**Category:** network

Detects CORS configurations that combine `origin: "*"` with `credentials: true`.

**Example (vulnerable):**
```typescript
cors({ origin: "*", credentials: true }) // Dangerous combination!
```

---

#### VC-NET-004: Missing Request Timeout

**Severity:** Low
**Category:** network

Detects fetch/axios calls without timeout in API route handlers.

**Example (vulnerable):**
```typescript
const response = await fetch("https://external-api.com/data"); // No timeout!
```

---

### Middleware Pack

#### VC-RATE-001: Missing Rate Limiting

**Severity:** Medium
**Category:** middleware
**Confidence:** 0.65

Detects unauthenticated state-changing endpoints without rate limiting.

**What it looks for:**
- POST/PUT/PATCH/DELETE handlers without auth checks
- Handlers with database writes or sensitive operations
- No rate limiting signals in handler or middleware

---

### Validation Pack (Extended)

#### VC-VAL-002: Client-Side Only Validation

**Severity:** Medium
**Category:** validation

Detects validation in frontend components but missing in API routes.

---

### Privacy Pack (Extended)

#### VC-PRIV-002: Over-broad API Response

**Severity:** Medium/High
**Category:** privacy

Detects Prisma queries returning full models without `select` restrictions.

**Example (vulnerable):**
```typescript
const users = await prisma.user.findMany(); // Returns password hash!
return Response.json(users);
```

**Example (safe):**
```typescript
const users = await prisma.user.findMany({
  select: { id: true, name: true, email: true }
});
return Response.json(users);
```

---

#### VC-PRIV-003: Debug Flags in Production

**Severity:** Medium
**Category:** config

Detects `debug: true` or `dev: true` in config files without NODE_ENV guards.

---

### Crypto Pack

#### VC-CRYPTO-001: Math.random for Tokens

**Severity:** High
**Category:** crypto

Detects Math.random used to generate tokens, keys, or session IDs.

**Example (vulnerable):**
```typescript
const token = Math.random().toString(36).substring(2); // Predictable!
```

**Example (safe):**
```typescript
const token = crypto.randomBytes(32).toString('hex');
```

---

#### VC-CRYPTO-002: JWT Decode Without Verify

**Severity:** Critical
**Category:** crypto

Detects jwt.decode() used without jwt.verify() in the same file.

**Example (vulnerable):**
```typescript
const payload = jwt.decode(token); // Signature not verified!
```

**Example (safe):**
```typescript
const payload = jwt.verify(token, secret); // Signature verified
```

---

#### VC-CRYPTO-003: Weak Password Hashing

**Severity:** High
**Category:** crypto

Detects MD5/SHA1 for passwords or bcrypt with saltRounds < 10.

**Example (vulnerable):**
```typescript
crypto.createHash('md5').update(password).digest('hex'); // Weak!
bcrypt.hash(password, 5); // Too few rounds!
```

---

### Uploads Pack

#### VC-UP-001: File Upload Without Constraints

**Severity:** High
**Category:** uploads

Detects file uploads without size or type validation.

**Example (vulnerable):**
```typescript
const file = formData.get('file') as File;
// No size or type check before processing
```

---

#### VC-UP-002: Upload to Public Path

**Severity:** High
**Category:** uploads

Detects uploaded files written to public directories.

**Example (vulnerable):**
```typescript
fs.writeFileSync(`public/uploads/${filename}`, buffer); // Publicly accessible!
```

---

## Phase 3: Hallucination Detection Engine

Advanced cross-file analysis for detecting security intent vs implementation gaps.

### Intent Command

Generate a security intent map baseline for your codebase:

```bash
# Generate intent map
vibecheck intent ./my-project --out intent-map.json

# Include intent map in scan output
vibecheck scan ./my-project --emit-intent-map
```

### Hallucinations Pack (Phase 3)

#### VC-HALL-010: Comment Claims Protection But Unproven

**Severity:** Medium
**Category:** hallucinations
**Confidence:** 0.75

Detects comments that claim security protection but the implementation doesn't prove it.

**Example (vulnerable):**
```typescript
// This route is protected by authentication middleware
export async function POST(request: Request) {
  // No auth check here, and middleware doesn't cover /api routes
  await prisma.user.create({ data: body });
}
```

---

#### VC-HALL-011: Middleware Assumed But Not Matching

**Severity:** High
**Category:** hallucinations
**Confidence:** 0.70

Detects routes that expect middleware protection but are not covered by matcher patterns.

**Example (vulnerable):**
```typescript
// middleware.ts
export const config = {
  matcher: ['/dashboard/:path*'], // Missing /api routes!
};

// app/api/users/route.ts
// Auth handled by middleware (but middleware doesn't cover this!)
export async function DELETE(request: Request) {
  await prisma.user.delete({ where: { id } });
}
```

---

#### VC-HALL-012: Validation Claimed But Missing/Ignored

**Severity:** Medium
**Category:** hallucinations
**Confidence:** 0.80

Detects validation that is claimed but not properly implemented or used.

**Example (vulnerable):**
```typescript
const schema = z.object({ name: z.string() });
schema.parse(body); // Result ignored!
await prisma.user.create({ data: body }); // Uses raw body
```

---

#### VC-AUTH-010: Auth-by-UI with Server Gap

**Severity:** Critical
**Category:** auth
**Confidence:** 0.85

Detects client-side auth checks without corresponding server-side protection.

**Example (vulnerable):**
```tsx
// Client component
const { session } = useSession();
if (session) {
  // Only render if logged in
  await fetch('/api/users', { method: 'DELETE' }); // Server has no auth!
}
```

---

### Coverage Metrics

With `--emit-intent-map`, the scan artifact includes coverage metrics:

- **authCoverage**: Percentage of state-changing routes with proven auth
- **validationCoverage**: Percentage of routes with request bodies that have validation
- **middlewareCoverage**: Percentage of routes covered by middleware matchers

### Intent Map Structure

```json
{
  "routeMap": [
    {
      "routeId": "abc123",
      "method": "POST",
      "path": "/api/users",
      "file": "app/api/users/route.ts",
      "startLine": 10,
      "endLine": 25
    }
  ],
  "middlewareMap": [
    {
      "file": "middleware.ts",
      "matchers": ["/api/:path*"],
      "protectsApi": true,
      "startLine": 15
    }
  ],
  "intentMap": [
    {
      "intentId": "def456",
      "type": "AUTH_ENFORCED",
      "scope": "route",
      "source": "comment",
      "textEvidence": "// Protected by auth"
    }
  ],
  "proofTraces": {
    "abc123": {
      "routeId": "abc123",
      "authProven": true,
      "validationProven": false,
      "middlewareCovered": true,
      "steps": [...]
    }
  },
  "coverage": {
    "authCoverage": 0.85,
    "validationCoverage": 0.60,
    "middlewareCoverage": 1.0
  }
}
```

---

## Output Formats

VibeCheck supports two output formats: JSON and SARIF.

### JSON Format

The default format, defined by `@vibecheck/schema`:

```json
{
  "artifactVersion": "0.1",
  "generatedAt": "2024-01-15T10:30:00.000Z",
  "tool": {
    "name": "vibecheck",
    "version": "1.0.0"
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

[SARIF (Static Analysis Results Interchange Format)](https://sarifweb.azurewebsites.net/) is an OASIS standard for static analysis tools. Use `--format sarif` to generate SARIF 2.1.0 output, compatible with:

- **GitHub Code Scanning** - Upload via `github/codeql-action/upload-sarif`
- **Azure DevOps** - Native SARIF support in security reports
- **VS Code** - SARIF Viewer extension
- **Other tools** - Any SARIF 2.1.0 compatible viewer

```bash
# Generate SARIF for GitHub Code Scanning
vibecheck scan --format sarif --out results.sarif

# Upload to GitHub (in CI workflow)
- uses: github/codeql-action/upload-sarif@v2
  with:
    sarif_file: results.sarif
```

## Architecture

```
packages/cli/src/
├── commands/
│   ├── scan.ts         # Main scan orchestrator
│   └── explain.ts      # Report viewer
├── scanners/
│   ├── types.ts        # ScanContext, types
│   ├── helpers/
│   │   ├── ast-helpers.ts      # ts-morph utilities
│   │   └── context-builder.ts  # ScanContext factory
│   ├── auth/
│   │   ├── unprotected-api-route.ts  # VC-AUTH-001
│   │   └── middleware-gap.ts         # VC-MW-001
│   ├── validation/
│   │   └── ignored-validation.ts     # VC-VAL-001
│   ├── privacy/
│   │   └── sensitive-logging.ts      # VC-PRIV-001
│   ├── config/
│   │   ├── undocumented-env.ts       # VC-CONFIG-001
│   │   └── insecure-defaults.ts      # VC-CONFIG-002
│   ├── network/
│   │   └── ssrf-prone-fetch.ts       # VC-NET-001
│   └── hallucinations/
│       └── unused-security-imports.ts # VC-HALL-001, VC-HALL-002
└── index.ts
```

## Design Principles

1. **Deterministic** - No LLM calls, results are reproducible
2. **Local-only** - All analysis runs on your machine
3. **Low false positives** - Precision over recall
4. **Framework-aware** - Built for Next.js, Express patterns
5. **Schema-compliant** - Output conforms to `@vibecheck/schema`

## Adding New Scanners

Each scanner must:

1. Accept a `ScanContext` with repo info and AST helpers
2. Return `Finding[]` conforming to the schema
3. Generate deterministic fingerprints for deduplication
4. Include clear evidence with file locations

```typescript
import { type ScanContext } from "../types.js";
import { type Finding } from "@vibecheck/schema";

export async function scanMyRule(ctx: ScanContext): Promise<Finding[]> {
  const findings: Finding[] = [];
  // ... detection logic
  return findings;
}
```

## License

MIT
