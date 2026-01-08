import type { Finding, EvidenceItem } from "@vibecheck/schema";
import type { ScanContext } from "../types.js";
import { resolvePath } from "../../utils/file-utils.js";
import { generateFingerprint, generateFindingId } from "../../utils/fingerprint.js";

const RULE_ID = "VC-UP-002";

/**
 * VC-UP-002: Upload served from public path
 *
 * Detect:
 * - Writing uploaded file to `public/` or `static/` directories
 * - Or referencing user-supplied filenames in public URL generation
 */
export async function scanPublicUploadPath(context: ScanContext): Promise<Finding[]> {
  const { repoRoot, fileIndex, helpers } = context;
  const findings: Finding[] = [];

  for (const relPath of fileIndex.allSourceFiles) {
    const absPath = resolvePath(repoRoot, relPath);
    const sourceFile = helpers.parseFile(absPath);

    if (!sourceFile) continue;

    const publicWrites = helpers.findPublicFileWrites(sourceFile);

    for (const write of publicWrites) {
      if (!write.isPublicDir) continue;

      const evidence: EvidenceItem[] = [
        {
          file: relPath,
          startLine: write.line,
          endLine: write.line,
          snippet: write.snippet,
          label: `File written to public path${write.usesUserFilename ? " with user-supplied filename" : ""}`,
        },
      ];

      const fingerprint = generateFingerprint({
        ruleId: RULE_ID,
        file: relPath,
        symbol: "public-write",
        startLine: write.line,
      });

      const severity = write.usesUserFilename ? "high" : "medium";

      findings.push({
        id: generateFindingId({
          ruleId: RULE_ID,
          file: relPath,
          symbol: "public-write",
          startLine: write.line,
        }),
        ruleId: RULE_ID,
        title: `Uploaded file written to public directory${write.usesUserFilename ? " with user filename" : ""}`,
        description: `Files are being written to a publicly accessible directory (${write.writePath}).${write.usesUserFilename ? " The filename appears to come from user input, which could allow path traversal attacks or filename-based exploits." : ""} Publicly accessible uploads can be directly accessed by anyone and may be executed by the server if not properly configured.`,
        severity,
        confidence: 0.85,
        category: "uploads",
        evidence,
        remediation: {
          recommendedFix: `Store uploads outside the public directory and serve them through a controlled API endpoint. Always sanitize and generate safe filenames using randomUUID() + validated extension. Store in a non-public directory (e.g., uploads/) and serve through an API route that handles authorization and content-type headers.`,
          // No patch for upload path fixes - requires restructuring file handling, creating API routes, and implementing authorization logic
        },
        links: {
          cwe: "https://cwe.mitre.org/data/definitions/434.html",
          owasp: "https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html",
        },
        fingerprint,
      });
    }
  }

  return findings;
}
