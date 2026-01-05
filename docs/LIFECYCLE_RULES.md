# Lifecycle Rules and Semantic Regression Detection

VibeCheck's lifecycle rules enforce **security invariants** across CRUD operations. When create, read, update, and delete operations on the same entity have inconsistent security controls, attackers can exploit the gaps.

## Security Invariants

A **security invariant** is a property that should remain consistent across related operations. Common invariants include:

1. **Authentication parity**: If creating a resource requires authentication, modifying it should too
2. **Validation consistency**: Input validation rules should apply equally to create and update
3. **Rate limit coverage**: Destructive operations need rate limiting if other operations have it

When these invariants are violated, the asymmetry creates attack vectors.

## Lifecycle Rules

### VC-LIFE-001: Create-Update Authentication Asymmetry

**Severity**: High
**Confidence**: 0.85

**What it detects**: Routes where POST (create) requires authentication but PUT/PATCH (update) does not.

**Why it matters**: Attackers can modify resources they couldn't create. This often happens when:
- Update endpoints are added later without security review
- Different developers implement create vs. update
- Copy-paste errors omit auth middleware

**Attack scenario**:
```
1. Attacker cannot create admin user (POST /api/users requires auth)
2. Attacker finds PUT /api/users/:id has no auth check
3. Attacker modifies existing user to grant themselves admin
```

**Example finding**:
```
Create-update asymmetry for users: POST protected but PUT is not

Evidence:
  - POST /api/users has auth (session check)
  - PUT /api/users/:id missing auth
```

**Remediation**:
```typescript
// Before (vulnerable)
export async function PUT(req: Request) {
  const data = await req.json();
  return updateUser(data);
}

// After (fixed)
export async function PUT(req: Request) {
  const session = await getServerSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }
  const data = await req.json();
  return updateUser(data);
}
```

---

### VC-LIFE-002: Validation Schema Drift

**Severity**: Medium
**Confidence**: 0.80

**What it detects**: Routes where POST validates input but PUT/PATCH does not, or uses weaker validation.

**Why it matters**: Attackers bypass validation by using update endpoints. This enables:
- Type confusion attacks
- Constraint violations
- Data corruption

**Attack scenario**:
```
1. POST /api/posts validates: { title: string (max 100), body: string (max 5000) }
2. PATCH /api/posts/:id has no validation
3. Attacker updates post with 1MB body, causing storage/rendering issues
```

**Supported validation libraries**:
- Zod (`.parse()`, `.safeParse()`)
- Yup (`yup.object()`)
- Joi (`Joi.object()`)
- Valibot (`parse()`, `safeParse()`)
- AJV (`ajv.validate()`)
- express-validator
- Custom patterns (`schema.validate()`)

**Example finding**:
```
Validation drift for posts: POST validates with zod but PATCH has no validation

Evidence:
  - POST /api/posts uses zod validation
  - PATCH /api/posts/:id missing validation
```

**Remediation**:
```typescript
// Shared schema for create and update
const PostSchema = z.object({
  title: z.string().max(100),
  body: z.string().max(5000),
});

// Use in both handlers
export async function POST(req: Request) {
  const data = PostSchema.parse(await req.json());
  return createPost(data);
}

export async function PATCH(req: Request) {
  const data = PostSchema.partial().parse(await req.json()); // partial for updates
  return updatePost(data);
}
```

---

### VC-LIFE-003: Delete Rate Limit Gap

**Severity**: Medium
**Confidence**: 0.75

**What it detects**: DELETE endpoints lacking rate limiting when other methods on the same resource have it.

**Why it matters**: Unprotected DELETE enables rapid destruction:
- Mass deletion attacks
- Resource exhaustion
- Data loss without recovery

**Attack scenario**:
```
1. GET/POST /api/comments has rate limiting (100/min)
2. DELETE /api/comments/:id has no rate limit
3. Attacker scripts deletion of all comments in seconds
```

**Detected rate limit patterns**:
- Wrapper functions (`withRateLimit()`, `rateLimit()`)
- Upstash Ratelimit
- Redis-based limiters
- Express rate-limit middleware
- Custom decorators and comments

**Example finding**:
```
Rate limit gap for comments: GET/POST rate-limited but DELETE is not

Evidence:
  - GET /api/comments uses upstash rate limiting
  - DELETE /api/comments/:id missing rate limiting
```

**Remediation**:
```typescript
import { Ratelimit } from "@upstash/ratelimit";

const ratelimit = new Ratelimit({ /* config */ });

export async function DELETE(req: Request) {
  const ip = req.headers.get("x-forwarded-for");
  const { success } = await ratelimit.limit(ip);
  if (!success) {
    return new Response("Too Many Requests", { status: 429 });
  }
  // proceed with deletion
}
```

---

## Semantic Regression Detection

Beyond comparing individual findings, VibeCheck detects **semantic regressions**—changes that degrade security properties even if specific findings differ.

### Protection Removal

**Detected when**: A route that previously passed protection checks now has protection-related findings.

**Tracked protection types**:
- `auth`: Authentication checks
- `validation`: Input validation
- `rate-limit`: Rate limiting
- `middleware`: Security middleware

**Example**:
```
Baseline: /api/users/[id]/route.ts:PUT - no findings
Current:  /api/users/[id]/route.ts:PUT - VC-AUTH-002 (missing auth)

→ Protection removed: auth protection lost on /api/users/[id]:PUT
```

### Coverage Decrease

**Detected when**: The percentage of routes with security findings increases significantly (>10%).

**Example**:
```
Baseline: 2/20 routes have findings (10%)
Current:  5/22 routes have findings (23%)

→ Coverage decreased: 13% more routes now have security issues
```

### Severity Group Increase

**Detected when**: Findings for a rule category escalate to high/critical severity.

**Example**:
```
Baseline: VC-AUTH findings all medium severity
Current:  VC-AUTH findings include high severity

→ Severity group increased: VC-AUTH findings escalated to high
```

---

## Regression Policy Configuration

Configure how semantic regressions affect policy evaluation:

```json
{
  "regression": {
    "failOnNewHighCritical": true,
    "failOnSeverityRegression": true,
    "failOnNetIncrease": false,
    "warnOnNewFindings": true,
    "failOnProtectionRemoved": true,
    "warnOnProtectionRemoved": true,
    "failOnSemanticRegression": false
  }
}
```

### Policy Fields

| Field | Type | Description |
|-------|------|-------------|
| `failOnNewHighCritical` | boolean | Fail if new high/critical findings appear |
| `failOnSeverityRegression` | boolean | Fail if same fingerprint has higher severity |
| `failOnNetIncrease` | boolean | Fail if total findings increased |
| `warnOnNewFindings` | boolean | Warn on any new findings |
| `failOnProtectionRemoved` | boolean | Fail if protection removed from a route |
| `warnOnProtectionRemoved` | boolean | Warn if protection removed |
| `failOnSemanticRegression` | boolean | Fail on coverage decrease or severity escalation |

### Profile Defaults

| Profile | Protection Removed | Semantic Regression |
|---------|-------------------|---------------------|
| `startup` | Warn | Ignore |
| `strict` | Fail | Ignore |
| `compliance-lite` | Fail | Fail |

---

## Usage

### CLI

```bash
# Scan with lifecycle rules
vibecheck scan

# Compare against baseline for regression detection
vibecheck scan --baseline ./previous-scan.json

# With strict policy (fails on protection removal)
vibecheck scan --baseline ./baseline.json --policy strict
```

### CI Integration

```yaml
# GitHub Actions example
- name: Security Scan
  run: |
    # Get baseline from main branch artifact
    npx vibecheck scan --baseline ./baseline.json --policy strict
```

### Viewing Results

The web UI shows lifecycle findings grouped by entity:

```
users (3 findings)
├── VC-LIFE-001: Create-update asymmetry (high)
├── VC-LIFE-002: Validation drift (medium)
└── VC-LIFE-003: Delete rate limit gap (medium)
```

Regression results appear in the policy report:

```
Regression Summary:
  New findings: 2
  Resolved: 1
  Protection regressions: 1 (auth removed from /api/users:PUT)
  Semantic regressions: 1 (coverage decreased by 15%)
```

---

## Best Practices

### 1. Use Shared Middleware

Apply security controls at the route group level:

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  // Auth check for all /api/admin/* routes
  if (request.nextUrl.pathname.startsWith("/api/admin")) {
    const session = getSession(request);
    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }
  }
}
```

### 2. Shared Validation Schemas

Define schemas once, use everywhere:

```typescript
// schemas/user.ts
export const UserCreateSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: z.enum(["user", "admin"]),
});

export const UserUpdateSchema = UserCreateSchema.partial();
```

### 3. Rate Limit All Destructive Operations

Apply rate limiting to DELETE, PUT, PATCH by default:

```typescript
// lib/rate-limit.ts
export const destructiveRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1m"),
});

// Apply to all mutating endpoints
```

### 4. Baseline on Merge

Update your baseline after merging to main:

```yaml
on:
  push:
    branches: [main]

jobs:
  update-baseline:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx vibecheck scan -o baseline.json
      - uses: actions/upload-artifact@v4
        with:
          name: security-baseline
          path: baseline.json
```

### 5. Review Lifecycle Findings Together

When VC-LIFE findings appear, review the entire entity's routes:

```bash
# Find all routes for the affected entity
grep -r "export.*function.*GET\|POST\|PUT\|PATCH\|DELETE" ./app/api/users/
```

---

## Troubleshooting

### False positives on validation

If VC-LIFE-002 triggers but you validate elsewhere (e.g., middleware):

1. Add validation directly in the handler (preferred)
2. Or configure an override:

```json
{
  "overrides": [{
    "ruleId": "VC-LIFE-002",
    "pathPattern": "**/api/validated/**",
    "action": "ignore"
  }]
}
```

### Rate limiting at infrastructure level

If rate limiting is handled by CDN/API gateway:

```json
{
  "overrides": [{
    "ruleId": "VC-LIFE-003",
    "action": "ignore"
  }]
},
"waivers": [{
  "ruleId": "VC-LIFE-003",
  "reason": "Rate limiting enforced at Cloudflare level"
}]
```

### Semantic regression false positives

If code refactoring triggers protection removal:

1. Verify the protection actually exists
2. Update baseline after legitimate changes:

```bash
vibecheck scan -o baseline.json  # Create new baseline
```
