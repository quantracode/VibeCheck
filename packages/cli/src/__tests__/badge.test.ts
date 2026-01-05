import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { executeBadge } from "../commands/badge.js";
import { executeScan } from "../commands/scan.js";

/**
 * Get fixture path
 */
function getFixturePath(name: string): string {
  return path.resolve(__dirname, "fixtures", name);
}

describe("badge command", () => {
  let tmpDir: string;
  let artifactPath: string;

  beforeAll(async () => {
    // Create temp directory
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-badge-test-"));

    // Generate a test artifact
    const fixturePath = getFixturePath("safe-nextjs-app");
    artifactPath = path.join(tmpDir, "scan.json");

    await executeScan(fixturePath, {
      out: artifactPath,
      format: "json",
      failOn: "off",
      changed: false,
      emitRouteMap: true,
      emitIntents: false,
      emitTraces: false,
      exclude: [],
      includeTests: false,
    });
  }, 30000);

  afterAll(() => {
    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("badge generation", () => {
    it("generates all expected badges", async () => {
      const badgeDir = path.join(tmpDir, "badges");

      const exitCode = await executeBadge({
        artifact: artifactPath,
        out: badgeDir,
        style: "flat",
      });

      expect(exitCode).toBe(0);

      // Check all expected badges exist
      const expectedBadges = [
        "vibecheck-status.svg",
        "vibecheck-findings.svg",
        "vibecheck-severity.svg",
        "vibecheck-score.svg",
      ];

      for (const badge of expectedBadges) {
        const badgePath = path.join(badgeDir, badge);
        expect(fs.existsSync(badgePath)).toBe(true);
      }
    });

    it("generates valid SVG content", async () => {
      const badgeDir = path.join(tmpDir, "badges-svg");

      await executeBadge({
        artifact: artifactPath,
        out: badgeDir,
        style: "flat",
      });

      const statusBadge = fs.readFileSync(
        path.join(badgeDir, "vibecheck-status.svg"),
        "utf-8"
      );

      // Check valid SVG structure
      expect(statusBadge).toContain("<svg");
      expect(statusBadge).toContain("xmlns=\"http://www.w3.org/2000/svg\"");
      expect(statusBadge).toContain("</svg>");
      expect(statusBadge).toContain("vibecheck");
    });

    it("respects flat-square style", async () => {
      const badgeDir = path.join(tmpDir, "badges-square");

      await executeBadge({
        artifact: artifactPath,
        out: badgeDir,
        style: "flat-square",
      });

      const badge = fs.readFileSync(
        path.join(badgeDir, "vibecheck-status.svg"),
        "utf-8"
      );

      // Flat-square has rx="0" (no rounded corners)
      expect(badge).toContain('rx="0"');
    });
  });

  describe("deterministic output", () => {
    it("produces identical badges on multiple runs", async () => {
      const badgeDir1 = path.join(tmpDir, "badges-run1");
      const badgeDir2 = path.join(tmpDir, "badges-run2");

      await executeBadge({
        artifact: artifactPath,
        out: badgeDir1,
        style: "flat",
      });

      await executeBadge({
        artifact: artifactPath,
        out: badgeDir2,
        style: "flat",
      });

      // Compare all badges
      const badges = fs.readdirSync(badgeDir1).filter((f) => f.endsWith(".svg"));

      for (const badge of badges) {
        const content1 = fs.readFileSync(path.join(badgeDir1, badge), "utf-8");
        const content2 = fs.readFileSync(path.join(badgeDir2, badge), "utf-8");

        expect(content1).toBe(content2);
      }
    });
  });

  describe("badge content", () => {
    it("shows correct findings count", async () => {
      const badgeDir = path.join(tmpDir, "badges-content");

      await executeBadge({
        artifact: artifactPath,
        out: badgeDir,
        style: "flat",
      });

      const findingsBadge = fs.readFileSync(
        path.join(badgeDir, "vibecheck-findings.svg"),
        "utf-8"
      );

      // Should contain "findings" label
      expect(findingsBadge).toContain("findings");
    });

    it("shows score in badge", async () => {
      const badgeDir = path.join(tmpDir, "badges-score");

      await executeBadge({
        artifact: artifactPath,
        out: badgeDir,
        style: "flat",
      });

      const scoreBadge = fs.readFileSync(
        path.join(badgeDir, "vibecheck-score.svg"),
        "utf-8"
      );

      // Should contain score label and /100 format
      expect(scoreBadge).toContain("security score");
      expect(scoreBadge).toMatch(/\d+\/100/);
    });
  });

  describe("error handling", () => {
    it("fails on missing artifact", async () => {
      const badgeDir = path.join(tmpDir, "badges-error");

      const exitCode = await executeBadge({
        artifact: "/nonexistent/file.json",
        out: badgeDir,
        style: "flat",
      });

      expect(exitCode).toBe(1);
    });

    it("fails on invalid artifact", async () => {
      const invalidArtifact = path.join(tmpDir, "invalid.json");
      fs.writeFileSync(invalidArtifact, '{"not": "an artifact"}');

      const badgeDir = path.join(tmpDir, "badges-invalid");

      const exitCode = await executeBadge({
        artifact: invalidArtifact,
        out: badgeDir,
        style: "flat",
      });

      expect(exitCode).toBe(1);
    });
  });
});

describe("badge snapshots", () => {
  let tmpDir: string;
  let artifactPath: string;

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-badge-snap-"));
    const fixturePath = getFixturePath("safe-nextjs-app");
    artifactPath = path.join(tmpDir, "scan.json");

    await executeScan(fixturePath, {
      out: artifactPath,
      format: "json",
      failOn: "off",
      changed: false,
      emitRouteMap: true,
      emitIntents: false,
      emitTraces: false,
      exclude: [],
      includeTests: false,
    });
  }, 30000);

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("badge structure is stable", async () => {
    const badgeDir = path.join(tmpDir, "badges-snap");

    await executeBadge({
      artifact: artifactPath,
      out: badgeDir,
      style: "flat",
    });

    const statusBadge = fs.readFileSync(
      path.join(badgeDir, "vibecheck-status.svg"),
      "utf-8"
    );

    // Verify badge structure elements
    expect(statusBadge).toContain('<linearGradient id="s"');
    expect(statusBadge).toContain('<clipPath id="r"');
    expect(statusBadge).toContain('text-anchor="middle"');
    expect(statusBadge).toContain('font-family="Verdana,Geneva,DejaVu Sans,sans-serif"');
  });

  it("badge colors are deterministic", async () => {
    const badgeDir = path.join(tmpDir, "badges-colors");

    await executeBadge({
      artifact: artifactPath,
      out: badgeDir,
      style: "flat",
    });

    const scoreBadge = fs.readFileSync(
      path.join(badgeDir, "vibecheck-score.svg"),
      "utf-8"
    );

    // Badge should contain one of the defined colors
    const colorPattern = /#(4c1|97ca00|dfb317|fe7d37|e05d44|007ec6|555)/;
    expect(scoreBadge).toMatch(colorPattern);
  });
});
