# Apply Fixes Feature Demo

This document demonstrates how to use the `--apply-fixes` flag to automatically apply patches from VibeCheck findings.

## Basic Usage

### 1. Run a scan with automatic patch application

```bash
vibecheck scan --apply-fixes
```

This will:
- Run the security scan
- For each finding with a valid `remediation.patch`, prompt for confirmation before applying
- Apply approved patches to the source files

### 2. Run with auto-confirmation (no prompts)

```bash
vibecheck scan --apply-fixes --force
```

The `--force` flag skips confirmation prompts and applies all patches automatically.

### 3. Apply patches from an existing artifact

First, run a scan and save the artifact:

```bash
vibecheck scan --out vibecheck-scan.json
```

Then apply patches from the saved artifact (coming in a future version):

```bash
vibecheck apply-fixes vibecheck-scan.json
```

## Patch Format

The `remediation.patch` field in findings should contain a **standard unified diff** (git-style diff).

### Example Unified Diff Format

```diff
--- a/app/api/users/route.ts
+++ b/app/api/users/route.ts
@@ -1,5 +1,10 @@
 export async function POST(request: Request) {
+  const session = await getServerSession(authOptions);
+  if (!session) {
+    return new Response(JSON.stringify({ error: "Unauthorized" }), {
+      status: 401,
+    });
+  }
   const body = await request.json();
   // ... rest of handler
 }
```

## Safety Features

1. **Confirmation Prompts**: By default, you must confirm each patch before it's applied
2. **Preview**: Shows a preview of each patch before asking for confirmation
3. **Validation**: Verifies that patches match the current file content before applying
4. **Error Handling**: Reports any patches that fail to apply

## Current Limitations

- Only unified diff format is supported (not simple code snippets)
- Patches must exactly match the current file content (context lines must match)
- No automatic rollback if a patch fails partway through

## Best Practices

1. **Always commit your code** before running `--apply-fixes`
2. **Review applied changes** with `git diff` after applying patches
3. **Run tests** after applying patches to ensure nothing broke
4. **Use `--force` carefully** - it's better to review each patch manually

## Example Workflow

```bash
# 1. Ensure clean working directory
git status

# 2. Run scan with patch application
vibecheck scan --apply-fixes

# 3. Review applied changes
git diff

# 4. Run tests
npm test

# 5. Commit the fixes
git add .
git commit -m "fix: apply VibeCheck security patches"
```
