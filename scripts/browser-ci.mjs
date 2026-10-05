import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const preview = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    "4173",
  ],
  { stdio: "inherit" },
);
const chrome = spawn(
  process.env.CHROME_PATH || "google-chrome",
  [
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--remote-debugging-port=9222",
    `--user-data-dir=${join(tmpdir(), `garage-ci-${process.pid}`)}`,
    "http://localhost:4173",
  ],
  { stdio: ["ignore", "ignore", "ignore"] },
);
chrome.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
mkdirSync(new URL("../docs/upgrade-2026-10-05/", import.meta.url), {
  recursive: true,
});
try {
  let url;
  for (let i = 0; i < 100; i++) {
    try {
      const response = await fetch("http://127.0.0.1:9222/json/version");
      url = (await response.json()).webSocketDebuggerUrl;
      if (url && (await fetch("http://localhost:4173").then((r) => r.ok)))
        break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!url) throw Error("Chrome failed to start");
  for (const script of [
    "verify-upgrade.mjs",
    "verify-resilience.mjs",
    "verify-all-levels.mjs",
  ]) {
    const child = spawn(process.execPath, [`scripts/${script}`, url], {
      stdio: "inherit",
    });
    const code = await new Promise((r) => child.on("exit", r));
    if (code !== 0) throw Error(`${script} failed`);
  }
} finally {
  chrome.kill();
  preview.kill();
}
