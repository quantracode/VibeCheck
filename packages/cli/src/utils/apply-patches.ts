import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import type { Finding } from "@vibecheck/schema";
import readline from "node:readline";

/**
 * Result of applying a single patch
 */
export interface PatchResult {
  /** The finding ID */
  findingId: string;
  /** The file that was patched */
  file: string;
  /** Whether the patch was applied successfully */
  success: boolean;
  /** Error message if patch failed */
  error?: string;
  /** The patch that was applied */
  patch: string;
}

/**
 * Summary of all patch operations
 */
export interface PatchSummary {
  /** Total number of findings with patches */
  totalPatchable: number;
  /** Number of patches successfully applied */
  applied: number;
  /** Number of patches that failed */
  failed: number;
  /** Number of patches skipped (user declined) */
  skipped: number;
  /** Individual patch results */
  results: PatchResult[];
}

/**
 * Detect if a patch is in unified diff format
 */
function isUnifiedDiff(patch: string): boolean {
  const lines = patch.trim().split("\n");
  // Check for unified diff markers
  return lines.some(line =>
    line.startsWith("--- ") ||
    line.startsWith("+++ ") ||
    line.startsWith("@@ ")
  );
}

/**
 * Apply a unified diff patch to a file
 */
async function applyUnifiedDiff(
  filePath: string,
  patch: string,
  baseDir: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(baseDir, filePath);

    if (!existsSync(absolutePath)) {
      return {
        success: false,
        error: `File not found: ${filePath}`,
      };
    }

    const content = await readFile(absolutePath, "utf-8");
    const lines = content.split("\n");

    // Parse the unified diff
    const patchLines = patch.split("\n");
    let currentLine = 0;
    let inHunk = false;
    let hunkStartLine = 0;
    const newLines: string[] = [];

    for (const patchLine of patchLines) {
      // Skip file headers (---, +++)
      if (patchLine.startsWith("--- ") || patchLine.startsWith("+++ ")) {
        continue;
      }

      // Parse hunk header (@@ -start,count +start,count @@)
      if (patchLine.startsWith("@@ ")) {
        const match = patchLine.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
        if (match) {
          hunkStartLine = parseInt(match[1], 10) - 1; // Convert to 0-indexed

          // Add all lines before this hunk
          while (currentLine < hunkStartLine) {
            newLines.push(lines[currentLine]);
            currentLine++;
          }

          inHunk = true;
        }
        continue;
      }

      if (inHunk) {
        if (patchLine.startsWith("-")) {
          // Line removed - skip the current line in the original file
          currentLine++;
        } else if (patchLine.startsWith("+")) {
          // Line added - add to new content (without the +)
          newLines.push(patchLine.slice(1));
        } else if (patchLine.startsWith(" ")) {
          // Context line - verify it matches and keep it
          const contextLine = patchLine.slice(1);
          if (lines[currentLine] !== contextLine) {
            return {
              success: false,
              error: `Patch context mismatch at line ${currentLine + 1}. Expected: "${contextLine}", found: "${lines[currentLine]}"`,
            };
          }
          newLines.push(lines[currentLine]);
          currentLine++;
        }
      }
    }

    // Add remaining lines after the last hunk
    while (currentLine < lines.length) {
      newLines.push(lines[currentLine]);
      currentLine++;
    }

    // Write the patched content
    await writeFile(absolutePath, newLines.join("\n"), "utf-8");

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Prompt user for confirmation
 */
async function promptConfirmation(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Apply patches from findings
 */
export async function applyPatches(
  findings: Finding[],
  baseDir: string,
  options: {
    force?: boolean;
    dryRun?: boolean;
  } = {}
): Promise<PatchSummary> {
  const results: PatchResult[] = [];

  // Filter findings that have patches
  const patchableFindings = findings.filter(
    (f) => f.remediation?.patch && f.remediation.patch.trim().length > 0
  );

  if (patchableFindings.length === 0) {
    return {
      totalPatchable: 0,
      applied: 0,
      failed: 0,
      skipped: 0,
      results: [],
    };
  }

  console.log(`\nFound ${patchableFindings.length} finding(s) with patches.\n`);

  for (const finding of patchableFindings) {
    const patch = finding.remediation.patch!;

    // Determine the target file from evidence
    const firstEvidence = finding.evidence[0];
    if (!firstEvidence) {
      results.push({
        findingId: finding.id,
        file: "unknown",
        success: false,
        error: "No evidence found to determine target file",
        patch,
      });
      continue;
    }

    const targetFile = firstEvidence.file;

    // Check if patch is a unified diff
    if (!isUnifiedDiff(patch)) {
      results.push({
        findingId: finding.id,
        file: targetFile,
        success: false,
        error: "Patch is not in unified diff format. Only standard git-style diffs are supported.",
        patch,
      });
      continue;
    }

    // Show patch details
    console.log(`\x1b[36m[${finding.ruleId}]\x1b[0m ${finding.title}`);
    console.log(`  File: ${targetFile}`);
    console.log(`  Severity: \x1b[33m${finding.severity.toUpperCase()}\x1b[0m`);
    console.log(`  Description: ${finding.description.slice(0, 100)}${finding.description.length > 100 ? '...' : ''}`);
    console.log(`\n  Patch preview:`);

    // Show patch with syntax highlighting
    const patchLines = patch.split("\n").slice(0, 15); // Show first 15 lines
    for (const line of patchLines) {
      if (line.startsWith("+")) {
        console.log(`    \x1b[32m${line}\x1b[0m`);
      } else if (line.startsWith("-")) {
        console.log(`    \x1b[31m${line}\x1b[0m`);
      } else {
        console.log(`    ${line}`);
      }
    }
    if (patch.split("\n").length > 15) {
      console.log(`    \x1b[90m... (${patch.split("\n").length - 15} more lines)\x1b[0m`);
    }
    console.log("");

    // Dry run mode - just show what would be done
    if (options.dryRun) {
      console.log(`  \x1b[90m[DRY RUN] Would apply patch to ${targetFile}\x1b[0m\n`);
      results.push({
        findingId: finding.id,
        file: targetFile,
        success: true,
        patch,
      });
      continue;
    }

    // Confirmation prompt (unless --force)
    let shouldApply = options.force ?? false;
    if (!options.force) {
      shouldApply = await promptConfirmation("  Apply this patch?");
    }

    if (!shouldApply) {
      console.log(`  \x1b[90mSkipped\x1b[0m\n`);
      results.push({
        findingId: finding.id,
        file: targetFile,
        success: false,
        error: "User declined",
        patch,
      });
      continue;
    }

    // Apply the patch
    const result = await applyUnifiedDiff(targetFile, patch, baseDir);

    if (result.success) {
      console.log(`  \x1b[32m✓ Patch applied successfully\x1b[0m\n`);
      results.push({
        findingId: finding.id,
        file: targetFile,
        success: true,
        patch,
      });
    } else {
      console.log(`  \x1b[31m✗ Failed to apply patch: ${result.error}\x1b[0m\n`);
      results.push({
        findingId: finding.id,
        file: targetFile,
        success: false,
        error: result.error,
        patch,
      });
    }
  }

  const applied = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success && r.error !== "User declined").length;
  const skipped = results.filter((r) => r.error === "User declined").length;

  return {
    totalPatchable: patchableFindings.length,
    applied,
    failed,
    skipped,
    results,
  };
}

/**
 * Read and parse a scan artifact file
 */
export async function readArtifact(artifactPath: string): Promise<{ findings: Finding[] }> {
  try {
    const content = await readFile(artifactPath, "utf-8");
    const artifact = JSON.parse(content);

    if (!artifact.findings || !Array.isArray(artifact.findings)) {
      throw new Error("Invalid artifact format: missing or invalid findings array");
    }

    return artifact;
  } catch (error) {
    throw new Error(
      `Failed to read artifact: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
