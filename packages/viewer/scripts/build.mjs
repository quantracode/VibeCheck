#!/usr/bin/env node
/**
 * Build script for the viewer package.
 * Copies the static export from the web app to the dist directory.
 */

import { cpSync, rmSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageDir = join(__dirname, "..");
const webAppDir = join(packageDir, "..", "..", "apps", "web");
const distDir = join(packageDir, "dist");
const outDir = join(webAppDir, "out");

console.log("Building viewer package...\n");

// Step 1: Build the web app
console.log("Step 1: Building web app...");
try {
  execSync("pnpm build", {
    cwd: webAppDir,
    stdio: "inherit",
  });
} catch (error) {
  console.error("Failed to build web app");
  process.exit(1);
}

// Step 2: Check that the output exists
if (!existsSync(outDir)) {
  console.error(`Error: Web app output not found at ${outDir}`);
  console.error("Make sure the web app is configured for static export.");
  process.exit(1);
}

// Step 3: Clean and create dist directory
console.log("\nStep 2: Copying static files to dist...");
if (existsSync(distDir)) {
  rmSync(distDir, { recursive: true });
}
mkdirSync(distDir, { recursive: true });

// Step 4: Copy the static export
cpSync(outDir, distDir, { recursive: true });

console.log("\nViewer package built successfully!");
console.log(`Output: ${distDir}`);
