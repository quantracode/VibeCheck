import type { ScannerPack } from "../types.js";
import { scanIgnoredValidation } from "./ignored-validation.js";
import { scanClientSideOnlyValidation } from "./client-side-only.js";

export const validationPack: ScannerPack = {
  id: "validation",
  name: "Input Validation",
  scanners: [scanIgnoredValidation, scanClientSideOnlyValidation],
};

export { scanIgnoredValidation } from "./ignored-validation.js";
export { scanClientSideOnlyValidation } from "./client-side-only.js";
