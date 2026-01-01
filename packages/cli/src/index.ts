#!/usr/bin/env node
import { Command } from "commander";
import {
  registerScanCommand,
  registerExplainCommand,
  registerDemoArtifactCommand,
} from "./commands/index.js";

const program = new Command();

program
  .name("vibecheck")
  .description("Security scanner for modern web applications")
  .version("0.0.1");

// Register commands
registerScanCommand(program);
registerExplainCommand(program);
registerDemoArtifactCommand(program);

// Parse arguments
program.parse();
