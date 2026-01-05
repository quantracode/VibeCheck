/**
 * VC-LIFE-002: Validation Schema Drift
 *
 * Detects patterns where POST endpoints validate input but PUT/PATCH
 * endpoints for the same entity do not apply equivalent validation.
 *
 * Example vulnerable pattern:
 *   // POST /api/users - validated
 *   export async function POST(request: Request) {
 *     const body = await request.json();
 *     const validated = userSchema.parse(body); // Zod validation
 *     await prisma.user.create({ data: validated });
 *   }
 *
 *   // PATCH /api/users/[id] - NOT validated
 *   export async function PATCH(request: Request) {
 *     const body = await request.json();
 *     await prisma.user.update({ where: { id }, data: body }); // Raw body!
 *   }
 *
 * Severity: Medium
 * Category: lifecycle
 * Confidence: 0.80
 */

import type { Finding, EvidenceItem } from "@vibecheck/schema";
import type { ScanContext, RouteHandler } from "../types.js";
import { resolvePath } from "../../utils/file-utils.js";
import { generateFingerprint, generateFindingId } from "../../utils/fingerprint.js";

const RULE_ID = "VC-LIFE-002";

/**
 * Entity route info for grouping
 */
interface EntityValidationGroup {
  entityName: string;
  basePath: string;
  handlers: Array<{
    method: string;
    file: string;
    handler: RouteHandler;
    hasValidation: boolean;
    validationLibrary?: string;
    handlerText: string;
  }>;
}

/**
 * Validation patterns and the library they indicate
 */
const VALIDATION_PATTERNS: Array<{ pattern: RegExp; library: string }> = [
  { pattern: /\.parse\s*\(/, library: "zod" },
  { pattern: /\.safeParse\s*\(/, library: "zod" },
  { pattern: /\.parseAsync\s*\(/, library: "zod" },
  { pattern: /z\.\w+\(\)/, library: "zod" },
  { pattern: /yup\.object\s*\(/, library: "yup" },
  { pattern: /\.validate\s*\(/, library: "yup/joi" },
  { pattern: /\.validateSync\s*\(/, library: "yup" },
  { pattern: /Joi\.object\s*\(/, library: "joi" },
  { pattern: /schema\.validate\s*\(/, library: "joi" },
  { pattern: /valibot\./i, library: "valibot" },
  { pattern: /v\.\w+\(\)/, library: "valibot" },
  { pattern: /ajv\.compile\s*\(/, library: "ajv" },
  { pattern: /validate\s*\(\s*body/, library: "custom" },
  { pattern: /validateBody\s*\(/, library: "custom" },
  { pattern: /validateRequest\s*\(/, library: "custom" },
];

/**
 * Extract entity name from route path
 */
function extractEntityName(filePath: string): string | null {
  const normalized = filePath.replace(/\\/g, "/");
  const match = normalized.match(/\/api\/([a-z]+(?:-[a-z]+)*)/i);
  if (match) {
    return match[1].toLowerCase();
  }
  return null;
}

/**
 * Get base path for grouping
 */
function getBasePath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  return normalized.replace(/\/\[[^\]]+\]/g, "").replace(/\/route\.[tj]sx?$/, "");
}

/**
 * Check if handler has validation and return library info
 */
function detectValidation(handlerText: string): { hasValidation: boolean; library?: string } {
  for (const { pattern, library } of VALIDATION_PATTERNS) {
    if (pattern.test(handlerText)) {
      return { hasValidation: true, library };
    }
  }
  return { hasValidation: false };
}

/**
 * Check if handler reads request body
 */
function readsRequestBody(handlerText: string): boolean {
  return /request\.json\s*\(\)|req\.body|formData\s*\(\)|\.text\s*\(\)/.test(handlerText);
}

/**
 * VC-LIFE-002: Validation Schema Drift Scanner
 */
export async function scanValidationSchemaDrift(context: ScanContext): Promise<Finding[]> {
  const { repoRoot, fileIndex, helpers, repoMeta } = context;
  const findings: Finding[] = [];

  if (repoMeta.framework !== "next") {
    return findings;
  }

  // Group routes by entity
  const entityGroups = new Map<string, EntityValidationGroup>();

  for (const relPath of fileIndex.apiRouteFiles) {
    const absPath = resolvePath(repoRoot, relPath);
    const sourceFile = helpers.parseFile(absPath);

    if (!sourceFile) continue;

    const entityName = extractEntityName(relPath);
    if (!entityName) continue;

    const basePath = getBasePath(relPath);
    const handlers = helpers.findRouteHandlers(sourceFile);

    for (const handler of handlers) {
      // Only check methods that accept body
      if (!["POST", "PUT", "PATCH"].includes(handler.method)) continue;

      const handlerText = helpers.getNodeText(handler.functionNode);

      // Skip if handler doesn't read body
      if (!readsRequestBody(handlerText)) continue;

      const { hasValidation, library } = detectValidation(handlerText);

      const groupKey = entityName;

      if (!entityGroups.has(groupKey)) {
        entityGroups.set(groupKey, {
          entityName,
          basePath,
          handlers: [],
        });
      }

      entityGroups.get(groupKey)!.handlers.push({
        method: handler.method,
        file: relPath,
        handler,
        hasValidation,
        validationLibrary: library,
        handlerText,
      });
    }
  }

  // Analyze each entity group for validation drift
  for (const [entityKey, group] of entityGroups) {
    // Find POST handlers with validation
    const validatedCreates = group.handlers.filter(
      (h) => h.method === "POST" && h.hasValidation
    );

    if (validatedCreates.length === 0) continue;

    // Find PUT/PATCH handlers without validation
    const unvalidatedUpdates = group.handlers.filter(
      (h) => (h.method === "PUT" || h.method === "PATCH") && !h.hasValidation
    );

    for (const unvalidated of unvalidatedUpdates) {
      const validatedExample = validatedCreates[0];

      const evidence: EvidenceItem[] = [
        {
          file: validatedExample.file,
          startLine: validatedExample.handler.startLine,
          endLine: Math.min(validatedExample.handler.startLine + 15, validatedExample.handler.endLine),
          snippet: validatedExample.handlerText.slice(0, 350) + "...",
          label: `Validated POST handler using ${validatedExample.validationLibrary || "validation"}`,
        },
        {
          file: unvalidated.file,
          startLine: unvalidated.handler.startLine,
          endLine: Math.min(unvalidated.handler.startLine + 15, unvalidated.handler.endLine),
          snippet: unvalidated.handlerText.slice(0, 350) + "...",
          label: `Unvalidated ${unvalidated.method} handler - reads body without schema validation`,
        },
      ];

      const fingerprint = generateFingerprint({
        ruleId: RULE_ID,
        file: unvalidated.file,
        symbol: unvalidated.method,
        route: group.basePath,
      });

      findings.push({
        id: generateFindingId({
          ruleId: RULE_ID,
          file: unvalidated.file,
          symbol: unvalidated.method,
        }),
        ruleId: RULE_ID,
        title: `Validation schema drift for ${group.entityName}: POST validated but ${unvalidated.method} is not`,
        description:
          `The POST handler for '${group.entityName}' validates input using ${validatedExample.validationLibrary || "schema validation"}, ` +
          `but the ${unvalidated.method} handler accepts unvalidated request body. This "schema drift" means ` +
          `validation rules applied during creation can be bypassed during updates. Attackers could inject ` +
          `malformed data, exceed field limits, or introduce invalid state through the update endpoint.`,
        severity: "medium",
        confidence: 0.80,
        category: "lifecycle",
        evidence,
        remediation: {
          recommendedFix:
            `Apply consistent validation to the ${unvalidated.method} handler:\n\n` +
            `// If using Zod:\n` +
            `const updateSchema = ${group.entityName}Schema.partial(); // Allow partial updates\n\n` +
            `export async function ${unvalidated.method}(request: Request) {\n` +
            `  const body = await request.json();\n` +
            `  const validated = updateSchema.parse(body);\n` +
            `  // Use validated data\n` +
            `}\n\n` +
            `Consider creating a shared schema or using .partial() for update operations.`,
        },
        links: {
          owasp: "https://owasp.org/Top10/A03_2021-Injection/",
          cwe: "https://cwe.mitre.org/data/definitions/20.html",
        },
        fingerprint,
      });
    }
  }

  return findings;
}
