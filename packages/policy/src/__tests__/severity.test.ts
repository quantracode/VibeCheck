import { describe, it, expect } from "vitest";
import {
  SEVERITY_ORDER,
  SEVERITY_LEVELS,
  compareSeverity,
  severityMeetsThreshold,
  lowerSeverity,
  higherSeverity,
} from "../severity.js";

describe("severity utilities", () => {
  describe("SEVERITY_ORDER", () => {
    it("orders severities correctly", () => {
      expect(SEVERITY_ORDER.critical).toBeGreaterThan(SEVERITY_ORDER.high);
      expect(SEVERITY_ORDER.high).toBeGreaterThan(SEVERITY_ORDER.medium);
      expect(SEVERITY_ORDER.medium).toBeGreaterThan(SEVERITY_ORDER.low);
      expect(SEVERITY_ORDER.low).toBeGreaterThan(SEVERITY_ORDER.info);
    });
  });

  describe("SEVERITY_LEVELS", () => {
    it("lists all levels in ascending order", () => {
      expect(SEVERITY_LEVELS).toEqual(["info", "low", "medium", "high", "critical"]);
    });
  });

  describe("compareSeverity", () => {
    it("returns positive when first is more severe", () => {
      expect(compareSeverity("critical", "high")).toBeGreaterThan(0);
      expect(compareSeverity("high", "medium")).toBeGreaterThan(0);
      expect(compareSeverity("medium", "low")).toBeGreaterThan(0);
      expect(compareSeverity("low", "info")).toBeGreaterThan(0);
    });

    it("returns negative when first is less severe", () => {
      expect(compareSeverity("high", "critical")).toBeLessThan(0);
      expect(compareSeverity("medium", "high")).toBeLessThan(0);
    });

    it("returns zero for equal severities", () => {
      expect(compareSeverity("critical", "critical")).toBe(0);
      expect(compareSeverity("high", "high")).toBe(0);
    });
  });

  describe("severityMeetsThreshold", () => {
    it("returns true when severity meets threshold", () => {
      expect(severityMeetsThreshold("critical", "high")).toBe(true);
      expect(severityMeetsThreshold("high", "high")).toBe(true);
      expect(severityMeetsThreshold("critical", "medium")).toBe(true);
    });

    it("returns false when severity is below threshold", () => {
      expect(severityMeetsThreshold("medium", "high")).toBe(false);
      expect(severityMeetsThreshold("low", "medium")).toBe(false);
      expect(severityMeetsThreshold("info", "low")).toBe(false);
    });
  });

  describe("lowerSeverity", () => {
    it("returns next lower severity", () => {
      expect(lowerSeverity("critical")).toBe("high");
      expect(lowerSeverity("high")).toBe("medium");
      expect(lowerSeverity("medium")).toBe("low");
      expect(lowerSeverity("low")).toBe("info");
    });

    it("returns same severity for info (lowest)", () => {
      expect(lowerSeverity("info")).toBe("info");
    });
  });

  describe("higherSeverity", () => {
    it("returns next higher severity", () => {
      expect(higherSeverity("info")).toBe("low");
      expect(higherSeverity("low")).toBe("medium");
      expect(higherSeverity("medium")).toBe("high");
      expect(higherSeverity("high")).toBe("critical");
    });

    it("returns same severity for critical (highest)", () => {
      expect(higherSeverity("critical")).toBe("critical");
    });
  });
});
