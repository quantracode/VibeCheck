import { describe, it, expect } from "vitest";
import {
  parseMatcherConfig,
  matcherCoversApi,
  scanNextjsMiddleware,
} from "../../scanners/nextjs-middleware.js";
import type { ScanContext } from "../../scanners/types.js";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

describe("parseMatcherConfig", () => {
  it("parses single string matcher", () => {
    const content = `
export const config = {
  matcher: '/dashboard/:path*'
};
`;
    const matchers = parseMatcherConfig(content);
    expect(matchers).toEqual(["/dashboard/:path*"]);
  });

  it("parses array matcher", () => {
    const content = `
export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*']
};
`;
    const matchers = parseMatcherConfig(content);
    expect(matchers).toEqual(["/dashboard/:path*", "/admin/:path*"]);
  });

  it("returns null when no config export", () => {
    const content = `
export function middleware(request) {
  return NextResponse.next();
}
`;
    const matchers = parseMatcherConfig(content);
    expect(matchers).toBeNull();
  });

  it("parses complex negation pattern", () => {
    const content = `
export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)'
};
`;
    const matchers = parseMatcherConfig(content);
    expect(matchers).toEqual(["/((?!_next/static|_next/image|favicon.ico).*)"]);
  });
});

describe("matcherCoversApi", () => {
  it("returns true for direct /api match", () => {
    expect(matcherCoversApi(["/api"])).toBe(true);
    expect(matcherCoversApi(["/api/:path*"])).toBe(true);
  });

  it("returns true for patterns starting with /api", () => {
    expect(matcherCoversApi(["/api/users/:path*"])).toBe(true);
  });

  it("returns true for catch-all patterns", () => {
    expect(matcherCoversApi(["/:path*"])).toBe(true);
  });

  it("returns true for negation patterns not excluding api", () => {
    expect(
      matcherCoversApi(["/((?!_next/static|_next/image|favicon.ico).*)"])
    ).toBe(true);
  });

  it("returns false for dashboard-only patterns", () => {
    expect(matcherCoversApi(["/dashboard/:path*"])).toBe(false);
  });

  it("returns false for unrelated patterns", () => {
    expect(matcherCoversApi(["/admin", "/profile"])).toBe(false);
  });
});

describe("scanNextjsMiddleware", () => {
  function createNextProject(tmpDir: string, options: {
    hasMiddleware?: boolean;
    middlewareContent?: string;
    hasNextAuth?: boolean;
    hasApiRoutes?: boolean;
  } = {}) {
    // Create package.json
    const pkg: Record<string, unknown> = {
      name: "test-app",
      dependencies: {
        next: "14.0.0",
        ...(options.hasNextAuth && { "next-auth": "4.0.0" }),
      },
    };
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify(pkg));

    // Create middleware if specified
    if (options.hasMiddleware && options.middlewareContent) {
      fs.writeFileSync(
        path.join(tmpDir, "middleware.ts"),
        options.middlewareContent
      );
    }

    // Create API routes if specified
    if (options.hasApiRoutes) {
      const apiDir = path.join(tmpDir, "app", "api", "users");
      fs.mkdirSync(apiDir, { recursive: true });
      fs.writeFileSync(
        path.join(apiDir, "route.ts"),
        `export async function GET() { return Response.json({}); }`
      );
    }
  }

  it("returns no findings for non-Next.js project", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));

    try {
      fs.writeFileSync(
        path.join(tmpDir, "package.json"),
        JSON.stringify({ name: "test" })
      );

      const context: ScanContext = {
        targetDir: tmpDir,
        sourceFiles: [],
      };

      const findings = await scanNextjsMiddleware(context);
      expect(findings).toHaveLength(0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("returns no findings when no API routes exist", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));

    try {
      createNextProject(tmpDir, { hasApiRoutes: false });

      const context: ScanContext = {
        targetDir: tmpDir,
        sourceFiles: [],
      };

      const findings = await scanNextjsMiddleware(context);
      expect(findings).toHaveLength(0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("finds missing middleware with next-auth", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));

    try {
      createNextProject(tmpDir, {
        hasNextAuth: true,
        hasApiRoutes: true,
      });

      const context: ScanContext = {
        targetDir: tmpDir,
        sourceFiles: [],
      };

      const findings = await scanNextjsMiddleware(context);
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe("VC-AUTH-INFO-001");
      expect(findings[0].severity).toBe("medium");
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("finds middleware not covering API routes", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));

    try {
      createNextProject(tmpDir, {
        hasMiddleware: true,
        middlewareContent: `
export function middleware(request) {
  return NextResponse.next();
}

export const config = {
  matcher: '/dashboard/:path*'
};
`,
        hasApiRoutes: true,
      });

      const context: ScanContext = {
        targetDir: tmpDir,
        sourceFiles: [],
      };

      const findings = await scanNextjsMiddleware(context);
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe("VC-MW-001");
      expect(findings[0].severity).toBe("high");
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("returns no findings when middleware covers API", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibecheck-test-"));

    try {
      createNextProject(tmpDir, {
        hasMiddleware: true,
        middlewareContent: `
export function middleware(request) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*']
};
`,
        hasApiRoutes: true,
      });

      const context: ScanContext = {
        targetDir: tmpDir,
        sourceFiles: [],
      };

      const findings = await scanNextjsMiddleware(context);
      expect(findings).toHaveLength(0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });
});
