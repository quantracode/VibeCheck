import type { Finding, EvidenceItem, AbuseClassification } from "@vibecheck/schema";
import type { ScanContext, RouteHandler, FunctionNode } from "../types.js";
import { resolvePath } from "../../utils/file-utils.js";
import { generateFingerprint, generateFindingId } from "../../utils/fingerprint.js";
import type { Node, SourceFile } from "ts-morph";

// ============================================================================
// Rule IDs
// ============================================================================

const RULE_IDS = {
  AI_GENERATION: "VC-ABUSE-001",
  CODE_EXECUTION: "VC-ABUSE-002",
  FILE_PROCESSING: "VC-ABUSE-003",
  EXPENSIVE_ENDPOINT: "VC-ABUSE-004",
} as const;

// ============================================================================
// Pattern Definitions
// ============================================================================

/**
 * Route patterns that indicate compute-intensive operations
 */
const ROUTE_PATTERNS = {
  AI_GENERATION: [
    /generate[-_]?/i,
    /chat[-_]?completion/i,
    /completion/i,
    /embed[-_]?/i,
    /transcribe/i,
    /translate/i,
    /summarize/i,
    /code[-_]?expert/i,
    /ai[-_]?/i,
    /llm[-_]?/i,
    /gpt[-_]?/i,
    /claude[-_]?/i,
    /openai/i,
    /anthropic/i,
  ],
  CODE_EXECUTION: [
    /eval[-_]?/i,
    /execute[-_]?/i,
    /run[-_]?code/i,
    /sandbox/i,
    /repl/i,
    /compile/i,
    /interpret/i,
  ],
  FILE_PROCESSING: [
    /parse[-_]?/i,
    /convert[-_]?/i,
    /transform[-_]?/i,
    /process[-_]?file/i,
    /upload[-_]?/i,
    /import[-_]?/i,
    /export[-_]?/i,
    /render[-_]?/i,
    /resize[-_]?/i,
    /thumbnail/i,
    /pdf[-_]?/i,
    /image[-_]?/i,
    /video[-_]?/i,
    /audio[-_]?/i,
  ],
  DATA_EXPORT: [
    /bulk[-_]?/i,
    /batch[-_]?/i,
    /export[-_]?all/i,
    /download[-_]?all/i,
    /dump/i,
  ],
};

/**
 * Import patterns that indicate expensive operations
 */
const EXPENSIVE_IMPORT_PATTERNS = [
  // AI/LLM SDKs
  { pattern: /openai/i, category: "ai_generation" as const, costMultiplier: 100 },
  { pattern: /@anthropic-ai\/sdk/i, category: "ai_generation" as const, costMultiplier: 100 },
  { pattern: /langchain/i, category: "ai_generation" as const, costMultiplier: 100 },
  { pattern: /cohere/i, category: "ai_generation" as const, costMultiplier: 80 },
  { pattern: /replicate/i, category: "ai_generation" as const, costMultiplier: 150 },
  { pattern: /@huggingface/i, category: "ai_generation" as const, costMultiplier: 50 },

  // Code execution
  { pattern: /vm2?/i, category: "code_execution" as const, costMultiplier: 50 },
  { pattern: /isolated-vm/i, category: "code_execution" as const, costMultiplier: 50 },
  { pattern: /child_process/i, category: "code_execution" as const, costMultiplier: 30 },

  // File processing
  { pattern: /sharp/i, category: "file_processing" as const, costMultiplier: 20 },
  { pattern: /jimp/i, category: "file_processing" as const, costMultiplier: 15 },
  { pattern: /pdf-lib/i, category: "file_processing" as const, costMultiplier: 25 },
  { pattern: /pdfkit/i, category: "file_processing" as const, costMultiplier: 25 },
  { pattern: /puppeteer/i, category: "file_processing" as const, costMultiplier: 100 },
  { pattern: /playwright/i, category: "file_processing" as const, costMultiplier: 100 },
  { pattern: /ffmpeg/i, category: "file_processing" as const, costMultiplier: 200 },
  { pattern: /fluent-ffmpeg/i, category: "file_processing" as const, costMultiplier: 200 },

  // External APIs
  { pattern: /stripe/i, category: "external_api" as const, costMultiplier: 10 },
  { pattern: /twilio/i, category: "external_api" as const, costMultiplier: 20 },
  { pattern: /sendgrid/i, category: "external_api" as const, costMultiplier: 5 },
  { pattern: /aws-sdk/i, category: "external_api" as const, costMultiplier: 15 },
  { pattern: /@aws-sdk/i, category: "external_api" as const, costMultiplier: 15 },
];

/**
 * Function call patterns that indicate expensive operations
 */
const EXPENSIVE_CALL_PATTERNS = [
  // OpenAI
  { pattern: /\.chat\.completions\.create/i, category: "ai_generation" as const, costMultiplier: 100 },
  { pattern: /\.completions\.create/i, category: "ai_generation" as const, costMultiplier: 100 },
  { pattern: /\.embeddings\.create/i, category: "ai_generation" as const, costMultiplier: 20 },
  { pattern: /\.images\.generate/i, category: "ai_generation" as const, costMultiplier: 500 },
  { pattern: /\.audio\.transcriptions/i, category: "ai_generation" as const, costMultiplier: 50 },

  // Anthropic
  { pattern: /\.messages\.create/i, category: "ai_generation" as const, costMultiplier: 100 },

  // Generic AI
  { pattern: /generateText/i, category: "ai_generation" as const, costMultiplier: 80 },
  { pattern: /streamText/i, category: "ai_generation" as const, costMultiplier: 80 },

  // Code execution
  { pattern: /eval\s*\(/i, category: "code_execution" as const, costMultiplier: 50 },
  { pattern: /new\s+Function\s*\(/i, category: "code_execution" as const, costMultiplier: 50 },
  { pattern: /vm\.run/i, category: "code_execution" as const, costMultiplier: 50 },
  { pattern: /exec\s*\(/i, category: "code_execution" as const, costMultiplier: 30 },
  { pattern: /spawn\s*\(/i, category: "code_execution" as const, costMultiplier: 30 },

  // File processing
  { pattern: /sharp\s*\(/i, category: "file_processing" as const, costMultiplier: 20 },
  { pattern: /\.resize\s*\(/i, category: "file_processing" as const, costMultiplier: 15 },
  { pattern: /\.toBuffer\s*\(/i, category: "file_processing" as const, costMultiplier: 10 },
  { pattern: /puppeteer.*launch/i, category: "file_processing" as const, costMultiplier: 100 },
  { pattern: /page\.pdf\s*\(/i, category: "file_processing" as const, costMultiplier: 50 },
  { pattern: /page\.screenshot\s*\(/i, category: "file_processing" as const, costMultiplier: 30 },
];

// ============================================================================
// Enforcement Detection Helpers
// ============================================================================

interface EnforcementStatus {
  hasAuth: boolean;
  hasRateLimit: boolean;
  hasRequestSizeLimit: boolean;
  hasTimeout: boolean;
  hasInputValidation: boolean;
}

/**
 * Check for auth enforcement patterns
 */
function detectAuthEnforcement(functionNode: FunctionNode, helpers: ScanContext["helpers"]): boolean {
  return helpers.containsAuthCheck(functionNode);
}

/**
 * Check for rate limit patterns
 */
function detectRateLimitEnforcement(sourceFile: SourceFile, helpers: ScanContext["helpers"]): boolean {
  return helpers.hasRateLimitSignals(sourceFile);
}

/**
 * Check for request size limit patterns
 */
function detectRequestSizeLimit(functionNode: FunctionNode, helpers: ScanContext["helpers"]): boolean {
  const text = helpers.getNodeText(functionNode);
  const patterns = [
    /content-length/i,
    /maxBodyLength/i,
    /bodyParser.*limit/i,
    /\.size\s*[<>]/i,
    /MAX_SIZE/i,
    /sizeLimit/i,
    /maxSize/i,
    /fileSizeLimit/i,
  ];
  return patterns.some(p => p.test(text));
}

/**
 * Check for timeout patterns
 */
function detectTimeoutEnforcement(functionNode: FunctionNode, helpers: ScanContext["helpers"]): boolean {
  const text = helpers.getNodeText(functionNode);
  const patterns = [
    /timeout/i,
    /AbortController/i,
    /signal/i,
    /setTimeout/i,
    /maxDuration/i,
  ];
  return patterns.some(p => p.test(text));
}

/**
 * Check for input validation patterns
 */
function detectInputValidation(functionNode: FunctionNode, helpers: ScanContext["helpers"]): boolean {
  const validationUsage = helpers.findValidationUsage(functionNode);
  return validationUsage.length > 0;
}

/**
 * Get all enforcement status for a handler
 */
function getEnforcementStatus(
  functionNode: FunctionNode,
  sourceFile: SourceFile,
  helpers: ScanContext["helpers"]
): EnforcementStatus {
  return {
    hasAuth: detectAuthEnforcement(functionNode, helpers),
    hasRateLimit: detectRateLimitEnforcement(sourceFile, helpers),
    hasRequestSizeLimit: detectRequestSizeLimit(functionNode, helpers),
    hasTimeout: detectTimeoutEnforcement(functionNode, helpers),
    hasInputValidation: detectInputValidation(functionNode, helpers),
  };
}

/**
 * Get list of missing enforcements
 */
function getMissingEnforcements(status: EnforcementStatus): AbuseClassification["missingEnforcement"] {
  const missing: AbuseClassification["missingEnforcement"] = [];
  if (!status.hasAuth) missing.push("auth");
  if (!status.hasRateLimit) missing.push("rate_limit");
  if (!status.hasRequestSizeLimit) missing.push("request_size_limit");
  if (!status.hasTimeout) missing.push("timeout");
  if (!status.hasInputValidation) missing.push("input_validation");
  return missing;
}

// ============================================================================
// Abuse Detection Helpers
// ============================================================================

interface AbuseMatch {
  category: AbuseClassification["category"];
  costMultiplier: number;
  matchedPattern: string;
  matchType: "route" | "import" | "call";
}

/**
 * Check if route path matches abuse patterns
 */
function matchRoutePatterns(routePath: string): AbuseMatch | null {
  for (const [category, patterns] of Object.entries(ROUTE_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(routePath)) {
        const categoryMap: Record<string, AbuseClassification["category"]> = {
          AI_GENERATION: "ai_generation",
          CODE_EXECUTION: "code_execution",
          FILE_PROCESSING: "file_processing",
          DATA_EXPORT: "data_export",
        };
        return {
          category: categoryMap[category] || "computation",
          costMultiplier: category === "AI_GENERATION" ? 100 :
                         category === "CODE_EXECUTION" ? 50 :
                         category === "FILE_PROCESSING" ? 25 : 10,
          matchedPattern: pattern.source,
          matchType: "route",
        };
      }
    }
  }
  return null;
}

/**
 * Check for expensive imports in file
 */
function findExpensiveImports(sourceFile: SourceFile): AbuseMatch[] {
  const matches: AbuseMatch[] = [];
  const imports = sourceFile.getImportDeclarations();

  for (const imp of imports) {
    const moduleSpecifier = imp.getModuleSpecifierValue();
    for (const { pattern, category, costMultiplier } of EXPENSIVE_IMPORT_PATTERNS) {
      if (pattern.test(moduleSpecifier)) {
        matches.push({
          category,
          costMultiplier,
          matchedPattern: moduleSpecifier,
          matchType: "import",
        });
        break;
      }
    }
  }

  return matches;
}

/**
 * Check for expensive function calls in handler
 */
function findExpensiveCalls(functionNode: FunctionNode, helpers: ScanContext["helpers"]): AbuseMatch[] {
  const matches: AbuseMatch[] = [];
  const text = helpers.getNodeText(functionNode);

  for (const { pattern, category, costMultiplier } of EXPENSIVE_CALL_PATTERNS) {
    if (pattern.test(text)) {
      matches.push({
        category,
        costMultiplier,
        matchedPattern: pattern.source,
        matchType: "call",
      });
    }
  }

  return matches;
}

/**
 * Calculate abuse risk based on cost multiplier and missing enforcements
 */
function calculateAbuseRisk(
  costMultiplier: number,
  missingCount: number
): AbuseClassification["risk"] {
  // High cost + many missing enforcements = critical
  if (costMultiplier >= 100 && missingCount >= 3) return "critical";
  if (costMultiplier >= 50 && missingCount >= 2) return "high";
  if (costMultiplier >= 20 && missingCount >= 1) return "medium";
  if (missingCount >= 2) return "medium";
  return "low";
}

/**
 * Get route path from file path (Next.js App Router)
 */
function getRoutePathFromFile(filePath: string): string {
  // Convert app/api/generate/route.ts -> /api/generate
  const match = filePath.match(/app(\/api\/[^/]+(?:\/[^/]+)*?)\/route\.[tj]sx?$/);
  if (match) {
    return match[1].replace(/\\/g, "/");
  }

  // Handle dynamic routes [param] -> :param
  return filePath
    .replace(/.*?app/, "")
    .replace(/\/route\.[tj]sx?$/, "")
    .replace(/\[([^\]]+)\]/g, ":$1")
    .replace(/\\/g, "/");
}

// ============================================================================
// Main Scanner
// ============================================================================

/**
 * VC-ABUSE-001 to VC-ABUSE-004: Compute Abuse Detection
 *
 * Detects compute-intensive endpoints that may be vulnerable to abuse:
 * - AI/LLM generation endpoints
 * - Code execution endpoints
 * - File processing endpoints
 * - Expensive API endpoints
 *
 * Checks for missing enforcement:
 * - Authentication
 * - Rate limiting
 * - Request size limits
 * - Timeouts
 * - Input validation
 */
export async function scanComputeAbuse(context: ScanContext): Promise<Finding[]> {
  const { repoRoot, fileIndex, helpers } = context;
  const findings: Finding[] = [];

  for (const relPath of fileIndex.apiRouteFiles) {
    const absPath = resolvePath(repoRoot, relPath);
    const sourceFile = helpers.parseFile(absPath);

    if (!sourceFile) continue;

    const handlers = helpers.findRouteHandlers(sourceFile);
    const routePath = getRoutePathFromFile(relPath);
    const fileImports = findExpensiveImports(sourceFile);

    for (const handler of handlers) {
      // Collect all abuse matches
      const allMatches: AbuseMatch[] = [];

      // Check route patterns
      const routeMatch = matchRoutePatterns(routePath);
      if (routeMatch) {
        allMatches.push(routeMatch);
      }

      // Check expensive calls in handler
      const callMatches = findExpensiveCalls(handler.functionNode, helpers);
      allMatches.push(...callMatches);

      // Check expensive imports
      allMatches.push(...fileImports);

      // Skip if no abuse patterns matched
      if (allMatches.length === 0) continue;

      // Get enforcement status
      const enforcement = getEnforcementStatus(handler.functionNode, sourceFile, helpers);
      const missingEnforcements = getMissingEnforcements(enforcement);

      // Skip if all enforcements are present
      if (missingEnforcements.length === 0) continue;

      // Use highest cost multiplier
      const maxCost = Math.max(...allMatches.map(m => m.costMultiplier));
      const primaryMatch = allMatches.find(m => m.costMultiplier === maxCost) || allMatches[0];

      // Calculate risk
      const risk = calculateAbuseRisk(maxCost, missingEnforcements.length);

      // Determine severity based on risk
      const severityMap = {
        critical: "critical" as const,
        high: "high" as const,
        medium: "medium" as const,
        low: "low" as const,
      };

      // Determine rule ID based on category
      const ruleId = primaryMatch.category === "ai_generation" ? RULE_IDS.AI_GENERATION :
                    primaryMatch.category === "code_execution" ? RULE_IDS.CODE_EXECUTION :
                    primaryMatch.category === "file_processing" ? RULE_IDS.FILE_PROCESSING :
                    RULE_IDS.EXPENSIVE_ENDPOINT;

      const handlerText = helpers.getNodeText(handler.functionNode);

      const evidence: EvidenceItem[] = [
        {
          file: relPath,
          startLine: handler.startLine,
          endLine: handler.endLine,
          snippet: handlerText.slice(0, 300) + (handlerText.length > 300 ? "..." : ""),
          label: `${handler.method} handler with ${primaryMatch.category.replace(/_/g, " ")} pattern`,
        },
      ];

      // Add match evidence
      for (const match of allMatches.slice(0, 3)) {
        evidence.push({
          file: relPath,
          startLine: handler.startLine,
          endLine: handler.startLine,
          snippet: `Matched: ${match.matchedPattern} (${match.matchType})`,
          label: `${match.category.replace(/_/g, " ")} pattern (${match.costMultiplier}x cost)`,
        });
      }

      const fingerprint = generateFingerprint({
        ruleId,
        file: relPath,
        symbol: `${handler.method}:${primaryMatch.category}`,
        startLine: handler.startLine,
      });

      const abuseClassification: AbuseClassification = {
        risk,
        category: primaryMatch.category,
        costAmplification: maxCost,
        missingEnforcement: missingEnforcements,
        confidence: 0.75,
      };

      findings.push({
        id: generateFindingId({
          ruleId,
          file: relPath,
          symbol: `${handler.method}:${primaryMatch.category}`,
          startLine: handler.startLine,
        }),
        ruleId,
        title: `${risk.charAt(0).toUpperCase() + risk.slice(1)} compute abuse risk: ${primaryMatch.category.replace(/_/g, " ")} endpoint`,
        description: generateDescription(primaryMatch, missingEnforcements, maxCost, routePath),
        severity: severityMap[risk],
        confidence: abuseClassification.confidence,
        category: "abuse",
        evidence,
        remediation: generateRemediation(primaryMatch.category, missingEnforcements),
        links: {
          owasp: "https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html",
          cwe: "https://cwe.mitre.org/data/definitions/770.html",
        },
        fingerprint,
        abuseClassification,
      });
    }
  }

  return findings;
}

/**
 * Generate finding description
 */
function generateDescription(
  match: AbuseMatch,
  missing: AbuseClassification["missingEnforcement"],
  costMultiplier: number,
  routePath: string
): string {
  const categoryDescriptions: Record<AbuseClassification["category"], string> = {
    ai_generation: "AI/LLM operations that consume significant compute resources and API costs",
    code_execution: "code execution capabilities that can be abused for cryptomining or resource exhaustion",
    file_processing: "file processing operations that can be abused with large or malicious files",
    external_api: "expensive external API calls that incur per-request costs",
    computation: "CPU-intensive operations vulnerable to resource exhaustion",
    data_export: "bulk data operations that can be abused to extract large datasets",
    upload_processing: "file upload processing that can be exploited with oversized files",
  };

  const missingText = missing.map(m => m.replace(/_/g, " ")).join(", ");

  return `This endpoint (${routePath}) performs ${categoryDescriptions[match.category]}. ` +
    `Without proper controls, attackers can abuse this endpoint causing significant financial damage or service degradation. ` +
    `Estimated cost amplification: ${costMultiplier}x per request. ` +
    `Missing enforcement: ${missingText}.`;
}

/**
 * Generate remediation based on category and missing enforcements
 */
function generateRemediation(
  category: AbuseClassification["category"],
  missing: AbuseClassification["missingEnforcement"]
): Finding["remediation"] {
  const recommendations: string[] = [];

  if (missing.includes("auth")) {
    recommendations.push("authentication (e.g., getServerSession with 401 for unauthorized)");
  }

  if (missing.includes("rate_limit")) {
    recommendations.push("rate limiting (e.g., @upstash/ratelimit with sliding window)");
  }

  if (missing.includes("request_size_limit")) {
    recommendations.push("request size limits (check JSON.stringify(body).length, reject if > threshold)");
  }

  if (missing.includes("timeout")) {
    recommendations.push("timeout enforcement (use AbortController with setTimeout)");
  }

  if (missing.includes("input_validation")) {
    recommendations.push("input validation (use Zod/Yup to validate and limit input size)");
  }

  return {
    recommendedFix: `Add the following enforcement controls to protect against compute abuse: ${recommendations.join("; ")}.`,
    // No patch for compute abuse fixes - each requires different implementation based on the specific operation and infrastructure
  };
}
