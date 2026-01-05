/**
 * Local heuristic list of deprecated/vulnerable packages.
 * This list is deterministic (no network calls) and curated.
 *
 * Sources for additions:
 * - npm deprecation notices
 * - Security advisories (GHSA, CVE)
 * - Project EOL announcements
 * - Known vulnerable patterns
 */

export interface DeprecatedPackage {
  name: string;
  reason: string;
  replacement?: string;
  severity: "critical" | "high" | "medium" | "low";
  /** CVE or advisory if applicable */
  advisory?: string;
}

/**
 * Deprecated/vulnerable packages list
 */
export const DEPRECATED_PACKAGES: DeprecatedPackage[] = [
  // Security-critical deprecations
  {
    name: "request",
    reason: "Deprecated since 2020, no security patches",
    replacement: "node-fetch, axios, or got",
    severity: "high",
  },
  {
    name: "request-promise",
    reason: "Deprecated, depends on deprecated request",
    replacement: "node-fetch, axios, or got",
    severity: "high",
  },
  {
    name: "request-promise-native",
    reason: "Deprecated, depends on deprecated request",
    replacement: "node-fetch, axios, or got",
    severity: "high",
  },
  {
    name: "node-uuid",
    reason: "Deprecated, renamed to uuid",
    replacement: "uuid",
    severity: "low",
  },
  {
    name: "bcrypt-nodejs",
    reason: "Unmaintained, security concerns",
    replacement: "bcrypt or bcryptjs",
    severity: "high",
    advisory: "Multiple known vulnerabilities",
  },
  {
    name: "cryptiles",
    reason: "Deprecated due to timing attack vulnerabilities",
    replacement: "@hapi/cryptiles",
    severity: "critical",
    advisory: "CVE-2018-1000620",
  },
  {
    name: "hoek",
    reason: "Prototype pollution vulnerability",
    replacement: "@hapi/hoek >= 6.0.0",
    severity: "critical",
    advisory: "CVE-2018-3728",
  },
  {
    name: "lodash",
    reason: "Versions < 4.17.21 have prototype pollution vulnerabilities",
    severity: "medium",
    advisory: "CVE-2021-23337, CVE-2020-8203",
  },
  {
    name: "minimist",
    reason: "Versions < 1.2.6 have prototype pollution",
    severity: "medium",
    advisory: "CVE-2021-44906",
  },
  {
    name: "qs",
    reason: "Versions < 6.10.3 have prototype pollution",
    severity: "medium",
    advisory: "CVE-2022-24999",
  },
  {
    name: "ua-parser-js",
    reason: "Versions < 0.7.33 or 0.8.x/1.0.x compromised",
    severity: "critical",
    advisory: "Supply chain attack (malware)",
  },
  {
    name: "event-stream",
    reason: "Versions 3.3.6 contained malware targeting bitcoin wallets",
    severity: "critical",
    advisory: "Supply chain attack (bitcoin theft)",
  },
  {
    name: "flatmap-stream",
    reason: "Contained malicious code, part of event-stream attack",
    severity: "critical",
    advisory: "Supply chain attack",
  },
  {
    name: "coa",
    reason: "Versions 2.0.3+ briefly compromised",
    severity: "high",
    advisory: "Supply chain attack",
  },
  {
    name: "rc",
    reason: "Versions 1.2.9, 1.3.0, 2.3.9 briefly compromised",
    severity: "high",
    advisory: "Supply chain attack",
  },
  {
    name: "colors",
    reason: "Versions 1.4.1+ contain intentional sabotage code",
    replacement: "chalk or ansi-colors",
    severity: "high",
    advisory: "Protestware",
  },
  {
    name: "faker",
    reason: "Versions 6.6.6+ contain intentional sabotage code",
    replacement: "@faker-js/faker",
    severity: "high",
    advisory: "Protestware",
  },
  {
    name: "node-ipc",
    reason: "Versions 10.1.1-10.1.2 contained destructive code",
    severity: "critical",
    advisory: "Protestware/malware targeting Russia/Belarus",
  },
  {
    name: "merge",
    reason: "Prototype pollution in all versions",
    replacement: "lodash.merge or Object spread",
    severity: "medium",
    advisory: "CVE-2018-16469",
  },
  {
    name: "deep-extend",
    reason: "Versions < 0.6.0 have prototype pollution",
    severity: "high",
    advisory: "CVE-2018-3750",
  },
  {
    name: "mixin-deep",
    reason: "Versions < 1.3.2 have prototype pollution",
    severity: "high",
    advisory: "CVE-2019-10746",
  },
  {
    name: "set-value",
    reason: "Versions < 4.0.0 have prototype pollution",
    severity: "high",
    advisory: "CVE-2021-23440",
  },
  // Authentication/crypto deprecations
  {
    name: "passport-local-mongoose",
    reason: "Outdated, use @passport-js/passport-local-mongoose",
    severity: "low",
  },
  {
    name: "jwt-simple",
    reason: "Algorithm confusion vulnerability possible",
    replacement: "jsonwebtoken with explicit algorithms",
    severity: "high",
  },
  {
    name: "cookie-session",
    reason: "Consider express-session for sensitive data",
    severity: "low",
  },
  // Other security-relevant deprecations
  {
    name: "marked",
    reason: "Versions < 4.0.10 have ReDoS and XSS vulnerabilities",
    severity: "medium",
    advisory: "Multiple CVEs",
  },
  {
    name: "serialize-javascript",
    reason: "Versions < 3.1.0 have XSS vulnerability",
    severity: "high",
    advisory: "CVE-2020-7660",
  },
  {
    name: "sanitize-html",
    reason: "Versions < 2.7.1 have XSS bypass vulnerabilities",
    severity: "high",
    advisory: "Multiple CVEs",
  },
  {
    name: "tar",
    reason: "Versions < 6.1.11 have path traversal vulnerabilities",
    severity: "high",
    advisory: "CVE-2021-37701, CVE-2021-37712",
  },
  {
    name: "decompress",
    reason: "Arbitrary file write via path traversal",
    severity: "critical",
    advisory: "CVE-2020-12265",
  },
  {
    name: "unzip",
    reason: "Arbitrary file write via path traversal",
    replacement: "unzipper or yauzl",
    severity: "critical",
  },
  {
    name: "adm-zip",
    reason: "Versions < 0.5.2 have path traversal",
    severity: "high",
    advisory: "CVE-2018-1002204",
  },
  {
    name: "xmldom",
    reason: "Versions < 0.7.5 have XXE and other vulnerabilities",
    replacement: "@xmldom/xmldom",
    severity: "high",
  },
  {
    name: "xml2js",
    reason: "Prototype pollution in some versions",
    severity: "medium",
  },
];

/**
 * Map for quick lookups
 */
export const DEPRECATED_PACKAGES_MAP = new Map<string, DeprecatedPackage>(
  DEPRECATED_PACKAGES.map((pkg) => [pkg.name, pkg])
);

/**
 * Check if a package is deprecated
 */
export function isDeprecated(name: string): DeprecatedPackage | undefined {
  return DEPRECATED_PACKAGES_MAP.get(name);
}
