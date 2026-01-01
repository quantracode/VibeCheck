/**
 * Intent Command
 *
 * Generates a security intent map baseline for the codebase.
 * Useful for tracking drift over time.
 */

import path from "node:path";
import type { Command } from "commander";
import { ARTIFACT_VERSION } from "@vibecheck/schema";
import { writeFileSync, resolvePath } from "../utils/file-utils.js";
import { hashPath } from "../utils/fingerprint.js";
import { getGitInfo, getRepoName } from "../utils/git-info.js";
import { buildScanContext } from "../scanners/index.js";
import {
  buildRouteMap,
  buildMiddlewareMap,
  buildAllProofTraces,
  calculateCoverage,
  mineAllIntentClaims,
} from "../phase3/index.js";
import type {
  RouteInfo,
  MiddlewareInfo,
  IntentClaim,
  ProofTrace,
  CoverageMetrics,
} from "../scanners/types.js";

export interface IntentOptions {
  out: string;
  format: string;
  repoName?: string;
}

interface IntentMapArtifact {
  artifactVersion: string;
  generatedAt: string;
  tool: {
    name: string;
    version: string;
  };
  repo: {
    name: string;
    rootPathHash: string;
    git?: {
      branch?: string;
      commit?: string;
      remoteUrl?: string;
      isDirty?: boolean;
    };
  };
  routeMap: { routes: RouteInfo[] };
  middlewareMap: {
    middlewareFile?: string;
    matcher: string[];
    coverage: Array<{ routeId: string; covered: boolean; reason?: string }>;
  };
  intentMap: { intents: IntentClaim[] };
  proofTraces: Record<string, { summary: string; nodes: Array<{ kind: string; label: string; file?: string; line?: number }> }>;
  coverage: CoverageMetrics;
  summary: {
    totalRoutes: number;
    totalIntents: number;
    authCoveragePercent: number;
    validationCoveragePercent: number;
    middlewareCoveragePercent: number;
    intentsByType: Record<string, number>;
    intentsBySource: Record<string, number>;
  };
}

/**
 * Execute the intent command
 */
export async function executeIntent(
  targetDir: string,
  options: IntentOptions
): Promise<number> {
  const absoluteTarget = resolvePath(targetDir);

  console.log(`Mining intent map: ${absoluteTarget}`);
  const startTime = Date.now();

  // Build scan context
  console.log("Building scan context...");
  const context = await buildScanContext(absoluteTarget);

  console.log(`Found ${context.fileIndex.allSourceFiles.length} source files`);

  // Build Phase 3 maps
  console.log("\nBuilding route map...");
  const routeMap = buildRouteMap(context);
  console.log(`  Found ${routeMap.length} routes`);

  console.log("Building middleware map...");
  const middlewareMap = buildMiddlewareMap(context);
  console.log(`  Found ${middlewareMap.length} middleware configurations`);

  console.log("Mining intent claims...");
  const intentMap = mineAllIntentClaims(context, routeMap);
  console.log(`  Found ${intentMap.length} intent claims`);

  console.log("Building proof traces...");
  const proofTraces = buildAllProofTraces(context, routeMap);
  console.log(`  Built ${proofTraces.size} proof traces`);

  console.log("Calculating coverage...");
  const coverage = calculateCoverage(routeMap, proofTraces, middlewareMap);

  const endTime = Date.now();
  console.log(`\nCompleted in ${endTime - startTime}ms`);

  // Create artifact
  const artifact = createIntentArtifact(
    routeMap,
    middlewareMap,
    intentMap,
    proofTraces,
    coverage,
    absoluteTarget,
    options.repoName
  );

  // Determine output path
  let outputPath = options.out;
  if (!path.isAbsolute(outputPath)) {
    outputPath = resolvePath(absoluteTarget, outputPath);
  }

  // Write artifact
  if (options.format === "json") {
    writeFileSync(outputPath, JSON.stringify(artifact, null, 2));
    console.log(`\nIntent map written to: ${outputPath}`);
  }

  // Print summary
  printIntentSummary(artifact);

  return 0;
}

/**
 * Create intent map artifact
 */
function createIntentArtifact(
  routeMap: RouteInfo[],
  middlewareMap: MiddlewareInfo[],
  intentMap: IntentClaim[],
  proofTraces: Map<string, ProofTrace>,
  coverage: CoverageMetrics,
  targetDir: string,
  repoName?: string
): IntentMapArtifact {
  const gitInfo = getGitInfo(targetDir);
  const name = repoName ?? getRepoName(targetDir);

  // Convert proofTraces Map to schema format
  const proofTracesRecord: IntentMapArtifact["proofTraces"] = {};
  for (const [key, value] of proofTraces) {
    proofTracesRecord[key] = {
      summary: value.authProven
        ? "Auth proven"
        : value.middlewareCovered
        ? "Protected by middleware"
        : "No protection proven",
      nodes: value.steps.map((step) => ({
        kind: "handler",
        label: step.label,
        file: step.file,
        line: step.line,
      })),
    };
  }

  // Build middleware coverage
  const allMatchers = middlewareMap.flatMap((m) => m.matchers);
  const middlewareCoverage = routeMap.map((route) => {
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

  // Calculate summary stats
  const intentsByType: Record<string, number> = {};
  const intentsBySource: Record<string, number> = {};

  for (const intent of intentMap) {
    intentsByType[intent.type] = (intentsByType[intent.type] || 0) + 1;
    intentsBySource[intent.source] = (intentsBySource[intent.source] || 0) + 1;
  }

  return {
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
    routeMap: { routes: routeMap },
    middlewareMap: {
      middlewareFile: middlewareMap[0]?.file,
      matcher: allMatchers,
      coverage: middlewareCoverage,
    },
    intentMap: { intents: intentMap },
    proofTraces: proofTracesRecord,
    coverage,
    summary: {
      totalRoutes: routeMap.length,
      totalIntents: intentMap.length,
      authCoveragePercent: Math.round(coverage.authCoverage * 100),
      validationCoveragePercent: Math.round(coverage.validationCoverage * 100),
      middlewareCoveragePercent: Math.round(coverage.middlewareCoverage * 100),
      intentsByType,
      intentsBySource,
    },
  };
}

/**
 * Print intent map summary
 */
function printIntentSummary(artifact: IntentMapArtifact): void {
  const { summary, coverage } = artifact;

  console.log("\n" + "=".repeat(60));
  console.log("VibeCheck Intent Map Generated");
  console.log("=".repeat(60));

  console.log(`\nRoutes discovered: ${summary.totalRoutes}`);
  console.log(`Intent claims found: ${summary.totalIntents}`);

  console.log("\nCoverage metrics:");
  console.log(`  Auth coverage: ${formatPercent(coverage.authCoverage)}`);
  console.log(`  Validation coverage: ${formatPercent(coverage.validationCoverage)}`);
  console.log(`  Middleware coverage: ${formatPercent(coverage.middlewareCoverage)}`);

  if (summary.totalIntents > 0) {
    console.log("\nIntents by type:");
    for (const [type, count] of Object.entries(summary.intentsByType)) {
      console.log(`  ${type}: ${count}`);
    }

    console.log("\nIntents by source:");
    for (const [source, count] of Object.entries(summary.intentsBySource)) {
      console.log(`  ${source}: ${count}`);
    }
  }

  console.log("");
}

/**
 * Format percentage with color
 */
function formatPercent(value: number): string {
  const percent = Math.round(value * 100);
  let color = "\x1b[32m"; // Green

  if (percent < 50) {
    color = "\x1b[31m"; // Red
  } else if (percent < 80) {
    color = "\x1b[33m"; // Yellow
  }

  return `${color}${percent}%\x1b[0m`;
}

/**
 * Register intent command with commander
 */
export function registerIntentCommand(program: Command): void {
  program
    .command("intent [target]")
    .description("Generate security intent map baseline")
    .option(
      "-o, --out <path>",
      "Output file path",
      "vibecheck-artifacts/intent-map.json"
    )
    .option("-f, --format <format>", "Output format", "json")
    .option("--repo-name <name>", "Override repository name")
    .action(async (target: string | undefined, options: IntentOptions) => {
      const targetDir = target ?? process.cwd();
      const exitCode = await executeIntent(targetDir, options);
      process.exit(exitCode);
    });
}
