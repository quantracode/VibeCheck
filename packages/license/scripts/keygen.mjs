#!/usr/bin/env node
/**
 * Generate Ed25519 key pair for VibeCheck license signing
 *
 * Usage: node scripts/keygen.mjs
 *
 * Outputs:
 * - Private key (PKCS8 DER, base64) - for VIBECHECK_LICENSE_PRIVATE_KEY env var in issuer
 * - Public key (SPKI DER, base64) - for VIBECHECK_PUBLIC_KEY_B64 in constants.ts
 */

import { generateKeyPairSync } from "crypto";

console.log("Generating Ed25519 key pair for VibeCheck license signing...\n");

// Generate Ed25519 key pair
const { privateKey, publicKey } = generateKeyPairSync("ed25519");

// Export in the formats we need
const privateKeyDer = privateKey.export({ type: "pkcs8", format: "der" });
const publicKeyDer = publicKey.export({ type: "spki", format: "der" });

// Convert to base64
const privateKeyB64 = privateKeyDer.toString("base64");
const publicKeyB64 = publicKeyDer.toString("base64");

console.log("=".repeat(80));
console.log("PRIVATE KEY (PKCS8 DER, base64)");
console.log("Set this in your license issuer's environment:");
console.log("VIBECHECK_LICENSE_PRIVATE_KEY=" + privateKeyB64);
console.log("=".repeat(80));
console.log("");
console.log("=".repeat(80));
console.log("PUBLIC KEY (SPKI DER, base64)");
console.log("Update this in packages/license/src/constants.ts:");
console.log('export const VIBECHECK_PUBLIC_KEY_B64 =');
console.log(`  "${publicKeyB64}";`);
console.log("=".repeat(80));
console.log("");
console.log("⚠️  IMPORTANT:");
console.log("1. Keep the private key SECRET - only store in secure env vars");
console.log("2. Update the public key in constants.ts and rebuild the license package");
console.log("3. Any licenses signed with old keys will become invalid");
