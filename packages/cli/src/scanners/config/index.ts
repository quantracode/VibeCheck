import type { ScannerPack } from "../types.js";
import { scanUndocumentedEnv, parseEnvExample, findEnvUsages } from "./undocumented-env.js";
import { scanInsecureDefaults } from "./insecure-defaults.js";

export const configPack: ScannerPack = {
  id: "config",
  name: "Configuration & Secrets",
  scanners: [scanUndocumentedEnv, scanInsecureDefaults],
};

// Re-export for testing
export { scanUndocumentedEnv, parseEnvExample, findEnvUsages } from "./undocumented-env.js";
export { scanInsecureDefaults } from "./insecure-defaults.js";
