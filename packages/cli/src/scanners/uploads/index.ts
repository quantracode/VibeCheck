import type { ScannerPack } from "../types.js";
import { scanMissingUploadConstraints } from "./missing-constraints.js";
import { scanPublicUploadPath } from "./public-path.js";

export const uploadsPack: ScannerPack = {
  id: "uploads",
  name: "File Upload Security",
  scanners: [scanMissingUploadConstraints, scanPublicUploadPath],
};

export { scanMissingUploadConstraints } from "./missing-constraints.js";
export { scanPublicUploadPath } from "./public-path.js";
