import type { Finding, EvidenceItem } from "@vibecheck/schema";
import type { ScanContext } from "../types.js";
import { resolvePath } from "../../utils/file-utils.js";
import { generateFingerprint, generateFindingId } from "../../utils/fingerprint.js";

const RULE_ID = "VC-UP-001";

/**
 * VC-UP-001: File upload without size/type constraints
 *
 * Targets:
 * - multer usage without limits/fileFilter
 * - formidable/busboy without size checks
 * - Next.js route handlers reading formData and accepting file without checking type/size
 *
 * Precision:
 * - Only flag if a file is accepted AND there is no check of file.size, file.type, or limits
 */
export async function scanMissingUploadConstraints(context: ScanContext): Promise<Finding[]> {
  const { repoRoot, fileIndex, helpers } = context;
  const findings: Finding[] = [];

  // Scan API route files
  for (const relPath of fileIndex.apiRouteFiles) {
    const absPath = resolvePath(repoRoot, relPath);
    const sourceFile = helpers.parseFile(absPath);

    if (!sourceFile) continue;

    const handlers = helpers.findRouteHandlers(sourceFile);

    for (const handler of handlers) {
      const uploadHandlers = helpers.findFileUploadHandlers(handler.functionNode);

      for (const upload of uploadHandlers) {
        // Only flag if missing both size and type checks
        if (upload.hasSizeCheck && upload.hasTypeCheck) continue;

        const missingChecks: string[] = [];
        if (!upload.hasSizeCheck) missingChecks.push("size limit");
        if (!upload.hasTypeCheck) missingChecks.push("type validation");

        const evidence: EvidenceItem[] = [
          {
            file: relPath,
            startLine: upload.line,
            endLine: upload.line,
            snippet: upload.snippet,
            label: `File upload via ${upload.uploadMethod} without ${missingChecks.join(" or ")}`,
          },
        ];

        const fingerprint = generateFingerprint({
          ruleId: RULE_ID,
          file: relPath,
          symbol: upload.uploadMethod,
          startLine: upload.line,
        });

        findings.push({
          id: generateFindingId({
            ruleId: RULE_ID,
            file: relPath,
            symbol: upload.uploadMethod,
            startLine: upload.line,
          }),
          ruleId: RULE_ID,
          title: `File upload missing ${missingChecks.join(" and ")}`,
          description: `This file upload handler using ${upload.uploadMethod} lacks ${missingChecks.join(" and ")}. Without size limits, attackers can upload extremely large files causing denial of service. Without type validation, attackers may upload malicious executables, scripts, or unexpected content types.`,
          severity: "high",
          confidence: 0.8,
          category: "uploads",
          evidence,
          remediation: {
            recommendedFix: `Add both size limits and file type validation to your upload handler. For multer: add limits.fileSize and fileFilter callback. For Next.js formData: check file.size and file.type. Define allowed MIME types based on your use case (images, documents, etc.) and appropriate size limits.`,
            // No patch for upload constraints - requires knowing appropriate size limits and allowed file types for the specific use case
          },
          links: {
            cwe: "https://cwe.mitre.org/data/definitions/434.html",
            owasp: "https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html",
          },
          fingerprint,
        });
      }
    }
  }

  return findings;
}
