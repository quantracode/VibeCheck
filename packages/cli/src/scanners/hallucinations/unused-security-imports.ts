import type { Finding, Category, Severity, EvidenceItem } from "@vibecheck/schema";
import { readFileSync, resolvePath } from "../../utils/file-utils.js";
import { generateFingerprint, generateFindingId } from "../../utils/fingerprint.js";
import type { ScanContext } from "../types.js";

const RULE_ID = "VC-HALL-001";
const RULE_ID_002 = "VC-HALL-002";

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
  {
    name: "express-rate-limit",
    category: "middleware",
    severity: "medium",
    description: "Rate limiting middleware",
  },
  {
    name: "bcrypt",
    category: "auth",
    severity: "high",
    description: "Password hashing library",
  },
  {
    name: "argon2",
    category: "auth",
    severity: "high",
    description: "Password hashing library",
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
 */
export function findSecurityImports(content: string, libraries: string[]): ImportMatch[] {
  const imports: ImportMatch[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

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
    const usageRegex = new RegExp(`\\b${id}\\b`, "g");
    const matches = afterImport.match(usageRegex);

    return { identifier: id, used: matches !== null && matches.length > 0 };
  });
}

/**
 * VC-HALL-001: Unused Security Imports
 *
 * Detects when security libraries are imported but not used
 */
export async function scanUnusedSecurityImports(context: ScanContext): Promise<Finding[]> {
  const { repoRoot, fileIndex } = context;
  const findings: Finding[] = [];
  const libNames = SECURITY_LIBS.map((l) => l.name);

  for (const relFile of fileIndex.allSourceFiles) {
    const absPath = resolvePath(repoRoot, relFile);
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

/**
 * VC-HALL-002: next-auth present but not enforced
 *
 * Detects when next-auth is installed but there's no middleware
 * or server-side auth enforcement in route handlers
 */
export async function scanNextAuthNotEnforced(context: ScanContext): Promise<Finding[]> {
  const { repoRoot, fileIndex, repoMeta, helpers } = context;
  const findings: Finding[] = [];

  // Only check if next-auth is present
  if (!repoMeta.hasNextAuth) {
    return findings;
  }

  // Check if middleware exists and uses next-auth
  if (fileIndex.middlewareFile) {
    const content = readFileSync(resolvePath(repoRoot, fileIndex.middlewareFile));
    if (content && /next-auth|withAuth|getToken/.test(content)) {
      return findings; // Middleware seems to enforce auth
    }
  }

  // Check API routes for auth enforcement
  let routesWithoutAuth = 0;
  let totalRoutes = 0;

  for (const relPath of fileIndex.apiRouteFiles) {
    const absPath = resolvePath(repoRoot, relPath);
    const sourceFile = helpers.parseFile(absPath);
    if (!sourceFile) continue;

    const handlers = helpers.findRouteHandlers(sourceFile);
    for (const handler of handlers) {
      totalRoutes++;
      if (!helpers.containsAuthCheck(handler.functionNode)) {
        routesWithoutAuth++;
      }
    }
  }

  // If most routes lack auth checks, emit finding
  if (totalRoutes > 0 && routesWithoutAuth / totalRoutes > 0.5) {
    const evidence: EvidenceItem[] = [
      {
        file: "package.json",
        startLine: 1,
        endLine: 1,
        label: "next-auth is installed",
      },
    ];

    if (!fileIndex.middlewareFile) {
      evidence.push({
        file: "middleware.ts",
        startLine: 1,
        endLine: 1,
        label: "No middleware file exists",
      });
    }

    const fingerprint = generateFingerprint({
      ruleId: RULE_ID_002,
      file: "package.json",
      symbol: "next-auth",
    });

    findings.push({
      id: generateFindingId({
        ruleId: RULE_ID_002,
        file: "package.json",
        symbol: "next-auth",
      }),
      ruleId: RULE_ID_002,
      title: "next-auth installed but not enforced in most routes",
      description: `next-auth is installed but ${routesWithoutAuth} of ${totalRoutes} API route handlers (${Math.round(routesWithoutAuth / totalRoutes * 100)}%) lack authentication checks. This may indicate incomplete auth implementation.`,
      severity: "medium",
      confidence: 0.75,
      category: "auth",
      evidence,
      remediation: {
        recommendedFix: "Add authentication middleware or explicit auth checks to API routes. Create middleware.ts using next-auth's withAuth helper with matcher for /api/:path*. See https://next-auth.js.org/configuration/nextjs",
        // No patch for file creation - apply-patches only handles modifications to existing files
      },
      links: {
        owasp: "https://owasp.org/Top10/A01_2021-Broken_Access_Control/",
      },
      fingerprint,
    });
  }

  return findings;
}
