import { Command } from "commander";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ARTIFACT_VERSION,
  type ScanArtifact,
  computeSummary,
} from "@vibecheck/schema";

export interface DemoArtifactOptions {
  out?: string;
}

function generateDemoArtifact(): ScanArtifact {
  const findings = [
    {
      id: "demo-finding-1",
      ruleId: "VC-AUTH-001",
      title: "Missing Authentication in API Route",
      description:
        "The API route /api/users does not verify user authentication before returning sensitive data. An attacker could access user information without logging in.",
      severity: "critical" as const,
      confidence: 0.95,
      category: "auth" as const,
      evidence: [
        {
          file: "pages/api/users.ts",
          startLine: 5,
          endLine: 12,
          snippet: `export default async function handler(req, res) {
  // No authentication check!
  const users = await db.query("SELECT * FROM users");
  res.json(users);
}`,
          label: "Unauthenticated API handler",
        },
      ],
      remediation: {
        recommendedFix:
          "Add authentication middleware to verify the user session before processing the request.",
        patch: `import { getServerSession } from "next-auth";

export default async function handler(req, res) {
  const session = await getServerSession(req, res);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const users = await db.query("SELECT * FROM users");
  res.json(users);
}`,
      },
      links: {
        owasp: "https://owasp.org/Top10/A01_2021-Broken_Access_Control/",
        cwe: "https://cwe.mitre.org/data/definitions/306.html",
      },
      fingerprint: "demo-fp-001",
    },
    {
      id: "demo-finding-2",
      ruleId: "VC-INJECT-001",
      title: "SQL Injection Vulnerability",
      description:
        "User input is directly interpolated into SQL query without parameterization, allowing attackers to execute arbitrary SQL commands.",
      severity: "critical" as const,
      confidence: 0.92,
      category: "injection" as const,
      evidence: [
        {
          file: "lib/database.ts",
          startLine: 23,
          endLine: 25,
          snippet: `async function getUser(id: string) {
  return db.query(\`SELECT * FROM users WHERE id = '\${id}'\`);
}`,
          label: "SQL string interpolation",
        },
      ],
      proof: {
        summary: "User input flows from API parameter to SQL query without sanitization",
        nodes: [
          {
            kind: "route" as const,
            label: "User ID received from request query parameter",
            file: "pages/api/user/[id].ts",
            line: 4,
          },
          {
            kind: "function" as const,
            label: "ID passed to getUser() without validation",
            file: "pages/api/user/[id].ts",
            line: 8,
          },
          {
            kind: "sink" as const,
            label: "ID interpolated directly into SQL query",
            file: "lib/database.ts",
            line: 24,
          },
        ],
      },
      remediation: {
        recommendedFix:
          "Use parameterized queries or prepared statements instead of string interpolation.",
        patch: `async function getUser(id: string) {
  return db.query("SELECT * FROM users WHERE id = $1", [id]);
}`,
      },
      links: {
        owasp: "https://owasp.org/Top10/A03_2021-Injection/",
        cwe: "https://cwe.mitre.org/data/definitions/89.html",
      },
      fingerprint: "demo-fp-002",
    },
    {
      id: "demo-finding-3",
      ruleId: "VC-XSS-001",
      title: "Cross-Site Scripting (XSS) via dangerouslySetInnerHTML",
      description:
        "User-generated content is rendered using dangerouslySetInnerHTML without sanitization, enabling XSS attacks.",
      severity: "high" as const,
      confidence: 0.88,
      category: "validation" as const,
      evidence: [
        {
          file: "components/Comment.tsx",
          startLine: 15,
          endLine: 17,
          snippet: `function Comment({ content }: { content: string }) {
  return <div dangerouslySetInnerHTML={{ __html: content }} />;
}`,
          label: "Unsanitized HTML rendering",
        },
      ],
      remediation: {
        recommendedFix:
          "Sanitize HTML content using a library like DOMPurify before rendering.",
        patch: `import DOMPurify from "dompurify";

function Comment({ content }: { content: string }) {
  const sanitized = DOMPurify.sanitize(content);
  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
}`,
      },
      links: {
        owasp: "https://owasp.org/Top10/A03_2021-Injection/",
        cwe: "https://cwe.mitre.org/data/definitions/79.html",
      },
      fingerprint: "demo-fp-003",
    },
    {
      id: "demo-finding-4",
      ruleId: "VC-SECRETS-001",
      title: "Hardcoded API Key in Source Code",
      description:
        "An API key is hardcoded in the source file. This could be exposed in version control or client bundles.",
      severity: "high" as const,
      confidence: 0.85,
      category: "secrets" as const,
      evidence: [
        {
          file: "lib/stripe.ts",
          startLine: 3,
          endLine: 3,
          snippet: `const STRIPE_KEY = "sk_live_abc123xyz789";`,
          label: "Hardcoded secret key",
        },
      ],
      remediation: {
        recommendedFix:
          "Move secrets to environment variables and never commit them to version control.",
        patch: `const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_KEY) {
  throw new Error("STRIPE_SECRET_KEY environment variable is required");
}`,
      },
      fingerprint: "demo-fp-004",
    },
    {
      id: "demo-finding-5",
      ruleId: "VC-HALL-001",
      title: "Unused Security Import: helmet",
      description:
        "The helmet security middleware is imported but never used, suggesting incomplete security implementation.",
      severity: "medium" as const,
      confidence: 0.94,
      category: "middleware" as const,
      evidence: [
        {
          file: "server.ts",
          startLine: 2,
          endLine: 2,
          snippet: `import helmet from "helmet";`,
          label: "Unused helmet import",
        },
      ],
      claim: {
        type: "OTHER" as const,
        source: "import" as const,
        scope: "module" as const,
        strength: "weak" as const,
        textEvidence: 'import helmet from "helmet"',
        location: {
          file: "server.ts",
          startLine: 2,
          endLine: 2,
        },
      },
      remediation: {
        recommendedFix:
          "Apply the helmet middleware to add security headers, or remove the unused import.",
        patch: `import helmet from "helmet";

app.use(helmet());`,
      },
      fingerprint: "demo-fp-005",
    },
    {
      id: "demo-finding-6",
      ruleId: "VC-PRIVACY-001",
      title: "Sensitive Data in Console Logs",
      description:
        "User passwords are being logged to the console, which could expose credentials in log files or monitoring systems.",
      severity: "medium" as const,
      confidence: 0.91,
      category: "privacy" as const,
      evidence: [
        {
          file: "lib/auth.ts",
          startLine: 45,
          endLine: 45,
          snippet: `console.log("Login attempt:", { email, password });`,
          label: "Password logged to console",
        },
      ],
      remediation: {
        recommendedFix:
          "Remove sensitive data from log statements. Only log non-sensitive identifiers.",
        patch: `console.log("Login attempt:", { email, timestamp: Date.now() });`,
      },
      fingerprint: "demo-fp-006",
    },
    {
      id: "demo-finding-7",
      ruleId: "VC-CONFIG-001",
      title: "Insecure Cookie Configuration",
      description:
        "Session cookies are configured without the Secure and HttpOnly flags, making them vulnerable to interception and XSS attacks.",
      severity: "low" as const,
      confidence: 0.82,
      category: "config" as const,
      evidence: [
        {
          file: "lib/session.ts",
          startLine: 8,
          endLine: 12,
          snippet: `const sessionConfig = {
  name: "session",
  secret: process.env.SESSION_SECRET,
  // Missing: secure, httpOnly, sameSite
};`,
          label: "Insecure session config",
        },
      ],
      remediation: {
        recommendedFix:
          "Add secure cookie options to protect against common attacks.",
        patch: `const sessionConfig = {
  name: "session",
  secret: process.env.SESSION_SECRET,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 7, // 1 week
  },
};`,
      },
      fingerprint: "demo-fp-007",
    },
  ];

  const artifact: ScanArtifact = {
    artifactVersion: ARTIFACT_VERSION,
    generatedAt: new Date().toISOString(),
    tool: {
      name: "vibecheck",
      version: "0.0.1",
    },
    repo: {
      name: "demo-project",
      rootPathHash: "demo-hash-12345",
      git: {
        branch: "main",
        commit: "abc1234",
        isDirty: false,
      },
    },
    summary: computeSummary(findings),
    findings,
    metrics: {
      filesScanned: 42,
      linesOfCode: 3847,
      scanDurationMs: 1250,
      rulesExecuted: 12,
    },
  };

  return artifact;
}

export function executeDemoArtifact(options: DemoArtifactOptions): void {
  const artifact = generateDemoArtifact();
  const json = JSON.stringify(artifact, null, 2);

  if (options.out) {
    const outPath = resolve(process.cwd(), options.out);
    writeFileSync(outPath, json, "utf-8");
    console.log(`Demo artifact written to: ${outPath}`);
  } else {
    console.log(json);
  }

  console.log(`
============================================================
Demo Artifact Generated
============================================================

Findings: ${artifact.summary.totalFindings}
  - Critical: ${artifact.summary.bySeverity.critical}
  - High: ${artifact.summary.bySeverity.high}
  - Medium: ${artifact.summary.bySeverity.medium}
  - Low: ${artifact.summary.bySeverity.low}
  - Info: ${artifact.summary.bySeverity.info}

Use this artifact to test the VibeCheck UI:
  1. Run: pnpm dev:web
  2. Open: http://localhost:3000
  3. Import the generated JSON file
`);
}

export function registerDemoArtifactCommand(program: Command): void {
  program
    .command("demo-artifact")
    .description("Generate a demo artifact for testing the UI")
    .option("-o, --out <path>", "Output file path (prints to stdout if not specified)")
    .action((options: DemoArtifactOptions) => {
      executeDemoArtifact(options);
    });
}
