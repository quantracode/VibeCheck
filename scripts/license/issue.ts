#!/usr/bin/env npx tsx
/**
 * Issue a new VibeCheck license (standalone script)
 *
 * Usage:
 *   npx tsx scripts/license/issue.ts --email user@example.com --name "User Name" --plan pro
 *
 * This is an alternative to the CLI command for quick license generation.
 */

import { createLicense, inspectLicense } from "@vibecheck/license";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Parse command line arguments
const args = process.argv.slice(2);

function getArg(name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  if (index !== -1 && args[index + 1]) {
    return args[index + 1];
  }
  return undefined;
}

function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

// Check for help
if (hasFlag("help") || args.length === 0) {
  console.log(`
VibeCheck License Issuer

Usage:
  npx tsx scripts/license/issue.ts [options]

Required:
  --email <email>     License holder's email
  --name <name>       License holder's name
  --plan <plan>       Plan type: pro | enterprise

Optional:
  --key <path>        Path to private key file (default: .keys/latest or VIBECHECK_PRIVATE_KEY env)
  --expires <days>    Days until expiry (default: 365, use 0 for perpetual)
  --seats <number>    Number of seats (enterprise only)
  --id <id>           Custom license ID
  --features <list>   Comma-separated additional features

Examples:
  npx tsx scripts/license/issue.ts --email user@example.com --name "John Doe" --plan pro
  npx tsx scripts/license/issue.ts --email corp@example.com --name "Acme Corp" --plan enterprise --seats 50 --expires 0
`);
  process.exit(0);
}

// Get required arguments
const email = getArg("email");
const name = getArg("name");
const plan = getArg("plan") as "pro" | "enterprise" | undefined;

if (!email || !name || !plan) {
  console.error("Error: --email, --name, and --plan are required");
  process.exit(1);
}

if (!["pro", "enterprise"].includes(plan)) {
  console.error("Error: --plan must be 'pro' or 'enterprise'");
  process.exit(1);
}

// Get private key
let privateKey: string;

const keyPath = getArg("key");
if (keyPath) {
  if (!existsSync(keyPath)) {
    console.error(`Error: Private key file not found: ${keyPath}`);
    process.exit(1);
  }
  privateKey = readFileSync(keyPath, "utf-8").trim();
} else if (process.env.VIBECHECK_PRIVATE_KEY) {
  privateKey = process.env.VIBECHECK_PRIVATE_KEY;
} else {
  // Try to find the latest key in .keys directory
  const keysDir = join(__dirname, ".keys");
  if (existsSync(keysDir)) {
    const { readdirSync, statSync } = await import("fs");
    const files = readdirSync(keysDir)
      .filter((f) => f.startsWith("vibecheck-private-"))
      .map((f) => ({ name: f, mtime: statSync(join(keysDir, f)).mtime }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    if (files.length > 0) {
      privateKey = readFileSync(join(keysDir, files[0].name), "utf-8").trim();
      console.log(`Using key: ${files[0].name}`);
    } else {
      console.error("Error: No private key found. Use --key or set VIBECHECK_PRIVATE_KEY");
      process.exit(1);
    }
  } else {
    console.error("Error: No private key found. Use --key or set VIBECHECK_PRIVATE_KEY");
    process.exit(1);
  }
}

// Parse optional arguments
const expiresArg = getArg("expires");
const expiresDays = expiresArg !== undefined ? parseInt(expiresArg, 10) : 365;
const expiresAt = expiresDays > 0 ? new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000) : null;

const seatsArg = getArg("seats");
const seats = seatsArg ? parseInt(seatsArg, 10) : undefined;

const featuresArg = getArg("features");
const features = featuresArg ? featuresArg.split(",").map((f) => f.trim()) : undefined;

const id = getArg("id");

// Create the license
const licenseKey = createLicense(
  {
    id,
    plan,
    name,
    email,
    expiresAt,
    seats,
    features,
  },
  privateKey
);

// Display the result
console.log();
console.log("=".repeat(60));
console.log("LICENSE GENERATED");
console.log("=".repeat(60));
console.log();

const license = inspectLicense(licenseKey);
if (license) {
  console.log("Details:");
  console.log(`  ID:       ${license.payload.id}`);
  console.log(`  Plan:     ${license.payload.plan}`);
  console.log(`  Name:     ${license.payload.name}`);
  console.log(`  Email:    ${license.payload.email}`);
  console.log(`  Issued:   ${license.payload.issuedAt}`);
  console.log(`  Expires:  ${license.payload.expiresAt ?? "Never (perpetual)"}`);
  console.log(`  Features: ${license.payload.features.join(", ")}`);
  if (license.payload.seats) {
    console.log(`  Seats:    ${license.payload.seats}`);
  }
}

console.log();
console.log("License Key:");
console.log("-".repeat(60));
console.log(licenseKey);
console.log("-".repeat(60));
console.log();
