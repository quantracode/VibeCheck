import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import type { WaiversFile } from "@vibecheck/policy";
import {
  executeWaiversInit,
  executeWaiversAdd,
  executeWaiversList,
  executeWaiversRemove,
} from "../commands/waivers.js";

// Create temp directory for test files
function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-waivers-test-"));
}

function cleanupDir(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe("waivers commands", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupDir(tempDir);
  });

  describe("waivers init", () => {
    it("creates new waivers file", () => {
      const filepath = path.join(tempDir, "waivers.json");
      const exitCode = executeWaiversInit(filepath, false);

      expect(exitCode).toBe(0);
      expect(fs.existsSync(filepath)).toBe(true);

      const file = JSON.parse(fs.readFileSync(filepath, "utf-8")) as WaiversFile;
      expect(file.version).toBe("0.1");
      expect(file.waivers).toEqual([]);
    });

    it("fails if file exists without force", () => {
      const filepath = path.join(tempDir, "waivers.json");
      fs.writeFileSync(filepath, JSON.stringify({ version: "0.1", waivers: [] }));

      const exitCode = executeWaiversInit(filepath, false);
      expect(exitCode).toBe(1);
    });

    it("overwrites file with force flag", () => {
      const filepath = path.join(tempDir, "waivers.json");
      const oldFile: WaiversFile = {
        version: "0.1",
        waivers: [
          {
            id: "w-old",
            match: { fingerprint: "sha256:old" },
            reason: "Old",
            createdBy: "test",
            createdAt: new Date().toISOString(),
          },
        ],
      };
      fs.writeFileSync(filepath, JSON.stringify(oldFile));

      const exitCode = executeWaiversInit(filepath, true);
      expect(exitCode).toBe(0);

      const file = JSON.parse(fs.readFileSync(filepath, "utf-8")) as WaiversFile;
      expect(file.waivers).toEqual([]);
    });
  });

  describe("waivers add", () => {
    it("adds waiver by fingerprint", () => {
      const filepath = path.join(tempDir, "waivers.json");

      const exitCode = executeWaiversAdd(filepath, {
        fingerprint: "sha256:abc123",
        reason: "Test reason",
        createdBy: "test@example.com",
      });

      expect(exitCode).toBe(0);

      const file = JSON.parse(fs.readFileSync(filepath, "utf-8")) as WaiversFile;
      expect(file.waivers).toHaveLength(1);
      expect(file.waivers[0].match.fingerprint).toBe("sha256:abc123");
      expect(file.waivers[0].reason).toBe("Test reason");
    });

    it("adds waiver by rule ID", () => {
      const filepath = path.join(tempDir, "waivers.json");

      const exitCode = executeWaiversAdd(filepath, {
        ruleId: "VC-AUTH-001",
        reason: "Known issue",
        createdBy: "test@example.com",
      });

      expect(exitCode).toBe(0);

      const file = JSON.parse(fs.readFileSync(filepath, "utf-8")) as WaiversFile;
      expect(file.waivers).toHaveLength(1);
      expect(file.waivers[0].match.ruleId).toBe("VC-AUTH-001");
    });

    it("adds waiver with path pattern", () => {
      const filepath = path.join(tempDir, "waivers.json");

      const exitCode = executeWaiversAdd(filepath, {
        ruleId: "VC-VAL-*",
        pathPattern: "src/legacy/**",
        reason: "Legacy code",
        createdBy: "test@example.com",
      });

      expect(exitCode).toBe(0);

      const file = JSON.parse(fs.readFileSync(filepath, "utf-8")) as WaiversFile;
      expect(file.waivers[0].match.pathPattern).toBe("src/legacy/**");
    });

    it("adds waiver with expiration", () => {
      const filepath = path.join(tempDir, "waivers.json");
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const exitCode = executeWaiversAdd(filepath, {
        fingerprint: "sha256:xyz",
        reason: "Temporary",
        createdBy: "test@example.com",
        expiresAt: futureDate.toISOString(),
      });

      expect(exitCode).toBe(0);

      const file = JSON.parse(fs.readFileSync(filepath, "utf-8")) as WaiversFile;
      expect(file.waivers[0].expiresAt).toBeDefined();
    });

    it("adds waiver with ticket reference", () => {
      const filepath = path.join(tempDir, "waivers.json");

      const exitCode = executeWaiversAdd(filepath, {
        fingerprint: "sha256:abc",
        reason: "Tracked issue",
        createdBy: "test@example.com",
        ticketRef: "JIRA-123",
      });

      expect(exitCode).toBe(0);

      const file = JSON.parse(fs.readFileSync(filepath, "utf-8")) as WaiversFile;
      expect(file.waivers[0].ticketRef).toBe("JIRA-123");
    });

    it("fails without fingerprint or ruleId", () => {
      const filepath = path.join(tempDir, "waivers.json");

      const exitCode = executeWaiversAdd(filepath, {
        reason: "Missing match",
        createdBy: "test@example.com",
      });

      expect(exitCode).toBe(1);
    });

    it("fails with both fingerprint and ruleId", () => {
      const filepath = path.join(tempDir, "waivers.json");

      const exitCode = executeWaiversAdd(filepath, {
        fingerprint: "sha256:abc",
        ruleId: "VC-AUTH-001",
        reason: "Conflicting",
        createdBy: "test@example.com",
      });

      expect(exitCode).toBe(1);
    });

    it("fails with past expiry date", () => {
      const filepath = path.join(tempDir, "waivers.json");
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 1);

      const exitCode = executeWaiversAdd(filepath, {
        fingerprint: "sha256:xyz",
        reason: "Expired",
        createdBy: "test@example.com",
        expiresAt: pastDate.toISOString(),
      });

      expect(exitCode).toBe(1);
    });

    it("appends to existing waivers", () => {
      const filepath = path.join(tempDir, "waivers.json");

      // Add first waiver
      executeWaiversAdd(filepath, {
        fingerprint: "sha256:first",
        reason: "First",
        createdBy: "test@example.com",
      });

      // Add second waiver
      executeWaiversAdd(filepath, {
        fingerprint: "sha256:second",
        reason: "Second",
        createdBy: "test@example.com",
      });

      const file = JSON.parse(fs.readFileSync(filepath, "utf-8")) as WaiversFile;
      expect(file.waivers).toHaveLength(2);
    });
  });

  describe("waivers list", () => {
    it("lists waivers in file", () => {
      const filepath = path.join(tempDir, "waivers.json");
      const file: WaiversFile = {
        version: "0.1",
        waivers: [
          {
            id: "w-1",
            match: { fingerprint: "sha256:abc" },
            reason: "Test",
            createdBy: "test@example.com",
            createdAt: new Date().toISOString(),
          },
          {
            id: "w-2",
            match: { ruleId: "VC-AUTH-*" },
            reason: "Auth rules",
            createdBy: "test@example.com",
            createdAt: new Date().toISOString(),
          },
        ],
      };
      fs.writeFileSync(filepath, JSON.stringify(file));

      const exitCode = executeWaiversList(filepath, false);
      expect(exitCode).toBe(0);
    });

    it("handles empty waivers file", () => {
      const filepath = path.join(tempDir, "waivers.json");
      const file: WaiversFile = { version: "0.1", waivers: [] };
      fs.writeFileSync(filepath, JSON.stringify(file));

      const exitCode = executeWaiversList(filepath, false);
      expect(exitCode).toBe(0);
    });
  });

  describe("waivers remove", () => {
    it("removes waiver by ID", () => {
      const filepath = path.join(tempDir, "waivers.json");
      const file: WaiversFile = {
        version: "0.1",
        waivers: [
          {
            id: "w-to-remove",
            match: { fingerprint: "sha256:abc" },
            reason: "Test",
            createdBy: "test@example.com",
            createdAt: new Date().toISOString(),
          },
          {
            id: "w-keep",
            match: { fingerprint: "sha256:xyz" },
            reason: "Keep",
            createdBy: "test@example.com",
            createdAt: new Date().toISOString(),
          },
        ],
      };
      fs.writeFileSync(filepath, JSON.stringify(file));

      const exitCode = executeWaiversRemove(filepath, "w-to-remove");
      expect(exitCode).toBe(0);

      const updated = JSON.parse(fs.readFileSync(filepath, "utf-8")) as WaiversFile;
      expect(updated.waivers).toHaveLength(1);
      expect(updated.waivers[0].id).toBe("w-keep");
    });

    it("fails for non-existent waiver ID", () => {
      const filepath = path.join(tempDir, "waivers.json");
      const file: WaiversFile = {
        version: "0.1",
        waivers: [
          {
            id: "w-exists",
            match: { fingerprint: "sha256:abc" },
            reason: "Test",
            createdBy: "test@example.com",
            createdAt: new Date().toISOString(),
          },
        ],
      };
      fs.writeFileSync(filepath, JSON.stringify(file));

      const exitCode = executeWaiversRemove(filepath, "w-nonexistent");
      expect(exitCode).toBe(1);
    });
  });
});
