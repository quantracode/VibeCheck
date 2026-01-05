import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { executeVerifyDeterminism } from "../commands/verify-determinism.js";

/**
 * Get fixture path
 */
function getFixturePath(name: string): string {
  return path.resolve(__dirname, "fixtures", name);
}

describe("verify-determinism command", () => {
  const safeFixturePath = getFixturePath("safe-nextjs-app");

  describe("on safe fixture", () => {
    it("succeeds with deterministic output", async () => {
      // Run verification with 2 runs for speed
      const exitCode = await executeVerifyDeterminism(safeFixturePath, {
        runs: 2,
        sarif: false,
        verbose: false,
      });

      expect(exitCode).toBe(0);
    }, 30000); // Allow 30 seconds for the test

    it("succeeds with SARIF verification", async () => {
      const exitCode = await executeVerifyDeterminism(safeFixturePath, {
        runs: 2,
        sarif: true,
        verbose: false,
      });

      expect(exitCode).toBe(0);
    }, 30000);

    it("writes certificate when output specified", async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));
      const certPath = path.join(tmpDir, "cert.json");

      try {
        const exitCode = await executeVerifyDeterminism(safeFixturePath, {
          runs: 2,
          sarif: false,
          out: certPath,
          verbose: false,
        });

        expect(exitCode).toBe(0);
        expect(fs.existsSync(certPath)).toBe(true);

        const cert = JSON.parse(fs.readFileSync(certPath, "utf-8"));
        expect(cert.certified).toBe(true);
        expect(cert.runs).toBe(2);
        expect(cert.jsonHashes).toHaveLength(2);
        expect(cert.jsonHashes[0]).toBe(cert.jsonHashes[1]);
      } finally {
        // Cleanup
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    }, 30000);

    it("produces identical findings across runs", async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));
      const certPath = path.join(tmpDir, "cert.json");

      try {
        await executeVerifyDeterminism(safeFixturePath, {
          runs: 3,
          sarif: false,
          out: certPath,
          verbose: true,
        });

        const cert = JSON.parse(fs.readFileSync(certPath, "utf-8"));

        // All hashes should be identical
        const uniqueHashes = new Set(cert.jsonHashes);
        expect(uniqueHashes.size).toBe(1);

        // No differences should be reported
        expect(cert.comparisonDetails.differences).toHaveLength(0);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    }, 60000);
  });

  describe("validation", () => {
    it("fails with runs < 2", async () => {
      const exitCode = await executeVerifyDeterminism(safeFixturePath, {
        runs: 1,
        sarif: false,
        verbose: false,
      });

      expect(exitCode).toBe(1);
    });
  });

  describe("certificate structure", () => {
    it("contains all required fields", async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));
      const certPath = path.join(tmpDir, "cert.json");

      try {
        await executeVerifyDeterminism(safeFixturePath, {
          runs: 2,
          sarif: true,
          out: certPath,
          verbose: false,
        });

        const cert = JSON.parse(fs.readFileSync(certPath, "utf-8"));

        // Required fields
        expect(cert).toHaveProperty("certified");
        expect(cert).toHaveProperty("timestamp");
        expect(cert).toHaveProperty("targetPath");
        expect(cert).toHaveProperty("targetPathHash");
        expect(cert).toHaveProperty("runs");
        expect(cert).toHaveProperty("cliVersion");
        expect(cert).toHaveProperty("artifactVersion");
        expect(cert).toHaveProperty("totalFindings");
        expect(cert).toHaveProperty("jsonHashes");
        expect(cert).toHaveProperty("comparisonDetails");
        expect(cert).toHaveProperty("runDurations");

        // SARIF hashes when enabled
        expect(cert).toHaveProperty("sarifHashes");
        expect(cert.sarifHashes).toHaveLength(2);

        // Comparison details
        expect(cert.comparisonDetails).toHaveProperty("allJsonMatch");
        expect(cert.comparisonDetails).toHaveProperty("allSarifMatch");
        expect(cert.comparisonDetails).toHaveProperty("differences");
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    }, 30000);
  });
});

describe("determinism property", () => {
  const safeFixturePath = getFixturePath("safe-nextjs-app");

  it("fingerprints are stable across runs", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));
    const certPath = path.join(tmpDir, "cert.json");

    try {
      const exitCode = await executeVerifyDeterminism(safeFixturePath, {
        runs: 3,
        sarif: false,
        out: certPath,
        verbose: true,
      });

      expect(exitCode).toBe(0);

      const cert = JSON.parse(fs.readFileSync(certPath, "utf-8"));
      expect(cert.certified).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 60000);
});
