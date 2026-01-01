import path from "node:path";
import type { Command } from "commander";
import {
  ARTIFACT_VERSION,
  computeSummary,
  validateArtifact,
  type ScanArtifact,
  type Finding,
  type Severity,
} from "@vibecheck/schema";
import {
  findFiles,
  writeFileSync,
  resolvePath,
} from "../utils/file-utils.js";
import { hashPath } from "../utils/fingerprint.js";
import { getGitInfo, getRepoName } from "../utils/git-info.js";
import { ALL_SCANNERS, severityMeetsThreshold, type ScanContext } from "../scanners/index.js";

export interface ScanOptions {
  out: string;
  format: string;
  repoName?: string;
  failOn: string;
  changed: boolean;
}

const DEFAULT_OUTPUT_DIR = "vibecheck-artifacts";
const DEFAULT_OUTPUT_FILE = "vibecheck-scan.json";

/**
 * Run all scanners and collect findings
 */
async function runScanners(context: ScanContext): Promise<Finding[]> {
  const allFindings: Finding[] = [];

  for (const scanner of ALL_SCANNERS) {
    const findings = await scanner(context);
    allFindings.push(...findings);
  }

  return allFindings;
}

/**
 * Create scan artifact from findings
 */
function createArtifact(
  findings: Finding[],
  targetDir: string,
  repoName?: string,
  metrics?: { filesScanned: number; scanDurationMs: number }
): ScanArtifact {
  const summary = computeSummary(findings);
  const gitInfo = getGitInfo(targetDir);
  const name = repoName ?? getRepoName(targetDir);

  const artifact: ScanArtifact = {
    artifactVersion: ARTIFACT_VERSION,
    generatedAt: new Date().toISOString(),
    tool: {
      name: "vibecheck",
      version: "0.0.1",
    },
    repo: {
      name,
      rootPathHash: hashPath(targetDir),
      git: gitInfo,
    },
    summary,
    findings,
  };

  if (metrics) {
    artifact.metrics = {
      filesScanned: metrics.filesScanned,
      linesOfCode: 0, // Not implemented yet
      scanDurationMs: metrics.scanDurationMs,
      rulesExecuted: ALL_SCANNERS.length,
    };
  }

  return artifact;
}

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
  return `${colors[severity]}${severity.toUpperCase()}${reset}`;
}

/**
 * Print scan summary to console
 */
function printSummary(artifact: ScanArtifact): void {
  const { summary, findings } = artifact;

  console.log("\n" + "=".repeat(60));
  console.log("VibeCheck Scan Complete");
  console.log("=".repeat(60));

  console.log(`\nTotal findings: ${summary.totalFindings}`);

  if (summary.totalFindings > 0) {
    console.log("\nBy severity:");
    if (summary.bySeverity.critical > 0) {
      console.log(`  ${formatSeverity("critical")}: ${summary.bySeverity.critical}`);
    }
    if (summary.bySeverity.high > 0) {
      console.log(`  ${formatSeverity("high")}: ${summary.bySeverity.high}`);
    }
    if (summary.bySeverity.medium > 0) {
      console.log(`  ${formatSeverity("medium")}: ${summary.bySeverity.medium}`);
    }
    if (summary.bySeverity.low > 0) {
      console.log(`  ${formatSeverity("low")}: ${summary.bySeverity.low}`);
    }
    if (summary.bySeverity.info > 0) {
      console.log(`  ${formatSeverity("info")}: ${summary.bySeverity.info}`);
    }

    console.log("\nTop findings:");
    const topFindings = findings
      .sort((a, b) => {
        const order = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
        return order[b.severity] - order[a.severity];
      })
      .slice(0, 5);

    for (const finding of topFindings) {
      console.log(`  [${formatSeverity(finding.severity)}] ${finding.title}`);
      console.log(`    ${finding.evidence[0]?.file}:${finding.evidence[0]?.startLine}`);
    }
  }

  console.log("");
}

/**
 * Check if any finding meets the fail threshold
 */
function shouldFail(findings: Finding[], threshold: Severity): boolean {
  return findings.some((f) => severityMeetsThreshold(f.severity, threshold));
}

/**
 * Execute the scan command
 */
export async function executeScan(
  targetDir: string,
  options: ScanOptions
): Promise<number> {
  const absoluteTarget = resolvePath(targetDir);

  // Handle --changed flag
  if (options.changed) {
    console.warn("\x1b[33mWarning: --changed flag is not implemented yet\x1b[0m");
  }

  console.log(`Scanning: ${absoluteTarget}`);
  const startTime = Date.now();

  // Find source files
  const sourceFiles = await findFiles(
    ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
    {
      cwd: absoluteTarget,
      ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**", "**/build/**"],
    }
  );

  console.log(`Found ${sourceFiles.length} source files`);

  // Create scan context
  const context: ScanContext = {
    targetDir: absoluteTarget,
    sourceFiles,
  };

  // Run scanners
  const findings = await runScanners(context);

  const endTime = Date.now();
  const scanDurationMs = endTime - startTime;

  // Create artifact
  const artifact = createArtifact(findings, absoluteTarget, options.repoName, {
    filesScanned: sourceFiles.length,
    scanDurationMs,
  });

  // Validate artifact before writing
  try {
    validateArtifact(artifact);
  } catch (error) {
    console.error("\x1b[31mError: Generated artifact failed validation\x1b[0m");
    console.error(error);
    return 1;
  }

  // Determine output path
  let outputPath = options.out;
  if (!path.isAbsolute(outputPath)) {
    outputPath = resolvePath(absoluteTarget, outputPath);
  }

  // Write artifact
  if (options.format === "json") {
    writeFileSync(outputPath, JSON.stringify(artifact, null, 2));
    console.log(`\nArtifact written to: ${outputPath}`);
  }

  // Print summary
  printSummary(artifact);

  // Check fail threshold
  const threshold = options.failOn as Severity;
  if (shouldFail(findings, threshold)) {
    console.log(
      `\x1b[31mFailing: Found findings with severity >= ${threshold}\x1b[0m`
    );
    return 1;
  }

  return 0;
}

/**
 * Register scan command with commander
 */
export function registerScanCommand(program: Command): void {
  program
    .command("scan [target]")
    .description("Scan a directory for security issues")
    .option(
      "-o, --out <path>",
      "Output file path",
      path.join(DEFAULT_OUTPUT_DIR, DEFAULT_OUTPUT_FILE)
    )
    .option("-f, --format <format>", "Output format", "json")
    .option("--repo-name <name>", "Override repository name")
    .option(
      "--fail-on <severity>",
      "Exit with non-zero if findings >= severity",
      "high"
    )
    .option("--changed", "Only scan changed files (not implemented)")
    .action(async (target: string | undefined, options: ScanOptions) => {
      const targetDir = target ?? process.cwd();
      const exitCode = await executeScan(targetDir, options);
      process.exit(exitCode);
    });
}
