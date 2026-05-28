import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import path from "node:path";

const lhciBin = path.join(process.cwd(), "node_modules", ".bin", "lhci");
const child = spawn(lhciBin, ["autorun"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    CHROME_PATH: chromium.executablePath(),
  },
  stdio: "inherit",
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
