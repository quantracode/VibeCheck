/**
 * Terminal progress display - clean, minimal design
 */

import path from "node:path";

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  clearLine: "\x1b[2K",
};

// Progress bar characters
const BAR_FILLED = "█";
const BAR_EMPTY = "░";

interface PackInfo {
  id: string;
  name: string;
  scannerCount: number;
}

interface PackResult {
  findingsCount: number;
  scannersRun: number;
}

function createProgressBar(current: number, total: number, width: number = 20): string {
  const percent = total > 0 ? Math.min(current / total, 1) : 0;
  const filled = Math.min(Math.round(percent * width), width);
  const empty = Math.max(width - filled, 0);

  return (
    `${ANSI.cyan}${BAR_FILLED.repeat(filled)}${ANSI.reset}` +
    `${ANSI.dim}${BAR_EMPTY.repeat(empty)}${ANSI.reset}`
  );
}

function truncateEnd(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str.padEnd(maxLen);
  return str.slice(0, maxLen - 2) + "..";
}

export class ScanProgress {
  private packs: PackInfo[];
  private results: Map<number, PackResult> = new Map();
  private startTime: number = 0;
  private currentPack: number = -1;
  private totalFiles: number = 0;
  private currentFile: string = "";
  private filesProcessed: number = 0;

  constructor(packs: PackInfo[], totalFiles: number = 0) {
    this.packs = packs;
    this.totalFiles = totalFiles;
  }

  start(): void {
    this.startTime = Date.now();
    const width = 88;
    const filesStr = `${this.totalFiles} files`;
    const packsStr = `${this.packs.length} packs`;
    const padding = width - 14 - filesStr.length - packsStr.length;

    console.log("");
    console.log(`${ANSI.cyan}  ${"─".repeat(width)}${ANSI.reset}`);
    console.log(`${ANSI.cyan}  ${ANSI.reset}  ${ANSI.bold}SCANNING${ANSI.reset}  ${ANSI.dim}${filesStr}${ANSI.reset}${" ".repeat(Math.max(padding, 2))}${ANSI.dim}${packsStr}${ANSI.reset}`);
    console.log(`${ANSI.cyan}  ${"─".repeat(width)}${ANSI.reset}`);
    console.log("");
  }

  startPack(packIndex: number): void {
    this.currentPack = packIndex;
    this.results.set(packIndex, { findingsCount: 0, scannersRun: 0 });
    this.renderPackProgress();
  }

  startScanner(packIndex: number, _scannerIndex: number): void {
    this.renderPackProgress();
  }

  /** Called when a file is processed */
  onFileProgress(file: string, processed: number, _total: number): void {
    this.currentFile = file;
    this.filesProcessed = processed;
    this.renderPackProgress();
  }

  completeScanner(packIndex: number, findingsFound: number): void {
    const result = this.results.get(packIndex);
    if (result) {
      result.findingsCount += findingsFound;
      result.scannersRun++;
    }
    this.renderPackProgress();
  }

  private renderPackProgress(): void {
    const pack = this.packs[this.currentPack];
    const result = this.results.get(this.currentPack);

    // Pack number on the left
    const packNum = `[${String(this.currentPack + 1).padStart(2)}/${this.packs.length}]`;

    // Calculate progress based on files processed
    const filePercent = this.totalFiles > 0
      ? Math.min(Math.round((this.filesProcessed / this.totalFiles) * 100), 100)
      : 0;

    // Progress bar
    const progressBar = createProgressBar(this.filesProcessed, this.totalFiles, 20);

    // Current file or status
    const fileName = this.currentFile ? path.basename(this.currentFile) : "";
    const truncatedFile = truncateEnd(fileName, 28);
    const statusText = `${ANSI.dim}${truncatedFile}${ANSI.reset} ${ANSI.cyan}${String(filePercent).padStart(3)}%${ANSI.reset}`;

    // Pack name (fixed width)
    const packName = truncateEnd(pack.name, 32);

    // Clear line and write progress
    process.stdout.write(`\r${ANSI.clearLine}`);
    process.stdout.write(
      `  ${ANSI.cyan}●${ANSI.reset} ${ANSI.dim}${packNum}${ANSI.reset}  ${packName} ${progressBar}  ${statusText}`
    );
  }

  completePack(packIndex: number): void {
    const result = this.results.get(packIndex);
    const findings = result?.findingsCount ?? 0;
    const pack = this.packs[packIndex];

    // Pack number on the left
    const packNum = `[${String(packIndex + 1).padStart(2)}/${this.packs.length}]`;

    // Show full progress bar on completion
    const progressBar = createProgressBar(1, 1, 20);

    // Pack name (fixed width)
    const packName = truncateEnd(pack.name, 32);

    // Status text
    const statusIcon = findings > 0 ? `${ANSI.yellow}●${ANSI.reset}` : `${ANSI.green}●${ANSI.reset}`;
    const statusText = findings > 0
      ? `${ANSI.yellow}${String(findings).padStart(3)} found${ANSI.reset}`
      : `${ANSI.green}    clean${ANSI.reset}`;

    // Clear line and write final result
    process.stdout.write(`\r${ANSI.clearLine}`);
    console.log(
      `  ${statusIcon} ${ANSI.dim}${packNum}${ANSI.reset}  ${packName} ${progressBar}  ${statusText}`
    );
  }

  stop(): void {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    const totalFindings = Array.from(this.results.values()).reduce(
      (sum, r) => sum + r.findingsCount,
      0
    );

    const width = 88;
    const statusIcon = totalFindings > 0 ? `${ANSI.yellow}!${ANSI.reset}` : `${ANSI.green}✓${ANSI.reset}`;
    const findingsText = totalFindings > 0
      ? `${ANSI.yellow}${ANSI.bold}${totalFindings} finding${totalFindings > 1 ? "s" : ""}${ANSI.reset}`
      : `${ANSI.green}${ANSI.bold}No findings${ANSI.reset}`;

    const timeStr = `${elapsed}s`;
    const mainContent = `  ${statusIcon} COMPLETE  ${findingsText}`;
    // Account for ANSI codes in length calculation
    const visibleLen = totalFindings > 0
      ? 14 + totalFindings.toString().length + (totalFindings > 1 ? 8 : 7)
      : 23;
    const padding = width - visibleLen - timeStr.length - 2;

    console.log("");
    console.log(`${ANSI.cyan}  ${"─".repeat(width)}${ANSI.reset}`);
    console.log(`${ANSI.cyan}  ${ANSI.reset}${mainContent}${" ".repeat(Math.max(padding, 2))}${ANSI.dim}${timeStr}${ANSI.reset}`);
    console.log(`${ANSI.cyan}  ${"─".repeat(width)}${ANSI.reset}`);
  }
}

/**
 * Simple spinner for single operations
 */
export class Spinner {
  private message: string;
  private startTime: number = 0;

  constructor(message: string) {
    this.message = message;
  }

  start(): void {
    this.startTime = Date.now();
    process.stdout.write(`  ${ANSI.cyan}●${ANSI.reset} ${this.message}...`);
  }

  update(message: string): void {
    this.message = message;
  }

  succeed(message?: string): void {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    process.stdout.write(`\r${ANSI.clearLine}`);
    console.log(`  ${ANSI.green}●${ANSI.reset} ${message || this.message} ${ANSI.dim}(${elapsed}s)${ANSI.reset}`);
  }

  fail(message?: string): void {
    process.stdout.write(`\r${ANSI.clearLine}`);
    console.log(`  ${ANSI.red}●${ANSI.reset} ${message || this.message}`);
  }

  stop(): void {
    process.stdout.write(`\r${ANSI.clearLine}`);
  }
}
