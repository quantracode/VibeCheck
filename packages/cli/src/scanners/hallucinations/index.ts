import type { ScannerPack } from "../types.js";
import {
  scanUnusedSecurityImports,
  scanNextAuthNotEnforced,
  findSecurityImports,
  checkIdentifierUsage,
} from "./unused-security-imports.js";

export const hallucinationsPack: ScannerPack = {
  id: "hallucinations",
  name: "Security Hallucinations",
  scanners: [scanUnusedSecurityImports, scanNextAuthNotEnforced],
};

// Re-export for testing
export {
  scanUnusedSecurityImports,
  scanNextAuthNotEnforced,
  findSecurityImports,
  checkIdentifierUsage,
} from "./unused-security-imports.js";
