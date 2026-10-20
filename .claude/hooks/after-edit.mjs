// PostToolUse (Edit|Write): lint the edited file and flag em dashes in what was just written.
// Exit 2 sends the message back to Claude so it fixes it straight away.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const input = JSON.parse(readFileSync(0, "utf8"));
const file = String(input.tool_input?.file_path ?? "");
const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const problems = [];

// Only what this edit added, so older text doesn't keep tripping it.
const added = String(input.tool_input?.new_string ?? input.tool_input?.content ?? "");
if (/\.(tsx?|md)$/.test(file) && added.includes("—"))
  problems.push(`${path.basename(file)}: contains an em dash. House style is no em dashes; use a comma, colon or full stop.`);

if (/\.(tsx?|mjs)$/.test(file) && file.startsWith(path.join(root, "src"))) {
  try {
    execFileSync("npx", ["eslint", "--no-warn-ignored", file], { cwd: root, encoding: "utf8", stdio: "pipe" });
  } catch (e) {
    problems.push(`eslint ${path.relative(root, file)}:\n${(e.stdout || e.message).trim()}`);
  }
}

if (problems.length) {
  process.stderr.write(problems.join("\n\n"));
  process.exit(2);
}
