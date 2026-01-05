import { describe, it, expect, beforeAll } from "vitest";
import {
  generateKeyPair,
  createLicense,
  createDemoLicense,
  derivePublicKey,
  inspectLicense,
} from "../issue.js";
import { validateLicense, parseLicenseKey, getDaysRemaining } from "../verify.js";
import { isDemoLicense, PLAN_FEATURES } from "../types.js";

describe("License Types", () => {
  it("should identify demo license IDs", () => {
    expect(isDemoLicense("demo-12345")).toBe(true);
    expect(isDemoLicense("trial-abc")).toBe(true);
    expect(isDemoLicense("prod-12345")).toBe(false);
    expect(isDemoLicense("abc-demo-123")).toBe(false);
  });

  it("should have correct plan features", () => {
    expect(PLAN_FEATURES.free).toHaveLength(0);
    expect(PLAN_FEATURES.pro).toContain("baseline");
    expect(PLAN_FEATURES.pro).toContain("architecture_maps");
    expect(PLAN_FEATURES.pro).toContain("abuse_classification");
  });
});

describe("Key Generation", () => {
  it("should generate valid Ed25519 key pair", () => {
    const { publicKey, privateKey } = generateKeyPair();

    expect(publicKey).toBeTruthy();
    expect(privateKey).toBeTruthy();

    // Ed25519 keys have specific sizes
    const pubKeyBytes = Buffer.from(publicKey, "base64");
    const privKeyBytes = Buffer.from(privateKey, "base64");

    // SPKI format for Ed25519 public key is 44 bytes
    expect(pubKeyBytes.length).toBe(44);
    // PKCS8 format for Ed25519 private key is 48 bytes
    expect(privKeyBytes.length).toBe(48);
  });

  it("should derive correct public key from private key", () => {
    const { publicKey, privateKey } = generateKeyPair();
    const derivedPublicKey = derivePublicKey(privateKey);

    expect(derivedPublicKey).toBe(publicKey);
  });
});

describe("License Creation", () => {
  let publicKey: string;
  let privateKey: string;

  beforeAll(() => {
    const keyPair = generateKeyPair();
    publicKey = keyPair.publicKey;
    privateKey = keyPair.privateKey;
  });

  it("should create a valid license", () => {
    const licenseKey = createLicense(
      {
        plan: "pro",
        name: "Test User",
        email: "test@example.com",
      },
      privateKey
    );

    expect(licenseKey).toBeTruthy();
    expect(licenseKey.split(".")).toHaveLength(2);

    const license = inspectLicense(licenseKey);
    expect(license).not.toBeNull();
    expect(license!.payload.plan).toBe("pro");
    expect(license!.payload.name).toBe("Test User");
    expect(license!.payload.email).toBe("test@example.com");
    expect(license!.payload.features).toContain("baseline");
  });

  it("should create license with expiry date", () => {
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days

    const licenseKey = createLicense(
      {
        plan: "pro",
        name: "Pro User",
        email: "pro@example.com",
        expiresAt,
      },
      privateKey
    );

    const license = inspectLicense(licenseKey);
    expect(license!.payload.expiresAt).toBeTruthy();
    expect(license!.payload.features).toContain("baseline");
  });

  it("should create license without email (privacy-preserving)", () => {
    const licenseKey = createLicense(
      {
        plan: "pro",
        customerId: "hashed-customer-id-123",
      },
      privateKey
    );

    const license = inspectLicense(licenseKey);
    expect(license!.payload.email).toBeUndefined();
    expect(license!.payload.customerId).toBe("hashed-customer-id-123");
    expect(license!.payload.features).toContain("baseline");
  });

  it("should create license with custom ID", () => {
    const licenseKey = createLicense(
      {
        id: "custom-id-12345",
        plan: "pro",
        name: "Custom ID User",
        email: "custom@example.com",
      },
      privateKey
    );

    const license = inspectLicense(licenseKey);
    expect(license!.payload.id).toBe("custom-id-12345");
  });

  it("should add additional features to license", () => {
    const licenseKey = createLicense(
      {
        plan: "pro",
        name: "Extended Features User",
        email: "extended@example.com",
        features: ["custom_feature", "beta_access"],
      },
      privateKey
    );

    const license = inspectLicense(licenseKey);
    expect(license!.payload.features).toContain("custom_feature");
    expect(license!.payload.features).toContain("beta_access");
    // Should also have plan features
    expect(license!.payload.features).toContain("baseline");
  });
});

describe("Demo License", () => {
  it("should create demo license with demo- prefix", () => {
    const demoKey = createDemoLicense("pro", 30);

    const license = inspectLicense(demoKey);
    expect(license).not.toBeNull();
    expect(license!.payload.id).toMatch(/^demo-/);
    expect(license!.payload.plan).toBe("pro");
    expect(isDemoLicense(license!.payload.id)).toBe(true);
  });

  it("should create demo license with correct expiry", () => {
    const demoKey = createDemoLicense("pro", 7);

    const license = inspectLicense(demoKey);
    expect(license!.payload.expiresAt).toBeTruthy();

    const daysRemaining = getDaysRemaining(license!);
    expect(daysRemaining).toBeGreaterThanOrEqual(6);
    expect(daysRemaining).toBeLessThanOrEqual(7);
  });
});

describe("License Verification", () => {
  let publicKey: string;
  let privateKey: string;

  beforeAll(() => {
    const keyPair = generateKeyPair();
    publicKey = keyPair.publicKey;
    privateKey = keyPair.privateKey;
  });

  it("should validate a correctly signed license", async () => {
    const licenseKey = createLicense(
      {
        plan: "pro",
        name: "Verified User",
        email: "verified@example.com",
      },
      privateKey
    );

    const result = await validateLicense(licenseKey, { publicKey });

    expect(result.valid).toBe(true);
    expect(result.license).not.toBeNull();
    expect(result.error).toBeUndefined();
    expect(result.isDemo).toBe(false);
  });

  it("should reject tampered license", async () => {
    const licenseKey = createLicense(
      {
        plan: "pro",
        name: "Tampered User",
        email: "tampered@example.com",
      },
      privateKey
    );

    // Tamper with the payload
    const parts = licenseKey.split(".");
    const payload = JSON.parse(Buffer.from(parts[0], "base64").toString());
    payload.plan = "enterprise"; // Try to upgrade
    const tamperedPayload = Buffer.from(JSON.stringify(payload)).toString(
      "base64"
    );
    const tamperedKey = `${tamperedPayload}.${parts[1]}`;

    const result = await validateLicense(tamperedKey, { publicKey });

    expect(result.valid).toBe(false);
    expect(result.error).toContain("signature");
  });

  it("should reject license signed with different key", async () => {
    const { privateKey: otherPrivateKey } = generateKeyPair();

    const licenseKey = createLicense(
      {
        plan: "pro",
        name: "Wrong Key User",
        email: "wrongkey@example.com",
      },
      otherPrivateKey
    );

    const result = await validateLicense(licenseKey, { publicKey });

    expect(result.valid).toBe(false);
    expect(result.error).toContain("signature");
  });

  it("should reject expired license", async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday

    const licenseKey = createLicense(
      {
        plan: "pro",
        name: "Expired User",
        email: "expired@example.com",
        expiresAt: pastDate,
      },
      privateKey
    );

    const result = await validateLicense(licenseKey, { publicKey });

    expect(result.valid).toBe(false);
    expect(result.error).toContain("expired");
  });

  it("should accept perpetual license (no expiry)", async () => {
    const licenseKey = createLicense(
      {
        plan: "pro",
        name: "Perpetual User",
        email: "perpetual@example.com",
        expiresAt: null,
      },
      privateKey
    );

    const result = await validateLicense(licenseKey, { publicKey });

    expect(result.valid).toBe(true);
    expect(result.license!.payload.expiresAt).toBeNull();
  });
});

describe("License Parsing", () => {
  it("should parse valid license key", () => {
    const demoKey = createDemoLicense("pro");
    const license = parseLicenseKey(demoKey);

    expect(license).not.toBeNull();
    expect(license!.payload.plan).toBe("pro");
    expect(license!.signature).toBeTruthy();
  });

  it("should return null for invalid format", () => {
    expect(parseLicenseKey("invalid")).toBeNull();
    expect(parseLicenseKey("no.dots.here.too.many")).toBeNull();
    expect(parseLicenseKey("")).toBeNull();
    expect(parseLicenseKey("   ")).toBeNull();
  });

  it("should return null for malformed base64", () => {
    expect(parseLicenseKey("!!!invalid!!!.signature")).toBeNull();
  });

  it("should return null for invalid JSON payload", () => {
    const invalidJson = Buffer.from("not json").toString("base64");
    expect(parseLicenseKey(`${invalidJson}.signature`)).toBeNull();
  });

  it("should return null for missing required fields", () => {
    const incompletePayload = Buffer.from(
      JSON.stringify({ plan: "pro" })
    ).toString("base64");
    expect(parseLicenseKey(`${incompletePayload}.signature`)).toBeNull();
  });
});

describe("Utility Functions", () => {
  it("should calculate days remaining correctly", () => {
    const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const license = {
      payload: {
        id: "test",
        plan: "pro" as const,
        name: "Test",
        email: "test@test.com",
        issuedAt: new Date().toISOString(),
        expiresAt: futureDate.toISOString(),
        features: [],
      },
      signature: "test",
    };

    const days = getDaysRemaining(license);
    expect(days).toBeGreaterThanOrEqual(9);
    expect(days).toBeLessThanOrEqual(10);
  });

  it("should return null for perpetual license", () => {
    const license = {
      payload: {
        id: "test",
        plan: "pro" as const,
        name: "Test",
        email: "test@test.com",
        issuedAt: new Date().toISOString(),
        expiresAt: null,
        features: [],
      },
      signature: "test",
    };

    expect(getDaysRemaining(license)).toBeNull();
  });
});
