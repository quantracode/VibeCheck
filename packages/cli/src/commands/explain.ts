import type { Command } from "commander";
import {
  validateArtifact,
  type ScanArtifact,
  type Finding,
  type Severity,
} from "@vibecheck/schema";
import { readFileSync, resolvePath } from "../utils/file-utils.js";

/**
 * Format severity for console output with color
 */
function formatSeverity(severity: Severity): string {
  const colors: Record<Severity, string> = {
    critical: "\x1b[35m", // Magenta
    high: "\x1b[31m",     // Red
    medium: "\x1b[33m",   // Yellow
    low: "\x1b[36m",      // Cyan
    info: "\x1b[90m",     // Gray
  };
  const reset = "\x1b[0m";
  return `${colors[severity]}${severity.toUpperCase().padEnd(8)}${reset}`;
}

/**
 * Format category for display
 */
function formatCategory(category: string): string {
  return `\x1b[34m${category}\x1b[0m`;
}

/**
 * Print a horizontal divider
 */
function divider(char = "-", length = 70): string {
  return char.repeat(length);
}

/**
 * Print artifact summary
 */
function printSummary(artifact: ScanArtifact): void {
  const { summary, tool, repo, generatedAt, metrics } = artifact;

  console.log("\n" + divider("="));
  console.log("VIBECHECK SCAN REPORT");
  console.log(divider("="));

  console.log(`\nTool:       ${tool.name} v${tool.version}`);
  if (repo) {
    console.log(`Repository: ${repo.name}`);
    if (repo.git?.branch) {
      console.log(`Branch:     ${repo.git.branch}`);
    }
    if (repo.git?.commit) {
      console.log(`Commit:     ${repo.git.commit.slice(0, 8)}`);
    }
  }
  console.log(`Generated:  ${new Date(generatedAt).toLocaleString()}`);

  if (metrics) {
    console.log(`\nScan Metrics:`);
    console.log(`  Files scanned: ${metrics.filesScanned}`);
    console.log(`  Duration:      ${metrics.scanDurationMs.toFixed(0)}ms`);
    console.log(`  Rules run:     ${metrics.rulesExecuted}`);
  }

  console.log(`\n${divider()}`);
  console.log("SUMMARY");
  console.log(divider());

  console.log(`\nTotal Findings: ${summary.totalFindings}`);

  if (summary.totalFindings > 0) {
    console.log("\nBy Severity:");
    const severities: Severity[] = ["critical", "high", "medium", "low", "info"];
    for (const sev of severities) {
      const count = summary.bySeverity[sev];
      if (count > 0) {
        const bar = "\u2588".repeat(Math.min(count * 2, 40));
        console.log(`  ${formatSeverity(sev)} ${count.toString().padStart(3)} ${bar}`);
      }
    }

    console.log("\nBy Category:");
    const categories = Object.entries(summary.byCategory)
      .filter(([, count]) => count > 0)
      .sort(([, a], [, b]) => b - a);

    for (const [cat, count] of categories) {
      console.log(`  ${formatCategory(cat.padEnd(12))} ${count}`);
    }
  }
}

/**
 * Sort findings by severity (highest first)
 */
function sortBySeverity(findings: Finding[]): Finding[] {
  const order: Record<Severity, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
    info: 0,
  };

  return [...findings].sort((a, b) => order[b.severity] - order[a.severity]);
}

/**
 * Print detailed finding information
 */
function printFinding(finding: Finding, index: number): void {
  console.log(`\n${divider()}`);
  console.log(`FINDING #${index + 1}: ${finding.title}`);
  console.log(divider());

  console.log(`\nSeverity:   ${formatSeverity(finding.severity)}`);
  console.log(`Category:   ${formatCategory(finding.category)}`);
  console.log(`Rule:       ${finding.ruleId}`);
  console.log(`Confidence: ${(finding.confidence * 100).toFixed(0)}%`);
  console.log(`ID:         ${finding.id}`);

  console.log(`\nDescription:`);
  console.log(`  ${finding.description}`);

  console.log(`\nEvidence:`);
  for (const ev of finding.evidence) {
    console.log(`  - ${ev.file}:${ev.startLine}-${ev.endLine}`);
    console.log(`    ${ev.label}`);
    if (ev.snippet) {
      console.log(`    \x1b[90m${ev.snippet}\x1b[0m`);
    }
  }

  if (finding.claim) {
    console.log(`\nClaim:`);
    console.log(`  Type:     ${finding.claim.type}`);
    console.log(`  Source:   ${finding.claim.source}`);
    console.log(`  Strength: ${finding.claim.strength}`);
    console.log(`  Evidence: "${finding.claim.textEvidence}"`);
  }

  if (finding.proof) {
    console.log(`\nProof Trace:`);
    console.log(`  ${finding.proof.summary}`);
    for (const node of finding.proof.nodes) {
      const loc = node.file ? ` (${node.file}:${node.line})` : "";
      console.log(`    [${node.kind}] ${node.label}${loc}`);
    }
  }

  console.log(`\nRemediation:`);
  console.log(`  ${finding.remediation.recommendedFix}`);

  if (finding.remediation.patch) {
    console.log(`\n  Suggested patch:`);
    console.log(`  \x1b[90m${finding.remediation.patch}\x1b[0m`);
  }

  if (finding.links) {
    console.log(`\nReferences:`);
    if (finding.links.owasp) {
      console.log(`  OWASP: ${finding.links.owasp}`);
    }
    if (finding.links.cwe) {
      console.log(`  CWE:   ${finding.links.cwe}`);
    }
  }
}

/**
 * Print top findings with details
 */
function printTopFindings(artifact: ScanArtifact, limit: number): void {
  const { findings } = artifact;

  if (findings.length === 0) {
    console.log("\n\x1b[32mNo findings to display.\x1b[0m");
    return;
  }

  const sorted = sortBySeverity(findings);
  const top = sorted.slice(0, limit);

  console.log(`\n${divider("=")}`);
  console.log(`TOP ${top.length} FINDINGS`);
  console.log(divider("="));

  for (let i = 0; i < top.length; i++) {
    printFinding(top[i], i);
  }

  if (findings.length > limit) {
    console.log(`\n${divider()}`);
    console.log(`\x1b[90m... and ${findings.length - limit} more findings\x1b[0m`);
  }

  console.log("");
}

/**
 * Execute the explain command
 */
export async function executeExplain(
  artifactPath: string,
  options: { limit: number }
): Promise<number> {
  const absolutePath = resolvePath(artifactPath);

  // Read artifact file
  const content = readFileSync(absolutePath);
  if (!content) {
    console.error(`\x1b[31mError: Could not read file: ${absolutePath}\x1b[0m`);
    return 1;
  }

  // Parse JSON
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    console.error(`\x1b[31mError: Invalid JSON in file: ${absolutePath}\x1b[0m`);
    return 1;
  }

  // Validate artifact
  let artifact: ScanArtifact;
  try {
    artifact = validateArtifact(json);
  } catch (error) {
    console.error(`\x1b[31mError: Invalid artifact format\x1b[0m`);
    console.error(error);
    return 1;
  }

  // Print report
  printSummary(artifact);
  printTopFindings(artifact, options.limit);

  return 0;
}

/**
 * Register explain command with commander
 */
export function registerExplainCommand(program: Command): void {
  program
    .command("explain <artifactPath>")
    .description("Display a human-readable summary of a scan artifact")
    .option("-l, --limit <number>", "Maximum findings to display", "5")
    .action(async (artifactPath: string, options: { limit: string }) => {
      const limit = parseInt(options.limit, 10) || 5;
      const exitCode = await executeExplain(artifactPath, { limit });
      process.exit(exitCode);
    });
}
