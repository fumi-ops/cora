import { spawn } from "node:child_process";

function spawnDetached(command: string, args: string[]): void {
  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });

  child.unref();
}

export async function openBrowser(url: string): Promise<void> {
  const platform = process.platform;

  if (platform === "darwin") {
    spawnDetached("open", [url]);
    return;
  }

  if (platform === "win32") {
    spawnDetached("cmd", ["/c", "start", "", url]);
    return;
  }

  spawnDetached("xdg-open", [url]);
}
