#!/usr/bin/env npx tsx
/**
 * Generate Ed25519 key pair for VibeCheck license signing
 *
 * Usage:
 *   npx tsx scripts/license/gen-keypair.ts
 *
 * This will generate a new key pair and output:
 * - Public key (safe to share, embed in code)
 * - Private key (KEEP SECRET - never commit to version control)
 *
 * The public key should be used to update VIBECHECK_PUBLIC_KEY_B64 in:
 *   packages/license/src/constants.ts
 */

import { generateKeyPair, derivePublicKey } from "@vibecheck/license";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const keysDir = join(__dirname, ".keys");

console.log("=".repeat(60));
console.log("VibeCheck License Key Pair Generator");
console.log("=".repeat(60));
console.log();

// Generate the key pair
const { publicKey, privateKey } = generateKeyPair();

console.log("Generated new Ed25519 key pair");
console.log();

// Display the public key
console.log("PUBLIC KEY (safe to embed in code):");
console.log("-".repeat(60));
console.log(publicKey);
console.log();

// Display the private key with warning
console.log("PRIVATE KEY (⚠️ KEEP SECRET - never commit!):");
console.log("-".repeat(60));
console.log(privateKey);
console.log();

// Verify the keys match
const derivedPublic = derivePublicKey(privateKey);
if (derivedPublic !== publicKey) {
  console.error("ERROR: Key derivation mismatch!");
  process.exit(1);
}
console.log("✓ Key pair verified");
console.log();

// Save to files
if (!existsSync(keysDir)) {
  mkdirSync(keysDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const publicKeyPath = join(keysDir, `vibecheck-public-${timestamp}.key`);
const privateKeyPath = join(keysDir, `vibecheck-private-${timestamp}.key`);

writeFileSync(publicKeyPath, publicKey + "\n");
writeFileSync(privateKeyPath, privateKey + "\n");

console.log("Keys saved to:");
console.log(`  Public:  ${publicKeyPath}`);
console.log(`  Private: ${privateKeyPath}`);
console.log();

console.log("Next steps:");
console.log("1. Update the public key in packages/license/src/constants.ts");
console.log("2. Store the private key securely (password manager, HSM, etc.)");
console.log("3. NEVER commit the private key to version control");
console.log();
console.log("=".repeat(60));
