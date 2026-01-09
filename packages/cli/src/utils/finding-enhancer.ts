import type {
  Finding,
  Severity,
  Category,
  FindingEnhancements,
  PlainEnglish,
  SeverityContext,
  Urgency,
  CodeComparison,
  FixStep,
  AIPrompt,
} from "@vibecheck/schema";

/**
 * Maps severity to plain English urgency levels
 */
const SEVERITY_TO_URGENCY: Record<Severity, Urgency> = {
  critical: "Fix immediately before deploying",
  high: "Fix before next release",
  medium: "Should fix soon",
  low: "Good to fix eventually",
  info: "Nice to have",
};

/**
 * Plain English explanations for each severity level
 */
const SEVERITY_REASONING: Record<Severity, string> = {
  critical:
    "This issue could allow attackers to take control of your application or access all user data. It needs immediate attention.",
  high:
    "This issue could lead to unauthorized access or data exposure. It should be fixed before any production release.",
  medium:
    "This issue represents a security weakness that could be exploited under certain conditions. Plan to fix it soon.",
  low:
    "This is a minor security concern that's good to address but unlikely to be exploited on its own.",
  info:
    "This is a best practice recommendation that improves your overall security posture.",
};

/**
 * Category-specific impact descriptions
 */
const CATEGORY_IMPACTS: Record<Category, { impact: string; worstCase: string }> = {
  auth: {
    impact: "Anyone on the internet could access or modify protected data without logging in.",
    worstCase: "Attackers could steal user accounts, delete data, or impersonate users.",
  },
  validation: {
    impact: "Users could submit malicious or invalid data that breaks your app or exploits other systems.",
    worstCase: "Attackers could inject code, corrupt databases, or crash your servers.",
  },
  middleware: {
    impact: "Security protections you think are in place might not be running on some pages.",
    worstCase: "Attackers could bypass your security by accessing unprotected routes directly.",
  },
  secrets: {
    impact: "Sensitive credentials could be exposed to anyone who can access the code.",
    worstCase: "Attackers could use exposed API keys to access your cloud services and rack up charges.",
  },
  injection: {
    impact: "User input could be executed as code or database commands.",
    worstCase: "Attackers could read your entire database, modify data, or execute system commands.",
  },
  privacy: {
    impact: "Sensitive user information might be logged or exposed unintentionally.",
    worstCase: "User data could be leaked, leading to regulatory fines and loss of trust.",
  },
  config: {
    impact: "Misconfigured settings could weaken your application's security.",
    worstCase: "Default credentials or insecure settings could give attackers easy access.",
  },
  network: {
    impact: "Network requests might be misconfigured, allowing attackers to intercept or redirect them.",
    worstCase: "Attackers could steal data in transit, redirect users to malicious sites, or access internal systems.",
  },
  crypto: {
    impact: "Cryptographic operations might use weak algorithms that are easily broken.",
    worstCase: "Attackers could crack passwords, forge tokens, or decrypt sensitive data.",
  },
  uploads: {
    impact: "File uploads might not be properly validated, allowing dangerous files.",
    worstCase: "Attackers could upload malware, execute code on your server, or fill up storage.",
  },
  hallucinations: {
    impact: "Security protections that appear in comments or code might not actually work.",
    worstCase: "You might think you're protected when you're actually vulnerable.",
  },
  abuse: {
    impact: "Expensive operations could be triggered without proper limits.",
    worstCase: "Attackers could rack up huge API bills or crash your services with resource exhaustion.",
  },
  correlation: {
    impact: "Multiple security issues combine to create a more serious vulnerability.",
    worstCase: "The combination of weaknesses could create an attack path that's worse than any single issue.",
  },
  authorization: {
    impact: "Users might be able to access or modify resources they shouldn't have permission for.",
    worstCase: "Regular users could access admin features or other users' private data.",
  },
  lifecycle: {
    impact: "Data validation rules aren't consistent across create, update, and delete operations.",
    worstCase: "Attackers could bypass validation by using a different operation than expected.",
  },
  "supply-chain": {
    impact: "Third-party dependencies might introduce vulnerabilities or malicious code.",
    worstCase: "A compromised package could steal credentials or inject malware into your app.",
  },
  other: {
    impact: "This is a security concern that doesn't fit into standard categories.",
    worstCase: "The specific risk depends on the context of this finding.",
  },
};

/**
 * Rule-specific problem descriptions for common rule IDs
 */
const RULE_PROBLEM_DESCRIPTIONS: Record<string, string> = {
  "VC-AUTH-001": "This API endpoint can be accessed by anyone without logging in",
  "VC-AUTH-002": "A security middleware that should protect routes isn't being applied",
  "VC-VAL-001": "User input is being trusted without checking if it's valid",
  "VC-VAL-002": "Validation code exists but its errors are being ignored",
  "VC-NET-001": "Cross-origin requests are allowed from any website",
  "VC-NET-002": "Network requests can hang forever without timing out",
  "VC-NET-003": "Users can be redirected to any external URL",
  "VC-NET-004": "User input is used in URL requests without validation",
  "VC-CRY-001": "Passwords or sensitive data use outdated hashing algorithms",
  "VC-CRY-002": "JWT tokens are decoded without verifying the signature",
  "VC-CRY-003": "Random tokens are generated using predictable Math.random()",
  "VC-PRV-001": "Debug mode is enabled, exposing sensitive information",
  "VC-PRV-002": "API responses include more data than users should see",
  "VC-PRV-003": "Sensitive data like passwords or tokens are being logged",
  "VC-UPL-001": "File uploads don't have size or type restrictions",
  "VC-UPL-002": "Uploaded files are stored in publicly accessible locations",
  "VC-MID-001": "API routes are missing rate limiting",
  "VC-HAL-001": "Security imports are declared but never used",
  "VC-ABS-001": "Expensive AI/compute operations lack rate limiting or auth",
  "VC-CFG-001": "Configuration uses insecure default values",
  "VC-CFG-002": "Environment variables are used but not documented",
  "VC-AZN-001": "Admin routes don't check if the user has admin privileges",
  "VC-AZN-002": "Role requirements are declared but not enforced",
  "VC-AZN-003": "Resources can be accessed without ownership verification",
  "VC-AZN-004": "Client-provided IDs are trusted without verification",
  "VC-LCY-001": "Create and update operations have different validation rules",
  "VC-LCY-002": "Delete operations are missing rate limits",
  "VC-LCY-003": "Validation schemas don't match between similar operations",
  "VC-SUP-001": "Using deprecated packages with known vulnerabilities",
  "VC-SUP-002": "Multiple authentication systems may conflict",
  "VC-SUP-003": "Package.json uses overly permissive version ranges",
  "VC-SUP-004": "Suspicious postinstall scripts in dependencies",
  "VC-SUP-005": "Security-critical packages have outdated versions",
};

/**
 * Generate plain English explanation for a finding
 */
function generatePlainEnglish(finding: Finding): PlainEnglish {
  // Try to get a rule-specific problem description
  const problem =
    RULE_PROBLEM_DESCRIPTIONS[finding.ruleId] ||
    `${finding.title.replace(/VC-[A-Z]+-\d{3}:?\s*/g, "")}`;

  const categoryInfo = CATEGORY_IMPACTS[finding.category] || CATEGORY_IMPACTS.other;

  return {
    problem,
    impact: categoryInfo.impact,
    worstCase: categoryInfo.worstCase,
  };
}

/**
 * Generate severity context with urgency and reasoning
 */
function generateSeverityContext(finding: Finding): SeverityContext {
  return {
    urgency: SEVERITY_TO_URGENCY[finding.severity],
    reasoning: SEVERITY_REASONING[finding.severity],
  };
}

/**
 * Generate code comparison if we have evidence and remediation
 */
function generateCodeComparison(finding: Finding): CodeComparison | undefined {
  // We need evidence with a snippet and remediation with a patch
  const primaryEvidence = finding.evidence[0];
  if (!primaryEvidence?.snippet) {
    return undefined;
  }

  // If we have a unified diff patch, try to extract the "after" code
  if (finding.remediation?.patch) {
    const patch = finding.remediation.patch;
    const lines = patch.split("\n");

    // Extract added lines from the diff (lines starting with +, excluding +++ header)
    const addedLines = lines
      .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
      .map((line) => line.slice(1));

    if (addedLines.length > 0) {
      // Clean up the before snippet (remove trailing ...)
      const before = primaryEvidence.snippet.replace(/\.{3}$/, "").trim();

      // Construct the after code by inserting the new lines at the appropriate place
      const after = addedLines.join("\n") + "\n" + before;

      // Detect language from file extension
      const file = primaryEvidence.file;
      let language = "typescript";
      if (file.endsWith(".js") || file.endsWith(".jsx")) {
        language = "javascript";
      } else if (file.endsWith(".py")) {
        language = "python";
      } else if (file.endsWith(".go")) {
        language = "go";
      }

      return {
        before,
        after,
        language,
        changes: addedLines.map((line, i) => ({
          line: i + 1,
          explanation: `Added: ${line.trim().slice(0, 50)}${line.length > 50 ? "..." : ""}`,
        })),
      };
    }
  }

  return undefined;
}

/**
 * Category-specific fix step templates
 */
const CATEGORY_FIX_STEPS: Record<Category, FixStep[]> = {
  auth: [
    {
      step: 1,
      title: "Add authentication check",
      action:
        "Import your auth library and add a session check at the start of the function.",
      code: `const session = await getServerSession(authOptions);
if (!session) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401
  });
}`,
      verification: "Try accessing the endpoint without being logged in - you should get a 401 error.",
    },
    {
      step: 2,
      title: "Test the protection",
      action: "Verify the endpoint now requires authentication.",
      command: "curl -X POST http://localhost:3000/api/your-endpoint",
      verification: "You should receive a 401 Unauthorized response.",
    },
  ],
  validation: [
    {
      step: 1,
      title: "Define a validation schema",
      action: "Create a Zod schema that describes valid input.",
      code: `import { z } from "zod";

const inputSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
});`,
    },
    {
      step: 2,
      title: "Validate incoming data",
      action: "Parse the input through your schema before using it.",
      code: `const result = inputSchema.safeParse(body);
if (!result.success) {
  return new Response(JSON.stringify({ error: result.error.issues }), {
    status: 400
  });
}
const { name, email } = result.data;`,
      verification: "Send malformed data and verify you get a 400 error with validation details.",
    },
  ],
  middleware: [
    {
      step: 1,
      title: "Check middleware configuration",
      action: "Open your middleware file and verify the matcher patterns.",
      verification: "Ensure the route you want to protect is included in the matcher array.",
    },
    {
      step: 2,
      title: "Add the route to protected paths",
      action: "Update the middleware matcher to include this route.",
      code: `export const config = {
  matcher: [
    '/api/:path*',  // Protect all API routes
    '/dashboard/:path*',  // Protect dashboard
  ],
};`,
    },
  ],
  secrets: [
    {
      step: 1,
      title: "Move secret to environment variable",
      action: "Remove the hardcoded secret and use an environment variable instead.",
      code: `// Before: const apiKey = "sk-abc123...";
// After:
const apiKey = process.env.API_KEY;
if (!apiKey) {
  throw new Error("API_KEY environment variable is required");
}`,
    },
    {
      step: 2,
      title: "Update your .env file",
      action: "Add the secret to your .env file (never commit this to git).",
      command: "echo 'API_KEY=your-secret-key' >> .env",
    },
    {
      step: 3,
      title: "Add .env to .gitignore",
      action: "Make sure your secrets file is not tracked by git.",
      command: "echo '.env' >> .gitignore",
      verification: "Run 'git status' and verify .env is not listed as a tracked file.",
    },
  ],
  injection: [
    {
      step: 1,
      title: "Use parameterized queries",
      action: "Never concatenate user input directly into queries.",
      code: `// Before: db.query(\`SELECT * FROM users WHERE id = \${userId}\`);
// After:
db.query("SELECT * FROM users WHERE id = ?", [userId]);`,
    },
    {
      step: 2,
      title: "Validate and sanitize input",
      action: "Always validate input types and sanitize special characters.",
      verification: "Try entering SQL injection payloads like \"' OR '1'='1\" and verify they're handled safely.",
    },
  ],
  privacy: [
    {
      step: 1,
      title: "Remove sensitive data from logs",
      action: "Never log passwords, tokens, or personal information.",
      code: `// Before: console.log("User login:", { email, password });
// After:
console.log("User login:", { email, password: "[REDACTED]" });`,
    },
    {
      step: 2,
      title: "Filter response data",
      action: "Only return the fields that the client actually needs.",
      code: `// Before: return user;
// After:
const { password, ssn, ...safeUser } = user;
return safeUser;`,
    },
  ],
  config: [
    {
      step: 1,
      title: "Review configuration defaults",
      action: "Check all config values and replace insecure defaults.",
      verification: "Look for 'password', 'secret', 'admin', or 'test' in your config files.",
    },
    {
      step: 2,
      title: "Use environment variables",
      action: "Move all sensitive configuration to environment variables.",
    },
  ],
  network: [
    {
      step: 1,
      title: "Configure CORS properly",
      action: "Restrict allowed origins to only the domains you trust.",
      code: `const corsOptions = {
  origin: ['https://yourdomain.com'],
  methods: ['GET', 'POST'],
  credentials: true,
};`,
    },
    {
      step: 2,
      title: "Add request timeouts",
      action: "Set timeouts on all network requests to prevent hanging.",
      code: `const response = await fetch(url, {
  signal: AbortSignal.timeout(10000) // 10 second timeout
});`,
    },
  ],
  crypto: [
    {
      step: 1,
      title: "Use modern algorithms",
      action: "Replace MD5/SHA1 with bcrypt for passwords or SHA-256 for hashing.",
      code: `// For passwords, use bcrypt:
import bcrypt from 'bcrypt';
const hash = await bcrypt.hash(password, 12);`,
    },
    {
      step: 2,
      title: "Use crypto.randomUUID for tokens",
      action: "Never use Math.random() for security-sensitive values.",
      code: `// Before: const token = Math.random().toString(36);
// After:
const token = crypto.randomUUID();`,
    },
  ],
  uploads: [
    {
      step: 1,
      title: "Validate file types",
      action: "Only allow specific file types that you expect.",
      code: `const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
if (!ALLOWED_TYPES.includes(file.type)) {
  throw new Error('File type not allowed');
}`,
    },
    {
      step: 2,
      title: "Limit file size",
      action: "Set a maximum file size to prevent storage abuse.",
      code: `const MAX_SIZE = 5 * 1024 * 1024; // 5MB
if (file.size > MAX_SIZE) {
  throw new Error('File too large');
}`,
    },
    {
      step: 3,
      title: "Store in secure location",
      action: "Store uploads outside the public directory and serve through an API.",
      verification: "Verify uploaded files cannot be accessed directly via URL.",
    },
  ],
  hallucinations: [
    {
      step: 1,
      title: "Verify security code is working",
      action: "Check that imported security functions are actually being called.",
      verification: "Add logging or step through with a debugger to confirm the code executes.",
    },
    {
      step: 2,
      title: "Remove unused imports",
      action: "If the security code isn't needed, remove the import to avoid confusion.",
    },
  ],
  abuse: [
    {
      step: 1,
      title: "Add rate limiting",
      action: "Limit how often users can call expensive endpoints.",
      code: `import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
});`,
    },
    {
      step: 2,
      title: "Require authentication",
      action: "Make sure only logged-in users can access expensive operations.",
    },
    {
      step: 3,
      title: "Add request size limits",
      action: "Limit input size to prevent resource exhaustion.",
      code: `app.use(express.json({ limit: '100kb' }));`,
    },
  ],
  correlation: [
    {
      step: 1,
      title: "Review related findings",
      action: "This finding is connected to other security issues. Review them together.",
    },
    {
      step: 2,
      title: "Fix the root cause",
      action: "Address the underlying issue that enables this combination of vulnerabilities.",
    },
  ],
  authorization: [
    {
      step: 1,
      title: "Add role/permission check",
      action: "Verify the user has permission before performing the action.",
      code: `if (!user.roles.includes('admin')) {
  return new Response('Forbidden', { status: 403 });
}`,
    },
    {
      step: 2,
      title: "Add ownership verification",
      action: "Verify the user owns the resource they're trying to access.",
      code: `const resource = await db.findById(resourceId);
if (resource.ownerId !== session.user.id) {
  return new Response('Forbidden', { status: 403 });
}`,
    },
  ],
  lifecycle: [
    {
      step: 1,
      title: "Align validation rules",
      action: "Use the same validation schema for create and update operations.",
      code: `// Define once, use everywhere:
const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});`,
    },
    {
      step: 2,
      title: "Test all operations",
      action: "Verify that validation works the same for create, update, and delete.",
      verification: "Try submitting invalid data through each operation type.",
    },
  ],
  "supply-chain": [
    {
      step: 1,
      title: "Update dependencies",
      action: "Update vulnerable packages to their latest secure versions.",
      command: "pnpm update <package-name>",
    },
    {
      step: 2,
      title: "Review package security",
      action: "Check the package on npm for security advisories.",
      verification: "Visit the package page on npmjs.com and check for deprecation warnings.",
    },
  ],
  other: [
    {
      step: 1,
      title: "Review the finding",
      action: "Carefully read the description and evidence to understand the issue.",
    },
    {
      step: 2,
      title: "Apply the recommended fix",
      action: "Follow the remediation guidance provided in the finding details.",
    },
  ],
};

/**
 * Generate fix steps for a finding
 */
function generateFixSteps(finding: Finding): FixStep[] {
  const categorySteps = CATEGORY_FIX_STEPS[finding.category] || CATEGORY_FIX_STEPS.other;

  // If we have a specific recommended fix, add it as step 1
  if (finding.remediation?.recommendedFix) {
    return [
      {
        step: 1,
        title: "Apply the recommended fix",
        action: finding.remediation.recommendedFix,
        code: finding.remediation.patch || undefined,
      },
      ...categorySteps.map((step) => ({
        ...step,
        step: step.step + 1,
      })),
    ];
  }

  return categorySteps;
}

/**
 * Generate AI prompt template for a finding
 */
function generateAIPrompt(finding: Finding): AIPrompt {
  const template = `I have a security finding in my codebase that I need help fixing.

**Issue:** ${finding.title}
**File:** ${finding.evidence[0]?.file || "Unknown"}
**Severity:** ${finding.severity.toUpperCase()}
**Category:** ${finding.category}

**Description:**
${finding.description}

**Problematic Code:**
\`\`\`
${finding.evidence[0]?.snippet || "See file above"}
\`\`\`

**Recommended Fix:**
${finding.remediation?.recommendedFix || "See description above"}

Can you help me fix this security issue? Please:
1. Explain why this is a security risk
2. Show me the corrected code
3. Explain what the fix does`;

  const followUpQuestions = [
    `What other files might have similar ${finding.category} issues?`,
    "Are there any edge cases I should consider in this fix?",
    "How can I write a test to verify this is fixed?",
    "What would happen if an attacker tried to exploit this?",
  ];

  return {
    template,
    followUpQuestions,
  };
}

/**
 * Generate all enhancements for a finding
 */
export function enhanceFinding(finding: Finding): Finding {
  const enhancements: FindingEnhancements = {
    plainEnglish: generatePlainEnglish(finding),
    severityContext: generateSeverityContext(finding),
    codeComparison: generateCodeComparison(finding),
    fixSteps: generateFixSteps(finding),
    aiPrompt: generateAIPrompt(finding),
  };

  return {
    ...finding,
    enhancements,
  };
}

/**
 * Enhance all findings in a batch
 */
export function enhanceFindings(findings: Finding[]): Finding[] {
  return findings.map(enhanceFinding);
}
