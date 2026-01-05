import { spawn, exec } from "child_process";

export function openBrowser(url: string): void {
  const platform = process.platform;

  try {
    if (platform === "win32") {
      // Windows: use 'start' via exec to avoid shell+args deprecation warning
      exec(`start "" "${url}"`);
    } else if (platform === "darwin") {
      // macOS: use 'open' command
      const child = spawn("open", [url], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
    } else {
      // Linux and others: try xdg-open
      const child = spawn("xdg-open", [url], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
    }
  } catch {
    // Silently fail - user can manually open the URL
    console.log(`Could not automatically open browser.`);
    console.log(`Please open ${url} manually.`);
  }
}
