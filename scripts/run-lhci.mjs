import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const lhciBin = require.resolve("@lhci/cli/src/cli.js");
const child = spawn(process.execPath, [lhciBin, "autorun"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    CHROME_PATH: process.env.CHROME_PATH || chromium.executablePath(),
    SQLITE_PATH: "./drizzle/e2e.db",
    ADMIN_TOKEN: "e2e-secret",
  },
  stdio: "inherit",
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
