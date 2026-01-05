#!/usr/bin/env node
/**
 * Smoke test for the vibecheck CLI
 *
 * This script validates that the built CLI works correctly by:
 * 1. Building the CLI (if needed)
 * 2. Running a scan with --fail-on off
 * 3. Verifying the output file exists and conforms to the schema
 * 4. Optionally verifying npm pack produces a valid tarball
 */

import { execSync, spawn } from "node:child_process";
import { existsSync, unlinkSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_ROOT = join(__dirname, "..");
const OUTPUT_FILE = join(CLI_ROOT, "smoke-scan.json");

// ANSI color codes
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

function log(message, color = RESET) {
  console.log(`${color}${message}${RESET}`);
}

function logStep(step, message) {
  console.log(`${CYAN}[${step}]${RESET} ${message}`);
}

function logSuccess(message) {
  console.log(`${GREEN}✓${RESET} ${message}`);
}

function logError(message) {
  console.log(`${RED}✗${RESET} ${message}`);
}

async function cleanup() {
  // Clean up output file if it exists
  if (existsSync(OUTPUT_FILE)) {
    unlinkSync(OUTPUT_FILE);
  }
  // Clean up any tarballs
  const tarballs = execSync("ls -1 *.tgz 2>/dev/null || true", {
    cwd: CLI_ROOT,
    encoding: "utf-8"
  }).trim().split("\n").filter(Boolean);
  for (const tarball of tarballs) {
    unlinkSync(join(CLI_ROOT, tarball));
  }
}

async function build() {
  logStep("1/4", "Building CLI...");
  try {
    execSync("pnpm run build", { cwd: CLI_ROOT, stdio: "inherit" });
    logSuccess("Build completed");
    return true;
  } catch (error) {
    logError("Build failed");
    return false;
  }
}

async function runScan() {
  logStep("2/4", "Running scan...");

  return new Promise((resolve) => {
    const args = [
      join(CLI_ROOT, "dist", "index.js"),
      "scan",
      "--fail-on", "off",
      "--out", OUTPUT_FILE,
      "--no-emit-traces",  // Faster for smoke test
    ];

    const child = spawn("node", args, {
      cwd: CLI_ROOT,
      stdio: "inherit",
    });

    child.on("close", (code) => {
      if (code === 0) {
        logSuccess("Scan completed with exit code 0");
        resolve(true);
      } else {
        logError(`Scan exited with code ${code}`);
        resolve(false);
      }
    });

    child.on("error", (error) => {
      logError(`Scan failed: ${error.message}`);
      resolve(false);
    });
  });
}

async function validateOutput() {
  logStep("3/4", "Validating output...");

  // Check file exists
  if (!existsSync(OUTPUT_FILE)) {
    logError(`Output file not found: ${OUTPUT_FILE}`);
    return false;
  }
  logSuccess("Output file exists");

  // Parse JSON
  let artifact;
  try {
    const content = readFileSync(OUTPUT_FILE, "utf-8");
    artifact = JSON.parse(content);
  } catch (error) {
    logError(`Failed to parse output: ${error.message}`);
    return false;
  }
  logSuccess("Output is valid JSON");

  // Validate schema structure
  const requiredFields = [
    "artifactVersion",
    "generatedAt",
    "tool",
    "repo",
    "summary",
    "findings",
  ];

  for (const field of requiredFields) {
    if (!(field in artifact)) {
      logError(`Missing required field: ${field}`);
      return false;
    }
  }
  logSuccess("All required fields present");

  // Validate tool info
  if (artifact.tool?.name !== "vibecheck") {
    logError(`Unexpected tool name: ${artifact.tool?.name}`);
    return false;
  }
  logSuccess("Tool info correct");

  // Validate summary structure
  const summaryFields = ["totalFindings", "bySeverity", "byCategory"];
  for (const field of summaryFields) {
    if (!(field in artifact.summary)) {
      logError(`Missing summary field: ${field}`);
      return false;
    }
  }
  logSuccess("Summary structure valid");

  // Log some stats
  log(`\n  Findings: ${artifact.summary.totalFindings}`, CYAN);
  log(`  Files scanned: ${artifact.metrics?.filesScanned ?? "N/A"}`, CYAN);
  log(`  Duration: ${artifact.metrics?.scanDurationMs ?? "N/A"}ms`, CYAN);

  return true;
}

async function verifyPack() {
  logStep("4/4", "Verifying npm pack (optional)...");

  try {
    // Run npm pack --dry-run to see what would be included
    const output = execSync("npm pack --dry-run 2>&1", {
      cwd: CLI_ROOT,
      encoding: "utf-8"
    });

    // Check that essential files are included
    const requiredInPack = [
      "dist/index.js",
      "README.md",
      "package.json",
    ];

    const missingFiles = requiredInPack.filter(f => !output.includes(f));
    if (missingFiles.length > 0) {
      logError(`Pack missing files: ${missingFiles.join(", ")}`);
      return false;
    }

    logSuccess("Pack includes all required files");

    // Show pack contents
    const lines = output.split("\n").filter(l => l.trim());
    log(`\n  Pack contents (${lines.length} items):`, CYAN);
    for (const line of lines.slice(0, 10)) {
      log(`    ${line}`, RESET);
    }
    if (lines.length > 10) {
      log(`    ... and ${lines.length - 10} more`, RESET);
    }

    return true;
  } catch (error) {
    log(`  Skipping pack verification: ${error.message}`, YELLOW);
    return true; // Don't fail on this
  }
}

async function main() {
  log(`\n${BOLD}VibeCheck CLI Smoke Test${RESET}\n`);
  log(`${"─".repeat(50)}\n`);

  await cleanup();

  const steps = [
    build,
    runScan,
    validateOutput,
    verifyPack,
  ];

  for (const step of steps) {
    const success = await step();
    if (!success) {
      log(`\n${RED}${BOLD}Smoke test FAILED${RESET}\n`);
      process.exit(1);
    }
    console.log("");
  }

  await cleanup();

  log(`${GREEN}${BOLD}Smoke test PASSED${RESET}\n`);
  log(`${"─".repeat(50)}`);
  log(`\nThe CLI is ready for publishing. Run:`);
  log(`  npm publish`, CYAN);
  log(`\nOr test locally with:`);
  log(`  npx . scan --fail-on off --out test-scan.json`, CYAN);
  log("");
}

main().catch((error) => {
  logError(`Unexpected error: ${error.message}`);
  process.exit(1);
});
