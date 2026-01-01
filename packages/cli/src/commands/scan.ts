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
  writeFileSync,
  resolvePath,
  ensureDir,
} from "../utils/file-utils.js";
import { hashPath } from "../utils/fingerprint.js";
import { getGitInfo, getRepoName } from "../utils/git-info.js";
import {
  ALL_SCANNERS,
  ALL_SCANNER_PACKS,
  buildScanContext,
  severityMeetsThreshold,
  type ScanContext,
  type ScanContextOptions,
} from "../scanners/index.js";
import {
  buildRouteMap,
  buildMiddlewareMap,
  buildAllProofTraces,
  calculateCoverage,
  mineAllIntentClaims,
} from "../phase3/index.js";
import { toSarif, sarifToJson } from "../utils/sarif-formatter.js";

/**
 * Valid output formats
 */
export type OutputFormat = "json" | "sarif" | "both";

/**
 * Valid fail-on thresholds
 */
export type FailThreshold = "off" | Severity;

/**
 * Scan command options
 */
export interface ScanOptions {
  /** Output file/directory path */
  out: string;
  /** Output format: json, sarif, or both */
  format: OutputFormat;
  /** Override repository name */
  repoName?: string;
  /** Fail threshold: off, info, low, medium, high, critical */
  failOn: FailThreshold;
  /** Only scan changed files (not implemented) */
  changed: boolean;
  /** Include route map, intent claims, and coverage metrics */
  emitIntentMap: boolean;
  /** Additional glob patterns to exclude */
  exclude: string[];
  /** Include test files in scan */
  includeTests: boolean;
}

const DEFAULT_OUTPUT_DIR = "vibecheck-artifacts";
const DEFAULT_OUTPUT_FILE = "vibecheck-scan.json";

/**
 * Normalize path for Windows compatibility
 */
function normalizePath(p: string): string {
  // Use forward slashes for consistency, but respect platform separators for filesystem ops
  return p.replace(/\\/g, "/");
}

/**
 * Get output file path with correct extension
 */
function getOutputPath(basePath: string, format: "json" | "sarif", targetDir: string): string {
  let outputPath = basePath;

  // If path is relative, resolve against target directory
  if (!path.isAbsolute(outputPath)) {
    outputPath = resolvePath(targetDir, outputPath);
  }

  // Handle directory vs file path
  const ext = path.extname(outputPath);
  if (!ext) {
    // It's a directory, add default filename
    const filename = format === "sarif" ? "vibecheck-scan.sarif" : "vibecheck-scan.json";
    outputPath = path.join(outputPath, filename);
  } else if (format === "sarif" && ext === ".json") {
    // Replace .json with .sarif for sarif format
    outputPath = outputPath.replace(/\.json$/, ".sarif");
  } else if (format === "json" && ext === ".sarif") {
    // Replace .sarif with .json for json format
    outputPath = outputPath.replace(/\.sarif$/, ".json");
  }

  return outputPath;
}

/**
 * Run all scanners and collect findings
 */
async function runScanners(context: ScanContext): Promise<Finding[]> {
  const allFindings: Finding[] = [];
  const seenFingerprints = new Set<string>();

  for (const scanner of ALL_SCANNERS) {
    try {
      const findings = await scanner(context);

      // Dedupe by fingerprint
      for (const finding of findings) {
        if (!seenFingerprints.has(finding.fingerprint)) {
          seenFingerprints.add(finding.fingerprint);
          allFindings.push(finding);
        }
      }
    } catch (error) {
      // Log error but continue with other scanners
      console.error(`Scanner error: ${error}`);
    }
  }

  return allFindings;
}

interface Phase3Data {
  routeMap: {
    routes: Array<{
      routeId: string;
      method: string;
      path: string;
      file: string;
      startLine?: number;
      endLine?: number;
    }>;
  };
  middlewareMap: {
    middlewareFile?: string;
    matcher: string[];
    coverage: Array<{
      routeId: string;
      covered: boolean;
      reason?: string;
    }>;
  };
  intentMap: {
    intents: Array<{
      intentId: string;
      type: "AUTH_ENFORCED" | "INPUT_VALIDATED" | "CSRF_ENABLED" | "RATE_LIMITED" | "ENCRYPTED_AT_REST" | "MIDDLEWARE_PROTECTED" | "OTHER";
      scope: "route" | "module" | "global";
      targetRouteId?: string;
      source: "comment" | "identifier" | "import" | "doc" | "ui" | "config";
      location: { file: string; startLine: number; endLine: number };
      strength: "weak" | "medium" | "strong";
      textEvidence: string;
    }>;
  };
  proofTraces: Record<string, {
    summary: string;
    nodes: Array<{
      kind: "route" | "middleware" | "handler" | "function" | "sink" | "config" | "other";
      label: string;
      file?: string;
      line?: number;
    }>;
  }>;
  coverageMetrics: {
    authCoverage?: {
      totalStateChanging: number;
      protectedCount: number;
      unprotectedCount: number;
    };
    validationCoverage?: {
      totalStateChanging: number;
      validatedCount: number;
    };
    middlewareCoverage?: {
      totalApiRoutes: number;
      coveredApiRoutes: number;
    };
  };
}

/**
 * Create scan artifact from findings
 */
function createArtifact(
  findings: Finding[],
  targetDir: string,
  fileCount: number,
  repoName?: string,
  metrics?: { filesScanned: number; scanDurationMs: number },
  phase3Data?: Phase3Data
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

  // Add Phase 3 data if provided
  if (phase3Data) {
    artifact.routeMap = phase3Data.routeMap;
    artifact.middlewareMap = phase3Data.middlewareMap;
    artifact.intentMap = phase3Data.intentMap;
    artifact.proofTraces = phase3Data.proofTraces;

    // Add coverage to metrics
    if (artifact.metrics) {
      artifact.metrics = {
        ...artifact.metrics,
        ...phase3Data.coverageMetrics,
      };
    }
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
function printSummary(artifact: ScanArtifact, options: ScanOptions): void {
  const { summary, findings } = artifact;

  console.log("\n" + "=".repeat(60));
  console.log("VibeCheck Scan Complete");
  console.log("=".repeat(60));

  console.log(`\nScanner packs: ${ALL_SCANNER_PACKS.map((p) => p.name).join(", ")}`);
  console.log(`Total scanners: ${ALL_SCANNERS.length}`);
  console.log(`Total findings: ${summary.totalFindings}`);

  if (options.exclude.length > 0) {
    console.log(`Custom excludes: ${options.exclude.length} pattern(s)`);
  }
  if (options.includeTests) {
    console.log("Test files: included");
  }

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
      if (finding.evidence[0]) {
        console.log(`    ${normalizePath(finding.evidence[0].file)}:${finding.evidence[0].startLine}`);
      }
    }
  }

  console.log("");
}

/**
 * Check if any finding meets the fail threshold
 */
function shouldFail(findings: Finding[], threshold: FailThreshold): boolean {
  if (threshold === "off") {
    return false;
  }
  return findings.some((f) => severityMeetsThreshold(f.severity, threshold));
}

/**
 * Validate format option
 */
function validateFormat(format: string): OutputFormat {
  const validFormats: OutputFormat[] = ["json", "sarif", "both"];
  if (!validFormats.includes(format as OutputFormat)) {
    console.error(`\x1b[31mError: Invalid format "${format}". Valid options: ${validFormats.join(", ")}\x1b[0m`);
    process.exit(1);
  }
  return format as OutputFormat;
}

/**
 * Validate fail-on option
 */
function validateFailOn(failOn: string): FailThreshold {
  const validThresholds: FailThreshold[] = ["off", "info", "low", "medium", "high", "critical"];
  if (!validThresholds.includes(failOn as FailThreshold)) {
    console.error(`\x1b[31mError: Invalid fail-on value "${failOn}". Valid options: ${validThresholds.join(", ")}\x1b[0m`);
    process.exit(1);
  }
  return failOn as FailThreshold;
}

/**
 * Execute the scan command
 */
export async function executeScan(
  targetDir: string,
  options: ScanOptions
): Promise<number> {
  const absoluteTarget = resolvePath(targetDir);

  // Validate options
  const format = validateFormat(options.format);
  const failOn = validateFailOn(options.failOn);

  // Handle --changed flag
  if (options.changed) {
    console.warn("\x1b[33mWarning: --changed flag is not implemented yet\x1b[0m");
  }

  console.log(`Scanning: ${absoluteTarget}`);
  const startTime = Date.now();

  // Build scan context options
  const contextOptions: ScanContextOptions = {
    excludePatterns: options.exclude,
    includeTests: options.includeTests,
  };

  // Build scan context with file index and helpers
  console.log("Building scan context...");
  const context = await buildScanContext(absoluteTarget, contextOptions);

  console.log(`Found ${context.fileIndex.allSourceFiles.length} source files`);
  console.log(`  - API routes: ${context.fileIndex.apiRouteFiles.length}`);
  console.log(`  - Config files: ${context.fileIndex.configFiles.length}`);
  console.log(`  - Framework: ${context.repoMeta.framework}`);

  // Run scanners
  console.log("\nRunning scanners...");
  const findings = await runScanners(context);

  const endTime = Date.now();
  const scanDurationMs = endTime - startTime;

  // Build Phase 3 data if requested
  let phase3Data: Phase3Data | undefined;
  if (options.emitIntentMap) {
    console.log("\nBuilding intent map...");
    const routeMapRaw = buildRouteMap(context);
    const middlewareMapRaw = buildMiddlewareMap(context);
    const intentMapRaw = mineAllIntentClaims(context, routeMapRaw);
    const proofTracesRaw = buildAllProofTraces(context, routeMapRaw);
    const coverageRaw = calculateCoverage(routeMapRaw, proofTracesRaw, middlewareMapRaw);

    // Convert to schema format
    const proofTracesRecord: Phase3Data["proofTraces"] = {};
    for (const [key, value] of proofTracesRaw) {
      proofTracesRecord[key] = {
        summary: value.authProven
          ? "Auth proven"
          : value.middlewareCovered
          ? "Protected by middleware"
          : "No protection proven",
        nodes: value.steps.map((step) => ({
          kind: "handler" as const,
          label: step.label,
          file: step.file,
          line: step.line,
        })),
      };
    }

    // Build middleware coverage
    const allMatchers = middlewareMapRaw.flatMap((m) => m.matchers);
    const middlewareCoverage = routeMapRaw.map((route) => {
      const isRouteCovered = allMatchers.some((matcher) => {
        const pattern = matcher.replace(/\*/g, ".*").replace(/\/:path\*/g, "/.*");
        try {
          return new RegExp(`^${pattern}`).test(route.path);
        } catch {
          return route.path.startsWith(matcher.replace(/\/:path\*$/, ""));
        }
      });
      return {
        routeId: route.routeId,
        covered: isRouteCovered,
      };
    });

    // Calculate coverage stats
    const stateChangingMethods = ["POST", "PUT", "PATCH", "DELETE"];
    const stateChangingRoutes = routeMapRaw.filter((r) =>
      stateChangingMethods.includes(r.method)
    );
    const protectedRoutes = stateChangingRoutes.filter((r) => {
      const trace = proofTracesRaw.get(r.routeId);
      return trace?.authProven || trace?.middlewareCovered;
    });
    const validatedRoutes = routeMapRaw
      .filter((r) => ["POST", "PUT", "PATCH"].includes(r.method))
      .filter((r) => proofTracesRaw.get(r.routeId)?.validationProven);
    const coveredApiRoutes = middlewareCoverage.filter((c) => c.covered);

    phase3Data = {
      routeMap: { routes: routeMapRaw },
      middlewareMap: {
        middlewareFile: middlewareMapRaw[0]?.file,
        matcher: allMatchers,
        coverage: middlewareCoverage,
      },
      intentMap: { intents: intentMapRaw },
      proofTraces: proofTracesRecord,
      coverageMetrics: {
        authCoverage: {
          totalStateChanging: stateChangingRoutes.length,
          protectedCount: protectedRoutes.length,
          unprotectedCount: stateChangingRoutes.length - protectedRoutes.length,
        },
        validationCoverage: {
          totalStateChanging: routeMapRaw.filter((r) =>
            ["POST", "PUT", "PATCH"].includes(r.method)
          ).length,
          validatedCount: validatedRoutes.length,
        },
        middlewareCoverage: {
          totalApiRoutes: routeMapRaw.length,
          coveredApiRoutes: coveredApiRoutes.length,
        },
      },
    };

    console.log(`  Routes: ${routeMapRaw.length}`);
    console.log(`  Intents: ${intentMapRaw.length}`);
    console.log(`  Auth coverage: ${Math.round(coverageRaw.authCoverage * 100)}%`);
  }

  // Create artifact
  const artifact = createArtifact(
    findings,
    absoluteTarget,
    context.fileIndex.allSourceFiles.length,
    options.repoName,
    {
      filesScanned: context.fileIndex.allSourceFiles.length,
      scanDurationMs,
    },
    phase3Data
  );

  // Validate artifact before writing
  try {
    validateArtifact(artifact);
  } catch (error) {
    console.error("\x1b[31mError: Generated artifact failed validation\x1b[0m");
    console.error(error);
    return 1;
  }

  // Write output file(s)
  const outputFiles: string[] = [];

  if (format === "json" || format === "both") {
    const jsonPath = getOutputPath(options.out, "json", absoluteTarget);
    ensureDir(path.dirname(jsonPath));
    writeFileSync(jsonPath, JSON.stringify(artifact, null, 2));
    outputFiles.push(jsonPath);
  }

  if (format === "sarif" || format === "both") {
    const sarifPath = getOutputPath(options.out, "sarif", absoluteTarget);
    ensureDir(path.dirname(sarifPath));
    const sarifLog = toSarif(artifact);
    writeFileSync(sarifPath, sarifToJson(sarifLog));
    outputFiles.push(sarifPath);
  }

  if (outputFiles.length > 0) {
    console.log("\nArtifact(s) written to:");
    for (const f of outputFiles) {
      console.log(`  ${normalizePath(f)}`);
    }
  }

  // Print summary
  printSummary(artifact, options);

  // Check fail threshold
  if (shouldFail(findings, failOn)) {
    console.log(
      `\x1b[31mFailing: Found findings with severity >= ${failOn}\x1b[0m`
    );
    return 1;
  }

  return 0;
}

/**
 * Collect multiple --exclude values into an array
 */
function collectExcludes(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

/**
 * Register scan command with commander
 */
export function registerScanCommand(program: Command): void {
  program
    .command("scan [target]")
    .description("Scan a directory for security issues")
    .option(
      "-t, --target <path>",
      "Target directory to scan (alternative to positional argument)"
    )
    .option(
      "-o, --out <path>",
      "Output file or directory path",
      path.join(DEFAULT_OUTPUT_DIR, DEFAULT_OUTPUT_FILE)
    )
    .option(
      "-f, --format <format>",
      "Output format: json, sarif, or both",
      "json"
    )
    .option("--repo-name <name>", "Override repository name")
    .option(
      "--fail-on <threshold>",
      "Exit with non-zero if findings >= threshold (off, info, low, medium, high, critical)",
      "high"
    )
    .option(
      "-e, --exclude <glob>",
      "Glob pattern to exclude (repeatable)",
      collectExcludes,
      []
    )
    .option(
      "--include-tests",
      "Include test files in scan (excluded by default)"
    )
    .option("--changed", "Only scan changed files (not implemented)")
    .option(
      "--emit-intent-map",
      "Include route map, intent claims, and coverage metrics in output"
    )
    .addHelpText(
      "after",
      `
Examples:
  $ vibecheck scan                              Scan current directory
  $ vibecheck scan ./my-app                     Scan specific directory
  $ vibecheck scan -t ./my-app                  Same as above (explicit target)
  $ vibecheck scan --format sarif               Output in SARIF format
  $ vibecheck scan --format both                Output both JSON and SARIF
  $ vibecheck scan -o ./reports                 Custom output directory
  $ vibecheck scan --fail-on medium             Fail on medium or higher
  $ vibecheck scan --fail-on off                Never fail based on findings
  $ vibecheck scan -e "**/legacy/**"            Exclude legacy directory
  $ vibecheck scan -e "**/*.old.ts" -e "**/v1/**"  Multiple excludes
  $ vibecheck scan --include-tests              Include test files

Default excludes:
  node_modules, dist, .git, build, .next, coverage, .turbo, .cache,
  __tests__, *.test.*, *.spec.*, test/, tests/, fixtures/, __mocks__,
  cypress/, e2e/, *.stories.*
`
    )
    .action(async (positionalTarget: string | undefined, cmdOptions: Record<string, unknown>) => {
      // Prefer --target over positional, fall back to cwd
      const targetDir = (cmdOptions.target as string | undefined)
        ?? positionalTarget
        ?? process.cwd();

      const options: ScanOptions = {
        out: cmdOptions.out as string,
        format: cmdOptions.format as OutputFormat,
        repoName: cmdOptions.repoName as string | undefined,
        failOn: cmdOptions.failOn as FailThreshold,
        changed: Boolean(cmdOptions.changed),
        emitIntentMap: Boolean(cmdOptions.emitIntentMap),
        exclude: cmdOptions.exclude as string[],
        includeTests: Boolean(cmdOptions.includeTests),
      };

      const exitCode = await executeScan(targetDir, options);
      process.exit(exitCode);
    });
}
