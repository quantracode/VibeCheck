import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import type { Command } from "commander";
import { ARTIFACT_VERSION, computeSummary, type ScanArtifact, type Finding } from "@vibecheck/schema";
import { CLI_VERSION } from "../constants.js";
import { resolvePath, ensureDir, writeFileSync } from "../utils/file-utils.js";
import { hashPath } from "../utils/fingerprint.js";
import { getGitInfo, getRepoName } from "../utils/git-info.js";
import {
  ALL_SCANNERS,
  ALL_SCANNER_PACKS,
  buildScanContext,
  type ScanContext,
} from "../scanners/index.js";
import { toSarif, sarifToJson } from "../utils/sarif-formatter.js";
import { Spinner } from "../utils/progress.js";

/**
 * Verify determinism options
 */
export interface VerifyDeterminismOptions {
  /** Number of runs to perform */
  runs: number;
  /** Include SARIF comparison */
  sarif: boolean;
  /** Output directory for reports */
  out?: string;
  /** Verbose output */
  verbose: boolean;
}

/**
 * Run result for comparison
 */
interface RunResult {
  runNumber: number;
  artifact: ScanArtifact;
  jsonHash: string;
  sarifHash?: string;
  jsonContent: string;
  sarifContent?: string;
  durationMs: number;
}

/**
 * Comparison result between runs
 */
interface ComparisonResult {
  jsonMatch: boolean;
  sarifMatch: boolean;
  differences: string[];
}

/**
 * Certificate report
 */
interface DeterminismCertificate {
  certified: boolean;
  timestamp: string;
  targetPath: string;
  targetPathHash: string;
  runs: number;
  cliVersion: string;
  artifactVersion: string;
  totalFindings: number;
  jsonHashes: string[];
  sarifHashes?: string[];
  comparisonDetails: {
    allJsonMatch: boolean;
    allSarifMatch: boolean;
    differences: string[];
  };
  runDurations: number[];
}

/**
 * Normalize artifact for deterministic comparison
 * Removes fields that are expected to vary between runs
 */
function normalizeArtifact(artifact: ScanArtifact): ScanArtifact {
  // Deep clone to avoid modifying original
  const normalized = JSON.parse(JSON.stringify(artifact)) as ScanArtifact;

  // Remove timestamp - this will always differ
  normalized.generatedAt = "NORMALIZED";

  // Remove scan duration - this will differ
  if (normalized.metrics) {
    normalized.metrics.scanDurationMs = 0;
  }

  // Sort findings by fingerprint for stable ordering
  if (normalized.findings) {
    normalized.findings.sort((a, b) => a.fingerprint.localeCompare(b.fingerprint));
  }

  // Sort route map entries
  if (normalized.routeMap?.routes) {
    normalized.routeMap.routes.sort((a, b) => a.routeId.localeCompare(b.routeId));
  }

  // Sort intent map entries
  if (normalized.intentMap?.intents) {
    normalized.intentMap.intents.sort((a, b) => a.intentId.localeCompare(b.intentId));
  }

  // Sort middleware coverage
  if (normalized.middlewareMap?.coverage) {
    normalized.middlewareMap.coverage.sort((a, b) => a.routeId.localeCompare(b.routeId));
  }

  // Sort proof traces keys
  if (normalized.proofTraces) {
    const sortedTraces: typeof normalized.proofTraces = {};
    for (const key of Object.keys(normalized.proofTraces).sort()) {
      sortedTraces[key] = normalized.proofTraces[key];
    }
    normalized.proofTraces = sortedTraces;
  }

  return normalized;
}

/**
 * Hash content using SHA-256
 */
function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Run scanners without progress display
 */
async function runScannersQuietly(context: ScanContext): Promise<Finding[]> {
  const allFindings: Finding[] = [];
  const seenFingerprints = new Set<string>();

  for (const pack of ALL_SCANNER_PACKS) {
    for (const scanner of pack.scanners) {
      try {
        const findings = await scanner(context);
        for (const finding of findings) {
          if (!seenFingerprints.has(finding.fingerprint)) {
            seenFingerprints.add(finding.fingerprint);
            allFindings.push(finding);
          }
        }
      } catch {
        // Ignore errors in quiet mode
      }
    }
  }

  return allFindings;
}

/**
 * Create artifact from findings
 */
function createArtifact(
  findings: Finding[],
  targetDir: string,
  durationMs: number,
  filesScanned: number
): ScanArtifact {
  const summary = computeSummary(findings);
  const gitInfo = getGitInfo(targetDir);
  const name = getRepoName(targetDir);

  return {
    artifactVersion: ARTIFACT_VERSION,
    generatedAt: new Date().toISOString(),
    tool: {
      name: "vibecheck",
      version: CLI_VERSION,
    },
    repo: {
      name,
      rootPathHash: hashPath(targetDir),
      git: gitInfo,
    },
    summary,
    findings,
    metrics: {
      filesScanned,
      linesOfCode: 0,
      scanDurationMs: durationMs,
      rulesExecuted: ALL_SCANNERS.length,
    },
  };
}

/**
 * Run a single scan and return result
 */
async function runScan(
  targetDir: string,
  runNumber: number,
  includeSarif: boolean
): Promise<RunResult> {
  const startTime = Date.now();

  // Build context
  const context = await buildScanContext(targetDir);

  // Run scanners
  const findings = await runScannersQuietly(context);

  const endTime = Date.now();
  const durationMs = endTime - startTime;

  // Create artifact
  const artifact = createArtifact(
    findings,
    targetDir,
    durationMs,
    context.fileIndex.allSourceFiles.length
  );

  // Normalize and serialize
  const normalizedArtifact = normalizeArtifact(artifact);
  const jsonContent = JSON.stringify(normalizedArtifact, null, 2);
  const jsonHash = hashContent(jsonContent);

  const result: RunResult = {
    runNumber,
    artifact,
    jsonHash,
    jsonContent,
    durationMs,
  };

  // Optionally include SARIF
  if (includeSarif) {
    const sarifLog = toSarif(normalizedArtifact);
    const sarifContent = sarifToJson(sarifLog);
    result.sarifHash = hashContent(sarifContent);
    result.sarifContent = sarifContent;
  }

  return result;
}

/**
 * Compare two runs and identify differences
 */
function compareRuns(run1: RunResult, run2: RunResult): ComparisonResult {
  const differences: string[] = [];

  const jsonMatch = run1.jsonHash === run2.jsonHash;
  let sarifMatch = true;

  if (!jsonMatch) {
    // Find specific differences in JSON
    const json1 = JSON.parse(run1.jsonContent);
    const json2 = JSON.parse(run2.jsonContent);

    // Compare findings count
    if (json1.summary?.totalFindings !== json2.summary?.totalFindings) {
      differences.push(
        `Finding count differs: run${run1.runNumber}=${json1.summary?.totalFindings}, run${run2.runNumber}=${json2.summary?.totalFindings}`
      );
    }

    // Compare fingerprints
    const fp1 = new Set((json1.findings || []).map((f: Finding) => f.fingerprint));
    const fp2 = new Set((json2.findings || []).map((f: Finding) => f.fingerprint));

    const onlyIn1 = [...fp1].filter((fp) => !fp2.has(fp));
    const onlyIn2 = [...fp2].filter((fp) => !fp1.has(fp));

    if (onlyIn1.length > 0) {
      differences.push(`Fingerprints only in run${run1.runNumber}: ${onlyIn1.slice(0, 3).join(", ")}${onlyIn1.length > 3 ? "..." : ""}`);
    }
    if (onlyIn2.length > 0) {
      differences.push(`Fingerprints only in run${run2.runNumber}: ${onlyIn2.slice(0, 3).join(", ")}${onlyIn2.length > 3 ? "..." : ""}`);
    }

    // Compare routes
    const routes1 = json1.routeMap?.routes?.length ?? 0;
    const routes2 = json2.routeMap?.routes?.length ?? 0;
    if (routes1 !== routes2) {
      differences.push(`Route count differs: run${run1.runNumber}=${routes1}, run${run2.runNumber}=${routes2}`);
    }
  }

  if (run1.sarifHash && run2.sarifHash) {
    sarifMatch = run1.sarifHash === run2.sarifHash;
    if (!sarifMatch) {
      differences.push("SARIF output differs between runs");
    }
  }

  return { jsonMatch, sarifMatch, differences };
}

/**
 * Generate certificate report
 */
function generateCertificate(
  targetDir: string,
  results: RunResult[],
  comparisons: ComparisonResult[]
): DeterminismCertificate {
  const allJsonMatch = comparisons.every((c) => c.jsonMatch);
  const allSarifMatch = comparisons.every((c) => c.sarifMatch);
  const allDifferences = comparisons.flatMap((c) => c.differences);

  return {
    certified: allJsonMatch && allSarifMatch,
    timestamp: new Date().toISOString(),
    targetPath: targetDir,
    targetPathHash: hashPath(targetDir),
    runs: results.length,
    cliVersion: CLI_VERSION,
    artifactVersion: ARTIFACT_VERSION,
    totalFindings: results[0]?.artifact.summary.totalFindings ?? 0,
    jsonHashes: results.map((r) => r.jsonHash),
    sarifHashes: results[0]?.sarifHash ? results.map((r) => r.sarifHash!) : undefined,
    comparisonDetails: {
      allJsonMatch,
      allSarifMatch,
      differences: allDifferences,
    },
    runDurations: results.map((r) => r.durationMs),
  };
}

/**
 * Print certificate report to console
 */
function printCertificate(cert: DeterminismCertificate, verbose: boolean): void {
  const green = "\x1b[32m";
  const red = "\x1b[31m";
  const yellow = "\x1b[33m";
  const cyan = "\x1b[36m";
  const reset = "\x1b[0m";
  const bold = "\x1b[1m";

  console.log("\n" + "═".repeat(70));
  console.log(`${bold}DETERMINISM VERIFICATION REPORT${reset}`);
  console.log("═".repeat(70));

  console.log(`\n${cyan}Target:${reset} ${cert.targetPath}`);
  console.log(`${cyan}Runs:${reset} ${cert.runs}`);
  console.log(`${cyan}CLI Version:${reset} ${cert.cliVersion}`);
  console.log(`${cyan}Total Findings:${reset} ${cert.totalFindings}`);

  console.log(`\n${bold}Run Durations:${reset}`);
  for (let i = 0; i < cert.runDurations.length; i++) {
    console.log(`  Run ${i + 1}: ${cert.runDurations[i]}ms`);
  }
  const avgDuration = Math.round(cert.runDurations.reduce((a, b) => a + b, 0) / cert.runDurations.length);
  console.log(`  Average: ${avgDuration}ms`);

  console.log(`\n${bold}JSON Output Hashes:${reset}`);
  for (let i = 0; i < cert.jsonHashes.length; i++) {
    const hash = cert.jsonHashes[i];
    const match = i === 0 || hash === cert.jsonHashes[0];
    const icon = match ? `${green}✓${reset}` : `${red}✗${reset}`;
    console.log(`  Run ${i + 1}: ${hash.slice(0, 16)}... ${icon}`);
  }

  if (cert.sarifHashes) {
    console.log(`\n${bold}SARIF Output Hashes:${reset}`);
    for (let i = 0; i < cert.sarifHashes.length; i++) {
      const hash = cert.sarifHashes[i];
      const match = i === 0 || hash === cert.sarifHashes[0];
      const icon = match ? `${green}✓${reset}` : `${red}✗${reset}`;
      console.log(`  Run ${i + 1}: ${hash.slice(0, 16)}... ${icon}`);
    }
  }

  if (cert.comparisonDetails.differences.length > 0 && verbose) {
    console.log(`\n${bold}${yellow}Differences Detected:${reset}`);
    for (const diff of cert.comparisonDetails.differences) {
      console.log(`  ${red}•${reset} ${diff}`);
    }
  }

  console.log("\n" + "─".repeat(70));
  if (cert.certified) {
    console.log(`${bold}${green}✓ DETERMINISM CERTIFIED${reset}`);
    console.log(`${green}All ${cert.runs} runs produced identical output.${reset}`);
  } else {
    console.log(`${bold}${red}✗ DETERMINISM VERIFICATION FAILED${reset}`);
    console.log(`${red}Output differs between runs. See differences above.${reset}`);
  }
  console.log("─".repeat(70) + "\n");
}

/**
 * Execute verify-determinism command
 */
export async function executeVerifyDeterminism(
  targetDir: string,
  options: VerifyDeterminismOptions
): Promise<number> {
  const absoluteTarget = resolvePath(targetDir);
  const { runs, sarif, out, verbose } = options;

  if (runs < 2) {
    console.error("\x1b[31mError: --runs must be at least 2\x1b[0m");
    return 1;
  }

  console.log(`\n\x1b[36m\x1b[1mVibeCheck Determinism Verification\x1b[0m`);
  console.log(`\x1b[90mTarget: ${absoluteTarget}\x1b[0m`);
  console.log(`\x1b[90mRuns: ${runs}${sarif ? " (including SARIF)" : ""}\x1b[0m\n`);

  const results: RunResult[] = [];

  // Run scans
  for (let i = 1; i <= runs; i++) {
    const spinner = new Spinner(`Running scan ${i}/${runs}`);
    spinner.start();

    try {
      const result = await runScan(absoluteTarget, i, sarif);
      results.push(result);
      spinner.succeed(`Run ${i}/${runs} complete (${result.durationMs}ms, ${result.artifact.summary.totalFindings} findings)`);
    } catch (error) {
      spinner.fail(`Run ${i}/${runs} failed: ${error instanceof Error ? error.message : String(error)}`);
      return 1;
    }
  }

  // Compare results
  const spinner = new Spinner("Comparing outputs");
  spinner.start();

  const comparisons: ComparisonResult[] = [];
  for (let i = 1; i < results.length; i++) {
    const comparison = compareRuns(results[0], results[i]);
    comparisons.push(comparison);
  }

  spinner.succeed("Comparison complete");

  // Generate certificate
  const certificate = generateCertificate(absoluteTarget, results, comparisons);

  // Print report
  printCertificate(certificate, verbose);

  // Write certificate if output specified
  if (out) {
    const outPath = resolvePath(out);
    ensureDir(path.dirname(outPath));
    const certPath = outPath.endsWith(".json") ? outPath : path.join(outPath, "determinism-cert.json");
    writeFileSync(certPath, JSON.stringify(certificate, null, 2));
    console.log(`Certificate written to: ${certPath}\n`);
  }

  return certificate.certified ? 0 : 1;
}

/**
 * Register verify-determinism command with commander
 */
export function registerVerifyDeterminismCommand(program: Command): void {
  program
    .command("verify-determinism [target]")
    .description("Verify scan output is deterministic across multiple runs")
    .option(
      "-n, --runs <number>",
      "Number of runs to perform",
      (v) => parseInt(v, 10),
      3
    )
    .option("--sarif", "Include SARIF output in verification")
    .option("-o, --out <path>", "Output path for certificate JSON")
    .option("-v, --verbose", "Show detailed differences")
    .addHelpText(
      "after",
      `
Examples:
  $ vibecheck verify-determinism                     Verify current directory with 3 runs
  $ vibecheck verify-determinism ./my-app            Verify specific directory
  $ vibecheck verify-determinism --runs 5            Run 5 verification passes
  $ vibecheck verify-determinism --sarif             Include SARIF in verification
  $ vibecheck verify-determinism -o ./cert.json      Write certificate to file
  $ vibecheck verify-determinism -v                  Show detailed differences on failure

What it does:
  1. Runs the scanner N times on the target directory
  2. Normalizes output (removes timestamps, sorts arrays)
  3. Computes SHA-256 hash of each output
  4. Compares hashes to verify determinism
  5. Generates a certification report
  6. Exits 0 if deterministic, 1 if not
`
    )
    .action(async (positionalTarget: string | undefined, cmdOptions: Record<string, unknown>) => {
      const targetDir = positionalTarget ?? process.cwd();

      const options: VerifyDeterminismOptions = {
        runs: cmdOptions.runs as number,
        sarif: Boolean(cmdOptions.sarif),
        out: cmdOptions.out as string | undefined,
        verbose: Boolean(cmdOptions.verbose),
      };

      const exitCode = await executeVerifyDeterminism(targetDir, options);
      process.exit(exitCode);
    });
}
