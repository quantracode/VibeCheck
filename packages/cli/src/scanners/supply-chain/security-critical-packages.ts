/**
 * Security-critical packages that should have pinned versions.
 * Version ranges on these packages pose higher supply chain risk.
 */

export interface SecurityCriticalPackage {
  name: string;
  category: "auth" | "crypto" | "session" | "validation" | "network";
  reason: string;
}

/**
 * Packages where version pinning is recommended
 */
export const SECURITY_CRITICAL_PACKAGES: SecurityCriticalPackage[] = [
  // Authentication
  { name: "next-auth", category: "auth", reason: "Authentication framework" },
  { name: "@auth/core", category: "auth", reason: "Auth.js core" },
  { name: "@auth/prisma-adapter", category: "auth", reason: "Auth.js Prisma adapter" },
  { name: "passport", category: "auth", reason: "Authentication middleware" },
  { name: "passport-local", category: "auth", reason: "Local authentication strategy" },
  { name: "passport-jwt", category: "auth", reason: "JWT authentication strategy" },
  { name: "passport-oauth2", category: "auth", reason: "OAuth2 authentication" },
  { name: "@clerk/nextjs", category: "auth", reason: "Clerk authentication" },
  { name: "@supabase/auth-helpers-nextjs", category: "auth", reason: "Supabase auth" },
  { name: "firebase-admin", category: "auth", reason: "Firebase Admin SDK with auth" },
  { name: "@okta/okta-auth-js", category: "auth", reason: "Okta authentication" },
  { name: "auth0", category: "auth", reason: "Auth0 SDK" },
  { name: "@auth0/nextjs-auth0", category: "auth", reason: "Auth0 Next.js SDK" },
  { name: "lucia", category: "auth", reason: "Modern authentication library" },
  { name: "better-auth", category: "auth", reason: "Authentication library" },

  // Cryptography
  { name: "bcrypt", category: "crypto", reason: "Password hashing" },
  { name: "bcryptjs", category: "crypto", reason: "Password hashing (JS)" },
  { name: "argon2", category: "crypto", reason: "Password hashing (Argon2)" },
  { name: "scrypt", category: "crypto", reason: "Password hashing (scrypt)" },
  { name: "jsonwebtoken", category: "crypto", reason: "JWT signing/verification" },
  { name: "jose", category: "crypto", reason: "JWT/JWS/JWE implementation" },
  { name: "crypto-js", category: "crypto", reason: "Cryptographic operations" },
  { name: "node-forge", category: "crypto", reason: "Cryptographic toolkit" },
  { name: "tweetnacl", category: "crypto", reason: "Cryptographic library" },
  { name: "sodium-native", category: "crypto", reason: "libsodium bindings" },
  { name: "libsodium-wrappers", category: "crypto", reason: "libsodium for JS" },

  // Session management
  { name: "express-session", category: "session", reason: "Session middleware" },
  { name: "cookie-session", category: "session", reason: "Cookie-based sessions" },
  { name: "iron-session", category: "session", reason: "Encrypted sessions" },
  { name: "connect-redis", category: "session", reason: "Redis session store" },
  { name: "connect-mongo", category: "session", reason: "MongoDB session store" },

  // Validation
  { name: "zod", category: "validation", reason: "Schema validation" },
  { name: "yup", category: "validation", reason: "Schema validation" },
  { name: "joi", category: "validation", reason: "Schema validation" },
  { name: "ajv", category: "validation", reason: "JSON Schema validation" },
  { name: "validator", category: "validation", reason: "String validation" },
  { name: "express-validator", category: "validation", reason: "Express validation" },
  { name: "class-validator", category: "validation", reason: "Class-based validation" },

  // Security-sensitive network
  { name: "helmet", category: "network", reason: "Security headers" },
  { name: "cors", category: "network", reason: "CORS configuration" },
  { name: "csurf", category: "network", reason: "CSRF protection" },
  { name: "express-rate-limit", category: "network", reason: "Rate limiting" },
  { name: "@upstash/ratelimit", category: "network", reason: "Rate limiting" },
  { name: "rate-limiter-flexible", category: "network", reason: "Rate limiting" },
  { name: "hpp", category: "network", reason: "HTTP Parameter Pollution protection" },
];

/**
 * Map for quick lookups
 */
export const SECURITY_CRITICAL_MAP = new Map<string, SecurityCriticalPackage>(
  SECURITY_CRITICAL_PACKAGES.map((pkg) => [pkg.name, pkg])
);

/**
 * Check if a package is security-critical
 */
export function isSecurityCritical(name: string): SecurityCriticalPackage | undefined {
  return SECURITY_CRITICAL_MAP.get(name);
}

/**
 * Auth library groupings for detecting multiple auth systems
 */
export const AUTH_LIBRARY_GROUPS = {
  nextAuth: ["next-auth", "@auth/core"],
  clerk: ["@clerk/nextjs", "@clerk/clerk-js"],
  supabase: ["@supabase/auth-helpers-nextjs", "@supabase/supabase-js"],
  firebase: ["firebase-admin", "firebase"],
  auth0: ["auth0", "@auth0/nextjs-auth0", "@auth0/auth0-spa-js"],
  okta: ["@okta/okta-auth-js", "@okta/okta-react"],
  passport: ["passport"],
  lucia: ["lucia"],
  jwt: ["jsonwebtoken", "jose"],
  betterAuth: ["better-auth"],
} as const;

export type AuthLibraryGroup = keyof typeof AUTH_LIBRARY_GROUPS;

/**
 * Detect which auth library groups are present
 */
export function detectAuthLibraries(
  dependencies: Record<string, string>
): AuthLibraryGroup[] {
  const detected: AuthLibraryGroup[] = [];

  for (const [group, packages] of Object.entries(AUTH_LIBRARY_GROUPS)) {
    if (packages.some((pkg) => pkg in dependencies)) {
      detected.push(group as AuthLibraryGroup);
    }
  }

  return detected;
}

/**
 * Suspicious patterns in install scripts
 */
export const SUSPICIOUS_SCRIPT_PATTERNS = [
  { pattern: /curl\s+.*\s*\|\s*(bash|sh)/i, reason: "Remote script execution" },
  { pattern: /wget\s+.*\s*\|\s*(bash|sh)/i, reason: "Remote script execution" },
  { pattern: /\beval\s*\(/i, reason: "Dynamic code execution" },
  { pattern: /base64\s+(-d|--decode)/i, reason: "Base64 decoding (possible obfuscation)" },
  { pattern: /\$\(.*\)/i, reason: "Command substitution" },
  { pattern: /`.*`/i, reason: "Command substitution (backticks)" },
  { pattern: /powershell/i, reason: "PowerShell execution" },
  { pattern: /\.exe\b/i, reason: "Windows executable reference" },
  { pattern: /\/etc\/passwd/i, reason: "System file access" },
  { pattern: /\/etc\/shadow/i, reason: "System file access" },
  { pattern: /ssh.*@/i, reason: "SSH connection attempt" },
  { pattern: /rm\s+-rf\s+\//i, reason: "Destructive command" },
  { pattern: /nc\s+-.*\d+/i, reason: "Netcat usage (potential backdoor)" },
  { pattern: /ncat/i, reason: "Ncat usage (potential backdoor)" },
  { pattern: /reverse.*shell/i, reason: "Reverse shell reference" },
  { pattern: /crypto.*wallet/i, reason: "Cryptocurrency reference" },
  { pattern: /bitcoin|ethereum|monero/i, reason: "Cryptocurrency reference" },
  { pattern: /keylog/i, reason: "Keylogger reference" },
  { pattern: /exfiltrat/i, reason: "Data exfiltration reference" },
  { pattern: /hidden|stealth/i, reason: "Stealth behavior reference" },
  { pattern: /process\.env\.[A-Z_]+.*https?:\/\//i, reason: "Env var with URL (potential C2)" },
];

/**
 * Check if a script contains suspicious patterns
 */
export function findSuspiciousPatterns(script: string): Array<{ pattern: string; reason: string }> {
  const found: Array<{ pattern: string; reason: string }> = [];

  for (const { pattern, reason } of SUSPICIOUS_SCRIPT_PATTERNS) {
    if (pattern.test(script)) {
      found.push({ pattern: pattern.source, reason });
    }
  }

  return found;
}
