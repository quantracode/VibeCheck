import type { ScannerPack } from "../types.js";
import { scanUnprotectedApiRoutes } from "./unprotected-api-route.js";
import { scanMiddlewareGap, parseMatcherConfig, matcherCoversApi } from "./middleware-gap.js";

export const authPack: ScannerPack = {
  id: "auth",
  name: "Authentication & Authorization",
  scanners: [scanUnprotectedApiRoutes, scanMiddlewareGap],
};

// Re-export individual scanners and utilities for testing
export { scanUnprotectedApiRoutes } from "./unprotected-api-route.js";
export { scanMiddlewareGap, parseMatcherConfig, matcherCoversApi } from "./middleware-gap.js";
