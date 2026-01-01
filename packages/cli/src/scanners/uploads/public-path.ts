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
          recommendedFix: `Store uploads outside the public directory and serve them through a controlled API endpoint. Always sanitize and generate safe filenames.`,
          patch: `// DON'T: Write directly to public folder
// fs.writeFile(path.join('public', filename), buffer);

// DO: Store outside public with generated names
import { randomUUID } from 'crypto';
import path from 'path';

// Generate safe filename
const ext = path.extname(originalFilename).toLowerCase();
const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif'];
if (!allowedExtensions.includes(ext)) {
  throw new Error('Invalid file extension');
}

const safeFilename = \`\${randomUUID()}\${ext}\`;
const uploadPath = path.join(process.cwd(), 'uploads', safeFilename);

// Write to non-public directory
await fs.writeFile(uploadPath, buffer);

// Serve through API route:
// GET /api/files/[id] -> Stream file from uploads directory`,
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
