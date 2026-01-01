import micromatch from "micromatch";
import type { Finding } from "@vibecheck/schema";
import type { Waiver, WaiversFile, WaivedFinding } from "./schemas/index.js";

/**
 * Check if a rule ID matches a pattern (supports wildcard suffix)
 */
export function matchRuleId(ruleId: string, pattern: string): boolean {
  if (pattern.endsWith("*")) {
    const prefix = pattern.slice(0, -1);
    return ruleId.startsWith(prefix);
  }
  return ruleId === pattern;
}

/**
 * Check if any evidence path matches a glob pattern
 */
export function matchPathPattern(evidencePaths: string[], pattern: string): boolean {
  return evidencePaths.some((path) => micromatch.isMatch(path, pattern));
}

/**
 * Check if a waiver is expired
 */
export function isWaiverExpired(waiver: Waiver, now: Date = new Date()): boolean {
  if (!waiver.expiresAt) {
    return false;
  }
  return new Date(waiver.expiresAt) < now;
}

/**
 * Check if a waiver matches a finding
 */
export function matchWaiver(
  waiver: Waiver,
  finding: Finding,
  now: Date = new Date()
): { matches: boolean; expired: boolean } {
  const expired = isWaiverExpired(waiver, now);
  const { match } = waiver;

  // Check fingerprint match (exact)
  if (match.fingerprint && match.fingerprint === finding.fingerprint) {
    return { matches: true, expired };
  }

  // Check ruleId + optional path pattern
  if (match.ruleId) {
    const ruleMatches = matchRuleId(finding.ruleId, match.ruleId);
    if (!ruleMatches) {
      return { matches: false, expired };
    }

    // If path pattern specified, must also match
    if (match.pathPattern) {
      const evidencePaths = finding.evidence.map((e) => e.file);
      const pathMatches = matchPathPattern(evidencePaths, match.pathPattern);
      return { matches: pathMatches, expired };
    }

    return { matches: true, expired };
  }

  return { matches: false, expired };
}

/**
 * Find matching waiver for a finding
 */
export function findMatchingWaiver(
  finding: Finding,
  waivers: Waiver[],
  now: Date = new Date()
): { waiver: Waiver; expired: boolean } | null {
  for (const waiver of waivers) {
    const result = matchWaiver(waiver, finding, now);
    if (result.matches) {
      return { waiver, expired: result.expired };
    }
  }
  return null;
}

/**
 * Apply waivers to findings, returning waived and active findings
 */
export function applyWaivers(
  findings: Finding[],
  waivers: Waiver[],
  options: {
    /** Include expired waivers (default: false) */
    includeExpired?: boolean;
    now?: Date;
  } = {}
): {
  activeFindings: Finding[];
  waivedFindings: WaivedFinding[];
} {
  const { includeExpired = false, now = new Date() } = options;
  const activeFindings: Finding[] = [];
  const waivedFindings: WaivedFinding[] = [];

  for (const finding of findings) {
    const match = findMatchingWaiver(finding, waivers, now);

    if (match && (includeExpired || !match.expired)) {
      waivedFindings.push({
        finding: {
          id: finding.id,
          fingerprint: finding.fingerprint,
          ruleId: finding.ruleId,
          severity: finding.severity,
          title: finding.title,
        },
        waiver: match.waiver,
        expired: match.expired,
      });
    } else {
      activeFindings.push(finding);
    }
  }

  return { activeFindings, waivedFindings };
}

/**
 * Create an empty waivers file
 */
export function createEmptyWaiversFile(): WaiversFile {
  return {
    version: "0.1",
    waivers: [],
  };
}

/**
 * Generate a unique waiver ID
 */
export function generateWaiverId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `w-${timestamp}-${random}`;
}

/**
 * Create a new waiver
 */
export function createWaiver(params: {
  fingerprint?: string;
  ruleId?: string;
  pathPattern?: string;
  reason: string;
  createdBy: string;
  expiresAt?: string;
  ticketRef?: string;
}): Waiver {
  return {
    id: generateWaiverId(),
    match: {
      fingerprint: params.fingerprint,
      ruleId: params.ruleId,
      pathPattern: params.pathPattern,
    },
    reason: params.reason,
    createdBy: params.createdBy,
    createdAt: new Date().toISOString(),
    expiresAt: params.expiresAt,
    ticketRef: params.ticketRef,
  };
}

/**
 * Add a waiver to a waivers file
 */
export function addWaiver(file: WaiversFile, waiver: Waiver): WaiversFile {
  return {
    ...file,
    waivers: [...file.waivers, waiver],
  };
}

/**
 * Remove a waiver from a waivers file
 */
export function removeWaiver(file: WaiversFile, waiverId: string): WaiversFile {
  return {
    ...file,
    waivers: file.waivers.filter((w) => w.id !== waiverId),
  };
}
