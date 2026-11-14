// PreToolUse (Bash) for the read-only subagents (verifier, code-reviewer), set in their frontmatter.
// Allows only the verify script and read-only git commands, one command on one line. Everything else is denied.
import { readFileSync } from "node:fs";

function deny(reason) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } }));
  process.exit(0);
}

// Fail closed: if anything below throws (bad input, parse error), deny instead of letting the command run.
let cmd;
try {
  const input = JSON.parse(readFileSync(0, "utf8"));
  cmd = String(input.tool_input?.command ?? "").trim();
} catch {
  deny("Read-only agent: could not read the command, so it is denied.");
}

// No chaining, redirects or subshells: one plain command only.
// No quotes, backslashes or $ either: they let a flag or a variable hide from the checks below.
if (/[;&|`<>\n\r'"\\$]/.test(cmd)) deny("Read-only agent: one plain command on one line, no chaining, pipes, redirects, quotes or variables.");

const ALLOWED = [
  /^\.claude\/skills\/verify\/verify\.sh( --quick)?$/,
  /^git (diff|log|show|status|merge-base|rev-parse)(\s|$)/,
  /^git branch( (--show-current|--list|-a|-r|-v|-vv|--all|--remotes))*$/,
];
if (!ALLOWED.some((re) => re.test(cmd))) deny(`Read-only agent: "${cmd.slice(0, 60)}" is not allowed. Use verify.sh or read-only git.`);
// git subcommands above can't write, except a few flags that can.
if (/\s--output|\s-o(\s|$)/.test(cmd)) deny("Read-only agent: that git flag writes.");
// --no-index lets git print any file on disk, including secrets.
if (/--no-index/.test(cmd)) deny("Read-only agent: --no-index can read files outside the repo history.");
// Never touch secret files, even through git.
if (/(^|[\s=\/])(\.env(\.local|\.production|\.development)?|scripts\/\.env)(?![\w.])/.test(cmd)) deny("Read-only agent: secret files are off limits.");
