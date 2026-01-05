import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { execSync } from "child_process";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { createGunzip } from "zlib";
import { extract } from "tar";

const CACHE_DIR = join(homedir(), ".vibecheck");
const VIEWER_DIR = join(CACHE_DIR, "viewer");
const VIEWER_DIST_DIR = join(VIEWER_DIR, "dist");
const VERSION_FILE = join(VIEWER_DIR, ".version");
const VIEWER_PACKAGE = "@quantracode/vibecheck-viewer";

export interface ViewerInfo {
  path: string;
  version: string;
}

export function getCacheDir(): string {
  return CACHE_DIR;
}

export function getViewerDir(): string {
  return VIEWER_DIR;
}

function getInstalledVersion(): string | null {
  if (!existsSync(VERSION_FILE)) {
    return null;
  }
  try {
    return readFileSync(VERSION_FILE, "utf-8").trim();
  } catch {
    return null;
  }
}

function setInstalledVersion(version: string): void {
  writeFileSync(VERSION_FILE, version, "utf-8");
}

async function getLatestVersion(): Promise<string> {
  try {
    const result = execSync(`npm view ${VIEWER_PACKAGE} version`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return result.trim();
  } catch {
    throw new Error(
      `Failed to fetch latest version of ${VIEWER_PACKAGE}. Check your network connection.`
    );
  }
}

async function downloadPackage(version: string): Promise<void> {
  const tarballUrl = execSync(
    `npm view ${VIEWER_PACKAGE}@${version} dist.tarball`,
    {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }
  ).trim();

  // Clean existing viewer directory
  if (existsSync(VIEWER_DIR)) {
    rmSync(VIEWER_DIR, { recursive: true, force: true });
  }
  mkdirSync(VIEWER_DIR, { recursive: true });

  // Download and extract
  const response = await fetch(tarballUrl);
  if (!response.ok) {
    throw new Error(`Failed to download viewer: ${response.statusText}`);
  }

  const tarPath = join(CACHE_DIR, "viewer.tgz");

  // Write to temp file
  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(tarPath, buffer);

  // Extract using tar
  await extract({
    file: tarPath,
    cwd: VIEWER_DIR,
    strip: 1, // Remove the 'package' directory prefix
  });

  // Clean up temp file
  rmSync(tarPath, { force: true });
}

export async function ensureViewer(
  forceUpdate: boolean = false
): Promise<ViewerInfo> {
  mkdirSync(CACHE_DIR, { recursive: true });

  const installedVersion = getInstalledVersion();
  let latestVersion: string;

  try {
    latestVersion = await getLatestVersion();
  } catch (error) {
    // If we can't fetch latest and have a cached version, use it
    if (installedVersion && existsSync(join(VIEWER_DIST_DIR, "index.html"))) {
      return {
        path: VIEWER_DIST_DIR,
        version: installedVersion,
      };
    }
    throw error;
  }

  const needsUpdate =
    forceUpdate ||
    !installedVersion ||
    installedVersion !== latestVersion ||
    !existsSync(join(VIEWER_DIST_DIR, "index.html"));

  if (needsUpdate) {
    console.log(
      installedVersion
        ? `Updating viewer from ${installedVersion} to ${latestVersion}...`
        : `Installing viewer v${latestVersion}...`
    );

    await downloadPackage(latestVersion);
    setInstalledVersion(latestVersion);

    console.log("Viewer installed successfully.\n");
  }

  return {
    path: VIEWER_DIST_DIR,
    version: latestVersion,
  };
}

export function clearViewerCache(): void {
  if (existsSync(VIEWER_DIR)) {
    rmSync(VIEWER_DIR, { recursive: true, force: true });
    console.log("Viewer cache cleared.");
  } else {
    console.log("No viewer cache to clear.");
  }
}

export async function checkViewerInstalled(): Promise<boolean> {
  return (
    existsSync(VERSION_FILE) && existsSync(join(VIEWER_DIST_DIR, "index.html"))
  );
}
