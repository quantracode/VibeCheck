import type { Finding, EvidenceItem, Severity } from "@vibecheck/schema";
import type { ScanContext } from "../types.js";
import { resolvePath } from "../../utils/file-utils.js";
import { generateFingerprint, generateFindingId } from "../../utils/fingerprint.js";

const RULE_ID = "VC-PRIV-002";

/**
 * VC-PRIV-002: Over-broad API response (returns whole ORM model)
 *
 * Detect in route handlers returning:
 * - prisma.<model>.findMany({}) without select/include restrictions AND direct return
 * - prisma.<model>.findUnique({ where }) without select AND direct return
 *
 * Precision:
 * - Only flag if the model name suggests sensitive entity (user, account, etc.)
 * - OR fields: password, hash, token are present in schema.prisma
 */
export async function scanOverBroadResponse(context: ScanContext): Promise<Finding[]> {
  const { repoRoot, fileIndex, helpers, prismaSchemaInfo } = context;
  const findings: Finding[] = [];

  // Scan API route files
  for (const relPath of fileIndex.apiRouteFiles) {
    const absPath = resolvePath(repoRoot, relPath);
    const sourceFile = helpers.parseFile(absPath);

    if (!sourceFile) continue;

    const handlers = helpers.findRouteHandlers(sourceFile);

    for (const handler of handlers) {
      const prismaQueries = helpers.findPrismaQueries(handler.functionNode);

      for (const query of prismaQueries) {
        // Skip if has select (data is restricted)
        if (query.hasSelect) continue;

        // Check if model has sensitive fields from prisma schema
        let hasSensitiveFields = false;
        if (prismaSchemaInfo) {
          const modelInfo = prismaSchemaInfo.models.get(query.model.toLowerCase());
          if (modelInfo) {
            hasSensitiveFields = modelInfo.hasSensitiveFields;
          }
        }

        // Determine severity based on sensitive fields
        const severity: Severity = hasSensitiveFields ? "high" : "medium";

        const evidence: EvidenceItem[] = [
          {
            file: relPath,
            startLine: query.line,
            endLine: query.line,
            snippet: query.snippet,
            label: `Returns full ${query.model} model without select restriction`,
          },
        ];

        // Add prisma schema evidence if available
        if (hasSensitiveFields && prismaSchemaInfo) {
          const modelInfo = prismaSchemaInfo.models.get(query.model.toLowerCase());
          if (modelInfo) {
            evidence.push({
              file: "prisma/schema.prisma",
              startLine: 1,
              endLine: 1,
              snippet: `Model ${modelInfo.name} has sensitive fields: ${modelInfo.fields.filter(f => /password|hash|token|secret/i.test(f)).join(", ")}`,
              label: "Sensitive fields in model",
            });
          }
        }

        const fingerprint = generateFingerprint({
          ruleId: RULE_ID,
          file: relPath,
          symbol: `${query.model}.${query.operation}`,
          startLine: query.line,
        });

        findings.push({
          id: generateFindingId({
            ruleId: RULE_ID,
            file: relPath,
            symbol: `${query.model}.${query.operation}`,
            startLine: query.line,
          }),
          ruleId: RULE_ID,
          title: `Over-broad ${query.model} response exposes all fields`,
          description: `The ${query.operation} query on the ${query.model} model returns all fields without using a \`select\` clause. This may inadvertently expose sensitive fields like passwords, tokens, or internal IDs to API consumers.${hasSensitiveFields ? " The Prisma schema indicates this model contains sensitive fields." : ""}`,
          severity,
          confidence: hasSensitiveFields ? 0.9 : 0.75,
          category: "privacy",
          evidence,
          remediation: {
            recommendedFix: `Use Prisma's \`select\` clause to explicitly choose which fields to return. Never expose password hashes, tokens, or other sensitive data in API responses. Example: prisma.user.findMany({ select: { id: true, name: true, email: true } }) - only include fields the API consumer needs.`,
            // No patch for over-broad responses - requires understanding which fields are needed by the API consumer
          },
          links: {
            cwe: "https://cwe.mitre.org/data/definitions/359.html",
            owasp: "https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/",
          },
          fingerprint,
        });
      }
    }
  }

  return findings;
}
