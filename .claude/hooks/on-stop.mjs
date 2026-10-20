// Stop: type-check when TypeScript changed since the last clean check, so work isn't handed back broken.
// Skips when nothing changed (about 7 s otherwise). Exit 2 sends the errors back to Claude once.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";

const input = JSON.parse(readFileSync(0, "utf8") || "{}");
if (input.stop_hook_active) process.exit(0); // already sent back once; don't loop

const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const sh = (c) => execSync(c, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

let changed;
try {
  const diff = sh("git diff HEAD -- src '*.ts' '*.tsx'");
  const untracked = sh("git ls-files --others --exclude-standard -- src")
    .split("\n")
    .filter((f) => /\.tsx?$/.test(f))
    .map((f) => f + readFileSync(path.join(root, f), "utf8"))
    .join("");
  changed = createHash("sha1").update(diff + untracked).digest("hex");
} catch {
  process.exit(0); // not a git repo or git missing: stay out of the way
}

const stamp = path.join(root, ".claude", ".last-tsc");
if (existsSync(stamp) && readFileSync(stamp, "utf8") === changed) process.exit(0);

try {
  sh("npx tsc --noEmit");
  writeFileSync(stamp, changed);
} catch (e) {
  const out = String(e.stdout || e.message).split("\n").slice(0, 30).join("\n");
  process.stderr.write(`TypeScript errors (npx tsc --noEmit). Fix them before finishing:\n${out}`);
  process.exit(2);
}
