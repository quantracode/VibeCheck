import path from "node:path";
import type { Command } from "commander";
import {
  readFileSync,
  fileExists,
  resolvePath,
  writeFileSync,
  ensureDir,
} from "../utils/file-utils.js";
import {
  createEmptyWaiversFile,
  createWaiver,
  addWaiver,
  removeWaiver,
  WaiversFileSchema,
  type WaiversFile,
  type Waiver,
} from "@vibecheck/policy";

const DEFAULT_WAIVERS_FILE = "vibecheck-waivers.json";

/**
 * Load waivers file from path
 */
function loadWaiversFile(filepath: string): WaiversFile {
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

  return result.data;
}

/**
 * Save waivers file to path
 */
function saveWaiversFile(filepath: string, file: WaiversFile): void {
  const absolutePath = resolvePath(filepath);
  ensureDir(path.dirname(absolutePath));
  writeFileSync(absolutePath, JSON.stringify(file, null, 2));
}

/**
 * Initialize a new waivers file
 */
export function executeWaiversInit(filepath: string, force: boolean): number {
  const absolutePath = resolvePath(filepath);

  if (fileExists(absolutePath) && !force) {
    console.error(`\x1b[31mError: Waivers file already exists: ${absolutePath}\x1b[0m`);
    console.error("Use --force to overwrite");
    return 1;
  }

  const emptyFile = createEmptyWaiversFile();
  saveWaiversFile(filepath, emptyFile);

  console.log(`Created waivers file: ${absolutePath}`);
  return 0;
}

/**
 * Add a waiver to the file
 */
export function executeWaiversAdd(
  filepath: string,
  options: {
    fingerprint?: string;
    ruleId?: string;
    pathPattern?: string;
    reason: string;
    createdBy: string;
    expiresAt?: string;
    ticketRef?: string;
  }
): number {
  // Validate options
  if (!options.fingerprint && !options.ruleId) {
    console.error("\x1b[31mError: Must specify either --fingerprint or --ruleId\x1b[0m");
    return 1;
  }

  if (options.fingerprint && options.ruleId) {
    console.error("\x1b[31mError: Cannot specify both --fingerprint and --ruleId\x1b[0m");
    return 1;
  }

  // Validate expiry date if provided
  if (options.expiresAt) {
    const date = new Date(options.expiresAt);
    if (isNaN(date.getTime())) {
      console.error(`\x1b[31mError: Invalid expiry date: ${options.expiresAt}\x1b[0m`);
      return 1;
    }
    if (date <= new Date()) {
      console.error("\x1b[31mError: Expiry date must be in the future\x1b[0m");
      return 1;
    }
  }

  // Load or create waivers file
  let file: WaiversFile;
  const absolutePath = resolvePath(filepath);

  if (fileExists(absolutePath)) {
    file = loadWaiversFile(filepath);
  } else {
    console.log("Creating new waivers file...");
    file = createEmptyWaiversFile();
  }

  // Create waiver
  const waiver = createWaiver({
    fingerprint: options.fingerprint,
    ruleId: options.ruleId,
    pathPattern: options.pathPattern,
    reason: options.reason,
    createdBy: options.createdBy,
    expiresAt: options.expiresAt ? new Date(options.expiresAt).toISOString() : undefined,
    ticketRef: options.ticketRef,
  });

  // Add to file
  const updated = addWaiver(file, waiver);
  saveWaiversFile(filepath, updated);

  console.log(`Added waiver: ${waiver.id}`);
  if (options.fingerprint) {
    console.log(`  Fingerprint: ${options.fingerprint}`);
  } else {
    console.log(`  Rule ID: ${options.ruleId}`);
    if (options.pathPattern) {
      console.log(`  Path pattern: ${options.pathPattern}`);
    }
  }
  console.log(`  Reason: ${options.reason}`);
  console.log(`  Created by: ${options.createdBy}`);
  if (options.expiresAt) {
    console.log(`  Expires: ${options.expiresAt}`);
  }
  if (options.ticketRef) {
    console.log(`  Ticket: ${options.ticketRef}`);
  }

  return 0;
}

/**
 * List waivers in the file
 */
export function executeWaiversList(filepath: string, verbose: boolean): number {
  const file = loadWaiversFile(filepath);

  if (file.waivers.length === 0) {
    console.log("No waivers in file");
    return 0;
  }

  console.log(`Found ${file.waivers.length} waiver(s):\n`);

  for (const waiver of file.waivers) {
    const isExpired = waiver.expiresAt && new Date(waiver.expiresAt) < new Date();
    const expiredNote = isExpired ? " \x1b[31m[EXPIRED]\x1b[0m" : "";

    console.log(`ID: ${waiver.id}${expiredNote}`);

    if (waiver.match.fingerprint) {
      console.log(`  Match: fingerprint = ${waiver.match.fingerprint}`);
    } else {
      console.log(`  Match: ruleId = ${waiver.match.ruleId}`);
      if (waiver.match.pathPattern) {
        console.log(`         pathPattern = ${waiver.match.pathPattern}`);
      }
    }

    console.log(`  Reason: ${waiver.reason}`);

    if (verbose) {
      console.log(`  Created by: ${waiver.createdBy}`);
      console.log(`  Created at: ${waiver.createdAt}`);
      if (waiver.expiresAt) {
        console.log(`  Expires at: ${waiver.expiresAt}`);
      }
      if (waiver.ticketRef) {
        console.log(`  Ticket: ${waiver.ticketRef}`);
      }
    }

    console.log("");
  }

  return 0;
}

/**
 * Remove a waiver from the file
 */
export function executeWaiversRemove(filepath: string, waiverId: string): number {
  const file = loadWaiversFile(filepath);

  // Check if waiver exists
  const exists = file.waivers.some((w) => w.id === waiverId);
  if (!exists) {
    console.error(`\x1b[31mError: Waiver not found: ${waiverId}\x1b[0m`);
    return 1;
  }

  const updated = removeWaiver(file, waiverId);
  saveWaiversFile(filepath, updated);

  console.log(`Removed waiver: ${waiverId}`);
  return 0;
}

/**
 * Register waivers command with subcommands
 */
export function registerWaiversCommand(program: Command): void {
  const waiversCmd = program
    .command("waivers")
    .description("Manage policy waivers");

  // waivers init
  waiversCmd
    .command("init [path]")
    .description("Initialize a new waivers file")
    .option("-f, --force", "Overwrite existing file")
    .action((pathArg: string | undefined, cmdOptions: Record<string, unknown>) => {
      const filepath = pathArg ?? DEFAULT_WAIVERS_FILE;
      const exitCode = executeWaiversInit(filepath, Boolean(cmdOptions.force));
      process.exit(exitCode);
    });

  // waivers add
  waiversCmd
    .command("add [path]")
    .description("Add a waiver to the file")
    .option("--fingerprint <sha256>", "Match by finding fingerprint")
    .option("--rule-id <id>", "Match by rule ID (supports wildcards like VC-AUTH-*)")
    .option("--path-pattern <glob>", "Additional path pattern for rule ID match")
    .requiredOption("-r, --reason <text>", "Justification for the waiver")
    .requiredOption("--created-by <email>", "Who is creating this waiver")
    .option("--expires <date>", "Expiration date (ISO format)")
    .option("--ticket <ref>", "Reference to ticket/issue")
    .addHelpText(
      "after",
      `
Examples:
  $ vibecheck waivers add --fingerprint sha256:abc123 -r "False positive" --created-by dev@example.com
  $ vibecheck waivers add --rule-id VC-AUTH-001 -r "Accepted risk" --created-by dev@example.com
  $ vibecheck waivers add --rule-id "VC-VAL-*" --path-pattern "src/legacy/**" -r "Legacy code" --created-by dev@example.com
  $ vibecheck waivers add --fingerprint sha256:xyz --expires 2025-12-31 -r "Temporary" --created-by dev@example.com
  $ vibecheck waivers add ./custom-waivers.json --fingerprint sha256:abc -r "Custom file" --created-by dev@example.com
`
    )
    .action((pathArg: string | undefined, cmdOptions: Record<string, unknown>) => {
      const filepath = pathArg ?? DEFAULT_WAIVERS_FILE;
      const exitCode = executeWaiversAdd(filepath, {
        fingerprint: cmdOptions.fingerprint as string | undefined,
        ruleId: cmdOptions.ruleId as string | undefined,
        pathPattern: cmdOptions.pathPattern as string | undefined,
        reason: cmdOptions.reason as string,
        createdBy: cmdOptions.createdBy as string,
        expiresAt: cmdOptions.expires as string | undefined,
        ticketRef: cmdOptions.ticket as string | undefined,
      });
      process.exit(exitCode);
    });

  // waivers list
  waiversCmd
    .command("list [path]")
    .description("List waivers in the file")
    .option("-v, --verbose", "Show all waiver details")
    .action((pathArg: string | undefined, cmdOptions: Record<string, unknown>) => {
      const filepath = pathArg ?? DEFAULT_WAIVERS_FILE;
      try {
        const exitCode = executeWaiversList(filepath, Boolean(cmdOptions.verbose));
        process.exit(exitCode);
      } catch (error) {
        console.error(`\x1b[31mError: ${error instanceof Error ? error.message : String(error)}\x1b[0m`);
        process.exit(1);
      }
    });

  // waivers remove
  waiversCmd
    .command("remove <waiverId> [path]")
    .description("Remove a waiver from the file")
    .action((waiverId: string, pathArg: string | undefined) => {
      const filepath = pathArg ?? DEFAULT_WAIVERS_FILE;
      try {
        const exitCode = executeWaiversRemove(filepath, waiverId);
        process.exit(exitCode);
      } catch (error) {
        console.error(`\x1b[31mError: ${error instanceof Error ? error.message : String(error)}\x1b[0m`);
        process.exit(1);
      }
    });
}
