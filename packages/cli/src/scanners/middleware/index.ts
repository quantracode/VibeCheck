import type { ScannerPack } from "../types.js";
import { scanMissingRateLimit } from "./missing-rate-limit.js";

export const middlewarePack: ScannerPack = {
  id: "middleware",
  name: "Middleware Security",
  scanners: [scanMissingRateLimit],
};

export { scanMissingRateLimit } from "./missing-rate-limit.js";
