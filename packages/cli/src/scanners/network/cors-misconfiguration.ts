import type { Finding, EvidenceItem } from "@vibecheck/schema";
import type { ScanContext } from "../types.js";
import { resolvePath } from "../../utils/file-utils.js";
import { generateFingerprint, generateFindingId } from "../../utils/fingerprint.js";

const RULE_ID = "VC-NET-003";

/**
 * VC-NET-003: Over-permissive CORS with credentials
 *
 * Detects CORS configurations that combine:
 * - allowCredentials: true (or "Access-Control-Allow-Credentials: true")
 * AND
 * - allowOrigin: "*" (or reflects arbitrary origin unsafely)
 *
 * Two-signal: must see both wildcard origin AND credentials enabled
 */
export async function scanCorsMisconfiguration(context: ScanContext): Promise<Finding[]> {
  const { repoRoot, fileIndex, helpers } = context;
  const findings: Finding[] = [];

  // Scan all source files for CORS configuration
  for (const relPath of fileIndex.allSourceFiles) {
    const absPath = resolvePath(repoRoot, relPath);
    const sourceFile = helpers.parseFile(absPath);

    if (!sourceFile) continue;

    const corsConfigs = helpers.findCorsConfig(sourceFile);

    for (const config of corsConfigs) {
      // Two-signal: only flag when BOTH wildcard origin AND credentials
      if (!config.hasWildcardOrigin || !config.hasCredentials) {
        continue;
      }

      const evidence: EvidenceItem[] = [
        {
          file: relPath,
          startLine: config.line,
          endLine: config.line,
          snippet: config.snippet,
          label: `CORS with origin: "${config.originValue}" and credentials: ${config.credentialsValue}`,
        },
      ];

      const fingerprint = generateFingerprint({
        ruleId: RULE_ID,
        file: relPath,
        symbol: "cors",
        startLine: config.line,
      });

      findings.push({
        id: generateFindingId({
          ruleId: RULE_ID,
          file: relPath,
          symbol: "cors",
          startLine: config.line,
        }),
        ruleId: RULE_ID,
        title: "Over-permissive CORS with credentials",
        description: `The CORS configuration allows credentials (cookies, auth headers) to be sent with requests from any origin (*). This is dangerous because it allows any website to make authenticated requests to your API on behalf of logged-in users, enabling CSRF-like attacks. Browsers will actually block this specific combination, but the intent suggests a security misunderstanding.`,
        severity: "high",
        confidence: 0.9,
        category: "network",
        evidence,
        remediation: {
          recommendedFix: `When using credentials, you must specify explicit allowed origins instead of "*". Use an allowlist of trusted domains.`,
          patch: `// Instead of:
// cors({ origin: "*", credentials: true })

// Use an allowlist:
const allowedOrigins = [
  'https://app.example.com',
  'https://admin.example.com',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));`,
        },
        links: {
          cwe: "https://cwe.mitre.org/data/definitions/942.html",
          owasp: "https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/11-Client-side_Testing/07-Testing_Cross_Origin_Resource_Sharing",
        },
        fingerprint,
      });
    }
  }

  return findings;
}
