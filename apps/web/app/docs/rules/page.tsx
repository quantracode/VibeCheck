"use client";

import { motion } from "framer-motion";
import { Shield, AlertTriangle, Lock, Key, Network, Settings, Upload, Eye, Ghost, UserCheck } from "lucide-react";
import { useState } from "react";

const categories = [
  { id: "all", name: "All Rules", icon: Shield },
  { id: "auth", name: "Authentication", icon: Lock },
  { id: "authorization", name: "Authorization", icon: UserCheck },
  { id: "validation", name: "Validation", icon: AlertTriangle },
  { id: "privacy", name: "Privacy", icon: Eye },
  { id: "config", name: "Configuration", icon: Settings },
  { id: "crypto", name: "Cryptography", icon: Key },
  { id: "network", name: "Network", icon: Network },
  { id: "middleware", name: "Middleware", icon: Shield },
  { id: "uploads", name: "File Uploads", icon: Upload },
  { id: "hallucinations", name: "Hallucinations", icon: Ghost },
];

const rules = [
  // Authentication
  {
    id: "VC-AUTH-001",
    title: "Unprotected Route Handler",
    category: "auth",
    severity: "high",
    description: "Route handler in app/ or pages/api/ directories without authentication checks.",
    triggers: ["Route handler without session/auth checks", "Missing middleware protection", "No authentication imports"],
  },
  {
    id: "VC-AUTH-002",
    title: "JWT Verification Bypass",
    category: "auth",
    severity: "critical",
    description: "JWT tokens being decoded without cryptographic verification.",
    triggers: ["jwt.decode() without verify()", "jwtDecode() from jwt-decode library without separate verification", "Token payload access without signature check"],
  },
  {
    id: "VC-AUTH-003",
    title: "Insecure Session Configuration",
    category: "auth",
    severity: "medium",
    description: "Session cookies configured without security flags.",
    triggers: ["Missing httpOnly flag", "Missing secure flag in production", "SameSite not set to 'strict' or 'lax'"],
  },
  {
    id: "VC-AUTH-004",
    title: "Missing CSRF Protection",
    category: "auth",
    severity: "high",
    description: "State-changing endpoints without CSRF token validation.",
    triggers: ["POST/PUT/DELETE without CSRF check", "Missing CSRF middleware", "Token not validated server-side"],
  },
  {
    id: "VC-AUTH-005",
    title: "OAuth State Parameter Missing",
    category: "auth",
    severity: "high",
    description: "OAuth flow without state parameter for CSRF protection.",
    triggers: ["OAuth redirect without state", "State not validated on callback", "Predictable state values"],
  },
  // Authorization
  {
    id: "VC-AUTHZ-001",
    title: "Admin Route Lacks Role Guard",
    category: "authorization",
    severity: "high",
    description: "Route with 'admin' in path has authentication but no role verification.",
    triggers: ["Admin path without role check", "getServerSession without role verification", "Missing admin role guard"],
  },
  {
    id: "VC-AUTHZ-002",
    title: "Ownership Check Missing",
    category: "authorization",
    severity: "critical",
    description: "User ID extracted from request used for database operations without ownership verification.",
    triggers: ["userId from body without session comparison", "IDOR vulnerability", "Missing ownership check in update/delete"],
  },
  {
    id: "VC-AUTHZ-003",
    title: "Role Declared But Not Enforced",
    category: "authorization",
    severity: "medium",
    description: "Role types defined in codebase but not checked in route handlers.",
    triggers: ["Role enum/type without enforcement", "Missing role checks in handlers", "Incomplete RBAC implementation"],
  },
  {
    id: "VC-AUTHZ-004",
    title: "Server Trusts Client-Provided User ID",
    category: "authorization",
    severity: "critical",
    description: "POST handler uses userId from request body instead of authenticated session.",
    triggers: ["authorId from request body", "userId from client for writes", "Missing session-derived identity"],
  },
  // Validation
  {
    id: "VC-VAL-001",
    title: "Missing Input Validation",
    category: "validation",
    severity: "high",
    description: "User input used without validation or sanitization.",
    triggers: ["req.body used directly", "Query params without validation", "No Zod/Yup/Joi schema"],
  },
  {
    id: "VC-VAL-002",
    title: "Ignored Validation Errors",
    category: "validation",
    severity: "critical",
    description: "Validation is performed but errors are not checked or handled.",
    triggers: ["safeParse() result ignored", "Validation without error handling", "try/catch swallowing validation errors"],
  },
  {
    id: "VC-VAL-003",
    title: "Client-Side Only Validation",
    category: "validation",
    severity: "medium",
    description: "Validation logic exists only in client components without server-side enforcement.",
    triggers: ["Form validation without API validation", "Zod schema only in 'use client' files", "No server action validation"],
  },
  {
    id: "VC-VAL-004",
    title: "SQL Injection Vector",
    category: "validation",
    severity: "critical",
    description: "String interpolation or concatenation in SQL queries.",
    triggers: ["Template literals in SQL", "String concatenation with user input", "Missing parameterized queries"],
  },
  {
    id: "VC-VAL-005",
    title: "Command Injection Vector",
    category: "validation",
    severity: "critical",
    description: "User input passed to shell commands without sanitization.",
    triggers: ["exec() with user input", "spawn() with unsanitized args", "Template literals in commands"],
  },
  // Privacy
  {
    id: "VC-PRIV-001",
    title: "Sensitive Data in Client Component",
    category: "privacy",
    severity: "high",
    description: "Sensitive data exposed to client-side JavaScript.",
    triggers: ["API keys in 'use client' files", "Secrets in client bundles", "Private data without server-only"],
  },
  {
    id: "VC-PRIV-002",
    title: "Verbose Error Messages",
    category: "privacy",
    severity: "medium",
    description: "Detailed error information exposed to users.",
    triggers: ["Stack traces in responses", "Database errors exposed", "Internal paths revealed"],
  },
  {
    id: "VC-PRIV-003",
    title: "Sensitive Data Logging",
    category: "privacy",
    severity: "medium",
    description: "Passwords, tokens, or PII written to logs.",
    triggers: ["console.log with passwords", "Logging request bodies with secrets", "PII in error logs"],
  },
  // Configuration
  {
    id: "VC-CONFIG-001",
    title: "Debug Mode in Production",
    category: "config",
    severity: "medium",
    description: "Debug flags or development settings without environment checks.",
    triggers: ["debug: true without NODE_ENV check", "Verbose logging unconditionally enabled", "Development middleware in production"],
  },
  {
    id: "VC-CONFIG-002",
    title: "Missing Security Headers",
    category: "config",
    severity: "medium",
    description: "Security headers not configured in Next.js config or middleware.",
    triggers: ["No CSP header", "Missing X-Frame-Options", "HSTS not configured"],
  },
  {
    id: "VC-CONFIG-003",
    title: "Permissive CORS Configuration",
    category: "config",
    severity: "high",
    description: "CORS allowing all origins or credentials with wildcards.",
    triggers: ["Access-Control-Allow-Origin: *", "Credentials with wildcard origin", "Dynamic origin without validation"],
  },
  // Cryptography
  {
    id: "VC-CRYPTO-001",
    title: "Hardcoded Secrets",
    category: "crypto",
    severity: "critical",
    description: "API keys, passwords, or tokens hardcoded in source files.",
    triggers: ["API keys in source", "Passwords in code", "JWT secrets hardcoded"],
  },
  {
    id: "VC-CRYPTO-002",
    title: "Weak Cryptographic Algorithm",
    category: "crypto",
    severity: "high",
    description: "Use of deprecated or weak cryptographic algorithms.",
    triggers: ["MD5 for security purposes", "SHA1 for signatures", "DES/3DES encryption"],
  },
  {
    id: "VC-CRYPTO-003",
    title: "Insecure Random Number Generation",
    category: "crypto",
    severity: "high",
    description: "Math.random() used for security-sensitive operations.",
    triggers: ["Math.random() for tokens", "Non-crypto random for IDs", "Predictable session identifiers"],
  },
  // Network
  {
    id: "VC-NET-001",
    title: "SSRF Vulnerability",
    category: "network",
    severity: "high",
    description: "User-controlled URLs in server-side fetch without validation.",
    triggers: ["fetch() with user URL", "No URL allowlist", "Internal network accessible"],
  },
  {
    id: "VC-NET-002",
    title: "Missing Request Timeout",
    category: "network",
    severity: "low",
    description: "HTTP requests without timeout configuration.",
    triggers: ["fetch() without AbortController", "No timeout in HTTP client", "Unbounded request duration"],
  },
  {
    id: "VC-RATE-001",
    title: "Missing Rate Limiting",
    category: "network",
    severity: "medium",
    description: "Public endpoints without rate limiting protection.",
    triggers: ["Auth endpoints without limits", "API routes without throttling", "No rate limit middleware"],
  },
  // Middleware
  {
    id: "VC-MW-001",
    title: "Incomplete Middleware Coverage",
    category: "middleware",
    severity: "high",
    description: "Middleware matcher excludes sensitive routes.",
    triggers: ["API routes not in matcher", "Admin paths excluded", "Overly narrow config"],
  },
  {
    id: "VC-MW-002",
    title: "Middleware Bypass via Path",
    category: "middleware",
    severity: "high",
    description: "Middleware can be bypassed through path manipulation.",
    triggers: ["Case-sensitive matching issues", "Trailing slash bypass", "Encoded character bypass"],
  },
  // Uploads
  {
    id: "VC-UP-001",
    title: "Unrestricted File Upload",
    category: "uploads",
    severity: "high",
    description: "File uploads without type or size restrictions.",
    triggers: ["No MIME type validation", "Missing file size limits", "No extension filtering"],
  },
  {
    id: "VC-UP-002",
    title: "Path Traversal in Upload",
    category: "uploads",
    severity: "critical",
    description: "User-controlled filename used in file path without sanitization.",
    triggers: ["Filename from user input", "Path.join with user data", "No path normalization"],
  },
  // Hallucinations
  {
    id: "VC-HALL-001",
    title: "Unused Validation Schema",
    category: "hallucinations",
    severity: "high",
    description: "Validation schema defined but never applied to incoming data.",
    triggers: ["Zod schema without parse/safeParse call", "Schema defined but not imported in handler", "Validation in comments only"],
  },
  {
    id: "VC-HALL-002",
    title: "Uncalled Auth Function",
    category: "hallucinations",
    severity: "critical",
    description: "Authentication helper defined but not invoked in route handler.",
    triggers: ["requireAuth imported but not called", "Auth check in dead code path", "Conditional that's always false"],
  },
  {
    id: "VC-HALL-003",
    title: "Security Comment Without Implementation",
    category: "hallucinations",
    severity: "high",
    description: "TODO or FIXME comment about security with no implementation.",
    triggers: ["// TODO: add auth", "// FIXME: validate input", "Security comments without code"],
  },
];

export default function RulesPage() {
  const [selectedCategory, setSelectedCategory] = useState("all");

  const filteredRules = selectedCategory === "all"
    ? rules
    : rules.filter((r) => r.category === selectedCategory);

  const ruleCount = rules.length;
  const categoryCount = categories.length - 1; // Exclude "all"

  return (
    <div className="max-w-4xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-zinc-100">Security Rules</h1>
            <p className="text-sm text-zinc-500">
              {ruleCount} rules across {categoryCount} categories
            </p>
          </div>
        </div>
      </motion.div>

      {/* Category Filter */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="flex flex-wrap gap-2 mb-8"
      >
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = selectedCategory === cat.id;
          const count = cat.id === "all" ? rules.length : rules.filter((r) => r.category === cat.id).length;

          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all ${
                isActive
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-zinc-800/50 text-zinc-400 border border-zinc-700/50 hover:bg-zinc-800 hover:text-zinc-300"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {cat.name}
              <span className={`text-xs ${isActive ? "text-emerald-500" : "text-zinc-500"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </motion.div>

      {/* Rules List */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="space-y-4"
      >
        {filteredRules.map((rule, i) => (
          <RuleCard key={rule.id} rule={rule} delay={i * 0.03} />
        ))}
      </motion.div>

      {/* Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="mt-12 p-6 rounded-xl bg-zinc-900/50 border border-zinc-800"
      >
        <h2 className="text-lg font-semibold text-zinc-100 mb-4">Rule Coverage</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Critical"
            value={rules.filter((r) => r.severity === "critical").length}
            color="red"
          />
          <StatCard
            label="High"
            value={rules.filter((r) => r.severity === "high").length}
            color="orange"
          />
          <StatCard
            label="Medium"
            value={rules.filter((r) => r.severity === "medium").length}
            color="yellow"
          />
          <StatCard
            label="Low"
            value={rules.filter((r) => r.severity === "low").length}
            color="blue"
          />
        </div>
      </motion.div>
    </div>
  );
}

function RuleCard({ rule, delay }: { rule: typeof rules[0]; delay: number }) {
  const severityColors = {
    critical: "bg-red-500/10 text-red-400 border-red-500/20",
    high: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    low: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="p-5 rounded-xl bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <code className="text-sm text-emerald-400 font-mono">{rule.id}</code>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${severityColors[rule.severity as keyof typeof severityColors]}`}>
              {rule.severity}
            </span>
          </div>
          <h3 className="font-semibold text-zinc-100">{rule.title}</h3>
        </div>
      </div>
      <p className="text-sm text-zinc-400 mb-3">{rule.description}</p>
      <div className="flex flex-wrap gap-2">
        {rule.triggers.map((trigger, i) => (
          <span
            key={i}
            className="px-2 py-0.5 rounded bg-zinc-800/50 text-xs text-zinc-500"
          >
            {trigger}
          </span>
        ))}
      </div>
    </motion.div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "red" | "orange" | "yellow" | "blue";
}) {
  const colors = {
    red: "text-red-400",
    orange: "text-orange-400",
    yellow: "text-yellow-400",
    blue: "text-blue-400",
  };

  return (
    <div className="text-center">
      <div className={`text-2xl font-bold ${colors[color]}`}>{value}</div>
      <div className="text-xs text-zinc-500">{label}</div>
    </div>
  );
}
