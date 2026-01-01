import fs from "node:fs";
import path from "node:path";
import fg from "fast-glob";

/**
 * Read file contents as string, returns null if file doesn't exist
 */
export function readFileSync(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Check if a file exists
 */
export function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

/**
 * Write content to file, creating directories as needed
 */
export function writeFileSync(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, "utf-8");
}

/**
 * Find files matching glob patterns
 */
export async function findFiles(
  patterns: string | string[],
  options: {
    cwd: string;
    ignore?: string[];
    absolute?: boolean;
  }
): Promise<string[]> {
  return fg(patterns, {
    cwd: options.cwd,
    ignore: options.ignore ?? ["**/node_modules/**", "**/dist/**", "**/.git/**"],
    absolute: options.absolute ?? false,
    dot: false,
  });
}

/**
 * Get relative path from base directory
 */
export function relativePath(filePath: string, basePath: string): string {
  return path.relative(basePath, filePath).replace(/\\/g, "/");
}

/**
 * Resolve to absolute path
 */
export function resolvePath(...paths: string[]): string {
  return path.resolve(...paths);
}

/**
 * Read and parse JSON file
 */
export function readJsonSync<T>(filePath: string): T | null {
  const content = readFileSync(filePath);
  if (!content) return null;
  try {
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}
