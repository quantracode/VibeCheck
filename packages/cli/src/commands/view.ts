import { Command } from "commander";
import { existsSync } from "fs";
import { resolve, join } from "path";
import {
  startStaticServer,
  findAvailablePort,
  isPortAvailable,
} from "../utils/static-server.js";
import { ensureViewer, clearViewerCache } from "../utils/viewer-cache.js";
import { openBrowser } from "../utils/open-browser.js";

const DEFAULT_PORT = 3000;

interface ViewOptions {
  port: string;
  open: boolean;
  update: boolean;
  clearCache: boolean;
  artifact?: string;
}

function printBanner(url: string, hasArtifact: boolean): void {
  const width = 76;

  console.log(`\n\x1b[36m  ╭${"─".repeat(width)}╮\x1b[0m`);
  console.log(
    `\x1b[36m  │\x1b[0m  \x1b[1mVIBECHECK VIEWER\x1b[0m${" ".repeat(width - 19)}\x1b[36m│\x1b[0m`
  );
  console.log(`\x1b[36m  ╰${"─".repeat(width)}╯\x1b[0m\n`);

  console.log(`  \x1b[32m●\x1b[0m Server running at: \x1b[1m\x1b[36m${url}\x1b[0m\n`);

  if (hasArtifact) {
    console.log(`  \x1b[32m●\x1b[0m Scan artifact will be loaded automatically.\n`);
  } else {
    console.log(`  \x1b[90mDrag and drop a scan artifact (JSON) onto the page to view results.\x1b[0m`);
    console.log(`  \x1b[90mOr run: vibecheck scan --out artifact.json\x1b[0m\n`);
  }

  console.log(`  \x1b[90mPress Ctrl+C to stop the server.\x1b[0m\n`);
}

async function runViewCommand(options: ViewOptions): Promise<void> {
  // Handle cache clear
  if (options.clearCache) {
    clearViewerCache();
    return;
  }

  const requestedPort = parseInt(options.port, 10);

  if (isNaN(requestedPort) || requestedPort < 1 || requestedPort > 65535) {
    console.error(`\x1b[31mError: Invalid port number: ${options.port}\x1b[0m`);
    console.error("Port must be a number between 1 and 65535.");
    process.exit(1);
  }

  // Check if requested port is available
  const portAvailable = await isPortAvailable(requestedPort);
  let port = requestedPort;

  if (!portAvailable) {
    console.log(`\x1b[33mPort ${requestedPort} is already in use.\x1b[0m`);

    try {
      port = await findAvailablePort(requestedPort + 1);
      console.log(`Using port ${port} instead.\n`);
    } catch (error) {
      console.error(
        `\x1b[31mError: Could not find an available port.\x1b[0m`
      );
      console.error(`\nTry specifying a different port:`);
      console.error(`  vibecheck view --port 8080\n`);
      console.error(`Or stop the process using port ${requestedPort}:`);
      if (process.platform === "win32") {
        console.error(`  netstat -ano | findstr :${requestedPort}`);
        console.error(`  taskkill /PID <pid> /F`);
      } else {
        console.error(`  lsof -i :${requestedPort}`);
        console.error(`  kill <pid>`);
      }
      process.exit(1);
    }
  }

  // Ensure viewer is installed
  let viewerInfo;
  try {
    viewerInfo = await ensureViewer(options.update);
  } catch (error) {
    console.error(`\x1b[31mError: Failed to install viewer.\x1b[0m`);
    if (error instanceof Error) {
      console.error(error.message);
    }
    console.error(`\nCheck your network connection and try again.`);
    console.error(`You may also try: vibecheck view --clear-cache\n`);
    process.exit(1);
  }

  // Verify viewer files exist
  if (!existsSync(join(viewerInfo.path, "index.html"))) {
    console.error(`\x1b[31mError: Viewer files not found.\x1b[0m`);
    console.error(`Try reinstalling: vibecheck view --update\n`);
    process.exit(1);
  }

  // Resolve artifact path if provided
  let artifactPath: string | undefined;
  if (options.artifact) {
    artifactPath = resolve(options.artifact);
    if (!existsSync(artifactPath)) {
      console.log(
        `\x1b[33mWarning: Artifact file not found: ${options.artifact}\x1b[0m\n`
      );
      artifactPath = undefined;
    }
  } else {
    // Auto-detect common artifact locations
    const commonPaths = [
      "vibecheck-artifacts/artifact.json",
      "vibecheck-artifact.json",
      ".vibecheck/artifact.json",
      "scan-results.json",
    ];
    for (const p of commonPaths) {
      const fullPath = resolve(p);
      if (existsSync(fullPath)) {
        artifactPath = fullPath;
        console.log(`\x1b[90mAuto-detected artifact: ${p}\x1b[0m`);
        break;
      }
    }
  }

  // Start server
  let serverResult;
  try {
    serverResult = await startStaticServer({
      staticDir: viewerInfo.path,
      port,
      artifactPath,
    });
  } catch (error) {
    console.error(`\x1b[31mError: Failed to start server.\x1b[0m`);
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
  }

  const url = serverResult.url;

  printBanner(url, !!artifactPath);

  // Open browser
  if (options.open) {
    setTimeout(() => {
      openBrowser(url);
    }, 300);
  }

  // Handle shutdown
  const shutdown = async () => {
    console.log("\n\x1b[90mShutting down viewer...\x1b[0m");
    await serverResult.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Keep the process running
  await new Promise(() => {});
}

export function registerViewCommand(program: Command): void {
  program
    .command("view")
    .description("Start the VibeCheck web viewer to explore scan results")
    .option(
      "-p, --port <port>",
      "Port to run the viewer on",
      String(DEFAULT_PORT)
    )
    .option("--no-open", "Don't automatically open the browser")
    .option("--update", "Force update the viewer to latest version")
    .option("--clear-cache", "Clear the cached viewer and exit")
    .option(
      "-a, --artifact <path>",
      "Path to artifact file to open (optional)"
    )
    .addHelpText(
      "after",
      `
Examples:
  $ vibecheck view                        Start viewer on default port (3000)
  $ vibecheck view --port 8080            Start viewer on port 8080
  $ vibecheck view --no-open              Start without opening browser
  $ vibecheck view --update               Update viewer to latest version
  $ vibecheck view --clear-cache          Clear cached viewer files

Workflow:
  1. Run a scan:    vibecheck scan --out scan.json
  2. Start viewer:  vibecheck view
  3. Drop scan.json onto the page to view results
`
    )
    .action(runViewCommand);
}
