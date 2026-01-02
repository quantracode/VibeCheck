import { Project, SourceFile, Node, SyntaxKind, CallExpression, VariableDeclaration, BinaryExpression } from "ts-morph";
import type {
  AstHelpers,
  FunctionNode,
  RouteHandler,
  DbSink,
  ValidationUsage,
  SensitiveLogCall,
  InsecureDefault,
  SsrfProneFetch,
  RedirectCall,
  CorsConfig,
  OutboundCall,
  PrismaQuery,
  MathRandomUsage,
  JwtDecodeCall,
  WeakHashUsage,
  FileUploadHandler,
  PublicFileWrite,
  FileProgressCallback,
} from "../types.js";

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

/**
 * Auth check function/method names to look for
 */
const AUTH_CHECK_PATTERNS = [
  "getServerSession",
  "getSession",
  "auth",
  "requireAuth",
  "withAuth",
  "verifyJwt",
  "verifyToken",
  "authenticate",
  "isAuthenticated",
  "checkAuth",
  "validateSession",
  "getToken",
  "verifyAuth",
];

/**
 * Prisma operations that are dangerous without auth
 */
const PRISMA_WRITE_OPS = [
  "create",
  "createMany",
  "update",
  "updateMany",
  "upsert",
  "delete",
  "deleteMany",
];

const CRITICAL_OPS = ["delete", "deleteMany"];

/**
 * Sensitive variable name patterns
 */
const SENSITIVE_VAR_PATTERNS = /^(password|token|auth|authorization|cookie|session|secret|apikey|api_key|private|credential|bearer)/i;

/**
 * Critical env var patterns for insecure defaults
 */
const CRITICAL_ENV_PATTERNS = /JWT|SESSION|NEXTAUTH|SECRET|AUTH|TOKEN|KEY|PASSWORD/i;

/**
 * Create AST helpers with a ts-morph project
 */
export function createAstHelpers(
  repoRoot: string,
  totalFiles?: number,
  onFileProgress?: FileProgressCallback
): AstHelpers {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      allowJs: true,
      checkJs: false,
      noEmit: true,
      skipLibCheck: true,
    },
  });

  const fileCache = new Map<string, SourceFile>();
  let filesParsed = 0;

  function parseFile(filePath: string): SourceFile | null {
    if (fileCache.has(filePath)) {
      return fileCache.get(filePath)!;
    }

    try {
      const sourceFile = project.addSourceFileAtPath(filePath);
      fileCache.set(filePath, sourceFile);
      filesParsed++;

      // Report progress if callback provided
      if (onFileProgress && totalFiles) {
        onFileProgress(filePath, filesParsed, totalFiles);
      }

      return sourceFile;
    } catch {
      filesParsed++;
      if (onFileProgress && totalFiles) {
        onFileProgress(filePath, filesParsed, totalFiles);
      }
      return null;
    }
  }

  function findRouteHandlers(sourceFile: SourceFile): RouteHandler[] {
    const handlers: RouteHandler[] = [];

    // Find exported function declarations
    for (const func of sourceFile.getFunctions()) {
      if (!func.isExported()) continue;

      const name = func.getName();
      if (!name) continue;

      const method = HTTP_METHODS.find((m) => m === name);
      if (method) {
        handlers.push({
          method,
          functionNode: func,
          exportName: name,
          startLine: func.getStartLineNumber(),
          endLine: func.getEndLineNumber(),
        });
      }
    }

    // Find exported variable declarations with arrow functions
    for (const varStatement of sourceFile.getVariableStatements()) {
      if (!varStatement.isExported()) continue;

      for (const decl of varStatement.getDeclarations()) {
        const name = decl.getName();
        const method = HTTP_METHODS.find((m) => m === name);
        if (!method) continue;

        const initializer = decl.getInitializer();
        if (initializer && (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer))) {
          handlers.push({
            method,
            functionNode: initializer,
            exportName: name,
            startLine: decl.getStartLineNumber(),
            endLine: decl.getEndLineNumber(),
          });
        }
      }
    }

    return handlers;
  }

  function containsAuthCheck(node: FunctionNode): boolean {
    const text = node.getText();

    // Quick regex check first for performance
    const hasAuthPattern = AUTH_CHECK_PATTERNS.some((pattern) =>
      text.includes(pattern)
    );

    if (!hasAuthPattern) {
      // Also check for header/cookie checks followed by early returns
      const hasHeaderCheck = /request\.headers|req\.headers|headers\.get/i.test(text);
      const hasUnauthorizedReturn = /401|403|unauthorized|unauthenticated/i.test(text);

      return hasHeaderCheck && hasUnauthorizedReturn;
    }

    // Verify with AST
    const calls = node.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const call of calls) {
      const callText = call.getExpression().getText();

      // Check for auth function calls
      if (AUTH_CHECK_PATTERNS.some((pattern) => callText.includes(pattern))) {
        return true;
      }

      // Check for await auth() pattern
      if (callText === "auth" || callText.endsWith(".auth")) {
        return true;
      }
    }

    return false;
  }

  function findDbSinks(node: FunctionNode): DbSink[] {
    const sinks: DbSink[] = [];
    const calls = node.getDescendantsOfKind(SyntaxKind.CallExpression);

    for (const call of calls) {
      const callText = call.getExpression().getText();

      // Prisma patterns: prisma.user.create, db.user.delete, etc.
      const prismaMatch = callText.match(/(?:prisma|db)\.(\w+)\.(create|createMany|update|updateMany|upsert|delete|deleteMany)/);
      if (prismaMatch) {
        const operation = prismaMatch[2];
        sinks.push({
          kind: "prisma",
          operation,
          node: call,
          line: call.getStartLineNumber(),
          snippet: call.getText().slice(0, 100),
          isCritical: CRITICAL_OPS.includes(operation),
        });
        continue;
      }

      // SQL patterns: db.query, sql`...`, knex.insert/update/del
      if (/db\.query|\.execute|sql`/.test(callText)) {
        sinks.push({
          kind: "sql",
          operation: "query",
          node: call,
          line: call.getStartLineNumber(),
          snippet: call.getText().slice(0, 100),
          isCritical: /delete|drop|truncate/i.test(call.getText()),
        });
        continue;
      }

      // Knex patterns
      const knexMatch = callText.match(/\.(insert|update|del|delete)\s*\(/);
      if (knexMatch) {
        const operation = knexMatch[1];
        sinks.push({
          kind: "knex",
          operation,
          node: call,
          line: call.getStartLineNumber(),
          snippet: call.getText().slice(0, 100),
          isCritical: operation === "del" || operation === "delete",
        });
        continue;
      }

      // Export patterns: exportToCsv, generateExport, etc.
      if (/export/i.test(callText) && /csv|data|report|file/i.test(call.getText())) {
        sinks.push({
          kind: "export",
          operation: "export",
          node: call,
          line: call.getStartLineNumber(),
          snippet: call.getText().slice(0, 100),
          isCritical: true,
        });
      }
    }

    return sinks;
  }

  function findValidationUsage(node: FunctionNode): ValidationUsage[] {
    const usages: ValidationUsage[] = [];
    const calls = node.getDescendantsOfKind(SyntaxKind.CallExpression);
    const text = node.getText();

    // Track if raw body is used after validation
    const hasRawBodyAccess = /req\.body|request\.body|await\s+\w+\.json\(\)/i.test(text);

    for (const call of calls) {
      const callText = call.getExpression().getText();

      // Zod: schema.parse(), schema.safeParse()
      if (/\.parse\s*\(|\.safeParse\s*\(/.test(callText)) {
        const parent = call.getParent();
        const isAssigned = Node.isVariableDeclaration(parent) ||
          Node.isPropertyAssignment(parent) ||
          (Node.isBinaryExpression(parent) && parent.getOperatorToken().getText() === "=");

        // Check if result is used later (simplified check)
        let resultUsed = false;
        if (isAssigned && Node.isVariableDeclaration(parent)) {
          const varName = (parent as VariableDeclaration).getName();
          const afterCall = text.slice(text.indexOf(call.getText()) + call.getText().length);
          resultUsed = new RegExp(`\\b${varName}\\b`).test(afterCall);
        }

        usages.push({
          library: "zod",
          method: callText.includes("safeParse") ? "safeParse" : "parse",
          resultAssigned: isAssigned,
          resultUsed,
          rawBodyUsedAfter: hasRawBodyAccess && !resultUsed,
          node: call,
          line: call.getStartLineNumber(),
        });
        continue;
      }

      // Yup: schema.validate()
      if (/\.validate\s*\(/.test(callText) && /yup|schema/i.test(text)) {
        const parent = call.getParent();
        const isAssigned = Node.isVariableDeclaration(parent) ||
          (Node.isAwaitExpression(parent) && Node.isVariableDeclaration(parent.getParent()));

        usages.push({
          library: "yup",
          method: "validate",
          resultAssigned: isAssigned,
          resultUsed: isAssigned, // Simplified
          rawBodyUsedAfter: hasRawBodyAccess && !isAssigned,
          node: call,
          line: call.getStartLineNumber(),
        });
        continue;
      }

      // Joi: joi.validate() or schema.validate()
      if (/joi\.validate|\.validate\s*\(/.test(callText) && /joi/i.test(text)) {
        const parent = call.getParent();
        const isAssigned = Node.isVariableDeclaration(parent);

        usages.push({
          library: "joi",
          method: "validate",
          resultAssigned: isAssigned,
          resultUsed: isAssigned,
          rawBodyUsedAfter: hasRawBodyAccess && !isAssigned,
          node: call,
          line: call.getStartLineNumber(),
        });
      }
    }

    return usages;
  }

  function findSensitiveLogCalls(node: FunctionNode): SensitiveLogCall[] {
    const calls: SensitiveLogCall[] = [];
    const callExprs = node.getDescendantsOfKind(SyntaxKind.CallExpression);

    for (const call of callExprs) {
      const callText = call.getExpression().getText();

      // Match console.log/info/error/warn or logger.log/info/error/warn
      if (!/^(console|logger)\.(log|info|error|warn|debug)$/.test(callText)) {
        continue;
      }

      const args = call.getArguments();
      const sensitiveVars: string[] = [];
      let hasHighSeverity = false;

      for (const arg of args) {
        const argText = arg.getText();

        // Check for direct sensitive variable references
        const identifiers = arg.getDescendantsOfKind(SyntaxKind.Identifier);
        for (const id of identifiers) {
          const name = id.getText();
          if (SENSITIVE_VAR_PATTERNS.test(name)) {
            sensitiveVars.push(name);
            if (/password|secret|credential|bearer|authorization/i.test(name)) {
              hasHighSeverity = true;
            }
          }
        }

        // Check for object properties with sensitive names
        if (/password|token|secret|authorization|apikey|cookie|session/i.test(argText)) {
          if (!sensitiveVars.some((v) => argText.includes(v))) {
            const match = argText.match(/(password|token|secret|authorization|apikey|api_key|cookie|session)/i);
            if (match) {
              sensitiveVars.push(match[1]);
              if (/password|secret|authorization/i.test(match[1])) {
                hasHighSeverity = true;
              }
            }
          }
        }
      }

      if (sensitiveVars.length > 0) {
        calls.push({
          logMethod: callText,
          sensitiveVars,
          severity: hasHighSeverity ? "high" : "medium",
          node: call,
          line: call.getStartLineNumber(),
          snippet: call.getText().slice(0, 150),
        });
      }
    }

    return calls;
  }

  function findInsecureDefaults(sourceFile: SourceFile): InsecureDefault[] {
    const defaults: InsecureDefault[] = [];

    // Find binary expressions with || or ??
    const binaries = sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression);

    for (const binary of binaries) {
      const op = binary.getOperatorToken().getText();
      if (op !== "||" && op !== "??") continue;

      const left = binary.getLeft().getText();
      const right = binary.getRight();

      // Check for process.env.VAR pattern on left
      const envMatch = left.match(/process\.env\.([A-Z_][A-Z0-9_]*)/);
      if (!envMatch) continue;

      const envVar = envMatch[1];

      // Check if right side is a string literal (hardcoded fallback)
      if (Node.isStringLiteral(right)) {
        const fallbackValue = right.getLiteralValue();

        // Skip empty strings or obvious placeholders
        if (!fallbackValue || fallbackValue === "" || fallbackValue === "undefined") continue;

        // Check if this is a critical secret
        const isCritical = CRITICAL_ENV_PATTERNS.test(envVar);

        defaults.push({
          envVar,
          fallbackValue,
          isCritical,
          node: binary,
          line: binary.getStartLineNumber(),
          snippet: binary.getText().slice(0, 100),
        });
      }
    }

    // Also check variable declarations with hardcoded secrets
    const varDecls = sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration);

    for (const decl of varDecls) {
      const name = decl.getName();
      if (!CRITICAL_ENV_PATTERNS.test(name)) continue;

      const init = decl.getInitializer();
      if (!init || !Node.isStringLiteral(init)) continue;

      const value = init.getLiteralValue();
      if (!value || value.length < 8) continue; // Skip short/empty values

      // Skip if it's reading from env
      if (value.includes("process.env")) continue;

      defaults.push({
        envVar: name,
        fallbackValue: value,
        isCritical: true,
        node: decl,
        line: decl.getStartLineNumber(),
        snippet: decl.getText().slice(0, 100),
      });
    }

    return defaults;
  }

  function findSsrfProneFetch(node: FunctionNode): SsrfProneFetch[] {
    const fetches: SsrfProneFetch[] = [];
    const calls = node.getDescendantsOfKind(SyntaxKind.CallExpression);

    for (const call of calls) {
      const callText = call.getExpression().getText();

      // Match fetch, axios.get/post/etc
      if (!/^(fetch|axios\.get|axios\.post|axios\.put|axios\.delete|axios)$/.test(callText)) {
        continue;
      }

      const args = call.getArguments();
      if (args.length === 0) continue;

      const firstArg = args[0].getText();

      // Check for user-controlled URL patterns
      // body.url, query.url, params.url, data.url, req.body.url, request.query.url
      const ssrfPattern = /(?:body|query|params|data|req\.body|req\.query|request\.body|request\.query)\s*\.?\s*(?:\[\s*['"]?)?(url|uri|link|endpoint|target|destination)(?:['"]?\s*\])?/i;

      const match = firstArg.match(ssrfPattern);
      if (match) {
        fetches.push({
          fetchMethod: callText,
          userInputSource: firstArg,
          node: call,
          line: call.getStartLineNumber(),
          snippet: call.getText().slice(0, 150),
        });
      }
    }

    return fetches;
  }

  function getNodeText(node: Node): string {
    return node.getText();
  }

  function getNodeLine(node: Node): number {
    return node.getStartLineNumber();
  }

  // Phase 2 helpers

  /**
   * User-controlled redirect parameter names
   */
  const REDIRECT_PARAM_NAMES = ["next", "redirect", "returnTo", "url", "returnUrl", "callback", "callbackUrl", "goto", "destination"];

  /**
   * Find redirect calls with potential user-controlled input
   */
  function findRedirectCalls(node: FunctionNode): RedirectCall[] {
    const redirects: RedirectCall[] = [];
    const calls = node.getDescendantsOfKind(SyntaxKind.CallExpression);
    const text = node.getText();

    // Track variables that hold user-controlled values
    const userControlledVars = new Set<string>();

    // Find user-controlled sources
    for (const paramName of REDIRECT_PARAM_NAMES) {
      // searchParams.get("next"), req.nextUrl.searchParams.get("next")
      const searchParamMatch = new RegExp(`searchParams\\.get\\s*\\(\\s*['"]${paramName}['"]\\s*\\)`, "i");
      if (searchParamMatch.test(text)) {
        // Find the variable it's assigned to
        const assignMatch = text.match(new RegExp(`(?:const|let|var)\\s+(\\w+)\\s*=.*searchParams\\.get\\s*\\(\\s*['"]${paramName}['"]\\s*\\)`, "i"));
        if (assignMatch) {
          userControlledVars.add(assignMatch[1]);
        }
      }

      // body.next, body.redirect, etc.
      const bodyMatch = new RegExp(`(?:body|data)\\s*\\.\\s*${paramName}\\b`, "i");
      if (bodyMatch.test(text)) {
        const assignMatch = text.match(new RegExp(`(?:const|let|var)\\s+(\\w+)\\s*=.*(?:body|data)\\.${paramName}\\b`, "i"));
        if (assignMatch) {
          userControlledVars.add(assignMatch[1]);
        }
        userControlledVars.add(paramName);
      }
    }

    for (const call of calls) {
      const callText = call.getExpression().getText();

      // Match redirect calls: NextResponse.redirect, res.redirect, redirect
      if (!/^(NextResponse\.redirect|res\.redirect|redirect)$/.test(callText)) {
        continue;
      }

      const args = call.getArguments();
      if (args.length === 0) continue;

      const targetArg = args[0].getText();

      // Check if the target uses user-controlled input
      let isUserControlled = false;
      let userControlledSource: string | undefined;

      // Direct searchParams.get usage
      for (const paramName of REDIRECT_PARAM_NAMES) {
        if (new RegExp(`searchParams\\.get\\s*\\(\\s*['"]${paramName}['"]\\s*\\)`, "i").test(targetArg)) {
          isUserControlled = true;
          userControlledSource = `searchParams.get('${paramName}')`;
          break;
        }
        // Direct body property usage
        if (new RegExp(`(?:body|data)\\.${paramName}\\b`, "i").test(targetArg)) {
          isUserControlled = true;
          userControlledSource = `body.${paramName}`;
          break;
        }
      }

      // Check if uses a tracked user-controlled variable
      if (!isUserControlled) {
        for (const varName of userControlledVars) {
          if (new RegExp(`\\b${varName}\\b`).test(targetArg)) {
            isUserControlled = true;
            userControlledSource = varName;
            break;
          }
        }
      }

      if (isUserControlled) {
        redirects.push({
          method: callText,
          targetExpression: targetArg,
          isUserControlled: true,
          userControlledSource,
          node: call,
          line: call.getStartLineNumber(),
          snippet: call.getText().slice(0, 150),
        });
      }
    }

    return redirects;
  }

  /**
   * Find CORS configuration that may be insecure
   */
  function findCorsConfig(sourceFile: SourceFile): CorsConfig[] {
    const configs: CorsConfig[] = [];
    const text = sourceFile.getText();

    // Check for cors({ origin: "*", credentials: true }) pattern
    const calls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

    for (const call of calls) {
      const callText = call.getExpression().getText();

      // Match cors() or cors middleware
      if (callText !== "cors") continue;

      const args = call.getArguments();
      if (args.length === 0) continue;

      const configArg = args[0];
      if (!Node.isObjectLiteralExpression(configArg)) continue;

      const configText = configArg.getText();
      const hasWildcardOrigin = /origin\s*:\s*['"]?\*['"]?/.test(configText) ||
        /origin\s*:\s*true/.test(configText);
      const hasCredentials = /credentials\s*:\s*true/.test(configText);

      if (hasWildcardOrigin || hasCredentials) {
        configs.push({
          hasWildcardOrigin,
          hasCredentials,
          originValue: hasWildcardOrigin ? "*" : undefined,
          credentialsValue: hasCredentials ? "true" : undefined,
          node: call,
          line: call.getStartLineNumber(),
          snippet: call.getText().slice(0, 150),
        });
      }
    }

    // Check for res.setHeader patterns
    const headerPattern = /setHeader\s*\(\s*['"]Access-Control-Allow-Origin['"]\s*,\s*['"]?\*['"]?\s*\)/i;
    const credentialsPattern = /setHeader\s*\(\s*['"]Access-Control-Allow-Credentials['"]\s*,\s*['"]?true['"]?\s*\)/i;

    if (headerPattern.test(text) && credentialsPattern.test(text)) {
      // Find the actual calls
      for (const call of calls) {
        const callText = call.getText();
        if (headerPattern.test(callText)) {
          configs.push({
            hasWildcardOrigin: true,
            hasCredentials: credentialsPattern.test(text),
            originValue: "*",
            credentialsValue: "true",
            node: call,
            line: call.getStartLineNumber(),
            snippet: callText.slice(0, 150),
          });
        }
      }
    }

    return configs;
  }

  /**
   * Find outbound HTTP calls that may lack timeout
   */
  function findOutboundCalls(node: FunctionNode): OutboundCall[] {
    const outboundCalls: OutboundCall[] = [];
    const calls = node.getDescendantsOfKind(SyntaxKind.CallExpression);
    const text = node.getText();

    // Check for AbortController usage which indicates timeout handling
    const hasAbortController = /AbortController|signal\s*:/.test(text);

    for (const call of calls) {
      const callText = call.getExpression().getText();

      // Match fetch or axios calls
      if (!/^(fetch|axios\.get|axios\.post|axios\.put|axios\.delete|axios\.request|axios)$/.test(callText)) {
        continue;
      }

      const args = call.getArguments();
      if (args.length === 0) continue;

      const firstArg = args[0].getText();
      const fullCallText = call.getText();

      // Check if URL is external (starts with http and not localhost)
      const urlMatch = firstArg.match(/['"`](https?:\/\/[^'"`]+)['"`]/);
      const isExternalUrl = urlMatch
        ? !/(localhost|127\.0\.0\.1|0\.0\.0\.0)/.test(urlMatch[1])
        : false;

      // Check for timeout in options
      const hasTimeout = /timeout\s*:/.test(fullCallText) || hasAbortController;

      // Only flag external URLs without timeout
      if (isExternalUrl && !hasTimeout) {
        outboundCalls.push({
          method: callText,
          urlExpression: firstArg,
          hasTimeout: false,
          isExternalUrl: true,
          node: call,
          line: call.getStartLineNumber(),
          snippet: fullCallText.slice(0, 150),
        });
      }
    }

    return outboundCalls;
  }

  /**
   * Sensitive model names that warrant extra caution
   */
  const SENSITIVE_MODEL_NAMES = /^(user|account|customer|member|profile|employee|admin|session|token)$/i;

  /**
   * Find Prisma queries that may return too much data
   */
  function findPrismaQueries(node: FunctionNode): PrismaQuery[] {
    const queries: PrismaQuery[] = [];
    const calls = node.getDescendantsOfKind(SyntaxKind.CallExpression);
    const text = node.getText();

    for (const call of calls) {
      const callText = call.getExpression().getText();

      // Match prisma.user.findMany, db.account.findUnique, etc.
      const prismaMatch = callText.match(/(?:prisma|db)\.(\w+)\.(findMany|findFirst|findUnique|findFirstOrThrow|findUniqueOrThrow)/);
      if (!prismaMatch) continue;

      const modelName = prismaMatch[1];
      const operation = prismaMatch[2];

      // Check if model name is sensitive
      if (!SENSITIVE_MODEL_NAMES.test(modelName)) continue;

      const args = call.getArguments();
      const fullCallText = call.getText();

      // Check for select or include
      const hasSelect = /select\s*:/.test(fullCallText);
      const hasInclude = /include\s*:/.test(fullCallText);

      // Check if result is directly returned (very simplified check)
      // Look for: return prisma... or Response.json(prisma...) patterns
      const isDirectlyReturned = /return\s+(?:await\s+)?(?:Response\.json\s*\()?\s*(?:await\s+)?(?:prisma|db)\./.test(text) ||
        /Response\.json\s*\(\s*(?:await\s+)?(?:prisma|db)\./.test(text);

      // Only flag if no select restriction and might be directly returned
      if (!hasSelect) {
        queries.push({
          model: modelName,
          operation,
          hasSelect,
          hasInclude,
          isDirectlyReturned,
          node: call,
          line: call.getStartLineNumber(),
          snippet: fullCallText.slice(0, 150),
        });
      }
    }

    return queries;
  }

  /**
   * Sensitive token/key variable patterns
   */
  const SENSITIVE_TOKEN_PATTERNS = /token|secret|key|session|reset|code|nonce|password|apikey|api_key/i;

  /**
   * Find Math.random usage in sensitive contexts
   */
  function findMathRandomUsage(sourceFile: SourceFile): MathRandomUsage[] {
    const usages: MathRandomUsage[] = [];
    const text = sourceFile.getText();

    // Quick check if Math.random exists
    if (!text.includes("Math.random")) return usages;

    // Find variable declarations that use Math.random
    const varDecls = sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration);

    for (const decl of varDecls) {
      const name = decl.getName();
      const init = decl.getInitializer();
      if (!init) continue;

      const initText = init.getText();
      if (!initText.includes("Math.random")) continue;

      const isSensitiveContext = SENSITIVE_TOKEN_PATTERNS.test(name);

      if (isSensitiveContext) {
        usages.push({
          variableName: name,
          isSensitiveContext: true,
          node: decl,
          line: decl.getStartLineNumber(),
          snippet: decl.getText().slice(0, 150),
        });
      }
    }

    // Also check function calls where Math.random result flows to sensitive assignments
    const calls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const call of calls) {
      const callText = call.getText();
      if (!callText.includes("Math.random")) continue;

      // Check parent context
      const parent = call.getParent();
      if (Node.isVariableDeclaration(parent)) {
        const varName = parent.getName();
        if (SENSITIVE_TOKEN_PATTERNS.test(varName)) {
          // Already handled above
          continue;
        }
      }

      // Check for function names that suggest token generation
      const funcParent = call.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration);
      if (funcParent) {
        const funcName = funcParent.getName() ?? "";
        if (SENSITIVE_TOKEN_PATTERNS.test(funcName)) {
          usages.push({
            variableName: funcName,
            isSensitiveContext: true,
            node: call,
            line: call.getStartLineNumber(),
            snippet: callText.slice(0, 150),
          });
        }
      }
    }

    return usages;
  }

  /**
   * Find JWT decode calls without corresponding verify
   */
  function findJwtDecodeWithoutVerify(sourceFile: SourceFile): JwtDecodeCall[] {
    const decodes: JwtDecodeCall[] = [];
    const text = sourceFile.getText();

    // Check if file uses jsonwebtoken
    if (!/jwt\.decode|jsonwebtoken/.test(text)) return decodes;

    const hasVerify = /jwt\.verify|\.verify\s*\(/.test(text);

    const calls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

    for (const call of calls) {
      const callText = call.getExpression().getText();

      if (callText === "jwt.decode" || callText.endsWith(".decode")) {
        decodes.push({
          hasVerifyInFile: hasVerify,
          node: call,
          line: call.getStartLineNumber(),
          snippet: call.getText().slice(0, 150),
        });
      }
    }

    return decodes;
  }

  /**
   * Find weak hash algorithm usage
   */
  function findWeakHashUsage(sourceFile: SourceFile): WeakHashUsage[] {
    const usages: WeakHashUsage[] = [];
    const text = sourceFile.getText();

    // Check for createHash with weak algorithms
    const weakAlgos = ["md5", "sha1"];

    const calls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

    for (const call of calls) {
      const callText = call.getExpression().getText();

      if (!/createHash/.test(callText)) continue;

      const args = call.getArguments();
      if (args.length === 0) continue;

      const algoArg = args[0].getText().toLowerCase();

      for (const weakAlgo of weakAlgos) {
        if (algoArg.includes(weakAlgo)) {
          // Check if in password context
          const contextText = call.getParent()?.getText() ?? "";
          const fullContext = text.slice(
            Math.max(0, text.indexOf(call.getText()) - 200),
            text.indexOf(call.getText()) + 200
          );
          const isPasswordContext = /password|passwd|pwd|credential/i.test(fullContext);

          usages.push({
            algorithm: weakAlgo,
            isPasswordContext,
            node: call,
            line: call.getStartLineNumber(),
            snippet: call.getText().slice(0, 150),
          });
        }
      }
    }

    // Check for bcrypt with low salt rounds
    const bcryptPattern = /bcrypt\.hash\s*\([^,]+,\s*(\d+)/;
    const bcryptMatch = text.match(bcryptPattern);
    if (bcryptMatch && parseInt(bcryptMatch[1], 10) < 10) {
      // Find the actual call node
      for (const call of calls) {
        if (/bcrypt\.hash/.test(call.getExpression().getText())) {
          usages.push({
            algorithm: `bcrypt (saltRounds=${bcryptMatch[1]})`,
            isPasswordContext: true,
            node: call,
            line: call.getStartLineNumber(),
            snippet: call.getText().slice(0, 150),
          });
        }
      }
    }

    return usages;
  }

  /**
   * Find file upload handlers without proper validation
   */
  function findFileUploadHandlers(node: FunctionNode): FileUploadHandler[] {
    const handlers: FileUploadHandler[] = [];
    const text = node.getText();
    const calls = node.getDescendantsOfKind(SyntaxKind.CallExpression);

    // Check for formData().get() patterns (Next.js)
    const hasFormData = /formData\s*\(\s*\)|\.formData\s*\(\s*\)/.test(text);
    const hasFileGet = /\.get\s*\(\s*['"]file['"]\s*\)|\.getAll\s*\(\s*['"]files?['"]\s*\)/.test(text);

    if (hasFormData && hasFileGet) {
      const hasSizeCheck = /\.size\s*[<>]|size\s*[<>]|maxSize|MAX_SIZE/.test(text);
      const hasTypeCheck = /\.type\s*===|type\s*===|contentType|mime|accept/.test(text);

      if (!hasSizeCheck || !hasTypeCheck) {
        // Find the formData call
        for (const call of calls) {
          if (/formData/.test(call.getText())) {
            handlers.push({
              uploadMethod: "formData",
              hasSizeCheck,
              hasTypeCheck,
              hasLimits: hasSizeCheck && hasTypeCheck,
              node: call,
              line: call.getStartLineNumber(),
              snippet: call.getText().slice(0, 150),
            });
            break;
          }
        }
      }
    }

    // Check for multer without limits
    if (/multer/.test(text)) {
      for (const call of calls) {
        const callText = call.getExpression().getText();
        if (callText !== "multer") continue;

        const configText = call.getText();
        const hasLimits = /limits\s*:/.test(configText);
        const hasFileFilter = /fileFilter\s*:/.test(configText);

        if (!hasLimits && !hasFileFilter) {
          handlers.push({
            uploadMethod: "multer",
            hasSizeCheck: hasLimits,
            hasTypeCheck: hasFileFilter,
            hasLimits,
            node: call,
            line: call.getStartLineNumber(),
            snippet: configText.slice(0, 150),
          });
        }
      }
    }

    return handlers;
  }

  /**
   * Find file writes to public directories
   */
  function findPublicFileWrites(sourceFile: SourceFile): PublicFileWrite[] {
    const writes: PublicFileWrite[] = [];
    const text = sourceFile.getText();
    const calls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

    const publicDirPatterns = /['"`](public|static|app\/public|uploads)['"`]|['"`]\.\/public|['"`]\/public/i;

    for (const call of calls) {
      const callText = call.getExpression().getText();

      // Check for fs.writeFile, writeFileSync, etc.
      if (!/writeFile|writeFileSync|createWriteStream|copyFile|rename/.test(callText)) {
        continue;
      }

      const args = call.getArguments();
      if (args.length === 0) continue;

      const pathArg = args[0].getText();

      // Check if writing to public directory
      if (publicDirPatterns.test(pathArg)) {
        // Check if using user-supplied filename
        const usesUserFilename = /filename|originalname|name\s*\+|name\s*\$|\$\{.*name/i.test(pathArg);

        writes.push({
          writePath: pathArg,
          isPublicDir: true,
          usesUserFilename,
          node: call,
          line: call.getStartLineNumber(),
          snippet: call.getText().slice(0, 150),
        });
      }
    }

    // Also check path.join patterns
    for (const call of calls) {
      const callText = call.getExpression().getText();

      if (!/path\.join|path\.resolve/.test(callText)) continue;

      const fullCallText = call.getText();
      if (publicDirPatterns.test(fullCallText)) {
        const usesUserFilename = /filename|originalname|name\s*\+|name\s*\$|\$\{.*name/i.test(fullCallText);

        writes.push({
          writePath: fullCallText,
          isPublicDir: true,
          usesUserFilename,
          node: call,
          line: call.getStartLineNumber(),
          snippet: fullCallText.slice(0, 150),
        });
      }
    }

    return writes;
  }

  /**
   * Check if file contains rate limiting signals
   */
  function hasRateLimitSignals(sourceFile: SourceFile): boolean {
    const text = sourceFile.getText();
    const patterns = [
      "rateLimit",
      "rateLimiter",
      "limiter",
      "@upstash/ratelimit",
      "express-rate-limit",
      "next-rate-limit",
      "slowDown",
      "throttle",
    ];

    return patterns.some((p) => text.includes(p));
  }

  /**
   * Check if file contains validation schema usage
   */
  function hasValidationSchemas(sourceFile: SourceFile): boolean {
    const text = sourceFile.getText();
    return /\bz\.|zod|yup|joi|\.parse\s*\(|\.validate\s*\(|\.safeParse\s*\(/.test(text);
  }

  return {
    parseFile,
    findRouteHandlers,
    containsAuthCheck,
    findDbSinks,
    findValidationUsage,
    findSensitiveLogCalls,
    findInsecureDefaults,
    findSsrfProneFetch,
    getNodeText,
    getNodeLine,
    // Phase 2
    findRedirectCalls,
    findCorsConfig,
    findOutboundCalls,
    findPrismaQueries,
    findMathRandomUsage,
    findJwtDecodeWithoutVerify,
    findWeakHashUsage,
    findFileUploadHandlers,
    findPublicFileWrites,
    hasRateLimitSignals,
    hasValidationSchemas,
  };
}
