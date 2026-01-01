import type { Finding, Category, Severity, EvidenceItem } from "@vibecheck/schema";
import { readFileSync, resolvePath } from "../utils/file-utils.js";
import { generateFingerprint, generateFindingId } from "../utils/fingerprint.js";
import type { ScanContext } from "./types.js";

const RULE_ID = "VC-HALL-001";

/**
 * Security libraries to detect
 */
interface SecurityLib {
  name: string;
  category: Category;
  severity: Severity;
  description: string;
}

const SECURITY_LIBS: SecurityLib[] = [
  {
    name: "zod",
    category: "validation",
    severity: "medium",
    description: "Schema validation library",
  },
  {
    name: "yup",
    category: "validation",
    severity: "medium",
    description: "Schema validation library",
  },
  {
    name: "joi",
    category: "validation",
    severity: "medium",
    description: "Schema validation library",
  },
  {
    name: "helmet",
    category: "middleware",
    severity: "medium",
    description: "Security headers middleware",
  },
  {
    name: "cors",
    category: "middleware",
    severity: "low",
    description: "CORS middleware",
  },
  {
    name: "csurf",
    category: "middleware",
    severity: "medium",
    description: "CSRF protection middleware",
  },
];

interface ImportMatch {
  library: string;
  importedNames: string[];
  line: number;
  snippet: string;
  isDefaultImport: boolean;
  isNamespaceImport: boolean;
}

/**
 * Find imports of security libraries in a file
 *
 * Limitations:
 * - Uses regex, may match imports in comments
 * - Does not handle dynamic imports: import('zod')
 * - Does not track re-exports
 */
export function findSecurityImports(content: string, libraries: string[]): ImportMatch[] {
  const imports: ImportMatch[] = [];
  const lines = content.split("\n");
  const libPattern = libraries.join("|");

  // Match: import X from 'lib' / import { x, y } from 'lib' / import * as X from 'lib'
  const importRegex = new RegExp(
    `^\\s*import\\s+(?:([\\w]+)|\\{([^}]+)\\}|\\*\\s+as\\s+([\\w]+))\\s+from\\s+['"](?:${libPattern})['"]`,
    "gm"
  );

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    importRegex.lastIndex = 0;

    for (const lib of libraries) {
      // Check each library pattern
      const patterns = [
        // import X from 'lib'
        new RegExp(`^\\s*import\\s+(\\w+)\\s+from\\s+['"]${lib}['"]`),
        // import { x, y } from 'lib'
        new RegExp(`^\\s*import\\s+\\{([^}]+)\\}\\s+from\\s+['"]${lib}['"]`),
        // import * as X from 'lib'
        new RegExp(`^\\s*import\\s+\\*\\s+as\\s+(\\w+)\\s+from\\s+['"]${lib}['"]`),
        // import X, { y } from 'lib'
        new RegExp(`^\\s*import\\s+(\\w+)\\s*,\\s*\\{([^}]+)\\}\\s+from\\s+['"]${lib}['"]`),
      ];

      for (let p = 0; p < patterns.length; p++) {
        const match = line.match(patterns[p]);
        if (match) {
          const importedNames: string[] = [];
          let isDefaultImport = false;
          let isNamespaceImport = false;

          if (p === 0) {
            // Default import
            importedNames.push(match[1]);
            isDefaultImport = true;
          } else if (p === 1) {
            // Named imports
            const names = match[1].split(",").map((n) => n.trim().split(/\s+as\s+/)[0].trim());
            importedNames.push(...names.filter(Boolean));
          } else if (p === 2) {
            // Namespace import
            importedNames.push(match[1]);
            isNamespaceImport = true;
          } else if (p === 3) {
            // Default + named
            importedNames.push(match[1]);
            isDefaultImport = true;
            const names = match[2].split(",").map((n) => n.trim().split(/\s+as\s+/)[0].trim());
            importedNames.push(...names.filter(Boolean));
          }

          imports.push({
            library: lib,
            importedNames,
            line: i + 1,
            snippet: line.trim(),
            isDefaultImport,
            isNamespaceImport,
          });
          break;
        }
      }
    }
  }

  return imports;
}

/**
 * Check if any imported identifiers are used after the import line
 */
export function checkIdentifierUsage(
  content: string,
  importLine: number,
  identifiers: string[],
  isNamespaceImport: boolean
): { identifier: string; used: boolean }[] {
  const lines = content.split("\n");
  const afterImport = lines.slice(importLine).join("\n");

  return identifiers.map((id) => {
    // For namespace imports, check for namespace.something
    if (isNamespaceImport) {
      const namespaceRegex = new RegExp(`\\b${id}\\s*\\.`, "g");
      return { identifier: id, used: namespaceRegex.test(afterImport) };
    }

    // For regular imports, check for identifier usage
    // Match the identifier as a word boundary, not just as part of another word
    const usageRegex = new RegExp(`\\b${id}\\b`, "g");
    const matches = afterImport.match(usageRegex);

    // If found at least once, it's used (the import line itself is excluded)
    return { identifier: id, used: matches !== null && matches.length > 0 };
  });
}

/**
 * Unused Security Imports Scanner
 *
 * Detects when security libraries are imported but not used
 */
export async function scanUnusedSecurityImports(context: ScanContext): Promise<Finding[]> {
  const { targetDir, sourceFiles } = context;
  const findings: Finding[] = [];
  const libNames = SECURITY_LIBS.map((l) => l.name);

  for (const relFile of sourceFiles) {
    const absPath = resolvePath(targetDir, relFile);
    const content = readFileSync(absPath);
    if (!content) continue;

    const imports = findSecurityImports(content, libNames);

    for (const imp of imports) {
      const libInfo = SECURITY_LIBS.find((l) => l.name === imp.library);
      if (!libInfo) continue;

      const usageResults = checkIdentifierUsage(
        content,
        imp.line,
        imp.importedNames,
        imp.isNamespaceImport
      );

      const unusedIdentifiers = usageResults
        .filter((r) => !r.used)
        .map((r) => r.identifier);

      if (unusedIdentifiers.length === 0) continue;

      // All imported identifiers are unused
      const allUnused = unusedIdentifiers.length === imp.importedNames.length;

      const evidence: EvidenceItem[] = [
        {
          file: relFile,
          startLine: imp.line,
          endLine: imp.line,
          snippet: imp.snippet,
          label: allUnused
            ? `Unused import of ${imp.library}`
            : `Partially unused import: ${unusedIdentifiers.join(", ")}`,
        },
      ];

      const fingerprint = generateFingerprint({
        ruleId: RULE_ID,
        file: relFile,
        symbol: imp.library,
        startLine: imp.line,
      });

      findings.push({
        id: generateFindingId({
          ruleId: RULE_ID,
          file: relFile,
          symbol: imp.library,
          startLine: imp.line,
        }),
        severity: libInfo.severity,
        confidence: allUnused ? 0.9 : 0.75,
        category: libInfo.category,
        ruleId: RULE_ID,
        title: allUnused
          ? `Imported ${libInfo.description.toLowerCase()} "${imp.library}" is not used`
          : `Partially unused import from "${imp.library}"`,
        description: allUnused
          ? `The security library "${imp.library}" is imported but none of its exports are used. This may indicate incomplete implementation of ${libInfo.category} functionality.`
          : `Some exports from "${imp.library}" (${unusedIdentifiers.join(", ")}) are imported but not used. This may indicate incomplete implementation.`,
        evidence,
        remediation: {
          recommendedFix: allUnused
            ? `Either implement ${libInfo.category} using "${imp.library}" or remove the unused import.`
            : `Remove unused imports (${unusedIdentifiers.join(", ")}) or implement their usage.`,
        },
        fingerprint,
      });
    }
  }

  return findings;
}
