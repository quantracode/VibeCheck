import { createServer, type Server, type IncomingMessage, type ServerResponse } from "http";
import { existsSync, readFileSync, statSync, readdirSync } from "fs";
import { join, extname } from "path";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".webp": "image/webp",
  ".webm": "video/webm",
  ".mp4": "video/mp4",
  ".map": "application/json",
};

function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

function resolveFilePath(staticDir: string, urlPath: string): string | null {
  // Decode URL and normalize
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(urlPath);
  } catch {
    return null;
  }

  // Remove query string
  const queryIndex = decodedPath.indexOf("?");
  if (queryIndex !== -1) {
    decodedPath = decodedPath.substring(0, queryIndex);
  }

  // Normalize path
  let filePath = join(staticDir, decodedPath === "/" ? "index.html" : decodedPath);

  // Security: prevent directory traversal
  const normalizedPath = join(filePath);
  if (!normalizedPath.startsWith(staticDir)) {
    return null;
  }

  // Check if file exists
  if (existsSync(filePath)) {
    const stat = statSync(filePath);
    if (stat.isDirectory()) {
      filePath = join(filePath, "index.html");
      if (!existsSync(filePath)) {
        return null;
      }
    }
    return filePath;
  }

  // Try with .html extension (Next.js static export pattern)
  if (existsSync(filePath + ".html")) {
    return filePath + ".html";
  }

  // Smart SPA fallback for Next.js dynamic routes
  // For paths like /findings/some-id, find an HTML file in /findings/ directory
  const segments = decodedPath.split("/").filter(Boolean);

  if (segments.length >= 2) {
    const parentPath = segments.slice(0, -1).join("/");
    const parentDir = join(staticDir, parentPath);

    // Check if parent directory exists and has any .html files (dynamic route templates)
    if (existsSync(parentDir) && statSync(parentDir).isDirectory()) {
      try {
        const files = readdirSync(parentDir);
        const htmlFile = files.find((f) => f.endsWith(".html"));
        if (htmlFile) {
          return join(parentDir, htmlFile);
        }
      } catch {
        // Ignore errors reading directory
      }
    }

    // Fallback: serve the parent route's HTML (e.g., /findings.html for /findings/xxx)
    const parentHtml = join(staticDir, parentPath + ".html");
    if (existsSync(parentHtml)) {
      return parentHtml;
    }

    const parentIndexHtml = join(staticDir, parentPath, "index.html");
    if (existsSync(parentIndexHtml)) {
      return parentIndexHtml;
    }
  }

  // Final fallback: serve index.html for client-side routing
  const indexPath = join(staticDir, "index.html");
  if (existsSync(indexPath)) {
    return indexPath;
  }

  return null;
}

function handleRequest(
  staticDir: string,
  req: IncomingMessage,
  res: ServerResponse
): void {
  const urlPath = req.url || "/";
  const filePath = resolveFilePath(staticDir, urlPath);

  if (!filePath) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
    return;
  }

  try {
    const content = readFileSync(filePath);
    const contentType = getMimeType(filePath);

    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": content.length,
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(content);
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Internal Server Error");
  }
}

export interface StaticServerOptions {
  staticDir: string;
  port: number;
  host?: string;
  artifactPath?: string;
}

export interface StaticServerResult {
  server: Server;
  url: string;
  stop: () => Promise<void>;
}

export async function startStaticServer(
  options: StaticServerOptions
): Promise<StaticServerResult> {
  const { staticDir, port, host = "127.0.0.1", artifactPath } = options;

  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const urlPath = req.url || "/";

      // Handle special API endpoint for auto-loading artifacts
      if (urlPath === "/__vibecheck__/artifact" || urlPath === "/__vibecheck__/artifact.json") {
        if (artifactPath && existsSync(artifactPath)) {
          try {
            const content = readFileSync(artifactPath);
            res.writeHead(200, {
              "Content-Type": "application/json",
              "Content-Length": content.length,
              "Cache-Control": "no-cache",
              "Access-Control-Allow-Origin": "*",
            });
            res.end(content);
            return;
          } catch {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Failed to read artifact" }));
            return;
          }
        } else {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "No artifact available" }));
          return;
        }
      }

      // Handle CORS preflight for artifact endpoint
      if (req.method === "OPTIONS" && urlPath.startsWith("/__vibecheck__/")) {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        });
        res.end();
        return;
      }

      handleRequest(staticDir, req, res);
    });

    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        reject(new Error(`Port ${port} is already in use`));
      } else {
        reject(err);
      }
    });

    server.listen(port, host, () => {
      const url = `http://${host}:${port}`;
      resolve({
        server,
        url,
        stop: () =>
          new Promise((res) => {
            server.close(() => res());
          }),
      });
    });
  });
}

export async function findAvailablePort(
  startPort: number,
  maxAttempts: number = 10
): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    const available = await isPortAvailable(port);
    if (available) {
      return port;
    }
  }
  throw new Error(
    `Could not find available port in range ${startPort}-${startPort + maxAttempts - 1}`
  );
}

export function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();

    server.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        resolve(false);
      } else {
        resolve(false);
      }
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen(port, "127.0.0.1");
  });
}
