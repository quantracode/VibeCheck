# VibeCheck Security Rules

This document describes all security rules implemented in VibeCheck. Rules are organized by category and scanner pack.

---

## Authentication & Authorization

### VC-AUTH-001: Unprotected State-Changing API Route

| Property | Value |
|----------|-------|
| **Severity** | Critical |
| **Category** | auth |
| **Confidence** | 0.85 |

**What triggers it:**
- Next.js App Router route handler exports POST, PUT, PATCH, or DELETE
- Handler contains database operations (Prisma, Drizzle, Mongoose, raw SQL)
- No authentication check detected (getServerSession, auth(), getToken, cookies, headers inspection)

**Evidence shown:**
- File path and line numbers of the unprotected handler
- HTTP method exported
- Database operation identified

**Recommended fix:**
Add authentication check at the start of the handler:
```typescript
const session = await getServerSession(authOptions);
if (!session) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

**False positives / limitations:**
- May flag intentionally public endpoints (webhooks, public form submissions)
- Custom auth middleware patterns may not be recognized
- Does not follow function calls across files

---

### VC-AUTH-010: Auth-by-UI with Server Gap

| Property | Value |
|----------|-------|
| **Severity** | Critical |
| **Category** | auth |
| **Confidence** | 0.85 |

**What triggers it:**
- Client component uses `useSession` or `session &&` patterns for conditional rendering
- Component makes API calls (fetch, axios) to endpoints
- Target API endpoints lack server-side authentication

**Evidence shown:**
- Client file with UI-level auth pattern
- API endpoint being called
- Proof that endpoint has no server auth

**Recommended fix:**
Add server-side authentication to all API endpoints, regardless of client-side UI protection:
```typescript
// API route must independently verify auth
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return new Response("Unauthorized", { status: 401 });
  // ... handler logic
}
```

**False positives / limitations:**
- Cannot detect auth enforced via middleware with custom matchers
- May not recognize all fetch/axios call patterns

---

### VC-AUTH-INFO-001: Missing Middleware with next-auth Dependency

| Property | Value |
|----------|-------|
| **Severity** | Medium |
| **Category** | auth |
| **Confidence** | 0.70 |

**What triggers it:**
- `next-auth` is listed in package.json dependencies
- No `middleware.ts` or `middleware.js` file exists in the project

**Evidence shown:**
- next-auth version in package.json
- Expected middleware location

**Recommended fix:**
Create a middleware.ts file to protect routes:
```typescript
export { default } from "next-auth/middleware";
export const config = { matcher: ["/api/:path*", "/dashboard/:path*"] };
```

**False positives / limitations:**
- Some next-auth setups may intentionally skip middleware
- Does not check if auth is enforced via other mechanisms

---

### VC-MW-001: Middleware Matcher Gap for /api Coverage

| Property | Value |
|----------|-------|
| **Severity** | High |
| **Category** | middleware |
| **Confidence** | 0.80 |

**What triggers it:**
- Middleware file exists with a `config.matcher` export
- Matcher patterns do not include `/api` routes
- API routes exist in the project

**Evidence shown:**
- Current matcher configuration
- API routes not covered

**Recommended fix:**
Update middleware matcher to include API routes:
```typescript
export const config = {
  matcher: ["/api/:path*", "/dashboard/:path*"]
};
```

**False positives / limitations:**
- May flag projects that intentionally have public API routes
- Complex matcher regex may not be fully parsed

---

## Input Validation

### VC-VAL-001: Validation Defined But Output Ignored

| Property | Value |
|----------|-------|
| **Severity** | High |
| **Category** | validation |
| **Confidence** | 0.85 |

**What triggers it:**
- Zod `.parse()`, `.safeParse()`, Yup `.validate()`, or Joi `.validate()` is called
- Return value is not assigned to a variable, OR
- Code uses `request.body` / `await request.json()` after validation instead of validated output

**Evidence shown:**
- Validation call location
- Where raw input is used after validation

**Recommended fix:**
Always use the validated output:
```typescript
const result = schema.safeParse(await request.json());
if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
const { name, email } = result.data; // Use validated data
```

**False positives / limitations:**
- May not track data flow across complex function boundaries
- Destructuring patterns may not be recognized in all cases

---

### VC-VAL-002: Client-Side Only Validation

| Property | Value |
|----------|-------|
| **Severity** | Medium |
| **Category** | validation |
| **Confidence** | 0.70 |

**What triggers it:**
- Zod/Yup/Joi schema exists in a client-side file (components/, app/ client component)
- Corresponding API route accepts request body without server-side validation

**Evidence shown:**
- Client schema location
- API route lacking validation

**Recommended fix:**
Share the schema and validate on the server:
```typescript
// lib/schemas.ts (shared)
export const userSchema = z.object({ name: z.string(), email: z.email() });

// app/api/users/route.ts
import { userSchema } from "@/lib/schemas";
const validated = userSchema.parse(await request.json());
```

**False positives / limitations:**
- Cannot definitively link client schemas to specific API routes
- Some architectures may use different validation strategies

---

## Privacy & Data Protection

### VC-PRIV-001: Sensitive Data Logged

| Property | Value |
|----------|-------|
| **Severity** | High |
| **Category** | privacy |
| **Confidence** | 0.80 |

**What triggers it:**
- `console.log`, `console.error`, `console.info`, or logger calls
- Arguments include variables named: password, token, secret, apiKey, authorization, cookie, session, credential, bearer

**Evidence shown:**
- Log statement location
- Sensitive variable name detected

**Recommended fix:**
Never log sensitive data. Redact or omit:
```typescript
console.log("User login attempt", { userId: user.id }); // Not the password
```

**False positives / limitations:**
- Variable naming heuristics may flag non-sensitive data
- Cannot detect sensitive data in generic variable names

---

### VC-PRIV-002: Over-Broad API Response

| Property | Value |
|----------|-------|
| **Severity** | High |
| **Category** | privacy |
| **Confidence** | 0.75 |

**What triggers it:**
- Prisma query returns model data (findUnique, findMany, etc.)
- Query does not use `select` to restrict fields
- Result is returned in API response

**Evidence shown:**
- Prisma query location
- Model being queried

**Recommended fix:**
Use select to return only needed fields:
```typescript
const user = await prisma.user.findUnique({
  where: { id },
  select: { id: true, name: true, email: true } // Not password, tokens, etc.
});
```

**False positives / limitations:**
- Limited to Prisma; other ORMs not covered
- May flag internal-only endpoints

---

### VC-PRIV-003: Debug Flags Enabled in Production-ish Config

| Property | Value |
|----------|-------|
| **Severity** | Medium |
| **Category** | config |
| **Confidence** | 0.70 |

**What triggers it:**
- `next.config.js/ts` or server config contains `debug: true`, `dev: true`, or `logLevel: "debug"`
- No `NODE_ENV` guard around the setting

**Evidence shown:**
- Config file and line
- Debug flag identified

**Recommended fix:**
Guard debug settings with environment checks:
```javascript
module.exports = {
  logging: {
    level: process.env.NODE_ENV === "development" ? "debug" : "error"
  }
};
```

**False positives / limitations:**
- May not detect all config file patterns
- Some debug flags may be intentional

---

## Configuration & Secrets

### VC-CONFIG-001: Undocumented Environment Variable

| Property | Value |
|----------|-------|
| **Severity** | Medium |
| **Category** | config |
| **Confidence** | 0.65 |

**What triggers it:**
- Code references `process.env.VARIABLE_NAME`
- Variable is not present in `.env.example`

**Evidence shown:**
- Environment variable name
- Files where it's used

**Recommended fix:**
Document all environment variables in `.env.example`:
```bash
# .env.example
DATABASE_URL=postgresql://user:password@localhost:5432/db
NEXTAUTH_SECRET=your-secret-here
```

**False positives / limitations:**
- May flag Next.js built-in variables (NEXT_PUBLIC_*, NODE_ENV)
- Some variables may be optional

---

### VC-CONFIG-002: Insecure Default Secret Fallback

| Property | Value |
|----------|-------|
| **Severity** | Critical |
| **Category** | config |
| **Confidence** | 0.90 |

**What triggers it:**
- Code pattern: `process.env.SECRET ?? "fallback"` or `process.env.SECRET || "default"`
- Variable name suggests it's a secret (SECRET, KEY, TOKEN, PASSWORD)

**Evidence shown:**
- Fallback pattern location
- The hardcoded fallback value

**Recommended fix:**
Fail fast if secrets are missing:
```typescript
const secret = process.env.JWT_SECRET;
if (!secret) throw new Error("JWT_SECRET must be configured");
```

**False positives / limitations:**
- May flag non-secret configuration
- Intentional development defaults may be flagged

---

## Cryptography Security

### VC-CRYPTO-001: Math.random Used for Tokens/Secrets

| Property | Value |
|----------|-------|
| **Severity** | High |
| **Category** | crypto |
| **Confidence** | 0.85 |

**What triggers it:**
- `Math.random()` called in context of: token generation, API key creation, reset codes, session IDs
- Context determined by variable names and surrounding code

**Evidence shown:**
- Math.random() call location
- Context suggesting security use

**Recommended fix:**
Use cryptographically secure random generation:
```typescript
import { randomBytes } from "crypto";
const token = randomBytes(32).toString("hex");
```

**False positives / limitations:**
- May flag non-security uses of Math.random()
- Context detection is heuristic-based

---

### VC-CRYPTO-002: JWT Decoded Without Signature Verification

| Property | Value |
|----------|-------|
| **Severity** | Critical |
| **Category** | crypto |
| **Confidence** | 0.90 |

**What triggers it:**
- `jwt.decode()` or `jwtDecode()` called
- No corresponding `jwt.verify()` call in the same file/function

**Evidence shown:**
- jwt.decode() call location
- Warning about missing verification

**Recommended fix:**
Always verify JWT signatures:
```typescript
import jwt from "jsonwebtoken";
const payload = jwt.verify(token, process.env.JWT_SECRET);
```

**False positives / limitations:**
- Verification may happen in middleware (not detected)
- Some decode-only uses may be intentional (reading claims for logging)

---

### VC-CRYPTO-003: Weak Hashing for Passwords

| Property | Value |
|----------|-------|
| **Severity** | High |
| **Category** | crypto |
| **Confidence** | 0.85 |

**What triggers it:**
- bcrypt with `saltRounds < 10`
- `crypto.createHash("md5")` or `crypto.createHash("sha1")` on password-related data

**Evidence shown:**
- Hashing call location
- Algorithm or salt rounds used

**Recommended fix:**
Use bcrypt with adequate salt rounds:
```typescript
import bcrypt from "bcrypt";
const hash = await bcrypt.hash(password, 12);
```

**False positives / limitations:**
- MD5/SHA1 may be used for non-password purposes (checksums)
- Cannot always determine if data being hashed is a password

---

## Network Security

### VC-NET-001: SSRF-Prone Fetch

| Property | Value |
|----------|-------|
| **Severity** | High |
| **Category** | network |
| **Confidence** | 0.80 |

**What triggers it:**
- `fetch()` or `axios` call
- URL constructed from user input (`body.url`, `query.url`, `params.url`)
- No URL validation or allowlist check

**Evidence shown:**
- Fetch call location
- User-controlled URL source

**Recommended fix:**
Validate and restrict URLs:
```typescript
const allowedHosts = ["api.example.com"];
const url = new URL(body.url);
if (!allowedHosts.includes(url.hostname)) {
  return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
}
```

**False positives / limitations:**
- May not detect validation in helper functions
- Complex URL construction may not be recognized

---

### VC-NET-002: Open Redirect

| Property | Value |
|----------|-------|
| **Severity** | High |
| **Category** | network |
| **Confidence** | 0.80 |

**What triggers it:**
- `NextResponse.redirect()` or `res.redirect()`
- Redirect URL from user input without validation

**Evidence shown:**
- Redirect call location
- User input source

**Recommended fix:**
Validate redirect URLs:
```typescript
const allowedPaths = ["/dashboard", "/profile"];
const redirectTo = searchParams.get("redirect") || "/";
if (!allowedPaths.some(p => redirectTo.startsWith(p))) {
  return NextResponse.redirect(new URL("/", request.url));
}
```

**False positives / limitations:**
- May not detect validation in separate functions
- Some redirects may be intentionally flexible

---

### VC-NET-003: Over-Permissive CORS with Credentials

| Property | Value |
|----------|-------|
| **Severity** | High |
| **Category** | network |
| **Confidence** | 0.90 |

**What triggers it:**
- CORS configuration with `Access-Control-Allow-Origin: *`
- Combined with `Access-Control-Allow-Credentials: true`

**Evidence shown:**
- CORS configuration location
- Both problematic headers

**Recommended fix:**
Never combine wildcard origin with credentials:
```typescript
// Use specific origins when credentials are needed
headers.set("Access-Control-Allow-Origin", "https://app.example.com");
headers.set("Access-Control-Allow-Credentials", "true");
```

**False positives / limitations:**
- May not detect CORS configured via middleware
- Some APIs may intentionally be public

---

### VC-NET-004: Missing Request Timeout on Outbound Calls

| Property | Value |
|----------|-------|
| **Severity** | Low |
| **Category** | network |
| **Confidence** | 0.60 |

**What triggers it:**
- `fetch()` or `axios` call to external URL
- No `timeout` option configured
- No `AbortController` with timeout

**Evidence shown:**
- Fetch call location
- External URL being called

**Recommended fix:**
Add timeouts to prevent hanging:
```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 5000);
const response = await fetch(url, { signal: controller.signal });
clearTimeout(timeout);
```

**False positives / limitations:**
- May flag internal service calls
- Some calls may intentionally be long-running

---

## Middleware Security

### VC-RATE-001: Missing Rate Limiting on Public State-Changing Endpoints

| Property | Value |
|----------|-------|
| **Severity** | Medium |
| **Category** | middleware |
| **Confidence** | 0.65 |

**What triggers it:**
- POST/PUT/PATCH/DELETE endpoint without authentication
- Contains sensitive operations (email sending, database writes, external API calls)
- No rate limiting detected

**Evidence shown:**
- Endpoint location
- Sensitive operation identified

**Recommended fix:**
Add rate limiting:
```typescript
import { Ratelimit } from "@upstash/ratelimit";
const ratelimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "1m") });
const { success } = await ratelimit.limit(ip);
if (!success) return new Response("Too many requests", { status: 429 });
```

**False positives / limitations:**
- Rate limiting may be at infrastructure level (not detected)
- May flag low-risk endpoints

---

## File Upload Security

### VC-UP-001: File Upload Without Size/Type Constraints

| Property | Value |
|----------|-------|
| **Severity** | High |
| **Category** | uploads |
| **Confidence** | 0.80 |

**What triggers it:**
- File upload handling (multer, formidable, busboy)
- No `limits.fileSize` or `fileFilter` configuration

**Evidence shown:**
- Upload handler location
- Missing constraints

**Recommended fix:**
Configure upload constraints:
```typescript
const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png"];
    cb(null, allowed.includes(file.mimetype));
  }
});
```

**False positives / limitations:**
- May not detect constraints in wrapper functions
- Some uploads may intentionally be unrestricted

---

### VC-UP-002: Upload Served from Public Path

| Property | Value |
|----------|-------|
| **Severity** | High |
| **Category** | uploads |
| **Confidence** | 0.75 |

**What triggers it:**
- File write operation to `public/` or `static/` directory
- Especially with user-supplied filename

**Evidence shown:**
- Write operation location
- Target directory

**Recommended fix:**
Store uploads outside public directories:
```typescript
// Store in private location, serve via authenticated endpoint
const uploadPath = path.join(process.cwd(), "uploads", sanitizedFilename);
// Serve via /api/files/[id] with auth check
```

**False positives / limitations:**
- May flag intentionally public static assets
- Cannot detect all file path construction patterns

---

## Security Hallucinations

### VC-HALL-001: Unused Security Imports

| Property | Value |
|----------|-------|
| **Severity** | High |
| **Category** | varies (validation/middleware/auth) |
| **Confidence** | 0.70 |

**What triggers it:**
- Security library imported (zod, yup, joi, helmet, cors, bcrypt, next-auth, etc.)
- No identifiable usage of the library in the file

**Evidence shown:**
- Import statement
- Expected usage patterns not found

**Recommended fix:**
Either use the imported library or remove the import:
```typescript
import { z } from "zod";
const schema = z.object({ ... }); // Actually use it
const validated = schema.parse(data);
```

**False positives / limitations:**
- May not recognize all usage patterns
- Re-exports may appear as unused

---

### VC-HALL-002: next-auth Present But Not Enforced

| Property | Value |
|----------|-------|
| **Severity** | Medium |
| **Category** | auth |
| **Confidence** | 0.65 |

**What triggers it:**
- `next-auth` in dependencies
- Less than 50% of API routes have detectable auth enforcement
- No middleware with auth

**Evidence shown:**
- Percentage of unprotected routes
- List of unprotected endpoints

**Recommended fix:**
Add middleware to enforce auth globally:
```typescript
// middleware.ts
export { default } from "next-auth/middleware";
export const config = { matcher: ["/api/:path*"] };
```

**False positives / limitations:**
- May not detect custom auth patterns
- Some routes may be intentionally public

---

### VC-HALL-010: Comment Claims Protection But Unproven

| Property | Value |
|----------|-------|
| **Severity** | Medium |
| **Category** | hallucinations |
| **Confidence** | 0.75 |

**What triggers it:**
- Comment contains claims like "protected by auth", "validated input", "middleware enforced"
- Static analysis cannot verify the claim

**Evidence shown:**
- Comment text
- What verification was attempted

**Recommended fix:**
Ensure claimed protection is actually implemented:
```typescript
// DON'T: // Protected by middleware
// DO: Actually verify middleware covers this route
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return new Response("Unauthorized", { status: 401 });
  // ...
}
```

**False positives / limitations:**
- Comments may be accurate but unverifiable
- Context-dependent claims may be valid

---

### VC-HALL-011: Middleware Assumed But Not Matching

| Property | Value |
|----------|-------|
| **Severity** | High |
| **Category** | hallucinations |
| **Confidence** | 0.70 |

**What triggers it:**
- Route handler or comment suggests middleware protection
- Middleware exists but matcher does not cover the route path

**Evidence shown:**
- Route path
- Middleware matcher patterns
- Gap identified

**Recommended fix:**
Update middleware matcher to cover the route:
```typescript
export const config = {
  matcher: [
    "/api/:path*",
    "/dashboard/:path*",
    "/admin/:path*" // Add missing paths
  ]
};
```

**False positives / limitations:**
- Complex matcher patterns may not be fully parsed
- Dynamic segments may cause false matches

---

### VC-HALL-012: Validation Claimed But Missing/Ignored

| Property | Value |
|----------|-------|
| **Severity** | Medium |
| **Category** | hallucinations |
| **Confidence** | 0.80 |

**What triggers it:**
- Import or comment suggests validation
- No validation call found, OR
- Validation result is ignored

**Evidence shown:**
- Claim source (import/comment)
- Missing or ignored validation

**Recommended fix:**
Implement and use validation:
```typescript
import { z } from "zod";
const schema = z.object({ email: z.string().email() });
export async function POST(request: Request) {
  const result = schema.safeParse(await request.json());
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const { email } = result.data; // Use validated data
}
```

**False positives / limitations:**
- Validation may happen in called functions
- Some validation patterns may not be recognized

---

## Rule Summary

| Rule ID | Title | Severity | Category |
|---------|-------|----------|----------|
| VC-AUTH-001 | Unprotected State-Changing API Route | Critical | auth |
| VC-AUTH-010 | Auth-by-UI with Server Gap | Critical | auth |
| VC-AUTH-INFO-001 | Missing Middleware with next-auth | Medium | auth |
| VC-MW-001 | Middleware Matcher Gap | High | middleware |
| VC-VAL-001 | Validation Defined But Output Ignored | High | validation |
| VC-VAL-002 | Client-Side Only Validation | Medium | validation |
| VC-PRIV-001 | Sensitive Data Logged | High | privacy |
| VC-PRIV-002 | Over-Broad API Response | High | privacy |
| VC-PRIV-003 | Debug Flags in Config | Medium | config |
| VC-CONFIG-001 | Undocumented Environment Variable | Medium | config |
| VC-CONFIG-002 | Insecure Default Secret Fallback | Critical | config |
| VC-CRYPTO-001 | Math.random for Tokens | High | crypto |
| VC-CRYPTO-002 | JWT Decoded Without Verify | Critical | crypto |
| VC-CRYPTO-003 | Weak Password Hashing | High | crypto |
| VC-NET-001 | SSRF-Prone Fetch | High | network |
| VC-NET-002 | Open Redirect | High | network |
| VC-NET-003 | Over-Permissive CORS | High | network |
| VC-NET-004 | Missing Request Timeout | Low | network |
| VC-RATE-001 | Missing Rate Limiting | Medium | middleware |
| VC-UP-001 | Upload Without Constraints | High | uploads |
| VC-UP-002 | Upload Served from Public Path | High | uploads |
| VC-HALL-001 | Unused Security Imports | High | varies |
| VC-HALL-002 | next-auth Not Enforced | Medium | auth |
| VC-HALL-010 | Comment Claims Unproven | Medium | hallucinations |
| VC-HALL-011 | Middleware Assumed Not Matching | High | hallucinations |
| VC-HALL-012 | Validation Claimed Missing | Medium | hallucinations |

**Total: 26 rules across 10 categories**
