# Authorization Semantics Guide

VibeCheck detects authorization vulnerabilities that go beyond simple authentication checks. This guide explains the distinction between authentication and authorization, and how VibeCheck finds missing authorization controls.

## Authentication vs Authorization

These are distinct security concepts that are often confused:

| Concept | Question | Example |
|---------|----------|---------|
| **Authentication** | "Who are you?" | Verifying username/password, checking session tokens |
| **Authorization** | "What can you do?" | Checking roles, verifying resource ownership |

A common vulnerability pattern: code has authentication (user must be logged in) but lacks authorization (doesn't verify user can access the specific resource).

```typescript
// Has authentication, MISSING authorization
export async function DELETE(request: Request) {
  const session = await getServerSession(); // ✓ Authentication
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { postId } = await request.json();

  // ✗ No authorization check!
  // Any logged-in user can delete any post
  await prisma.post.delete({ where: { id: postId } });

  return Response.json({ deleted: true });
}
```

---

## Authorization Rules

### VC-AUTHZ-001: Admin Route Lacks Role Guard

**Severity**: High | **Confidence**: 80%

Detects routes in admin paths that have authentication but don't check if the user has admin privileges.

#### Detection Logic

Flags routes that match ALL conditions:
1. Path contains `/admin`, `/administrator`, `/staff`, `/internal`, `/management`, or `/backoffice`
2. Handler has authentication checks (`getServerSession`, `auth()`, etc.)
3. Handler lacks role-based authorization checks

#### Vulnerable Example

```typescript
// app/api/admin/users/route.ts
import { getServerSession } from "next-auth";

export async function DELETE(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // BUG: Any authenticated user can delete users!
  // Path says "admin" but no role check exists
  const { userId } = await request.json();
  await prisma.user.delete({ where: { id: userId } });

  return Response.json({ deleted: true });
}
```

#### Fixed Example

```typescript
// app/api/admin/users/route.ts
import { getServerSession } from "next-auth";

export async function DELETE(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ✓ Role check - only admins can proceed
  if (session.user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await request.json();
  await prisma.user.delete({ where: { id: userId } });

  return Response.json({ deleted: true });
}
```

#### Recognized Role Check Patterns

VibeCheck recognizes these authorization patterns as valid:

```typescript
// Direct role comparison
if (session.user.role !== "admin") { ... }
if (session.user.role === "moderator") { ... }

// Property checks
if (!session.user.isAdmin) { ... }

// Array checks
if (!["admin", "moderator"].includes(session.user.role)) { ... }

// Function-based checks
if (!checkRole(session, "admin")) { ... }
if (!hasRole("admin")) { ... }
requireRole("admin");
requireAdmin();

// Permission libraries (CASL, accesscontrol)
if (!abilities.can("delete", "User")) { ... }
```

---

### VC-AUTHZ-002: Ownership Check Missing (IDOR)

**Severity**: Critical | **Confidence**: 75%

Detects Insecure Direct Object Reference (IDOR) vulnerabilities where a user ID is extracted from the request but never compared to the authenticated user.

#### Detection Logic

Flags handlers that match ALL conditions:
1. State-changing method (POST, PUT, PATCH, DELETE)
2. Extracts `userId`, `ownerId`, `authorId`, or similar from request body
3. Has session access (authentication is present)
4. Performs database operations (update, delete, etc.)
5. Never compares extracted ID to `session.user.id`

#### Vulnerable Example

```typescript
// app/api/posts/route.ts
export async function PUT(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { postId, authorId, content } = await request.json();

  // BUG: authorId comes from client - never verified!
  // Attacker can modify any user's posts
  await prisma.post.update({
    where: { id: postId },
    data: { content, authorId }, // authorId not verified!
  });

  return Response.json({ updated: true });
}
```

#### Fixed Example (Option 1: Explicit Comparison)

```typescript
export async function PUT(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { postId, content } = await request.json();

  // ✓ Verify ownership before update
  const post = await prisma.post.findUnique({ where: { id: postId } });

  if (!post || post.authorId !== session.user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.post.update({
    where: { id: postId },
    data: { content },
  });

  return Response.json({ updated: true });
}
```

#### Fixed Example (Option 2: Database-Level Enforcement)

```typescript
export async function PUT(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { postId, content } = await request.json();

  // ✓ Include ownership in WHERE clause
  const result = await prisma.post.updateMany({
    where: {
      id: postId,
      authorId: session.user.id, // Only update if user owns it
    },
    data: { content },
  });

  if (result.count === 0) {
    return Response.json({ error: "Not found or forbidden" }, { status: 404 });
  }

  return Response.json({ updated: true });
}
```

#### Recognized Ownership Patterns

```typescript
// Direct comparison
if (userId !== session.user.id) { ... }
if (resource.ownerId !== session.user.id) { ... }

// Function checks
if (!isOwner(resource, session.user)) { ... }
if (!checkOwnership(postId, session.user.id)) { ... }

// Database-level (Prisma)
where: { id: postId, authorId: session.user.id }
where: { id: postId, ownerId: session.user.id }

// Admin override
if (session.user.role !== "admin" && ...) { ... }
```

---

### VC-AUTHZ-003: Role Declared Not Enforced

**Severity**: Medium | **Confidence**: 70%

Detects when role types are defined in the codebase but API handlers don't check roles.

#### Detection Logic

1. Scans for role type definitions (`type Role = "admin" | "user"`, enums, etc.)
2. Checks API handlers for session/auth usage
3. Flags handlers that use auth but don't check roles

This rule has lower confidence because not all routes need role checks - some operations are available to all authenticated users.

#### Example Trigger

```typescript
// types/user.ts
export type Role = "admin" | "moderator" | "user";

export interface User {
  id: string;
  email: string;
  role: Role;  // Role exists on user type
}
```

```typescript
// app/api/settings/route.ts
export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // session.user.role is available but never checked
  // Maybe this should be admin-only?
  await updateGlobalSettings(request);

  return Response.json({ updated: true });
}
```

#### When This Is Intentional

Some routes legitimately don't need role checks:
- User profile updates (user modifying their own data)
- Public read operations
- Operations available to all authenticated users

Use the waiver system to suppress false positives:

```typescript
// @vibecheck-ignore VC-AUTHZ-003: All authenticated users can update their profile
export async function PUT(request: Request) {
  // ...
}
```

---

### VC-AUTHZ-004: Server Trusts Client-Provided ID

**Severity**: Critical | **Confidence**: 85%

Detects when user or tenant IDs from request bodies are used directly in write operations instead of deriving them from the authenticated session.

#### Detection Logic

Flags POST handlers that:
1. Extract `userId`, `tenantId`, `organizationId`, etc. from request body
2. Use that ID directly in a create/insert operation
3. Don't override with `session.user.id`

#### Vulnerable Example

```typescript
// app/api/posts/route.ts
export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId, title, content } = await request.json();

  // BUG: authorId comes from client input!
  // Attacker can create posts as any user
  await prisma.post.create({
    data: {
      title,
      content,
      authorId: userId, // Should be session.user.id!
    },
  });

  return Response.json({ created: true });
}
```

#### Fixed Example

```typescript
// app/api/posts/route.ts
export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { title, content } = await request.json();

  // ✓ Author ID comes from session, not client
  await prisma.post.create({
    data: {
      title,
      content,
      authorId: session.user.id, // Derived from authenticated session
    },
  });

  return Response.json({ created: true });
}
```

#### Multi-Tenant Applications

This rule is especially important for multi-tenant apps:

```typescript
// VULNERABLE: Client controls tenant
const { tenantId, data } = await request.json();
await db.resource.create({ tenantId, ...data }); // Attacker accesses other tenants!

// SAFE: Tenant from session
const { data } = await request.json();
await db.resource.create({
  tenantId: session.user.tenantId, // From authenticated context
  ...data,
});
```

---

## OWASP References

All authorization rules map to OWASP Top 10 and CWE:

| Rule | OWASP | CWE |
|------|-------|-----|
| VC-AUTHZ-001 | [A01:2021 Broken Access Control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/) | [CWE-285](https://cwe.mitre.org/data/definitions/285.html) |
| VC-AUTHZ-002 | [A01:2021 Broken Access Control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/) | [CWE-639](https://cwe.mitre.org/data/definitions/639.html) (IDOR) |
| VC-AUTHZ-003 | [A01:2021 Broken Access Control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/) | [CWE-862](https://cwe.mitre.org/data/definitions/862.html) |
| VC-AUTHZ-004 | [A01:2021 Broken Access Control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/) | [CWE-639](https://cwe.mitre.org/data/definitions/639.html) |

---

## Best Practices

### 1. Use Middleware for Role Checks

```typescript
// lib/auth-middleware.ts
export function requireRole(...roles: string[]) {
  return async (request: Request) => {
    const session = await getServerSession();
    if (!session || !roles.includes(session.user.role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    return null; // Proceed
  };
}

// app/api/admin/route.ts
export async function POST(request: Request) {
  const forbidden = await requireRole("admin")(request);
  if (forbidden) return forbidden;

  // Handler code...
}
```

### 2. Always Derive IDs from Session

```typescript
// NEVER do this:
const { userId, ...data } = await request.json();
await db.create({ userId, ...data });

// ALWAYS do this:
const { ...data } = await request.json();
await db.create({ userId: session.user.id, ...data });
```

### 3. Include Ownership in Queries

```typescript
// Instead of finding then checking:
const post = await prisma.post.findUnique({ where: { id } });
if (post.authorId !== session.user.id) throw new Error("Forbidden");

// Include ownership in the query:
const post = await prisma.post.findFirst({
  where: { id, authorId: session.user.id },
});
if (!post) throw new Error("Not found"); // Hides existence from attacker
```

### 4. Return 404 Instead of 403

When a user lacks access to a resource, returning 404 ("Not Found") instead of 403 ("Forbidden") prevents information disclosure about what resources exist.
