# VibeCheck Licensing System

VibeCheck uses Ed25519 digital signatures for offline license verification. This document explains how the licensing system works and how to manage licenses.

## Overview

The licensing system is designed to be:

- **Offline-first**: License verification happens entirely locally using cryptographic signatures
- **Secure**: Ed25519 signatures ensure licenses cannot be forged
- **Privacy-respecting**: No license validation calls to external servers

## License Format

Licenses are encoded as a two-part string separated by a dot:

```
base64(JSON payload).base64(signature)
```

Example:
```
eyJpZCI6IjEyMzQ1...fQ==.YWJjZGVm...
```

### License Payload

The JSON payload contains:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique license identifier |
| `plan` | string | Plan type: `free`, `pro`, or `enterprise` |
| `name` | string | License holder's name |
| `email` | string | License holder's email |
| `issuedAt` | string | ISO 8601 timestamp of issue date |
| `expiresAt` | string \| null | ISO 8601 expiry date, or `null` for perpetual |
| `features` | string[] | List of enabled feature flags |
| `seats` | number? | Team seats (enterprise only) |

### Plan Features

| Feature | Free | Pro | Enterprise |
|---------|------|-----|------------|
| Basic scanning | ✓ | ✓ | ✓ |
| `baseline` | - | ✓ | ✓ |
| `policy_customization` | - | ✓ | ✓ |
| `abuse_classification` | - | ✓ | ✓ |
| `architecture_maps` | - | ✓ | ✓ |
| `signed_export` | - | ✓ | ✓ |
| `sso` | - | - | ✓ |
| `audit_logs` | - | - | ✓ |
| `custom_rules` | - | - | ✓ |

## CLI Commands

### Generate Key Pair

Generate a new Ed25519 key pair for signing licenses:

```bash
npx @quantracode/vibecheck license keygen
```

This outputs:
- **Public key**: Embed in your application code (`packages/license/src/constants.ts`)
- **Private key**: Keep secret! Store securely and never commit to version control

### Create a License

Create a signed license using the private key:

```bash
# Using private key file
npx @quantracode/vibecheck license create \
  --email "user@example.com" \
  --name "John Doe" \
  --plan pro \
  --key /path/to/private.key

# Using environment variable
VIBECHECK_PRIVATE_KEY="..." npx @quantracode/vibecheck license create \
  --email "user@example.com" \
  --name "John Doe" \
  --plan enterprise \
  --seats 50 \
  --expires 365
```

Options:
- `--email` (required): License holder's email
- `--name` (required): License holder's name
- `--plan` (required): `pro` or `enterprise`
- `--key`: Path to private key file
- `--key-env`: Environment variable name containing private key (default: `VIBECHECK_PRIVATE_KEY`)
- `--expires`: Days until expiry (default: 365, use 0 for perpetual)
- `--seats`: Number of seats (enterprise only)
- `--id`: Custom license ID
- `--features`: Comma-separated additional features

### Verify a License

Verify a license key is valid:

```bash
npx @quantracode/vibecheck license verify "eyJpZCI6..."
```

### Inspect a License

View license contents without verification:

```bash
npx @quantracode/vibecheck license inspect "eyJpZCI6..."
```

### Generate Demo License

Create a demo license for development/testing:

```bash
npx @quantracode/vibecheck license demo --plan pro --days 30
```

**Note**: Demo licenses only work on localhost and in development environments.

## Development Mode

Demo licenses are available for development and testing purposes. They:

- Have IDs prefixed with `demo-` or `trial-`
- Skip cryptographic signature verification
- Only work on `localhost` or when `NODE_ENV=development`
- Display a yellow "TRIAL" badge in the UI
- Show a persistent trial watermark banner

To enable demo mode in production for testing:
```bash
VIBECHECK_ALLOW_DEMO=true npx @quantracode/vibecheck view
```

## Security Considerations

### Key Management

1. **Never commit private keys** to version control
2. Store private keys in a secure location (password manager, HSM, etc.)
3. Use environment variables or secure key files for CI/CD
4. Rotate keys periodically and maintain a key revocation strategy

### Production Checklist

- [ ] Generated a production key pair
- [ ] Updated `VIBECHECK_PUBLIC_KEY_B64` in `packages/license/src/constants.ts`
- [ ] Stored private key securely
- [ ] Added private key patterns to `.gitignore`
- [ ] Tested license creation and verification

## Scripts

### Standalone Key Generation

```bash
npx tsx scripts/license/gen-keypair.ts
```

This saves keys to `scripts/license/.keys/` with timestamps.

### Standalone License Issuing

```bash
npx tsx scripts/license/issue.ts \
  --email user@example.com \
  --name "User Name" \
  --plan pro
```

## Architecture

```
packages/
├── license/                 # Shared license package
│   ├── src/
│   │   ├── types.ts        # Type definitions
│   │   ├── constants.ts    # Public key, environment checks
│   │   ├── verify.ts       # Browser-compatible verification
│   │   └── issue.ts        # Node.js license creation
│   └── package.json
│
├── cli/
│   └── src/commands/
│       └── license.ts      # CLI license commands
│
└── apps/web/
    ├── lib/
    │   ├── license.ts      # Web license wrapper
    │   └── license-store.ts # Zustand store
    └── components/license/
        └── LicenseModal.tsx # License UI
```

## Troubleshooting

### "Demo licenses are not valid in production"

Demo licenses (ID starts with `demo-` or `trial-`) only work on localhost. For production, use properly signed licenses.

### "Invalid license signature"

The license was not signed with the matching private key, or the license was tampered with. Generate a new license with the correct private key.

### "License has expired"

The license's `expiresAt` date has passed. Issue a new license with an extended expiry date.

### "Ed25519 not supported"

The browser doesn't support Ed25519 cryptography. This is rare in modern browsers but may occur in older environments.
