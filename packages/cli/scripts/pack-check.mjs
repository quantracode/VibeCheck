#!/usr/bin/env node
/**
 * Verify the package is ready for npm publish.
 * Checks that no workspace:* references exist in dependencies.
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = join(__dirname, "..", "package.json");

console.log("Checking package.json for workspace:* references...\n");

const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

let hasErrors = false;

// Check dependencies (these will be published)
if (pkg.dependencies) {
  for (const [name, version] of Object.entries(pkg.dependencies)) {
    if (version.includes("workspace:")) {
      console.error(`ERROR: dependencies["${name}"] contains workspace reference: ${version}`);
      hasErrors = true;
    }
  }
}

// Check peerDependencies (these will be published)
if (pkg.peerDependencies) {
  for (const [name, version] of Object.entries(pkg.peerDependencies)) {
    if (version.includes("workspace:")) {
      console.error(`ERROR: peerDependencies["${name}"] contains workspace reference: ${version}`);
      hasErrors = true;
    }
  }
}

// devDependencies with workspace:* are OK - they won't be published

// Check that dist/index.js exists
const distPath = join(__dirname, "..", "dist", "index.js");
if (!existsSync(distPath)) {
  console.error("ERROR: dist/index.js does not exist. Run 'pnpm build' first.");
  hasErrors = true;
}

// Check that dist/index.js has shebang
if (existsSync(distPath)) {
  const content = readFileSync(distPath, "utf-8");
  if (!content.startsWith("#!/usr/bin/env node")) {
    console.error("ERROR: dist/index.js is missing shebang (#!/usr/bin/env node)");
    hasErrors = true;
  }

  // Check that workspace packages are bundled (not imported)
  if (content.includes('from "@vibecheck/schema"') || content.includes('from "@vibecheck/policy"')) {
    console.error("ERROR: dist/index.js contains unbundled workspace imports");
    hasErrors = true;
  }
}

if (hasErrors) {
  console.error("\nPack check FAILED. Fix the above errors before publishing.");
  process.exit(1);
}

console.log("All checks passed! Package is ready for npm publish.");
console.log(`\nPackage: ${pkg.name}@${pkg.version}`);
