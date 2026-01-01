import type { ScannerPack } from "../types.js";
import { scanSsrfProneFetch } from "./ssrf-prone-fetch.js";
import { scanOpenRedirect } from "./open-redirect.js";
import { scanCorsMisconfiguration } from "./cors-misconfiguration.js";
import { scanMissingTimeout } from "./missing-timeout.js";

export const networkPack: ScannerPack = {
  id: "network",
  name: "Network Security",
  scanners: [
    scanSsrfProneFetch,
    scanOpenRedirect,
    scanCorsMisconfiguration,
    scanMissingTimeout,
  ],
};

export { scanSsrfProneFetch } from "./ssrf-prone-fetch.js";
export { scanOpenRedirect } from "./open-redirect.js";
export { scanCorsMisconfiguration } from "./cors-misconfiguration.js";
export { scanMissingTimeout } from "./missing-timeout.js";
