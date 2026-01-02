import type { Finding } from "@vibecheck/schema";
import type { SourceFile, Node, FunctionDeclaration, ArrowFunction, FunctionExpression } from "ts-morph";

/**
 * Repository metadata extracted from package.json and environment
 */
export interface RepoMeta {
  /** Dependencies from package.json */
  dependencies: Record<string, string>;
  /** Dev dependencies from package.json */
  devDependencies: Record<string, string>;
  /** Detected framework (next, express, etc.) */
  framework: "next" | "express" | "fastify" | "koa" | "unknown";
  /** Whether the project uses TypeScript */
  hasTypeScript: boolean;
  /** Whether next-auth is present */
  hasNextAuth: boolean;
  /** Whether prisma is present */
  hasPrisma: boolean;
}

/**
 * File index for quick lookups
 */
export interface FileIndex {
  /** All .ts, .tsx, .js, .jsx files */
  allSourceFiles: string[];
  /** TypeScript/TSX files only */
  tsTsxFiles: string[];
  /** Config files (.env*, *.config.*, etc.) */
  configFiles: string[];
  /** Next.js App Router route files (route.ts/js) */
  routeFiles: string[];
  /** Next.js middleware file path if exists */
  middlewareFile?: string;
  /** API route files specifically */
  apiRouteFiles: string[];
}

/**
 * Function node types that can be handlers
 */
export type FunctionNode = FunctionDeclaration | ArrowFunction | FunctionExpression;

/**
 * AST helpers for scanner use
 */
export interface AstHelpers {
  /** Parse a source file with ts-morph */
  parseFile(filePath: string): SourceFile | null;

  /** Find exported route handlers (GET, POST, etc.) in Next.js route file */
  findRouteHandlers(sourceFile: SourceFile): RouteHandler[];

  /** Check if a function contains auth checks */
  containsAuthCheck(node: FunctionNode): boolean;

  /** Find database sink calls (prisma, sql, etc.) */
  findDbSinks(node: FunctionNode): DbSink[];

  /** Find validation usage (zod, yup, joi) */
  findValidationUsage(node: FunctionNode): ValidationUsage[];

  /** Find console/logger calls with sensitive data */
  findSensitiveLogCalls(node: FunctionNode): SensitiveLogCall[];

  /** Find insecure default fallbacks for env vars */
  findInsecureDefaults(sourceFile: SourceFile): InsecureDefault[];

  /** Find SSRF-prone fetch calls */
  findSsrfProneFetch(node: FunctionNode): SsrfProneFetch[];

  /** Get the text/content of a node */
  getNodeText(node: Node): string;

  /** Get line number of a node */
  getNodeLine(node: Node): number;

  // Phase 2 helpers

  /** Find redirect calls with user-controlled input */
  findRedirectCalls(node: FunctionNode): RedirectCall[];

  /** Find CORS configuration in file */
  findCorsConfig(sourceFile: SourceFile): CorsConfig[];

  /** Find outbound HTTP calls (fetch/axios) */
  findOutboundCalls(node: FunctionNode): OutboundCall[];

  /** Find Prisma queries that may expose too much data */
  findPrismaQueries(node: FunctionNode): PrismaQuery[];

  /** Find Math.random usage in sensitive contexts */
  findMathRandomUsage(sourceFile: SourceFile): MathRandomUsage[];

  /** Find JWT decode without verify */
  findJwtDecodeWithoutVerify(sourceFile: SourceFile): JwtDecodeCall[];

  /** Find weak hash usage */
  findWeakHashUsage(sourceFile: SourceFile): WeakHashUsage[];

  /** Find file upload handlers */
  findFileUploadHandlers(node: FunctionNode): FileUploadHandler[];

  /** Find file writes to public directories */
  findPublicFileWrites(sourceFile: SourceFile): PublicFileWrite[];

  /** Check if file contains rate limiting signals */
  hasRateLimitSignals(sourceFile: SourceFile): boolean;

  /** Check if file contains validation schemas */
  hasValidationSchemas(sourceFile: SourceFile): boolean;
}

/**
 * Route handler information
 */
export interface RouteHandler {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
  functionNode: FunctionNode;
  exportName: string;
  startLine: number;
  endLine: number;
}

/**
 * Database sink call information
 */
export interface DbSink {
  kind: "prisma" | "sql" | "knex" | "drizzle" | "export";
  operation: string; // create, delete, query, export, etc.
  node: Node;
  line: number;
  snippet: string;
  isCritical: boolean; // delete, deleteMany, export operations
}

/**
 * Validation usage information
 */
export interface ValidationUsage {
  library: "zod" | "yup" | "joi";
  method: string; // parse, validate, etc.
  resultAssigned: boolean;
  resultUsed: boolean;
  rawBodyUsedAfter: boolean;
  node: Node;
  line: number;
}

/**
 * Sensitive log call information
 */
export interface SensitiveLogCall {
  logMethod: string; // console.log, logger.info, etc.
  sensitiveVars: string[];
  severity: "high" | "medium";
  node: Node;
  line: number;
  snippet: string;
}

/**
 * Insecure default fallback information
 */
export interface InsecureDefault {
  envVar: string;
  fallbackValue: string;
  isCritical: boolean; // JWT, SESSION, AUTH secrets
  node: Node;
  line: number;
  snippet: string;
}

/**
 * SSRF-prone fetch call information
 */
export interface SsrfProneFetch {
  fetchMethod: string; // fetch, axios.get, etc.
  userInputSource: string; // body.url, query.url, etc.
  node: Node;
  line: number;
  snippet: string;
}

/**
 * Redirect call information for open redirect detection
 */
export interface RedirectCall {
  method: string; // NextResponse.redirect, res.redirect, redirect
  targetExpression: string; // The URL/target being redirected to
  isUserControlled: boolean;
  userControlledSource?: string; // e.g., "searchParams.get('next')"
  node: Node;
  line: number;
  snippet: string;
}

/**
 * CORS configuration information
 */
export interface CorsConfig {
  hasWildcardOrigin: boolean;
  hasCredentials: boolean;
  originValue?: string;
  credentialsValue?: string;
  node: Node;
  line: number;
  snippet: string;
}

/**
 * Outbound HTTP call information
 */
export interface OutboundCall {
  method: string; // fetch, axios.get, etc.
  urlExpression: string;
  hasTimeout: boolean;
  isExternalUrl: boolean; // Not localhost
  node: Node;
  line: number;
  snippet: string;
}

/**
 * Prisma query information for over-broad response detection
 */
export interface PrismaQuery {
  model: string; // user, account, etc.
  operation: string; // findMany, findUnique, etc.
  hasSelect: boolean;
  hasInclude: boolean;
  isDirectlyReturned: boolean;
  node: Node;
  line: number;
  snippet: string;
}

/**
 * Math.random token usage
 */
export interface MathRandomUsage {
  variableName: string;
  isSensitiveContext: boolean; // token, key, session, etc.
  node: Node;
  line: number;
  snippet: string;
}

/**
 * JWT decode call without verify
 */
export interface JwtDecodeCall {
  hasVerifyInFile: boolean;
  node: Node;
  line: number;
  snippet: string;
}

/**
 * Weak hash usage
 */
export interface WeakHashUsage {
  algorithm: string; // md5, sha1
  isPasswordContext: boolean;
  node: Node;
  line: number;
  snippet: string;
}

/**
 * File upload handler information
 */
export interface FileUploadHandler {
  uploadMethod: string; // multer, formidable, formData
  hasSizeCheck: boolean;
  hasTypeCheck: boolean;
  hasLimits: boolean;
  node: Node;
  line: number;
  snippet: string;
}

/**
 * File write to public path
 */
export interface PublicFileWrite {
  writePath: string;
  isPublicDir: boolean;
  usesUserFilename: boolean;
  node: Node;
  line: number;
  snippet: string;
}

/**
 * Parsed Prisma model information
 */
export interface PrismaModelInfo {
  name: string;
  fields: string[];
  hasSensitiveFields: boolean; // password, hash, token, secret
}

/**
 * Prisma schema parsed info
 */
export interface PrismaSchemaInfo {
  models: Map<string, PrismaModelInfo>;
}

/**
 * Framework detection hints
 */
export interface FrameworkHints {
  isNext: boolean;
  isExpress: boolean;
  hasPrisma: boolean;
  hasNextAuth: boolean;
  hasMulter: boolean;
  hasFormidable: boolean;
}

/**
 * Progress callback for file processing
 */
export type FileProgressCallback = (file: string, index: number, total: number) => void;

/**
 * Context passed to each scanner
 */
export interface ScanContext {
  /** Absolute path to the target directory being scanned */
  repoRoot: string;
  /** Indexed files for quick lookup */
  fileIndex: FileIndex;
  /** Repository metadata */
  repoMeta: RepoMeta;
  /** AST helpers */
  helpers: AstHelpers;
  /** Framework detection hints */
  frameworkHints: FrameworkHints;
  /** Prisma schema information if available */
  prismaSchemaInfo?: PrismaSchemaInfo;
  /** Optional callback for file progress reporting */
  onFileProgress?: FileProgressCallback;
}

/**
 * Scanner function signature
 */
export type Scanner = (context: ScanContext) => Promise<Finding[]>;

/**
 * Scanner pack exports
 */
export interface ScannerPack {
  /** Unique pack identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Scanner functions in this pack */
  scanners: Scanner[];
}

/**
 * Severity levels for comparison
 */
export const SEVERITY_ORDER = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0,
} as const;

/**
 * Check if severity meets or exceeds threshold
 */
export function severityMeetsThreshold(
  severity: keyof typeof SEVERITY_ORDER,
  threshold: keyof typeof SEVERITY_ORDER
): boolean {
  return SEVERITY_ORDER[severity] >= SEVERITY_ORDER[threshold];
}

// =============================================================================
// Phase 3: Hallucination Detection Types
// =============================================================================

/**
 * Route information for route map
 */
export interface RouteInfo {
  /** Stable unique identifier for the route */
  routeId: string;
  /** HTTP method */
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
  /** URL path pattern */
  path: string;
  /** Source file path (relative) */
  file: string;
  /** Handler start line */
  startLine: number;
  /** Handler end line */
  endLine: number;
}

/**
 * Middleware matcher information
 */
export interface MiddlewareInfo {
  /** Source file path (relative) */
  file: string;
  /** Matcher patterns */
  matchers: string[];
  /** Whether it protects API routes */
  protectsApi: boolean;
  /** Start line of config */
  startLine: number;
}

/**
 * Claim types for intent mining (must match schema)
 */
export type IntentClaimType =
  | "AUTH_ENFORCED"
  | "INPUT_VALIDATED"
  | "CSRF_ENABLED"
  | "RATE_LIMITED"
  | "ENCRYPTED_AT_REST"
  | "MIDDLEWARE_PROTECTED"
  | "OTHER";

/**
 * Claim sources (must match schema)
 */
export type IntentClaimSource =
  | "comment"
  | "identifier"
  | "import"
  | "doc"
  | "ui"
  | "config";

/**
 * Claim scope (must match schema)
 */
export type IntentClaimScope = "route" | "module" | "global";

/**
 * Claim strength (must match schema)
 */
export type IntentClaimStrength = "weak" | "medium" | "strong";

/**
 * Intent claim mined from source code
 */
export interface IntentClaim {
  /** Stable unique identifier */
  intentId: string;
  /** Type of security claim */
  type: IntentClaimType;
  /** Scope of the claim */
  scope: IntentClaimScope;
  /** Target route ID if applicable */
  targetRouteId?: string;
  /** Source of the claim */
  source: IntentClaimSource;
  /** Location in source */
  location: {
    file: string;
    startLine: number;
    endLine: number;
  };
  /** Strength of the claim */
  strength: IntentClaimStrength;
  /** Text evidence of the claim */
  textEvidence: string;
}

/**
 * Proof trace step
 */
export interface ProofTraceStep {
  /** File containing this step */
  file: string;
  /** Line number */
  line: number;
  /** Code snippet */
  snippet: string;
  /** Step label/description */
  label: string;
}

/**
 * Proof trace result
 */
export interface ProofTrace {
  /** Route ID being traced */
  routeId: string;
  /** Whether auth was proven */
  authProven: boolean;
  /** Whether validation was proven */
  validationProven: boolean;
  /** Middleware coverage status */
  middlewareCovered: boolean;
  /** Trace steps showing the proof chain */
  steps: ProofTraceStep[];
}

/**
 * Coverage metrics for the scanned codebase
 */
export interface CoverageMetrics {
  /** Auth coverage: routes with auth / total state-changing routes */
  authCoverage: number;
  /** Validation coverage: routes with validation / total routes with body */
  validationCoverage: number;
  /** Middleware coverage: routes covered by middleware / total routes */
  middlewareCoverage: number;
}

/**
 * Phase 3 extended scan context
 */
export interface Phase3Context extends ScanContext {
  /** Route map */
  routeMap: RouteInfo[];
  /** Middleware map */
  middlewareMap: MiddlewareInfo[];
  /** Intent claims mined from source */
  intentMap: IntentClaim[];
  /** Proof traces for routes */
  proofTraces: Map<string, ProofTrace>;
  /** Coverage metrics */
  coverage: CoverageMetrics;
}
