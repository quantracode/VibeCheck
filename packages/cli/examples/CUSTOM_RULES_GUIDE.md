# Custom Rules Guide for VibeCheck

This guide shows you how to create custom security rules for VibeCheck using YAML files, without writing TypeScript.

## Table of Contents

- [Quick Start](#quick-start)
- [Rule Structure](#rule-structure)
- [File Filters](#file-filters)
- [Match Conditions](#match-conditions)
- [Context Conditions](#context-conditions)
- [Examples](#examples)
- [Best Practices](#best-practices)

## Quick Start

### 1. Create a YAML file

Create a file called `my-rule.yaml`:

```yaml
id: CUSTOM-AUTH-001
severity: high
category: auth
title: "Missing authentication check"
description: "API route handler missing authentication"

files:
  file_type:
    - ts
  include:
    - "**/api/**/*.ts"

match:
  contains: "export async function POST"
  not_contains: "getServerSession"

recommended_fix: "Add authentication check using getServerSession()"
```

### 2. Run VibeCheck with your custom rule

```bash
vibecheck scan --rules my-rule.yaml
```

Or with a directory of rules:

```bash
vibecheck scan --rules ./my-custom-rules/
```

## Rule Structure

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (format: `XXX-XXX-000`) |
| `severity` | enum | `critical`, `high`, `medium`, `low`, or `info` |
| `category` | enum | See [categories](#categories) below |
| `title` | string | Short, descriptive title |
| `description` | string | Detailed explanation of the issue |
| `match` | object | What to look for (see [Match Conditions](#match-conditions)) |
| `recommended_fix` | string | How to fix the issue |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `version` | string | Rule version (default: "1.0.0") |
| `confidence` | number | 0.0 to 1.0 (default: 0.8) |
| `files` | object | File filters (see [File Filters](#file-filters)) |
| `context` | object | Advanced conditions (see [Context Conditions](#context-conditions)) |
| `patch` | string | Unified diff patch for auto-fixing |
| `links` | object | Reference URLs (owasp, cwe, documentation) |
| `metadata` | object | Author, tags, dates, etc. |
| `enabled` | boolean | Whether rule is active (default: true) |

### Categories

- `auth` - Authentication issues
- `validation` - Input validation
- `middleware` - Middleware configuration
- `secrets` - Hardcoded secrets
- `injection` - SQL/XSS/Command injection
- `privacy` - Data privacy issues
- `config` - Configuration problems
- `network` - Network security
- `crypto` - Cryptographic issues
- `uploads` - File upload security
- `authorization` - Authorization/access control
- `other` - Other security issues

## File Filters

Control which files your rule scans:

```yaml
files:
  # File types to include
  file_type:
    - ts
    - tsx
    - js

  # Glob patterns to include
  include:
    - "**/api/**/*.ts"
    - "**/routes/**/*.ts"

  # Glob patterns to exclude
  exclude:
    - "**/*.test.*"
    - "**/*.spec.*"

  # Only match files in specific directories
  directories:
    - "/api/"
    - "/routes/"
```

### Available File Types

`ts`, `tsx`, `js`, `jsx`, `json`, `env`, `yaml`, `yml`, `md`, `config`, `any`

## Match Conditions

Define what patterns to search for:

### Basic String Match

```yaml
match:
  contains: "eval("
  case_sensitive: true
```

### Negative Match (Should NOT Contain)

```yaml
match:
  # Flag files that DON'T have authentication
  not_contains: "getServerSession"
```

### Regular Expression

```yaml
match:
  regex: "password\\s*=\\s*['\"][^'\"]+['\"]"
  case_sensitive: false
```

### Combined Conditions

```yaml
match:
  # Must contain export function POST
  contains: "export async function POST"
  # Must NOT contain auth check
  not_contains: "await auth()"
  # Also check with regex
  regex: "prisma\\.(create|update|delete)"
```

## Context Conditions

Add sophisticated filtering based on file content and structure:

### Import Requirements

```yaml
context:
  # Only flag if file imports these packages
  requires_import:
    - "next-auth"
    - "@prisma/client"

  # Don't flag if file imports these
  excludes_import:
    - "vitest"
    - "@testing-library"
```

### File Content Checks

```yaml
context:
  # File must contain all of these
  file_contains:
    - "database"
    - "user"

  # File must NOT contain any of these
  file_not_contains:
    - "test"
    - "mock"
```

### Function/Handler Type

```yaml
context:
  # Only match in specific handler types
  in_function:
    - POST
    - PUT
    - DELETE
    - route_handler
```

Available function types: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `route_handler`, `middleware`, `any`

## Examples

### Example 1: Detect Hardcoded API Keys

```yaml
id: CUSTOM-SEC-002
severity: critical
category: secrets
title: "Hardcoded API key detected"
description: "API keys should be stored in environment variables, not hardcoded in source files"

files:
  file_type:
    - ts
    - js
  exclude:
    - "**/*.test.*"

match:
  regex: "(api[_-]?key|apikey|api[_-]?secret)\\s*[:=]\\s*['\"][a-zA-Z0-9_-]{20,}['\"]"
  case_sensitive: false

recommended_fix: |
  Move the API key to an environment variable:

  // Before:
  const apiKey = "sk_live_abcd1234..."

  // After:
  const apiKey = process.env.API_KEY
  if (!apiKey) throw new Error('API_KEY not configured')

links:
  owasp: https://owasp.org/www-community/vulnerabilities/Use_of_hard-coded_password
  cwe: https://cwe.mitre.org/data/definitions/798.html
```

### Example 2: SQL Injection Risk

```yaml
id: CUSTOM-INJ-001
severity: high
category: injection
title: "Potential SQL injection vulnerability"
description: "SQL query uses string concatenation with variables, which is vulnerable to SQL injection"

files:
  file_type:
    - ts
    - js
  include:
    - "**/api/**"

match:
  regex: "query\\s*\\(\\s*['\"][^'\"]*\\$\\{|query\\s*\\(\\s*.*\\+.*\\)"
  case_sensitive: false

context:
  file_contains:
    - "query"
  file_not_contains:
    - "prisma"
    - "knex"

recommended_fix: |
  Use parameterized queries instead of string concatenation:

  // ❌ Vulnerable:
  db.query(`SELECT * FROM users WHERE id = ${userId}`)
  db.query("SELECT * FROM users WHERE id = " + userId)

  // ✅ Safe (parameterized):
  db.query('SELECT * FROM users WHERE id = $1', [userId])

  // ✅ Safe (ORM):
  prisma.user.findUnique({ where: { id: userId } })

links:
  owasp: https://owasp.org/www-community/attacks/SQL_Injection
  cwe: https://cwe.mitre.org/data/definitions/89.html
```

### Example 3: Missing Input Validation

```yaml
id: CUSTOM-VAL-001
severity: medium
category: validation
title: "POST handler missing input validation"
description: "API route accepts POST data without validating the input schema"

files:
  file_type:
    - ts
  include:
    - "**/api/**/*.ts"

match:
  contains: "await request.json()"

context:
  in_function:
    - POST
    - PUT
    - PATCH
  file_not_contains:
    - ".parse("
    - ".validate("
    - "zod"
    - "yup"
    - "joi"

recommended_fix: |
  Add input validation using a schema library:

  ```typescript
  import { z } from 'zod';

  const schema = z.object({
    email: z.string().email(),
    name: z.string().min(1),
  });

  export async function POST(request: Request) {
    const body = await request.json();
    const validated = schema.parse(body); // Throws if invalid
    // ... use validated data
  }
  ```

links:
  owasp: https://owasp.org/www-project-proactive-controls/v3/en/c5-validate-inputs
```

## Multiple Rules in One File

You can define multiple rules in a single YAML file:

```yaml
schema_version: "1.0"

rules:
  - id: CUSTOM-001
    severity: high
    category: auth
    title: "First rule"
    description: "Description"
    match:
      contains: "something"
    recommended_fix: "Fix it"

  - id: CUSTOM-002
    severity: medium
    category: validation
    title: "Second rule"
    description: "Description"
    match:
      contains: "something else"
    recommended_fix: "Fix it"
```

## Best Practices

### 1. Use Specific File Filters

Don't scan all files if you're only interested in API routes:

```yaml
files:
  include:
    - "**/api/**/*.ts"
  exclude:
    - "**/*.test.*"
```

### 2. Set Appropriate Confidence Levels

- `0.9-1.0`: Very confident (e.g., detecting `eval()`)
- `0.7-0.9`: Confident (e.g., regex patterns for known vulnerabilities)
- `0.5-0.7`: Moderate (e.g., heuristic checks)
- `0.3-0.5`: Low confidence (e.g., broad patterns with false positives)

### 3. Use Context Conditions

Reduce false positives with context:

```yaml
context:
  # Only flag API routes
  in_function:
    - POST
  # That don't already have auth
  file_not_contains:
    - "getServerSession"
```

### 4. Provide Actionable Fixes

Your `recommended_fix` should include:
- Why it's a problem
- How to fix it
- Code examples

### 5. Add Reference Links

Help users learn more:

```yaml
links:
  owasp: https://owasp.org/...
  cwe: https://cwe.mitre.org/...
  documentation: https://...
```

### 6. Test Your Rules

Before deploying custom rules, test them:

```bash
# Test on a small codebase first
vibecheck scan ./test-project --rules my-rule.yaml

# Check the findings
# Adjust your rule to reduce false positives
```

### 7. Version Your Rules

Use semantic versioning:

```yaml
version: "1.0.0"  # Initial release
version: "1.1.0"  # Added new pattern
version: "2.0.0"  # Breaking change to rule logic
```

## Sharing Rules with the Community

Consider contributing your rules back to the VibeCheck community!

1. Create a PR with your rule in `examples/custom-rules/`
2. Include test cases
3. Add documentation

## Troubleshooting

### Rule Not Matching Files

Check your file filters:
```yaml
files:
  file_type:
    - ts  # Make sure this matches your file extensions
  include:
    - "**/api/**"  # Check glob patterns
```

### Too Many False Positives

Add context conditions:
```yaml
context:
  file_not_contains:
    - "test"
    - "mock"
    - "example"
```

### Regex Not Working

Test your regex separately, and remember to escape special characters:
```yaml
match:
  regex: "eval\\s*\\("  # Backslash needs escaping in YAML
```

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE List](https://cwe.mitre.org/data/index.html)
- [Example Rules](./custom-rules/)

---

Happy rule writing! 🔒
