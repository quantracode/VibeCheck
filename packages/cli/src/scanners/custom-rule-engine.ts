import type { Finding, EvidenceItem, CustomRule } from "@vibecheck/schema";
import type { ScanContext, Scanner } from "./types.js";
import { resolvePath } from "../utils/file-utils.js";
import { generateFingerprint, generateFindingId } from "../utils/fingerprint.js";
import { readFileSync } from "node:fs";
import { basename, extname } from "node:path";
import micromatch from "micromatch";

/**
 * Check if a file matches the file filter criteria
 */
function matchesFileFilter(
  filePath: string,
  filter: CustomRule["files"]
): boolean {
  if (!filter) {
    return true; // No filter means match all files
  }

  const ext = extname(filePath).slice(1).toLowerCase(); // Remove the dot
  const fileName = basename(filePath);

  // Check file type filter
  if (filter.file_type && filter.file_type.length > 0) {
    const hasAny = filter.file_type.includes("any");
    if (!hasAny) {
      const matchesType = filter.file_type.some((type) => {
        if (type === "config") {
          return /\.(config|rc)\.(js|ts|json|yaml|yml)$/.test(fileName) ||
                 /^\..*rc$/.test(fileName);
        }
        if (type === "env") {
          return /^\.env/.test(fileName);
        }
        return ext === type || (type === "tsx" && ext === "ts") || (type === "jsx" && ext === "js");
      });

      if (!matchesType) {
        return false;
      }
    }
  }

  // Check include patterns
  if (filter.include && filter.include.length > 0) {
    if (!micromatch.isMatch(filePath, filter.include)) {
      return false;
    }
  }

  // Check exclude patterns
  if (filter.exclude && filter.exclude.length > 0) {
    if (micromatch.isMatch(filePath, filter.exclude)) {
      return false;
    }
  }

  // Check directory filter
  if (filter.directories && filter.directories.length > 0) {
    const matchesDir = filter.directories.some((dir) => {
      const normalizedDir = dir.replace(/\\/g, "/");
      const normalizedPath = filePath.replace(/\\/g, "/");
      return normalizedPath.includes(normalizedDir);
    });

    if (!matchesDir) {
      return false;
    }
  }

  return true;
}

/**
 * Check if file content matches the match conditions
 */
function matchesContent(
  content: string,
  match: CustomRule["match"],
  caseSensitive = false
): { matches: boolean; matchedLines: number[]; snippet?: string } {
  const lines = content.split("\n");
  const matchedLines: number[] = [];
  let snippet: string | undefined;

  const normalize = (str: string) =>
    caseSensitive ? str : str.toLowerCase();

  // Check "contains" condition
  if (match.contains) {
    const searchTerm = normalize(match.contains);
    let found = false;

    for (let i = 0; i < lines.length; i++) {
      if (normalize(lines[i]).includes(searchTerm)) {
        matchedLines.push(i + 1); // 1-indexed
        if (!snippet) {
          snippet = lines[i].trim();
        }
        found = true;
        if (!match.all_must_match) {
          break; // First match is enough
        }
      }
    }

    if (!found) {
      return { matches: false, matchedLines: [] };
    }
  }

  // Check "not_contains" condition (should NOT be present)
  if (match.not_contains) {
    const searchTerm = normalize(match.not_contains);
    const defaultAllMatch = match.all_must_match ?? true; // Default true for not_contains

    for (let i = 0; i < lines.length; i++) {
      if (normalize(lines[i]).includes(searchTerm)) {
        // Found the term that should NOT be present
        if (defaultAllMatch) {
          // If we require all to NOT match, finding one means failure
          return { matches: false, matchedLines: [] };
        }
        // Otherwise continue checking
      }
    }

    // If we get here with not_contains, it means the term was NOT found (which is good)
    // Record a match at line 1 as a placeholder
    if (matchedLines.length === 0) {
      matchedLines.push(1);
      snippet = lines[0]?.trim() || "";
    }
  }

  // Check "regex" condition
  if (match.regex) {
    try {
      const flags = caseSensitive ? "g" : "gi";
      const regex = new RegExp(match.regex, flags);
      let found = false;

      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) {
          matchedLines.push(i + 1);
          if (!snippet) {
            snippet = lines[i].trim();
          }
          found = true;
          if (!match.all_must_match) {
            break;
          }
        }
      }

      if (!found) {
        return { matches: false, matchedLines: [] };
      }
    } catch (e) {
      console.error(`Invalid regex: ${match.regex}`);
      return { matches: false, matchedLines: [] };
    }
  }

  return {
    matches: matchedLines.length > 0,
    matchedLines,
    snippet,
  };
}

/**
 * Check if file matches context conditions
 */
function matchesContext(
  content: string,
  sourceFile: any,
  context: CustomRule["context"],
  helpers: ScanContext["helpers"]
): boolean {
  if (!context) {
    return true; // No context conditions means match
  }

  const normalizeContent = content.toLowerCase();

  // Check required imports
  if (context.requires_import && context.requires_import.length > 0) {
    const hasAllRequiredImports = context.requires_import.every((imp) => {
      return normalizeContent.includes(`from "${imp}"`) ||
             normalizeContent.includes(`from '${imp}'`) ||
             normalizeContent.includes(`require("${imp}")`) ||
             normalizeContent.includes(`require('${imp}')`);
    });

    if (!hasAllRequiredImports) {
      return false;
    }
  }

  // Check excluded imports
  if (context.excludes_import && context.excludes_import.length > 0) {
    const hasExcludedImport = context.excludes_import.some((imp) => {
      return normalizeContent.includes(`from "${imp}"`) ||
             normalizeContent.includes(`from '${imp}'`) ||
             normalizeContent.includes(`require("${imp}")`) ||
             normalizeContent.includes(`require('${imp}')`);
    });

    if (hasExcludedImport) {
      return false;
    }
  }

  // Check file contains
  if (context.file_contains && context.file_contains.length > 0) {
    const hasAll = context.file_contains.every((term) =>
      normalizeContent.includes(term.toLowerCase())
    );

    if (!hasAll) {
      return false;
    }
  }

  // Check file not contains
  if (context.file_not_contains && context.file_not_contains.length > 0) {
    const hasAny = context.file_not_contains.some((term) =>
      normalizeContent.includes(term.toLowerCase())
    );

    if (hasAny) {
      return false;
    }
  }

  // Check function type (for route handlers)
  if (context.in_function && context.in_function.length > 0 && sourceFile) {
    try {
      const handlers = helpers.findRouteHandlers(sourceFile);
      if (handlers.length === 0) {
        return false; // No handlers found
      }

      const hasMatchingHandler = handlers.some((handler) => {
        return context.in_function?.includes(handler.method) ||
               context.in_function?.includes("route_handler") ||
               context.in_function?.includes("any");
      });

      if (!hasMatchingHandler) {
        return false;
      }
    } catch (e) {
      // If parsing fails, skip function-based filtering
    }
  }

  return true;
}

/**
 * Convert a custom rule into a scanner function
 */
export function createScannerFromRule(rule: CustomRule): Scanner {
  return async (context: ScanContext): Promise<Finding[]> => {
    const { repoRoot, fileIndex, helpers } = context;
    const findings: Finding[] = [];

    // Determine which files to scan
    let filesToScan = fileIndex.allSourceFiles;

    // Apply file filters
    filesToScan = filesToScan.filter((relPath) =>
      matchesFileFilter(relPath, rule.files)
    );

    // Scan each file
    for (const relPath of filesToScan) {
      const absPath = resolvePath(repoRoot, relPath);

      try {
        const content = readFileSync(absPath, "utf-8");

        // Parse file if it's a TypeScript/JavaScript file
        let sourceFile = null;
        if (/\.(ts|tsx|js|jsx)$/.test(relPath)) {
          sourceFile = helpers.parseFile(absPath);
        }

        // Check context conditions
        if (!matchesContext(content, sourceFile, rule.context, helpers)) {
          continue;
        }

        // Check match conditions
        const matchResult = matchesContent(
          content,
          rule.match,
          rule.match.case_sensitive
        );

        if (!matchResult.matches) {
          continue;
        }

        // Create finding
        const evidence: EvidenceItem[] = matchResult.matchedLines
          .slice(0, 3) // Limit to first 3 matches
          .map((lineNum) => ({
            file: relPath,
            startLine: lineNum,
            endLine: lineNum,
            snippet: matchResult.snippet || content.split("\n")[lineNum - 1]?.trim() || "",
            label: `Match found`,
          }));

        const fingerprint = generateFingerprint({
          ruleId: rule.id,
          file: relPath,
          line: matchResult.matchedLines[0] || 1,
          snippet: matchResult.snippet || "",
        });

        const finding: Finding = {
          id: generateFindingId({
            ruleId: rule.id,
            file: relPath,
            symbol: matchResult.snippet || "",
            startLine: matchResult.matchedLines[0] || 1,
          }),
          ruleId: rule.id,
          title: rule.title,
          description: rule.description,
          severity: rule.severity,
          confidence: rule.confidence,
          category: rule.category,
          evidence,
          remediation: {
            recommendedFix: rule.recommended_fix,
            patch: rule.patch,
          },
          links: rule.links,
          fingerprint,
        };

        findings.push(finding);
      } catch (error) {
        // Skip files that can't be read or parsed
        continue;
      }
    }

    return findings;
  };
}

/**
 * Create scanners from multiple custom rules
 */
export function createScannersFromRules(rules: CustomRule[]): Scanner[] {
  return rules.map(createScannerFromRule);
}
