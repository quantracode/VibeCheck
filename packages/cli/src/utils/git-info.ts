import { execSync } from "node:child_process";
import path from "node:path";
import type { GitInfo } from "@vibecheck/schema";
import { fileExists } from "./file-utils.js";

/**
 * Execute a git command and return output, or null on error
 */
function execGit(cmd: string, cwd: string): string | null {
  try {
    return execSync(cmd, { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    return null;
  }
}

/**
 * Check if directory is a git repository
 */
export function isGitRepo(cwd: string): boolean {
  return fileExists(path.join(cwd, ".git"));
}

/**
 * Get git information for a repository
 */
export function getGitInfo(cwd: string): GitInfo | undefined {
  if (!isGitRepo(cwd)) {
    return undefined;
  }

  const branch = execGit("git rev-parse --abbrev-ref HEAD", cwd);
  const commit = execGit("git rev-parse HEAD", cwd);
  const remoteUrl = execGit("git config --get remote.origin.url", cwd);
  const status = execGit("git status --porcelain", cwd);

  return {
    branch: branch ?? undefined,
    commit: commit ?? undefined,
    remoteUrl: remoteUrl ?? undefined,
    isDirty: status !== null && status.length > 0,
  };
}

/**
 * Get repository name from git remote or directory name
 */
export function getRepoName(cwd: string): string {
  const remoteUrl = execGit("git config --get remote.origin.url", cwd);

  if (remoteUrl) {
    // Extract repo name from URL like:
    // https://github.com/user/repo.git -> repo
    // git@github.com:user/repo.git -> repo
    const match = remoteUrl.match(/\/([^/]+?)(?:\.git)?$/);
    if (match) {
      return match[1];
    }
  }

  // Fall back to directory name
  return path.basename(cwd);
}
