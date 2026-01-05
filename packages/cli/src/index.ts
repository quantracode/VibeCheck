#!/usr/bin/env node
import { Command } from "commander";
import {
  registerScanCommand,
  registerExplainCommand,
  registerDemoArtifactCommand,
  registerIntentCommand,
  registerEvaluateCommand,
  registerWaiversCommand,
  registerViewCommand,
  registerLicenseCommand,
  registerVerifyDeterminismCommand,
  registerBadgeCommand,
} from "./commands/index.js";
import { CLI_VERSION } from "./constants.js";

// Re-export CLI_VERSION for backward compatibility
export { CLI_VERSION };

const program = new Command();

program
  .name("vibecheck")
  .description("Security scanner for modern web applications")
  .version(CLI_VERSION);

// Register commands
registerScanCommand(program);
registerExplainCommand(program);
registerDemoArtifactCommand(program);
registerIntentCommand(program);
registerEvaluateCommand(program);
registerWaiversCommand(program);
registerViewCommand(program);
registerLicenseCommand(program);
registerVerifyDeterminismCommand(program);
registerBadgeCommand(program);

// Parse arguments
program.parse();
