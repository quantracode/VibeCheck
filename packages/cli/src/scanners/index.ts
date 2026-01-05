// Export types
export * from "./types.js";

// Export helpers
export { buildScanContext, createAstHelpers, type ScanContextOptions } from "./helpers/index.js";

// Export scanner packs
export { authPack } from "./auth/index.js";
export { validationPack } from "./validation/index.js";
export { privacyPack } from "./privacy/index.js";
export { configPack } from "./config/index.js";
export { networkPack } from "./network/index.js";
export { hallucinationsPack } from "./hallucinations/index.js";
export { middlewarePack } from "./middleware/index.js";
export { cryptoPack } from "./crypto/index.js";
export { uploadsPack } from "./uploads/index.js";
export { abusePack } from "./abuse/index.js";
export { authorizationPack } from "./authorization/index.js";
export { lifecyclePack } from "./lifecycle/index.js";
export { supplyChainPack } from "./supply-chain/index.js";

// Import packs for aggregation
import type { ScannerPack, Scanner } from "./types.js";
import { authPack } from "./auth/index.js";
import { validationPack } from "./validation/index.js";
import { privacyPack } from "./privacy/index.js";
import { configPack } from "./config/index.js";
import { networkPack } from "./network/index.js";
import { hallucinationsPack } from "./hallucinations/index.js";
import { middlewarePack } from "./middleware/index.js";
import { cryptoPack } from "./crypto/index.js";
import { uploadsPack } from "./uploads/index.js";
import { abusePack } from "./abuse/index.js";
import { authorizationPack } from "./authorization/index.js";
import { lifecyclePack } from "./lifecycle/index.js";
import { supplyChainPack } from "./supply-chain/index.js";

// Phase 3 scanners
import {
  hallucinationsPack as hallucinationsPackPhase3,
  authPackPhase3,
} from "../phase3/index.js";

/**
 * All available scanner packs
 */
export const ALL_SCANNER_PACKS: ScannerPack[] = [
  authPack,
  validationPack,
  privacyPack,
  configPack,
  networkPack,
  hallucinationsPack,
  middlewarePack,
  cryptoPack,
  uploadsPack,
  abusePack,
  authorizationPack,
  lifecyclePack,
  supplyChainPack,
  // Phase 3 packs
  hallucinationsPackPhase3,
  authPackPhase3,
];

/**
 * All available scanners (flattened from packs)
 */
export const ALL_SCANNERS: Scanner[] = ALL_SCANNER_PACKS.flatMap((pack) => pack.scanners);

/**
 * Get a scanner pack by ID
 */
export function getScannerPack(id: string): ScannerPack | undefined {
  return ALL_SCANNER_PACKS.find((pack) => pack.id === id);
}

/**
 * Get all rule IDs covered by the scanners
 */
export const SUPPORTED_RULES = [
  // Auth pack
  "VC-AUTH-001",
  "VC-AUTH-INFO-001",
  "VC-MW-001",
  // Validation pack
  "VC-VAL-001",
  "VC-VAL-002",
  // Privacy pack
  "VC-PRIV-001",
  "VC-PRIV-002",
  "VC-PRIV-003",
  // Config pack
  "VC-CONFIG-001",
  "VC-CONFIG-002",
  // Network pack
  "VC-NET-001",
  "VC-NET-002",
  "VC-NET-003",
  "VC-NET-004",
  // Hallucinations pack (Phase 1-2)
  "VC-HALL-001",
  "VC-HALL-002",
  // Hallucinations pack (Phase 3)
  "VC-HALL-010",
  "VC-HALL-011",
  "VC-HALL-012",
  // Auth pack (Phase 3)
  "VC-AUTH-010",
  // Middleware pack
  "VC-RATE-001",
  // Crypto pack
  "VC-CRYPTO-001",
  "VC-CRYPTO-002",
  "VC-CRYPTO-003",
  // Uploads pack
  "VC-UP-001",
  "VC-UP-002",
  // Abuse pack
  "VC-ABUSE-001",
  "VC-ABUSE-002",
  "VC-ABUSE-003",
  "VC-ABUSE-004",
  // Authorization pack
  "VC-AUTHZ-001",
  "VC-AUTHZ-002",
  "VC-AUTHZ-003",
  "VC-AUTHZ-004",
  // Lifecycle pack
  "VC-LIFE-001",
  "VC-LIFE-002",
  "VC-LIFE-003",
  // Supply Chain pack
  "VC-SUP-001",
  "VC-SUP-002",
  "VC-SUP-003",
  "VC-SUP-004",
  "VC-SUP-005",
] as const;
