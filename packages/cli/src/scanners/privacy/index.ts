import type { ScannerPack } from "../types.js";
import { scanSensitiveLogging } from "./sensitive-logging.js";
import { scanOverBroadResponse } from "./over-broad-response.js";
import { scanDebugFlags } from "./debug-flags.js";

export const privacyPack: ScannerPack = {
  id: "privacy",
  name: "Privacy & Data Protection",
  scanners: [scanSensitiveLogging, scanOverBroadResponse, scanDebugFlags],
};

export { scanSensitiveLogging } from "./sensitive-logging.js";
export { scanOverBroadResponse } from "./over-broad-response.js";
export { scanDebugFlags } from "./debug-flags.js";
