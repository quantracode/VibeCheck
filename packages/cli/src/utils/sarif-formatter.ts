/**
 * SARIF (Static Analysis Results Interchange Format) output formatter
 *
 * Converts VibeCheck findings to SARIF 2.1.0 format for integration
 * with GitHub Code Scanning and other SARIF-compatible tools.
 */

import type { Finding, ScanArtifact, Severity } from "@vibecheck/schema";
import { SUPPORTED_RULES } from "../scanners/index.js";

/**
 * SARIF 2.1.0 schema types
 */
interface SarifLog {
  $schema: string;
  version: string;
  runs: SarifRun[];
}

interface SarifRun {
  tool: SarifTool;
  results: SarifResult[];
  invocations?: SarifInvocation[];
}

interface SarifTool {
  driver: SarifDriver;
}

interface SarifDriver {
  name: string;
  version: string;
  informationUri?: string;
  rules: SarifRule[];
}

interface SarifRule {
  id: string;
  name: string;
  shortDescription: SarifMessage;
  fullDescription?: SarifMessage;
  defaultConfiguration: {
    level: SarifLevel;
  };
  help?: SarifMessage;
  properties?: {
    tags?: string[];
    security_severity?: string;
  };
}

interface SarifResult {
  ruleId: string;
  ruleIndex: number;
  level: SarifLevel;
  message: SarifMessage;
  locations: SarifLocation[];
  fingerprints?: Record<string, string>;
  properties?: {
    confidence?: number;
    category?: string;
  };
}

interface SarifLocation {
  physicalLocation: SarifPhysicalLocation;
}

interface SarifPhysicalLocation {
  artifactLocation: SarifArtifactLocation;
  region?: SarifRegion;
}

interface SarifArtifactLocation {
  uri: string;
  uriBaseId?: string;
}

interface SarifRegion {
  startLine: number;
  endLine?: number;
  snippet?: {
    text: string;
  };
}

interface SarifMessage {
  text: string;
}

interface SarifInvocation {
  executionSuccessful: boolean;
  startTimeUtc?: string;
  endTimeUtc?: string;
}

type SarifLevel = "none" | "note" | "warning" | "error";

/**
 * Map VibeCheck severity to SARIF level
 */
function severityToSarifLevel(severity: Severity): SarifLevel {
  switch (severity) {
    case "critical":
    case "high":
      return "error";
    case "medium":
      return "warning";
    case "low":
    case "info":
      return "note";
    default:
      return "note";
  }
}

/**
 * Map VibeCheck severity to GitHub security severity score (0-10)
 */
function severityToSecurityScore(severity: Severity): string {
  switch (severity) {
    case "critical":
      return "9.0";
    case "high":
      return "7.5";
    case "medium":
      return "5.0";
    case "low":
      return "3.0";
    case "info":
      return "0.0";
    default:
      return "0.0";
  }
}

/**
 * Generate SARIF rule definitions from findings
 */
function generateRules(findings: Finding[]): SarifRule[] {
  const ruleMap = new Map<string, Finding>();

  // Get unique rules from findings
  for (const finding of findings) {
    if (!ruleMap.has(finding.ruleId)) {
      ruleMap.set(finding.ruleId, finding);
    }
  }

  return Array.from(ruleMap.entries()).map(([ruleId, finding]) => ({
    id: ruleId,
    name: ruleId.replace(/-/g, " "),
    shortDescription: {
      text: finding.title,
    },
    fullDescription: {
      text: finding.description,
    },
    defaultConfiguration: {
      level: severityToSarifLevel(finding.severity),
    },
    help: finding.remediation?.recommendedFix
      ? {
          text: finding.remediation.recommendedFix,
        }
      : undefined,
    properties: {
      tags: [finding.category, "security"],
      security_severity: severityToSecurityScore(finding.severity),
    },
  }));
}

/**
 * Normalize file path for SARIF URI (use forward slashes)
 */
function normalizeUri(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

/**
 * Convert a finding to SARIF result
 */
function findingToResult(
  finding: Finding,
  ruleIndex: number
): SarifResult {
  const locations: SarifLocation[] = finding.evidence.map((evidence) => ({
    physicalLocation: {
      artifactLocation: {
        uri: normalizeUri(evidence.file),
        uriBaseId: "%SRCROOT%",
      },
      region: {
        startLine: evidence.startLine,
        endLine: evidence.endLine,
        snippet: evidence.snippet
          ? {
              text: evidence.snippet,
            }
          : undefined,
      },
    },
  }));

  // If no evidence with file locations, use a default location
  if (locations.length === 0) {
    locations.push({
      physicalLocation: {
        artifactLocation: {
          uri: "unknown",
          uriBaseId: "%SRCROOT%",
        },
      },
    });
  }

  return {
    ruleId: finding.ruleId,
    ruleIndex,
    level: severityToSarifLevel(finding.severity),
    message: {
      text: `${finding.title}\n\n${finding.description}`,
    },
    locations,
    fingerprints: {
      vibecheck_v1: finding.fingerprint,
    },
    properties: {
      confidence: finding.confidence,
      category: finding.category,
    },
  };
}

/**
 * Convert VibeCheck scan artifact to SARIF format
 */
export function toSarif(artifact: ScanArtifact): SarifLog {
  const rules = generateRules(artifact.findings);
  const ruleIndexMap = new Map(rules.map((r, i) => [r.id, i]));

  const results = artifact.findings.map((finding) => {
    const ruleIndex = ruleIndexMap.get(finding.ruleId) ?? 0;
    return findingToResult(finding, ruleIndex);
  });

  const sarifLog: SarifLog = {
    $schema:
      "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: artifact.tool.name,
            version: artifact.tool.version,
            informationUri: "https://github.com/anthropics/vibecheck",
            rules,
          },
        },
        results,
        invocations: [
          {
            executionSuccessful: true,
            startTimeUtc: artifact.generatedAt,
          },
        ],
      },
    ],
  };

  return sarifLog;
}

/**
 * Convert SARIF log to JSON string
 */
export function sarifToJson(sarif: SarifLog, pretty = true): string {
  return JSON.stringify(sarif, null, pretty ? 2 : 0);
}
