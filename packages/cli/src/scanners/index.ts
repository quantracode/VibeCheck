export * from "./types.js";
export { scanEnvConfig, parseEnvExample, findEnvUsages } from "./env-config.js";
export {
  scanUnusedSecurityImports,
  findSecurityImports,
  checkIdentifierUsage,
} from "./unused-security-imports.js";
export {
  scanNextjsMiddleware,
  parseMatcherConfig,
  matcherCoversApi,
} from "./nextjs-middleware.js";

import type { Scanner } from "./types.js";
import { scanEnvConfig } from "./env-config.js";
import { scanUnusedSecurityImports } from "./unused-security-imports.js";
import { scanNextjsMiddleware } from "./nextjs-middleware.js";

/**
 * All available scanners
 */
export const ALL_SCANNERS: Scanner[] = [
  scanEnvConfig,
  scanUnusedSecurityImports,
  scanNextjsMiddleware,
];
