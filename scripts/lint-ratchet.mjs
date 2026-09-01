#!/usr/bin/env node
/**
 * Lint ratchet — enforces "no new lint warnings" without demanding that the
 * pre-existing backlog be fixed in one go.
 *
 * `next lint` exits 0 no matter how many warnings it prints, and
 * eslint.config.mjs deliberately keeps `no-explicit-any` and `no-unused-vars`
 * at "warn" for legacy code. That left the Definition of Done asserting a rule
 * ("new code targets zero new lint warnings") that nothing could enforce.
 *
 * This gate fails when the warning count rises above the committed baseline in
 * .lint-baseline.json, so legacy warnings stay tolerated while new ones block.
 * When the count drops, the baseline must be lowered — the ratchet only turns
 * one way.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath = join(repoRoot, ".lint-baseline.json");

// next lint's default dir set (app/pages/components/lib/src) skips tests/, e2e/
// and scripts/, so lint and typecheck had inconsistent scope. Keep them aligned.
const LINT_DIRS = ["src", "tests", "e2e", "scripts"];

const args = process.argv.slice(2);
const shouldUpdate = args.includes("--update");

let output = "";
let lintFailed = false;
try {
  output = execFileSync(
    "bunx",
    ["next", "lint", ...LINT_DIRS.flatMap((d) => ["--dir", d])],
    { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );
} catch (error) {
  // Non-zero exit means lint errors (not warnings) — always a hard failure.
  output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
  lintFailed = true;
}

process.stdout.write(output);

const warnings = (output.match(/^\s*\d+:\d+\s+Warning:/gm) ?? []).length;
const errors = (output.match(/^\s*\d+:\d+\s+Error:/gm) ?? []).length;

if (shouldUpdate) {
  writeFileSync(
    baselinePath,
    `${JSON.stringify({ maxWarnings: warnings, dirs: LINT_DIRS }, null, 2)}\n`
  );
  console.log(`\nlint-ratchet: baseline updated to ${warnings} warnings.`);
  process.exit(0);
}

let baseline;
try {
  baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
} catch {
  console.error(
    `\nlint-ratchet: missing or unreadable ${baselinePath}. ` +
      `Run \`bun run lint:ratchet -- --update\` to create it.`
  );
  process.exit(1);
}

const max = baseline.maxWarnings;

if (lintFailed || errors > 0) {
  console.error(`\nlint-ratchet: FAIL — ${errors} lint error(s). Fix them.`);
  process.exit(1);
}

if (warnings > max) {
  console.error(
    `\nlint-ratchet: FAIL — ${warnings} warnings, baseline is ${max} ` +
      `(+${warnings - max}).\n` +
      `Fix the warnings your change introduced. Do not raise the baseline to ` +
      `get green — that is the "never weaken a gate" rule in ` +
      `.agent/System/engineering_standards.md.`
  );
  process.exit(1);
}

if (warnings < max) {
  console.log(
    `\nlint-ratchet: ${warnings} warnings, below the ${max} baseline — ` +
      `nice. Lower it with \`bun run lint:ratchet -- --update\` so the ` +
      `progress is locked in.`
  );
  process.exit(0);
}

console.log(`\nlint-ratchet: PASS — ${warnings} warnings, at baseline (${max}).`);
