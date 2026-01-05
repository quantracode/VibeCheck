/**
 * License issuing utilities for VibeCheck
 *
 * This module is for CLI/server-side use only. It requires Node.js crypto.
 * DO NOT import this in browser code.
 */

import { createPrivateKey, createPublicKey, sign, generateKeyPairSync } from "crypto";
import { randomUUID } from "crypto";
import {
  type License,
  type LicensePayload,
  type CreateLicenseOptions,
  type PlanType,
  PLAN_FEATURES,
} from "./types.js";

/**
 * Generate a new Ed25519 key pair for license signing
 *
 * @returns Object with base64-encoded public and private keys
 */
export function generateKeyPair(): {
  publicKey: string;
  privateKey: string;
} {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "der" },
    privateKeyEncoding: { type: "pkcs8", format: "der" },
  });

  return {
    publicKey: Buffer.from(publicKey).toString("base64"),
    privateKey: Buffer.from(privateKey).toString("base64"),
  };
}

/**
 * Sign a license payload with the private key
 */
function signPayload(payloadJson: string, privateKeyB64: string): string {
  const privateKeyDer = Buffer.from(privateKeyB64, "base64");
  const privateKey = createPrivateKey({
    key: privateKeyDer,
    format: "der",
    type: "pkcs8",
  });

  const signature = sign(null, Buffer.from(payloadJson), privateKey);
  return signature.toString("base64");
}

/**
 * Create and sign a new license
 *
 * @param options - License creation options
 * @param privateKeyB64 - Base64-encoded private key for signing
 * @returns The signed license key string
 */
export function createLicense(
  options: CreateLicenseOptions,
  privateKeyB64: string
): string {
  const now = new Date();

  // Build features list based on plan + any additional features
  const planFeatures = PLAN_FEATURES[options.plan] ?? [];
  const additionalFeatures = options.features ?? [];
  const allFeatures = [...new Set([...planFeatures, ...additionalFeatures])];

  const payload: LicensePayload = {
    id: options.id ?? randomUUID(),
    plan: options.plan,
    name: options.name,
    email: options.email,
    customerId: options.customerId,
    issuedAt: now.toISOString(),
    expiresAt: options.expiresAt?.toISOString() ?? null,
    features: allFeatures,
  };

  const payloadJson = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadJson).toString("base64");
  const signature = signPayload(payloadJson, privateKeyB64);

  return `${payloadB64}.${signature}`;
}

/**
 * Create a demo license (for development/testing)
 * Demo licenses have the "demo-" prefix and skip signature verification.
 */
export function createDemoLicense(
  plan: PlanType = "pro",
  daysValid: number = 30
): string {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + daysValid * 24 * 60 * 60 * 1000);

  const payload: LicensePayload = {
    id: `demo-${Date.now()}`,
    plan,
    name: "Demo User",
    email: "demo@vibecheck.dev",
    issuedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    features: PLAN_FEATURES[plan] ?? [],
  };

  const payloadJson = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadJson).toString("base64");

  // Demo signature (not cryptographically valid, just for format)
  const demoSignature = Buffer.from(`demo-signature-${payload.id}`).toString(
    "base64"
  );

  return `${payloadB64}.${demoSignature}`;
}

/**
 * Derive the public key from a private key
 */
export function derivePublicKey(privateKeyB64: string): string {
  const privateKeyDer = Buffer.from(privateKeyB64, "base64");
  const privateKey = createPrivateKey({
    key: privateKeyDer,
    format: "der",
    type: "pkcs8",
  });

  const publicKey = createPublicKey(privateKey);
  const publicKeyDer = publicKey.export({ type: "spki", format: "der" });

  return Buffer.from(publicKeyDer).toString("base64");
}

/**
 * Parse a license key to inspect its contents (without validation)
 */
export function inspectLicense(licenseKey: string): License | null {
  try {
    const parts = licenseKey.trim().split(".");
    if (parts.length !== 2) return null;

    const [payloadB64, signature] = parts;
    const payloadJson = Buffer.from(payloadB64, "base64").toString("utf-8");
    const payload = JSON.parse(payloadJson) as LicensePayload;

    return { payload, signature };
  } catch {
    return null;
  }
}
