import { spawnSync } from "node:child_process";

const threshold = 80;
const result = spawnSync(process.execPath, ["--experimental-test-coverage", "--test", "tests/integration/admin_auth.test.mjs", "tests/integration/api_filters.test.mjs"], {
  encoding: "utf8",
});

const output = `${result.stdout}${result.stderr}`;
process.stdout.write(output);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const match = output.match(/# all files \|\s*([\d.]+)\s*\|/);
if (!match) {
  console.error("Unable to parse Node coverage summary.");
  process.exit(1);
}

const lineCoverage = Number(match[1]);
if (!Number.isFinite(lineCoverage) || lineCoverage < threshold) {
  console.error(`Node coverage ${lineCoverage.toFixed(2)}% is below required ${threshold.toFixed(2)}%.`);
  process.exit(1);
}
