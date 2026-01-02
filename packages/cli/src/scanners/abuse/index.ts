import type { ScannerPack } from "../types.js";
import { scanComputeAbuse } from "./compute-abuse.js";

/**
 * Abuse detection scanner pack
 *
 * Detects compute-intensive endpoints vulnerable to abuse:
 * - AI/LLM generation endpoints without rate limiting
 * - Code execution endpoints without sandboxing
 * - File processing endpoints without size limits
 * - Expensive API calls without authentication
 */
export const abusePack: ScannerPack = {
  id: "abuse",
  name: "Compute Abuse Detection",
  scanners: [scanComputeAbuse],
};
