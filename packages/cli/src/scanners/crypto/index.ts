import type { ScannerPack } from "../types.js";
import { scanMathRandomTokens } from "./math-random-tokens.js";
import { scanJwtDecodeUnverified } from "./jwt-decode-unverified.js";
import { scanWeakHashing } from "./weak-hashing.js";

export const cryptoPack: ScannerPack = {
  id: "crypto",
  name: "Cryptography Security",
  scanners: [scanMathRandomTokens, scanJwtDecodeUnverified, scanWeakHashing],
};

export { scanMathRandomTokens } from "./math-random-tokens.js";
export { scanJwtDecodeUnverified } from "./jwt-decode-unverified.js";
export { scanWeakHashing } from "./weak-hashing.js";
