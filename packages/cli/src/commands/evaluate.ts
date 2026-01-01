import path from "node:path";
import type { Command } from "commander";
import { readFileSync, fileExists, resolvePath, writeFileSync, ensureDir } from "../utils/file-utils.js";
import {
  evaluate,
  getProfile,
  PROFILE_NAMES,
  PROFILE_DESCRIPTIONS,
  type ProfileName,
  type PolicyConfig,
  type PolicyReport,
  type Waiver,
  type WaiversFile,
  WaiversFileSchema,
  PolicyConfigSchema,
} from "@vibecheck/policy";
import { validateArtifact, type ScanArtifact, type Severity } from "@vibecheck/schema";

/**
 * Evaluate command options
 */
export interface EvaluateOptions {
  /** Path to scan artifact (JSON) */
  artifact: string;
  /** Optional baseline artifact for regression detection */
  baseline?: string;
  /** Policy profile name */
  profile: ProfileName;
  /** Path to policy config file (JSON) */
  config?: string;
  /** Path to waivers file (JSON) */
  waivers?: string;
  /** Output report to file */
  out?: string;
  /** JSON output only (no console summary) */
  quiet: boolean;
}

/**
 * Load and validate scan artifact from file
 */
function loadArtifact(filepath: string): ScanArtifact {
  const absolutePath = resolvePath(filepath);

  if (!fileExists(absolutePath)) {
    throw new Error(`Artifact file not found: ${filepath}`);
  }

  const content = readFileSync(absolutePath);
  if (!content) {
    throw new Error(`Failed to read artifact file: ${filepath}`);
  }
  const data = JSON.parse(content);

  // Validate the artifact
  return validateArtifact(data);
}

/**
 * Load and validate waivers file
 */
function loadWaivers(filepath: string): Waiver[] {
  const absolutePath = resolvePath(filepath);

  if (!fileExists(absolutePath)) {
    throw new Error(`Waivers file not found: ${filepath}`);
  }

  const content = readFileSync(absolutePath);
  if (!content) {
    throw new Error(`Failed to read waivers file: ${filepath}`);
  }
  const data = JSON.parse(content);

  const result = WaiversFileSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`Invalid waivers file: ${result.error.message}`);
  }

  return result.data.waivers;
}

/**
 * Load and validate policy config file
 */
function loadConfig(filepath: string): PolicyConfig {
  const absolutePath = resolvePath(filepath);

  if (!fileExists(absolutePath)) {
    throw new Error(`Config file not found: ${filepath}`);
  }

  const content = readFileSync(absolutePath);
  if (!content) {
    throw new Error(`Failed to read config file: ${filepath}`);
  }
  const data = JSON.parse(content);

  const result = PolicyConfigSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`Invalid config file: ${result.error.message}`);
  }

  return result.data;
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
 * Format status for console output with color
 */
function formatStatus(status: "pass" | "warn" | "fail"): string {
  const colors: Record<"pass" | "warn" | "fail", string> = {
    pass: "\x1b[32m",  // Green
    warn: "\x1b[33m",  // Yellow
    fail: "\x1b[31m",  // Red
  };
  const reset = "\x1b[0m";
  return `${colors[status]}${status.toUpperCase()}${reset}`;
}

/**
 * Print evaluation summary to console
 */
function printSummary(report: PolicyReport): void {
  console.log("\n" + "=".repeat(60));
  console.log("VibeCheck Policy Evaluation");
  console.log("=".repeat(60));

  console.log(`\nProfile: ${report.profileName ?? "custom"}`);
  console.log(`Status: ${formatStatus(report.status)}`);
  console.log(`Exit Code: ${report.exitCode}`);

  console.log("\nSummary:");
  console.log(`  Total active findings: ${report.summary.total}`);
  console.log(`  Waived findings: ${report.summary.waived}`);
  console.log(`  Ignored by override: ${report.summary.ignored}`);

  if (report.summary.total > 0) {
    console.log("\nBy severity:");
    if (report.summary.bySeverity.critical > 0) {
      console.log(`  ${formatSeverity("critical")}: ${report.summary.bySeverity.critical}`);
    }
    if (report.summary.bySeverity.high > 0) {
      console.log(`  ${formatSeverity("high")}: ${report.summary.bySeverity.high}`);
    }
    if (report.summary.bySeverity.medium > 0) {
      console.log(`  ${formatSeverity("medium")}: ${report.summary.bySeverity.medium}`);
    }
    if (report.summary.bySeverity.low > 0) {
      console.log(`  ${formatSeverity("low")}: ${report.summary.bySeverity.low}`);
    }
    if (report.summary.bySeverity.info > 0) {
      console.log(`  ${formatSeverity("info")}: ${report.summary.bySeverity.info}`);
    }
  }

  // Show thresholds
  console.log("\nThresholds:");
  console.log(`  Fail on severity >= ${report.thresholds.failOnSeverity} (confidence >= ${report.thresholds.minConfidenceForFail})`);
  console.log(`  Warn on severity >= ${report.thresholds.warnOnSeverity} (confidence >= ${report.thresholds.minConfidenceForWarn})`);
  if (report.thresholds.maxFindings > 0) {
    console.log(`  Max findings: ${report.thresholds.maxFindings}`);
  }

  // Show regression if present
  if (report.regression) {
    console.log("\nRegression:");
    console.log(`  New findings: ${report.regression.newFindings.length}`);
    console.log(`  Resolved findings: ${report.regression.resolvedFindings.length}`);
    console.log(`  Severity regressions: ${report.regression.severityRegressions.length}`);
    console.log(`  Net change: ${report.regression.netChange > 0 ? "+" : ""}${report.regression.netChange}`);
  }

  // Show reasons
  if (report.reasons.length > 0) {
    console.log("\nReasons:");
    for (const reason of report.reasons) {
      const statusIcon = reason.status === "fail" ? "\x1b[31m✗\x1b[0m"
        : reason.status === "warn" ? "\x1b[33m!\x1b[0m"
        : "\x1b[32m✓\x1b[0m";
      console.log(`  ${statusIcon} ${reason.message}`);
    }
  }

  // Show waived findings if any
  if (report.waivedFindings.length > 0) {
    console.log("\nWaived findings:");
    for (const wf of report.waivedFindings.slice(0, 5)) {
      const expiredNote = wf.expired ? " (EXPIRED)" : "";
      console.log(`  - [${wf.finding.ruleId}] ${wf.finding.title}${expiredNote}`);
      console.log(`    Reason: ${wf.waiver.reason}`);
    }
    if (report.waivedFindings.length > 5) {
      console.log(`  ... and ${report.waivedFindings.length - 5} more`);
    }
  }

  console.log("");
}

/**
 * Execute the evaluate command
 */
export async function executeEvaluate(options: EvaluateOptions): Promise<number> {
  // Load artifact
  const artifact = loadArtifact(options.artifact);

  // Load baseline if provided
  let baseline: ScanArtifact | undefined;
  if (options.baseline) {
    baseline = loadArtifact(options.baseline);
  }

  // Load config if provided, otherwise use profile
  let config: PolicyConfig | undefined;
  if (options.config) {
    config = loadConfig(options.config);
  }

  // Load waivers if provided
  let waivers: Waiver[] = [];
  if (options.waivers) {
    waivers = loadWaivers(options.waivers);
  }

  // Run evaluation
  const report = evaluate({
    artifact,
    baseline,
    config,
    profile: config ? undefined : options.profile,
    waivers,
    artifactPath: options.artifact,
  });

  // Output report
  if (options.out) {
    const outPath = resolvePath(options.out);
    ensureDir(path.dirname(outPath));
    writeFileSync(outPath, JSON.stringify(report, null, 2));
    if (!options.quiet) {
      console.log(`Policy report written to: ${outPath}`);
    }
  }

  // Print summary unless quiet mode
  if (!options.quiet) {
    printSummary(report);
  } else {
    // In quiet mode, just output JSON
    if (!options.out) {
      console.log(JSON.stringify(report, null, 2));
    }
  }

  return report.exitCode;
}

/**
 * Register evaluate command with commander
 */
export function registerEvaluateCommand(program: Command): void {
  program
    .command("evaluate")
    .description("Evaluate a scan artifact against a policy")
    .requiredOption(
      "-a, --artifact <path>",
      "Path to scan artifact (JSON)"
    )
    .option(
      "-b, --baseline <path>",
      "Path to baseline artifact for regression detection"
    )
    .option(
      "-p, --profile <name>",
      `Policy profile (${PROFILE_NAMES.join(", ")})`,
      "startup"
    )
    .option(
      "-c, --config <path>",
      "Path to policy config file (overrides profile)"
    )
    .option(
      "-w, --waivers <path>",
      "Path to waivers file"
    )
    .option(
      "-o, --out <path>",
      "Output report to file"
    )
    .option(
      "-q, --quiet",
      "JSON output only (no console summary)"
    )
    .addHelpText(
      "after",
      `
Profiles:
${PROFILE_NAMES.map((name) => `  ${name}: ${PROFILE_DESCRIPTIONS[name]}`).join("\n")}

Examples:
  $ vibecheck evaluate -a ./vibecheck-scan.json
  $ vibecheck evaluate -a ./scan.json -p strict
  $ vibecheck evaluate -a ./scan.json -b ./baseline.json
  $ vibecheck evaluate -a ./scan.json -w ./waivers.json
  $ vibecheck evaluate -a ./scan.json -c ./policy.json
  $ vibecheck evaluate -a ./scan.json -o ./report.json -q
`
    )
    .action(async (cmdOptions: Record<string, unknown>) => {
      // Validate profile
      const profileStr = cmdOptions.profile as string;
      if (!PROFILE_NAMES.includes(profileStr as ProfileName)) {
        console.error(`\x1b[31mError: Invalid profile "${profileStr}". Valid options: ${PROFILE_NAMES.join(", ")}\x1b[0m`);
        process.exit(1);
      }

      const options: EvaluateOptions = {
        artifact: cmdOptions.artifact as string,
        baseline: cmdOptions.baseline as string | undefined,
        profile: profileStr as ProfileName,
        config: cmdOptions.config as string | undefined,
        waivers: cmdOptions.waivers as string | undefined,
        out: cmdOptions.out as string | undefined,
        quiet: Boolean(cmdOptions.quiet),
      };

      try {
        const exitCode = await executeEvaluate(options);
        process.exit(exitCode);
      } catch (error) {
        console.error(`\x1b[31mError: ${error instanceof Error ? error.message : String(error)}\x1b[0m`);
        process.exit(1);
      }
    });
}
