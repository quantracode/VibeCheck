import crypto from "node:crypto";

/**
 * Generate a deterministic fingerprint for a finding based on its key attributes.
 * This allows deduplication across scans.
 */
export function generateFingerprint(parts: {
  ruleId: string;
  file: string;
  symbol?: string;
  route?: string;
  startLine?: number;
}): string {
  const data = [
    parts.ruleId,
    parts.file,
    parts.symbol ?? "",
    parts.route ?? "",
    parts.startLine?.toString() ?? "",
  ].join("::");

  return crypto.createHash("sha256").update(data).digest("hex").slice(0, 16);
}

/**
 * Generate a stable finding ID based on fingerprint components
 */
export function generateFindingId(parts: {
  ruleId: string;
  file: string;
  symbol?: string;
  startLine?: number;
}): string {
  const fp = generateFingerprint(parts);
  return `${parts.ruleId.toLowerCase()}-${fp.slice(0, 8)}`;
}

/**
 * Hash a directory path for repo identification
 */
export function hashPath(dirPath: string): string {
  return crypto.createHash("sha256").update(dirPath).digest("hex").slice(0, 16);
}
