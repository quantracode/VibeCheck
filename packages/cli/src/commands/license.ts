/**
 * License management commands for VibeCheck CLI
 *
 * Provides offline license creation and management.
 *
 * User commands:
 *   vibecheck license set     - Activate a license key (validates locally, saves to config)
 *   vibecheck license status  - Show current license status
 *   vibecheck license clear   - Remove stored license
 *
 * Admin commands (for license issuers):
 *   vibecheck license create  - Create a signed license (requires private key)
 *   vibecheck license demo    - Generate a demo license for testing
 *   vibecheck license verify  - Verify a license key
 *   vibecheck license inspect - Inspect a license key without verification
 *   vibecheck license keygen  - Generate a new Ed25519 key pair
 */

import { Command } from "commander";
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import chalk from "chalk";
import readline from "readline";
import {
  createLicense,
  createDemoLicense,
  inspectLicense,
  generateKeyPair,
  derivePublicKey,
  validateLicense,
  getDaysRemaining,
  PLAN_NAMES,
  isDemoLicense,
  type PlanType,
  type License,
} from "@vibecheck/license";

// ============================================================================
// License Storage (CLI config file)
// ============================================================================

const CONFIG_DIR = join(homedir(), ".vibecheck");
const LICENSE_FILE = join(CONFIG_DIR, "license.key");

/**
 * Ensure config directory exists
 */
function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Get stored license key from config
 */
function getStoredLicenseKey(): string | null {
  try {
    if (existsSync(LICENSE_FILE)) {
      return readFileSync(LICENSE_FILE, "utf-8").trim();
    }
  } catch {
    // Ignore read errors
  }
  return null;
}

/**
 * Store license key to config
 */
function storeLicenseKey(licenseKey: string): void {
  ensureConfigDir();
  writeFileSync(LICENSE_FILE, licenseKey, "utf-8");
}

/**
 * Clear stored license key
 */
function clearLicenseKey(): boolean {
  try {
    if (existsSync(LICENSE_FILE)) {
      unlinkSync(LICENSE_FILE);
      return true;
    }
  } catch {
    // Ignore delete errors
  }
  return false;
}

/**
 * Prompt user for input
 */
function promptInput(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// ============================================================================
// Command Registration
// ============================================================================

/**
 * Register the license command group
 */
export function registerLicenseCommand(program: Command): void {
  const license = program
    .command("license")
    .description("License management commands");

  // ========================================
  // User commands
  // ========================================

  // vibecheck license set
  license
    .command("set")
    .description("Activate a license key (validates locally, saves to config)")
    .argument("[license-key]", "The license key (prompts if not provided)")
    .action(async (licenseKey?: string) => {
      await setLicenseAction(licenseKey);
    });

  // vibecheck license status
  license
    .command("status")
    .description("Show current license status")
    .action(async () => {
      await statusLicenseAction();
    });

  // vibecheck license clear
  license
    .command("clear")
    .description("Remove stored license")
    .action(async () => {
      await clearLicenseAction();
    });

  // ========================================
  // Admin commands (license issuers)
  // ========================================

  // vibecheck license create
  license
    .command("create")
    .description("Create a new signed license")
    .option("-e, --email <email>", "License holder email (optional)")
    .option("-n, --name <name>", "License holder name (optional)")
    .option("-p, --plan <plan>", "Plan type: pro", "pro")
    .option("-k, --key <path>", "Path to private key file")
    .option("--key-env <var>", "Environment variable containing private key", "VIBECHECK_PRIVATE_KEY")
    .option("--expires <days>", "Days until expiry (0 for perpetual)", "90")
    .option("--id <id>", "Custom license ID")
    .option("--features <list>", "Comma-separated additional features")
    .action(async (options) => {
      await createLicenseAction(options);
    });

  // vibecheck license demo
  license
    .command("demo")
    .description("Generate a demo license for development/testing")
    .option("-p, --plan <plan>", "Plan type: pro", "pro")
    .option("-d, --days <days>", "Days until expiry", "30")
    .action(async (options) => {
      await createDemoAction(options);
    });

  // vibecheck license verify
  license
    .command("verify")
    .description("Verify a license key")
    .argument("<license-key>", "The license key to verify")
    .option("-k, --key <key>", "Public key to verify against (base64)")
    .action(async (licenseKey, options) => {
      await verifyLicenseAction(licenseKey, options);
    });

  // vibecheck license inspect
  license
    .command("inspect")
    .description("Inspect a license key (without verification)")
    .argument("<license-key>", "The license key to inspect")
    .action(async (licenseKey) => {
      await inspectLicenseAction(licenseKey);
    });

  // vibecheck license keygen
  license
    .command("keygen")
    .description("Generate a new Ed25519 key pair for license signing")
    .action(async () => {
      await keygenAction();
    });
}

// ============================================================================
// User Command Actions
// ============================================================================

/**
 * Set/activate a license key
 */
async function setLicenseAction(licenseKey?: string): Promise<void> {
  console.log();

  // Prompt for key if not provided
  if (!licenseKey) {
    licenseKey = await promptInput(chalk.cyan("Enter your license key: "));
  }

  licenseKey = licenseKey.trim();

  if (!licenseKey) {
    console.log(chalk.red("Error: No license key provided"));
    process.exit(1);
  }

  console.log(chalk.gray("Validating license..."));
  console.log();

  try {
    const result = await validateLicense(licenseKey);

    if (result.valid && result.license) {
      // Store the license
      storeLicenseKey(licenseKey);

      const { payload } = result.license;
      const isDemo = isDemoLicense(payload.id);
      const daysRemaining = getDaysRemaining(result.license);

      if (isDemo) {
        console.log(chalk.yellow.bold("⚠ Trial License Activated"));
        console.log(chalk.gray("  This license is for development/testing only."));
      } else {
        console.log(chalk.green.bold("✓ License Activated"));
      }

      console.log();
      console.log(chalk.gray("Details:"));
      console.log(`  ${chalk.gray("Plan:")}     ${chalk.cyan(PLAN_NAMES[payload.plan])}`);
      if (payload.name) {
        console.log(`  ${chalk.gray("Name:")}     ${payload.name}`);
      }
      console.log(`  ${chalk.gray("Expires:")}  ${payload.expiresAt ?? chalk.green("Never")}`);
      if (daysRemaining !== null) {
        const daysColor = daysRemaining <= 14 ? chalk.yellow : chalk.gray;
        console.log(`  ${chalk.gray("Remaining:")} ${daysColor(`${daysRemaining} days`)}`);
      }
      console.log(`  ${chalk.gray("Features:")} ${payload.features.join(", ") || "(none)"}`);

      console.log();
      console.log(chalk.gray(`License saved to: ${LICENSE_FILE}`));
    } else {
      console.log(chalk.red.bold("✗ Invalid License"));
      console.log(chalk.red(`  ${result.error}`));
      process.exit(1);
    }
  } catch (err) {
    console.error(chalk.red("Error validating license:"), err instanceof Error ? err.message : err);
    process.exit(1);
  }

  console.log();
}

/**
 * Show current license status
 */
async function statusLicenseAction(): Promise<void> {
  console.log();

  const licenseKey = getStoredLicenseKey();

  if (!licenseKey) {
    console.log(chalk.gray("No license configured."));
    console.log();
    console.log(chalk.gray("Plan:") + " " + chalk.white("Free"));
    console.log();
    console.log(chalk.gray("To activate a license:"));
    console.log(chalk.cyan("  vibecheck license set <license-key>"));
    console.log();
    console.log(chalk.gray("Get a license at:") + " " + chalk.blue("https://vibecheck.dev/pricing"));
    console.log();
    return;
  }

  try {
    const result = await validateLicense(licenseKey);

    if (result.valid && result.license) {
      const { payload } = result.license;
      const isDemo = isDemoLicense(payload.id);
      const daysRemaining = getDaysRemaining(result.license);

      if (isDemo) {
        console.log(chalk.yellow.bold("Trial License"));
        console.log(chalk.gray("(Development/testing only)"));
      } else {
        console.log(chalk.green.bold("License Active"));
      }

      console.log();
      console.log(`${chalk.gray("Plan:")}       ${chalk.cyan(PLAN_NAMES[payload.plan])}`);
      console.log(`${chalk.gray("ID:")}         ${payload.id}`);
      if (payload.name) {
        console.log(`${chalk.gray("Name:")}       ${payload.name}`);
      }
      console.log(`${chalk.gray("Issued:")}     ${payload.issuedAt}`);
      console.log(`${chalk.gray("Expires:")}    ${payload.expiresAt ?? chalk.green("Never")}`);

      if (daysRemaining !== null) {
        if (daysRemaining <= 0) {
          console.log(`${chalk.gray("Status:")}     ${chalk.red("Expired")}`);
        } else if (daysRemaining <= 14) {
          console.log(`${chalk.gray("Remaining:")}  ${chalk.yellow(`${daysRemaining} days`)} ${chalk.gray("(expiring soon)")}`);
        } else {
          console.log(`${chalk.gray("Remaining:")}  ${chalk.green(`${daysRemaining} days`)}`);
        }
      }

      console.log(`${chalk.gray("Features:")}   ${payload.features.join(", ") || "(none)"}`);
      console.log();

      if (daysRemaining !== null && daysRemaining <= 14 && !isDemo) {
        console.log(chalk.yellow("License expiring soon. Generate a new key from the Pro Portal:"));
        console.log(chalk.blue("  https://vibecheck.dev/portal"));
        console.log();
      }
    } else {
      console.log(chalk.red.bold("Stored License Invalid"));
      console.log(chalk.red(`  ${result.error}`));
      console.log();
      console.log(chalk.gray("Clear the invalid license with:"));
      console.log(chalk.cyan("  vibecheck license clear"));
      console.log();
    }
  } catch (err) {
    console.error(chalk.red("Error checking license:"), err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

/**
 * Clear stored license
 */
async function clearLicenseAction(): Promise<void> {
  console.log();

  const cleared = clearLicenseKey();

  if (cleared) {
    console.log(chalk.green("✓ License removed"));
    console.log(chalk.gray(`  Deleted: ${LICENSE_FILE}`));
  } else {
    console.log(chalk.gray("No license to remove."));
  }

  console.log();
}

// ============================================================================
// Admin Command Actions
// ============================================================================

/**
 * Create a new signed license
 */
async function createLicenseAction(options: {
  email?: string;
  name?: string;
  plan: string;
  key?: string;
  keyEnv: string;
  expires: string;
  id?: string;
  features?: string;
}): Promise<void> {
  // Validate plan
  const plan = options.plan as PlanType;
  if (plan !== "pro") {
    console.error(chalk.red("Error: Plan must be 'pro'"));
    process.exit(1);
  }

  // Get private key
  let privateKey: string | undefined;

  if (options.key) {
    if (!existsSync(options.key)) {
      console.error(chalk.red(`Error: Key file not found: ${options.key}`));
      process.exit(1);
    }
    privateKey = readFileSync(options.key, "utf-8").trim();
  } else if (process.env[options.keyEnv]) {
    privateKey = process.env[options.keyEnv];
  }

  if (!privateKey) {
    console.error(chalk.red("Error: No private key provided"));
    console.error(chalk.gray("  Use --key <path> or set VIBECHECK_PRIVATE_KEY environment variable"));
    process.exit(1);
  }

  // Parse options
  const expiresDays = parseInt(options.expires, 10);
  const expiresAt = expiresDays > 0
    ? new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000)
    : null;

  const features = options.features?.split(",").map((f) => f.trim());

  // Create license
  try {
    const licenseKey = createLicense(
      {
        id: options.id,
        plan,
        name: options.name,
        email: options.email,
        expiresAt,
        features,
      },
      privateKey
    );

    const license = inspectLicense(licenseKey);

    console.log();
    console.log(chalk.green.bold("✓ License created successfully"));
    console.log();

    if (license) {
      console.log(chalk.gray("Details:"));
      console.log(`  ${chalk.gray("ID:")}       ${license.payload.id}`);
      console.log(`  ${chalk.gray("Plan:")}     ${chalk.cyan(license.payload.plan)}`);
      if (license.payload.name) {
        console.log(`  ${chalk.gray("Name:")}     ${license.payload.name}`);
      }
      if (license.payload.email) {
        console.log(`  ${chalk.gray("Email:")}    ${license.payload.email}`);
      }
      console.log(`  ${chalk.gray("Issued:")}   ${license.payload.issuedAt}`);
      console.log(`  ${chalk.gray("Expires:")}  ${license.payload.expiresAt ?? chalk.green("Never (perpetual)")}`);
      console.log(`  ${chalk.gray("Features:")} ${license.payload.features.join(", ")}`);
    }

    console.log();
    console.log(chalk.gray("License Key:"));
    console.log(chalk.yellow(licenseKey));
    console.log();
  } catch (err) {
    console.error(chalk.red("Error creating license:"), err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

/**
 * Create a demo license for development/testing
 */
async function createDemoAction(options: {
  plan: string;
  days: string;
}): Promise<void> {
  const plan = options.plan as PlanType;
  if (plan !== "pro") {
    console.error(chalk.red("Error: Plan must be 'pro'"));
    process.exit(1);
  }

  const days = parseInt(options.days, 10);
  const licenseKey = createDemoLicense(plan, days);
  const license = inspectLicense(licenseKey);

  console.log();
  console.log(chalk.yellow.bold("⚠ Demo License Generated"));
  console.log(chalk.gray("  This license is for development/testing only."));
  console.log(chalk.gray("  It will not work in production environments."));
  console.log();

  if (license) {
    console.log(chalk.gray("Details:"));
    console.log(`  ${chalk.gray("ID:")}      ${license.payload.id}`);
    console.log(`  ${chalk.gray("Plan:")}    ${chalk.cyan(license.payload.plan)}`);
    console.log(`  ${chalk.gray("Expires:")} ${license.payload.expiresAt}`);
  }

  console.log();
  console.log(chalk.gray("License Key:"));
  console.log(chalk.yellow(licenseKey));
  console.log();
}

/**
 * Verify a license key
 */
async function verifyLicenseAction(
  licenseKey: string,
  options: { key?: string }
): Promise<void> {
  console.log();
  console.log(chalk.gray("Verifying license..."));

  try {
    const result = await validateLicense(licenseKey, {
      publicKey: options.key,
    });

    if (result.valid) {
      console.log();
      console.log(chalk.green.bold("✓ License is valid"));

      if (result.isDemo) {
        console.log(chalk.yellow("  (Demo license - valid in development only)"));
      }

      if (result.license) {
        const { payload } = result.license;
        console.log();
        console.log(chalk.gray("Details:"));
        console.log(`  ${chalk.gray("ID:")}       ${payload.id}`);
        console.log(`  ${chalk.gray("Plan:")}     ${chalk.cyan(payload.plan)}`);
        if (payload.name) {
          console.log(`  ${chalk.gray("Name:")}     ${payload.name}`);
        }
        if (payload.email) {
          console.log(`  ${chalk.gray("Email:")}    ${payload.email}`);
        }
        console.log(`  ${chalk.gray("Issued:")}   ${payload.issuedAt}`);
        console.log(`  ${chalk.gray("Expires:")}  ${payload.expiresAt ?? chalk.green("Never")}`);
        console.log(`  ${chalk.gray("Features:")} ${payload.features.join(", ") || "(none)"}`);
      }
    } else {
      console.log();
      console.log(chalk.red.bold("✗ License is invalid"));
      console.log(chalk.red(`  ${result.error}`));
      process.exit(1);
    }
  } catch (err) {
    console.error(chalk.red("Error verifying license:"), err instanceof Error ? err.message : err);
    process.exit(1);
  }

  console.log();
}

/**
 * Inspect a license key without verification
 */
async function inspectLicenseAction(licenseKey: string): Promise<void> {
  const license = inspectLicense(licenseKey);

  if (!license) {
    console.log();
    console.log(chalk.red.bold("✗ Invalid license format"));
    console.log(chalk.gray("  Could not parse the license key."));
    process.exit(1);
  }

  console.log();
  console.log(chalk.blue.bold("License Contents"));
  console.log(chalk.gray("(Not verified - use 'vibecheck license verify' for verification)"));
  console.log();

  const { payload } = license;
  console.log(`${chalk.gray("ID:")}         ${payload.id}`);
  console.log(`${chalk.gray("Plan:")}       ${chalk.cyan(payload.plan)}`);
  if (payload.name) {
    console.log(`${chalk.gray("Name:")}       ${payload.name}`);
  }
  if (payload.email) {
    console.log(`${chalk.gray("Email:")}      ${payload.email}`);
  }
  console.log(`${chalk.gray("Issued:")}     ${payload.issuedAt}`);
  console.log(`${chalk.gray("Expires:")}    ${payload.expiresAt ?? chalk.green("Never (perpetual)")}`);
  console.log(`${chalk.gray("Features:")}   ${payload.features.join(", ") || "(none)"}`);

  console.log();
  console.log(`${chalk.gray("Signature:")}  ${license.signature.slice(0, 20)}...`);
  console.log();
}

/**
 * Generate a new Ed25519 key pair
 */
async function keygenAction(): Promise<void> {
  console.log();
  console.log(chalk.blue.bold("Generating Ed25519 Key Pair"));
  console.log();

  const { publicKey, privateKey } = generateKeyPair();

  // Verify the keys
  const derivedPublic = derivePublicKey(privateKey);
  if (derivedPublic !== publicKey) {
    console.error(chalk.red("Error: Key verification failed"));
    process.exit(1);
  }

  console.log(chalk.green("✓ Keys generated and verified"));
  console.log();

  console.log(chalk.gray("PUBLIC KEY") + chalk.gray(" (safe to embed in code):"));
  console.log(chalk.cyan(publicKey));
  console.log();

  console.log(chalk.gray("PRIVATE KEY") + chalk.red.bold(" (⚠️ KEEP SECRET):"));
  console.log(chalk.yellow(privateKey));
  console.log();

  console.log(chalk.gray("─".repeat(60)));
  console.log(chalk.gray("Next steps:"));
  console.log(chalk.gray("1. Save the private key securely (password manager, HSM)"));
  console.log(chalk.gray("2. Update VIBECHECK_PUBLIC_KEY_B64 in packages/license/src/constants.ts"));
  console.log(chalk.gray("3. NEVER commit the private key to version control"));
  console.log();
}
