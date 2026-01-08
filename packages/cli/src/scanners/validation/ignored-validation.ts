import type { Finding, EvidenceItem } from "@vibecheck/schema";
import type { ScanContext } from "../types.js";
import { resolvePath } from "../../utils/file-utils.js";
import { generateFingerprint, generateFindingId } from "../../utils/fingerprint.js";

const RULE_ID = "VC-VAL-001";

/**
 * VC-VAL-001: Validation defined but output ignored
 *
 * Detects when zod/yup/joi validation is performed but:
 * - The validated result is not assigned to a variable
 * - The validated result is assigned but never referenced
 * - Raw request body is used after validation
 */
export async function scanIgnoredValidation(context: ScanContext): Promise<Finding[]> {
  const { repoRoot, fileIndex, helpers } = context;
  const findings: Finding[] = [];

  // Scan API route files for validation issues
  for (const relPath of fileIndex.apiRouteFiles) {
    const absPath = resolvePath(repoRoot, relPath);
    const sourceFile = helpers.parseFile(absPath);

    if (!sourceFile) continue;

    const handlers = helpers.findRouteHandlers(sourceFile);

    for (const handler of handlers) {
      const validationUsages = helpers.findValidationUsage(handler.functionNode);

      for (const usage of validationUsages) {
        // Case 1: Validation called but result not assigned
        if (!usage.resultAssigned) {
          const evidence: EvidenceItem[] = [
            {
              file: relPath,
              startLine: usage.line,
              endLine: usage.line,
              snippet: helpers.getNodeText(usage.node).slice(0, 150),
              label: `${usage.library}.${usage.method}() called but result not assigned`,
            },
          ];

          const fingerprint = generateFingerprint({
            ruleId: RULE_ID,
            file: relPath,
            symbol: `${usage.library}.${usage.method}`,
            startLine: usage.line,
          });

          findings.push({
            id: generateFindingId({
              ruleId: RULE_ID,
              file: relPath,
              symbol: `${usage.library}.${usage.method}`,
              startLine: usage.line,
            }),
            ruleId: RULE_ID,
            title: `Validation result ignored: ${usage.library}.${usage.method}()`,
            description: `The ${usage.library} validation method ${usage.method}() is called but its result is not assigned to a variable. This means validation errors are silently ignored and unvalidated data may be used.`,
            severity: "high",
            confidence: 0.92,
            category: "validation",
            evidence,
            remediation: {
              recommendedFix: `Assign the validation result to a variable and use the validated data instead of the raw input. For Zod: const validatedData = schema.parse(data). For Yup/Joi: const validatedData = await schema.validate(data). Then use validatedData for all operations.`,
              // No patch for validation fixes - requires knowing actual variable names and how to replace raw body usage
            },
            links: {
              cwe: "https://cwe.mitre.org/data/definitions/20.html",
            },
            fingerprint,
          });
          continue;
        }

        // Case 2: Result assigned but raw body used after
        if (usage.resultAssigned && usage.rawBodyUsedAfter && !usage.resultUsed) {
          const evidence: EvidenceItem[] = [
            {
              file: relPath,
              startLine: usage.line,
              endLine: usage.line,
              snippet: helpers.getNodeText(usage.node).slice(0, 150),
              label: `Validated data assigned but raw body used instead`,
            },
          ];

          const fingerprint = generateFingerprint({
            ruleId: RULE_ID,
            file: relPath,
            symbol: `${usage.library}.${usage.method}-unused`,
            startLine: usage.line,
          });

          findings.push({
            id: generateFindingId({
              ruleId: RULE_ID,
              file: relPath,
              symbol: `${usage.library}.${usage.method}-unused`,
              startLine: usage.line,
            }),
            ruleId: RULE_ID,
            title: `Validated data unused, raw body accessed instead`,
            description: `The ${usage.library} validation is performed and the result is assigned, but the code continues to use the raw request body instead of the validated data. This defeats the purpose of validation.`,
            severity: "high",
            confidence: 0.85,
            category: "validation",
            evidence,
            remediation: {
              recommendedFix: `Use the validated data variable instead of accessing the raw request body after validation.`,
            },
            links: {
              cwe: "https://cwe.mitre.org/data/definitions/20.html",
            },
            fingerprint,
          });
        }
      }
    }
  }

  return findings;
}
