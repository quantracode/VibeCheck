/**
 * Phase 3: Intent Claim Miner
 *
 * Parses comments, identifiers, imports, and config for security claims.
 * Deterministic, local-only.
 */

import crypto from "node:crypto";
import path from "node:path";
import { SyntaxKind, type SourceFile } from "ts-morph";
import type {
  ScanContext,
  IntentClaim,
  IntentClaimType,
  IntentClaimSource,
  IntentClaimScope,
  IntentClaimStrength,
  RouteInfo,
} from "../scanners/types.js";
import { generateRouteId, filePathToRoutePath } from "./proof-trace-builder.js";

/**
 * Patterns for detecting security intent claims
 */
const INTENT_PATTERNS: {
  pattern: RegExp;
  type: IntentClaimType;
  strength: IntentClaimStrength;
}[] = [
  // Auth patterns
  { pattern: /\b(auth|authenticate|authorized|protected|secured)\b/i, type: "AUTH_ENFORCED", strength: "strong" },
  { pattern: /\brequires?\s*(auth|login|session)\b/i, type: "AUTH_ENFORCED", strength: "strong" },
  { pattern: /\b(getServerSession|useSession|withAuth|requireAuth)\b/, type: "AUTH_ENFORCED", strength: "medium" },

  // Validation patterns
  { pattern: /\b(validat(e|ed|ion|or)|sanitiz(e|ed))\b/i, type: "INPUT_VALIDATED", strength: "strong" },
  { pattern: /\b(schema|zod|yup|joi)\b/i, type: "INPUT_VALIDATED", strength: "medium" },
  { pattern: /\.parse\(|\.validate\(|\.safeParse\(/, type: "INPUT_VALIDATED", strength: "medium" },

  // CSRF patterns
  { pattern: /\b(csrf|xsrf|cross.?site)\b/i, type: "CSRF_ENABLED", strength: "strong" },

  // Rate limiting patterns
  { pattern: /\b(rate.?limit|throttl|limit.?rate)\b/i, type: "RATE_LIMITED", strength: "strong" },

  // Encryption patterns
  { pattern: /\b(encrypt|cipher|aes|rsa)\b/i, type: "ENCRYPTED_AT_REST", strength: "medium" },

  // Middleware patterns
  { pattern: /\b(middleware|intercept|guard)\b/i, type: "MIDDLEWARE_PROTECTED", strength: "medium" },
];

/**
 * Security-related import patterns
 */
const SECURITY_IMPORTS: { module: RegExp; type: IntentClaimType }[] = [
  { module: /^next-auth/, type: "AUTH_ENFORCED" },
  { module: /^@auth\//, type: "AUTH_ENFORCED" },
  { module: /^passport/, type: "AUTH_ENFORCED" },
  { module: /^zod$/, type: "INPUT_VALIDATED" },
  { module: /^yup$/, type: "INPUT_VALIDATED" },
  { module: /^joi$/, type: "INPUT_VALIDATED" },
  { module: /^csurf$/, type: "CSRF_ENABLED" },
  { module: /^express-rate-limit$/, type: "RATE_LIMITED" },
  { module: /^rate-limiter-flexible$/, type: "RATE_LIMITED" },
  { module: /^helmet$/, type: "MIDDLEWARE_PROTECTED" },
];

/**
 * Generate a stable intent ID
 */
export function generateIntentId(
  type: IntentClaimType,
  file: string,
  line: number,
  evidence: string
): string {
  const normalized = `${type}:${file}:${line}:${evidence.slice(0, 50)}`.toLowerCase();
  return crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 12);
}

/**
 * Mine intent claims from a source file
 */
export function mineIntentClaims(
  ctx: ScanContext,
  sourceFile: SourceFile,
  routes: RouteInfo[]
): IntentClaim[] {
  const claims: IntentClaim[] = [];
  const filePath = sourceFile.getFilePath();
  const relPath = path.relative(ctx.repoRoot, filePath).replace(/\\/g, "/");

  // Mine from comments
  claims.push(...mineFromComments(sourceFile, relPath, routes));

  // Mine from imports
  claims.push(...mineFromImports(sourceFile, relPath));

  // Mine from identifiers (function names, variable names)
  claims.push(...mineFromIdentifiers(sourceFile, relPath, routes));

  return claims;
}

/**
 * Mine claims from code comments
 */
function mineFromComments(
  sourceFile: SourceFile,
  relPath: string,
  routes: RouteInfo[]
): IntentClaim[] {
  const claims: IntentClaim[] = [];

  // Get all comments in the file
  const leadingComments: Array<{ text: string; line: number }> = [];

  sourceFile.forEachDescendant((node) => {
    const nodeComments = node.getLeadingCommentRanges();
    for (const comment of nodeComments) {
      leadingComments.push({
        text: comment.getText(),
        line: sourceFile.getLineAndColumnAtPos(comment.getPos()).line,
      });
    }
  });

  // Also get file-level comments
  const fullText = sourceFile.getFullText();
  const commentMatches = fullText.matchAll(/\/\*\*?[\s\S]*?\*\/|\/\/[^\n]*/g);
  for (const match of commentMatches) {
    const line = sourceFile.getLineAndColumnAtPos(match.index || 0).line;
    // Avoid duplicates
    if (!leadingComments.some((c) => c.line === line)) {
      leadingComments.push({ text: match[0], line });
    }
  }

  for (const { text, line } of leadingComments) {
    for (const { pattern, type, strength } of INTENT_PATTERNS) {
      if (pattern.test(text)) {
        // Determine scope based on comment context
        const scope = determineCommentScope(text, relPath);

        // Try to find associated route
        const targetRouteId = findAssociatedRoute(relPath, line, routes);

        claims.push({
          intentId: generateIntentId(type, relPath, line, text),
          type,
          scope,
          targetRouteId,
          source: "comment",
          location: {
            file: relPath,
            startLine: line,
            endLine: line,
          },
          strength,
          textEvidence: truncateEvidence(text),
        });
        break; // One claim per comment
      }
    }
  }

  return claims;
}

/**
 * Mine claims from import statements
 */
function mineFromImports(sourceFile: SourceFile, relPath: string): IntentClaim[] {
  const claims: IntentClaim[] = [];

  for (const importDecl of sourceFile.getImportDeclarations()) {
    const moduleSpecifier = importDecl.getModuleSpecifierValue();
    const line = importDecl.getStartLineNumber();

    for (const { module, type } of SECURITY_IMPORTS) {
      if (module.test(moduleSpecifier)) {
        claims.push({
          intentId: generateIntentId(type, relPath, line, moduleSpecifier),
          type,
          scope: "module",
          source: "import",
          location: {
            file: relPath,
            startLine: line,
            endLine: line,
          },
          strength: "medium",
          textEvidence: `import from "${moduleSpecifier}"`,
        });
        break;
      }
    }
  }

  return claims;
}

/**
 * Mine claims from function and variable identifiers
 */
function mineFromIdentifiers(
  sourceFile: SourceFile,
  relPath: string,
  routes: RouteInfo[]
): IntentClaim[] {
  const claims: IntentClaim[] = [];

  // Function declarations
  for (const func of sourceFile.getFunctions()) {
    const name = func.getName() || "";
    const line = func.getStartLineNumber();

    for (const { pattern, type, strength } of INTENT_PATTERNS) {
      if (pattern.test(name)) {
        const targetRouteId = findAssociatedRoute(relPath, line, routes);

        claims.push({
          intentId: generateIntentId(type, relPath, line, name),
          type,
          scope: "route",
          targetRouteId,
          source: "identifier",
          location: {
            file: relPath,
            startLine: line,
            endLine: func.getEndLineNumber(),
          },
          strength,
          textEvidence: `function ${name}`,
        });
        break;
      }
    }
  }

  // Variable declarations with security-related names
  sourceFile.forEachDescendant((node) => {
    if (node.getKind() === SyntaxKind.VariableDeclaration) {
      const text = node.getText();
      const name = text.split("=")[0].trim();
      const line = node.getStartLineNumber();

      for (const { pattern, type, strength } of INTENT_PATTERNS) {
        if (pattern.test(name)) {
          claims.push({
            intentId: generateIntentId(type, relPath, line, name),
            type,
            scope: "route",
            source: "identifier",
            location: {
              file: relPath,
              startLine: line,
              endLine: line,
            },
            strength,
            textEvidence: `variable: ${truncateEvidence(name)}`,
          });
          break;
        }
      }
    }
  });

  return claims;
}

/**
 * Determine the scope of a comment-based claim
 */
function determineCommentScope(text: string, filePath: string): IntentClaimScope {
  const lowerText = text.toLowerCase();

  // Module-level indicators (file or function scope maps to module)
  if (
    lowerText.includes("@file") ||
    lowerText.includes("this file") ||
    lowerText.includes("this module")
  ) {
    return "module";
  }

  // Route-level indicators
  if (
    lowerText.includes("this route") ||
    lowerText.includes("this endpoint") ||
    lowerText.includes("this handler")
  ) {
    return "route";
  }

  // Global indicators
  if (
    lowerText.includes("all routes") ||
    lowerText.includes("every request") ||
    lowerText.includes("globally")
  ) {
    return "global";
  }

  // Default to route scope for comments near handlers
  return "route";
}

/**
 * Find an associated route for a given file and line
 */
function findAssociatedRoute(
  filePath: string,
  line: number,
  routes: RouteInfo[]
): string | undefined {
  // Find routes in the same file
  const fileRoutes = routes.filter((r) => r.file === filePath);

  if (fileRoutes.length === 0) {
    return undefined;
  }

  // If only one route, associate with it
  if (fileRoutes.length === 1) {
    return fileRoutes[0].routeId;
  }

  // Find the closest route that starts after or contains this line
  for (const route of fileRoutes) {
    if (line >= route.startLine && line <= route.endLine) {
      return route.routeId;
    }
  }

  // Find the closest route that starts after this line
  const afterRoutes = fileRoutes.filter((r) => r.startLine > line);
  if (afterRoutes.length > 0) {
    return afterRoutes.sort((a, b) => a.startLine - b.startLine)[0].routeId;
  }

  return undefined;
}

/**
 * Truncate evidence text
 */
function truncateEvidence(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 100) {
    return cleaned;
  }
  return cleaned.slice(0, 97) + "...";
}

/**
 * Mine all intent claims from scan context
 */
export function mineAllIntentClaims(
  ctx: ScanContext,
  routes: RouteInfo[]
): IntentClaim[] {
  const allClaims: IntentClaim[] = [];

  // Mine from all source files
  for (const file of ctx.fileIndex.allSourceFiles) {
    // allSourceFiles are relative paths, resolve to absolute for parseFile
    const absolutePath = path.join(ctx.repoRoot, file);
    const sourceFile = ctx.helpers.parseFile(absolutePath);
    if (!sourceFile) continue;

    const claims = mineIntentClaims(ctx, sourceFile, routes);
    allClaims.push(...claims);
  }

  // Deduplicate by intentId
  const seen = new Set<string>();
  return allClaims.filter((claim) => {
    if (seen.has(claim.intentId)) {
      return false;
    }
    seen.add(claim.intentId);
    return true;
  });
}

/**
 * Find claims that target a specific route
 */
export function findClaimsForRoute(
  claims: IntentClaim[],
  routeId: string
): IntentClaim[] {
  return claims.filter(
    (c) => c.targetRouteId === routeId || c.scope === "global" || c.scope === "module"
  );
}

/**
 * Find unproven claims (claims without corresponding proof)
 */
export function findUnprovenClaims(
  claims: IntentClaim[],
  proofTraces: Map<string, { authProven: boolean; validationProven: boolean }>
): IntentClaim[] {
  const unproven: IntentClaim[] = [];

  for (const claim of claims) {
    if (!claim.targetRouteId) continue;

    const proof = proofTraces.get(claim.targetRouteId);
    if (!proof) {
      unproven.push(claim);
      continue;
    }

    // Check if the claim type matches the proof
    if (claim.type === "AUTH_ENFORCED" && !proof.authProven) {
      unproven.push(claim);
    } else if (claim.type === "INPUT_VALIDATED" && !proof.validationProven) {
      unproven.push(claim);
    }
  }

  return unproven;
}
