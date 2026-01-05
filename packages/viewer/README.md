# @quantracode/vibecheck-viewer

Static web viewer for VibeCheck security scan results.

This package contains the pre-built static export of the VibeCheck web UI. It is automatically downloaded and served by the `vibecheck view` command.

## Usage

This package is not intended to be used directly. Instead, use the CLI:

```bash
# Start the viewer (auto-detects artifacts)
npx @quantracode/vibecheck view

# Or if installed globally
vibecheck view

# Specify an artifact file
vibecheck view -a ./scan-results.json

# Use a different port
vibecheck view --port 8080

# Don't open browser automatically
vibecheck view --no-open
```

## What's Included

- Static HTML/JS/CSS for the VibeCheck web viewer
- Client-side only - no server required
- Works offline after initial page load
- IndexedDB storage for imported artifacts
- Dark/light theme support

## Features

- **Dashboard**: Overview with severity breakdown and security score
- **Findings List**: Searchable, filterable list of all findings
- **Finding Details**: Deep dive into individual findings with code evidence
- **Architecture View**: Visual graph of routes, middleware, and intent claims
- **Report Export**: Copy markdown reports for sharing

## How Auto-Loading Works

When running `vibecheck view`, the CLI:

1. Starts a local HTTP server serving the viewer
2. Exposes the artifact at a special endpoint (`/__vibecheck__/artifact.json`)
3. The viewer checks this endpoint on load and auto-imports the artifact

This means you can run `vibecheck scan && vibecheck view` and see results immediately.

## Building from Source

```bash
# From the monorepo root
pnpm --filter @quantracode/vibecheck-viewer build
```

This builds the Next.js web app and copies the static export to this package's `dist` directory.

## Cache Location

The viewer is cached at:
- **Linux/macOS**: `~/.vibecheck/viewer/`
- **Windows**: `%USERPROFILE%\.vibecheck\viewer\`

To clear the cache:
```bash
vibecheck view --clear-cache
```

To force an update:
```bash
vibecheck view --update
```
