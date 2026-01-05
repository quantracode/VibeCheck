# Releasing VibeCheck

This document describes how to publish new versions of the VibeCheck packages to npm.

## Package Structure

VibeCheck is a monorepo with the following publishable package:

| Package | npm Name | Description |
|---------|----------|-------------|
| `packages/cli` | `@quantracode/vibecheck` | Command-line scanner (bundled) |

The CLI bundles `@vibecheck/schema` and `@vibecheck/policy` internally, so only the CLI package needs to be published.

## Prerequisites

- Node.js 18+
- pnpm 8+
- npm account with publish access to `@quantracode/vibecheck`
- Two-factor authentication enabled on npm (OTP required)

## Release Process

### 1. Ensure Clean Working Directory

```bash
git status
# Should show no uncommitted changes
```

### 2. Update Version Numbers

Update the version in the CLI package.json:

```bash
# packages/cli/package.json
```

For example, to bump to `0.1.0`:

```bash
# Edit package.json to update "version": "0.1.0"
```

Also update the version in `packages/cli/src/index.ts`:

```typescript
program
  .name("vibecheck")
  .description("Security scanner for modern web applications")
  .version("0.1.0");  // <-- Update this
```

And in `packages/cli/src/commands/scan.ts` (tool version in artifact):

```typescript
tool: {
  name: "vibecheck",
  version: "0.1.0",  // <-- Update this
},
```

### 3. Build All Packages

```bash
pnpm -r build
```

Verify the build completes without errors.

### 4. Run All Tests

```bash
pnpm -r test
```

All tests must pass before publishing.

### 5. Run Smoke Test

```bash
cd packages/cli
pnpm run smoke
```

This validates that the CLI works correctly when run via `node dist/index.js`.

### 6. Commit Version Bump

```bash
git add -A
git commit -m "chore: bump version to 0.1.0"
```

### 7. Publish Package

Publish the CLI package:

```bash
cd packages/cli
npm publish --access public
# Enter OTP when prompted
```

**Note:** The CLI is bundled with tsup, so all internal packages (`@vibecheck/schema` and `@vibecheck/policy`) are included in the published bundle. No workspace dependencies are included in the published package.

### 8. Create Git Tag

```bash
git tag v0.1.0
git push origin main --tags
```

### 9. Create GitHub Release (Optional)

1. Go to the [Releases page](https://github.com/quantracode/VibeCheck/releases)
2. Click "Create a new release"
3. Select the tag you just created
4. Add release notes summarizing changes
5. Publish the release

## Verifying the Release

After publishing, verify the package works via npx:

```bash
# Create a temp directory
mkdir /tmp/vibecheck-test && cd /tmp/vibecheck-test

# Test npx execution
npx @quantracode/vibecheck scan --help

# Test a real scan
npx @quantracode/vibecheck scan --fail-on off --out test-scan.json

# Verify output
cat test-scan.json | head -20
```

## Troubleshooting

### "Package name already exists"

If you get this error, the package name may be taken. Check npm:

```bash
npm view @quantracode/vibecheck
```

### "You must be logged in"

Log in to npm:

```bash
npm login
```

### "OTP required"

npm requires a one-time password for publishing when 2FA is enabled. Use your authenticator app to get the code.

### "EPERM: operation not permitted" (Windows)

Close any editors or terminals that might have files open in the dist directory, then retry.

## Rollback

If you need to unpublish a version (within 72 hours):

```bash
npm unpublish @quantracode/vibecheck@0.1.0
```

**Warning:** Unpublishing can break dependent projects. Only do this if absolutely necessary.

## Pre-release Versions

For pre-release versions, use semver pre-release tags:

```bash
# Alpha
"version": "0.1.0-alpha.1"
npm publish --tag alpha

# Beta
"version": "0.1.0-beta.1"
npm publish --tag beta

# Release candidate
"version": "0.1.0-rc.1"
npm publish --tag rc
```

To install a pre-release version:

```bash
npx @quantracode/vibecheck@alpha scan --help
npx @quantracode/vibecheck@beta scan --help
```
