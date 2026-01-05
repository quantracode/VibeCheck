import path from "node:path";
import type { Command } from "commander";
import { validateArtifact, type ScanArtifact } from "@vibecheck/schema";
import { readFileSync, writeFileSync, ensureDir, resolvePath } from "../utils/file-utils.js";

/**
 * Badge command options
 */
export interface BadgeOptions {
  /** Input artifact file */
  artifact: string;
  /** Output directory for badges */
  out: string;
  /** Badge style: flat, flat-square */
  style: "flat" | "flat-square";
}

/**
 * Badge color based on status/value
 */
type BadgeColor = "brightgreen" | "green" | "yellow" | "orange" | "red" | "blue" | "gray";

/**
 * Badge data for SVG generation
 */
interface BadgeData {
  label: string;
  message: string;
  color: BadgeColor;
  filename: string;
}

/**
 * Color hex values
 */
const COLORS: Record<BadgeColor, string> = {
  brightgreen: "#4c1",
  green: "#97ca00",
  yellow: "#dfb317",
  orange: "#fe7d37",
  red: "#e05d44",
  blue: "#007ec6",
  gray: "#555",
};

/**
 * Calculate text width (approximate)
 * Uses character-based estimation for deterministic output
 */
function textWidth(text: string): number {
  // Character width estimation for common fonts
  // Narrow chars: 1, i, l, t, f, j
  // Wide chars: M, W, m, w
  // Average: 6.5px per char at 11px font
  let width = 0;
  for (const char of text) {
    if ("1iltfj".includes(char)) {
      width += 4;
    } else if ("MWmw".includes(char)) {
      width += 9;
    } else if ("ABCDEFGHIJKLNOPQRSTUVXYZ".includes(char)) {
      width += 7;
    } else {
      width += 6;
    }
  }
  return width;
}

/**
 * Generate SVG badge content
 * Deterministic output with stable ordering
 */
function generateSvgBadge(data: BadgeData, style: "flat" | "flat-square"): string {
  const { label, message, color } = data;

  const labelWidth = textWidth(label) + 10;
  const messageWidth = textWidth(message) + 10;
  const totalWidth = labelWidth + messageWidth;
  const height = 20;

  const labelX = labelWidth / 2;
  const messageX = labelWidth + messageWidth / 2;

  const colorHex = COLORS[color];
  const labelColor = "#555";

  // Deterministic border radius based on style
  const radius = style === "flat" ? 3 : 0;

  // Build SVG with stable attribute ordering
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}" role="img" aria-label="${label}: ${message}">
  <title>${label}: ${message}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="${height}" rx="${radius}" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="${height}" fill="${labelColor}"/>
    <rect x="${labelWidth}" width="${messageWidth}" height="${height}" fill="${colorHex}"/>
    <rect width="${totalWidth}" height="${height}" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text x="${labelX}" y="14" fill="#010101" fill-opacity=".3">${escapeXml(label)}</text>
    <text x="${labelX}" y="13" fill="#fff">${escapeXml(label)}</text>
    <text x="${messageX}" y="14" fill="#010101" fill-opacity=".3">${escapeXml(message)}</text>
    <text x="${messageX}" y="13" fill="#fff">${escapeXml(message)}</text>
  </g>
</svg>`;

  return svg;
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Generate scan status badge (PASS/FAIL)
 */
function generateScanStatusBadge(artifact: ScanArtifact): BadgeData {
  const { summary } = artifact;
  const hasCritical = summary.bySeverity.critical > 0;
  const hasHigh = summary.bySeverity.high > 0;

  let message: string;
  let color: BadgeColor;

  if (hasCritical) {
    message = "CRITICAL";
    color = "red";
  } else if (hasHigh) {
    message = "HIGH";
    color = "orange";
  } else if (summary.totalFindings > 0) {
    message = "PASS";
    color = "yellow";
  } else {
    message = "PASS";
    color = "brightgreen";
  }

  return {
    label: "vibecheck",
    message,
    color,
    filename: "vibecheck-status.svg",
  };
}

/**
 * Generate findings count badge
 */
function generateFindingsCountBadge(artifact: ScanArtifact): BadgeData {
  const { summary } = artifact;
  const count = summary.totalFindings;

  let color: BadgeColor;
  if (count === 0) {
    color = "brightgreen";
  } else if (summary.bySeverity.critical > 0) {
    color = "red";
  } else if (summary.bySeverity.high > 0) {
    color = "orange";
  } else if (summary.bySeverity.medium > 0) {
    color = "yellow";
  } else {
    color = "green";
  }

  return {
    label: "findings",
    message: count.toString(),
    color,
    filename: "vibecheck-findings.svg",
  };
}

/**
 * Generate coverage badge
 */
function generateCoverageBadge(artifact: ScanArtifact): BadgeData | null {
  const metrics = artifact.metrics;
  if (!metrics?.authCoverage) {
    return null;
  }

  const { totalStateChanging, protectedCount } = metrics.authCoverage;
  if (totalStateChanging === 0) {
    return null;
  }

  const percentage = Math.round((protectedCount / totalStateChanging) * 100);

  let color: BadgeColor;
  if (percentage >= 90) {
    color = "brightgreen";
  } else if (percentage >= 70) {
    color = "green";
  } else if (percentage >= 50) {
    color = "yellow";
  } else if (percentage >= 30) {
    color = "orange";
  } else {
    color = "red";
  }

  return {
    label: "auth coverage",
    message: `${percentage}%`,
    color,
    filename: "vibecheck-coverage.svg",
  };
}

/**
 * Generate severity breakdown badge
 */
function generateSeverityBadge(artifact: ScanArtifact): BadgeData {
  const { summary } = artifact;
  const parts: string[] = [];

  if (summary.bySeverity.critical > 0) {
    parts.push(`${summary.bySeverity.critical}C`);
  }
  if (summary.bySeverity.high > 0) {
    parts.push(`${summary.bySeverity.high}H`);
  }
  if (summary.bySeverity.medium > 0) {
    parts.push(`${summary.bySeverity.medium}M`);
  }
  if (summary.bySeverity.low > 0) {
    parts.push(`${summary.bySeverity.low}L`);
  }

  const message = parts.length > 0 ? parts.join(" ") : "clean";

  let color: BadgeColor;
  if (summary.bySeverity.critical > 0) {
    color = "red";
  } else if (summary.bySeverity.high > 0) {
    color = "orange";
  } else if (summary.bySeverity.medium > 0) {
    color = "yellow";
  } else if (summary.bySeverity.low > 0) {
    color = "green";
  } else {
    color = "brightgreen";
  }

  return {
    label: "severity",
    message,
    color,
    filename: "vibecheck-severity.svg",
  };
}

/**
 * Generate score badge
 */
function generateScoreBadge(artifact: ScanArtifact): BadgeData {
  const { summary } = artifact;

  // Score calculation: 100 - (critical*25 + high*10 + medium*3 + low*1)
  const score = Math.max(
    0,
    100 -
      (summary.bySeverity.critical * 25 +
        summary.bySeverity.high * 10 +
        summary.bySeverity.medium * 3 +
        summary.bySeverity.low * 1)
  );

  let color: BadgeColor;
  if (score >= 90) {
    color = "brightgreen";
  } else if (score >= 70) {
    color = "green";
  } else if (score >= 50) {
    color = "yellow";
  } else if (score >= 30) {
    color = "orange";
  } else {
    color = "red";
  }

  return {
    label: "security score",
    message: `${score}/100`,
    color,
    filename: "vibecheck-score.svg",
  };
}

/**
 * Execute badge command
 */
export async function executeBadge(options: BadgeOptions): Promise<number> {
  const { artifact: artifactPath, out, style } = options;

  // Read and validate artifact
  const absoluteArtifactPath = resolvePath(artifactPath);
  const content = readFileSync(absoluteArtifactPath);

  if (!content) {
    console.error(`\x1b[31mError: Cannot read artifact file: ${absoluteArtifactPath}\x1b[0m`);
    return 1;
  }

  let artifact: ScanArtifact;
  try {
    const json = JSON.parse(content);
    artifact = validateArtifact(json);
  } catch (error) {
    console.error(`\x1b[31mError: Invalid artifact file: ${error instanceof Error ? error.message : String(error)}\x1b[0m`);
    return 1;
  }

  // Ensure output directory exists
  const absoluteOutPath = resolvePath(out);
  ensureDir(absoluteOutPath);

  console.log(`\n\x1b[36m\x1b[1mVibeCheck Badge Generator\x1b[0m`);
  console.log(`\x1b[90mArtifact: ${absoluteArtifactPath}\x1b[0m`);
  console.log(`\x1b[90mOutput: ${absoluteOutPath}\x1b[0m\n`);

  // Generate badges
  const badges: BadgeData[] = [
    generateScanStatusBadge(artifact),
    generateFindingsCountBadge(artifact),
    generateSeverityBadge(artifact),
    generateScoreBadge(artifact),
  ];

  // Add coverage badge if available
  const coverageBadge = generateCoverageBadge(artifact);
  if (coverageBadge) {
    badges.push(coverageBadge);
  }

  // Write badge files
  const writtenFiles: string[] = [];
  for (const badge of badges) {
    const svg = generateSvgBadge(badge, style);
    const filePath = path.join(absoluteOutPath, badge.filename);
    writeFileSync(filePath, svg);
    writtenFiles.push(filePath);
    console.log(`  \x1b[32m✓\x1b[0m ${badge.filename} (${badge.label}: ${badge.message})`);
  }

  console.log(`\n\x1b[32m${writtenFiles.length} badges generated\x1b[0m\n`);

  // Print usage hint
  console.log(`\x1b[90mUsage in README.md:\x1b[0m`);
  console.log(`  ![VibeCheck Status](${path.basename(absoluteOutPath)}/vibecheck-status.svg)`);
  console.log(`  ![VibeCheck Score](${path.basename(absoluteOutPath)}/vibecheck-score.svg)\n`);

  return 0;
}

/**
 * Register badge command with commander
 */
export function registerBadgeCommand(program: Command): void {
  program
    .command("badge")
    .description("Generate static SVG badges from scan artifact")
    .requiredOption("-a, --artifact <file>", "Input artifact JSON file")
    .option("-o, --out <dir>", "Output directory for badges", "./badges")
    .option("--style <style>", "Badge style: flat, flat-square", "flat")
    .addHelpText(
      "after",
      `
Examples:
  $ vibecheck badge --artifact scan.json               Generate badges in ./badges
  $ vibecheck badge -a scan.json -o ./docs/badges      Custom output directory
  $ vibecheck badge -a scan.json --style flat-square   Flat-square style

Generated badges:
  vibecheck-status.svg   - PASS/FAIL status based on critical/high findings
  vibecheck-findings.svg - Total findings count
  vibecheck-severity.svg - Severity breakdown (e.g., "2C 5H 10M")
  vibecheck-score.svg    - Security score (0-100)
  vibecheck-coverage.svg - Auth coverage percentage (if available)

Usage in README:
  ![VibeCheck Status](./badges/vibecheck-status.svg)
  ![Security Score](./badges/vibecheck-score.svg)
`
    )
    .action(async (cmdOptions: Record<string, unknown>) => {
      const options: BadgeOptions = {
        artifact: cmdOptions.artifact as string,
        out: cmdOptions.out as string,
        style: (cmdOptions.style as "flat" | "flat-square") ?? "flat",
      };

      const exitCode = await executeBadge(options);
      process.exit(exitCode);
    });
}
