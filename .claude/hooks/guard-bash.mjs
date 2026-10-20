// PreToolUse (Bash): blocks commands that could leak secrets or destroy data.
// Prints a deny/ask decision as JSON; prints nothing to let the command through.
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const input = JSON.parse(readFileSync(0, "utf8"));
const cmd = String(input.tool_input?.command ?? "");

const SECRET = /(^|[\s'"=\/])(\.env(\.local|\.production|\.development)?|scripts\/\.env)(?![\w.])/;
const isExample = (s) => /\.env\.example/.test(s) && !SECRET.test(s.replace(/\.env\.example/g, ""));

function decide(permissionDecision, reason) {
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision, permissionDecisionReason: reason } }),
  );
  process.exit(0);
}

// 1. Printing or copying secret files. grep -c / -q / -l only report presence, so they're fine.
if (SECRET.test(cmd) && !isExample(cmd)) {
  const printers = /\b(cat|less|more|head|tail|bat|nl|od|xxd|strings|cp|scp|rsync|curl|base64|pbcopy|open|code)\b/;
  const grepPrints = /\b(e|f|r)?grep\b(?![^|;&]*\s-[a-zA-Z]*[cqlL])/;
  const sedAwk = /\b(sed|awk)\b/;
  if (printers.test(cmd) || grepPrints.test(cmd) || sedAwk.test(cmd))
    decide("deny", "That would print or copy a secrets file. Check a key exists with `grep -c '^NAME=' <file>` instead.");
  if (/\bgit\s+add\b/.test(cmd)) decide("deny", "Env files must never be staged.");
}

// 2. Printing the whole environment.
if (/(^|[;&|]\s*)(printenv|env|export -p|set)\s*($|[;&|])/.test(cmd))
  decide("deny", "Printing the whole environment can expose tokens.");

// 3. Force-adding ignored files, and commits that would include env files.
if (/\bgit\s+add\b[^;&|]*\s(-f|--force)\b/.test(cmd)) decide("deny", "Don't force-add ignored files; they may be secrets.");
if (/\bgit\s+commit\b/.test(cmd)) {
  try {
    const staged = execSync("git diff --cached --name-only", { cwd: input.cwd || process.cwd(), encoding: "utf8" });
    const bad = staged.split("\n").filter((f) => /(^|\/)\.env(?!\.example)|scripts\/\.env/.test(f));
    if (bad.length) decide("deny", `Staged secrets: ${bad.join(", ")}. Unstage them first.`);
  } catch {}
}

// 4. History rewrites and pushes that overwrite.
if (/\bgit\s+push\b[^;&|]*\s(-f|--force|--force-with-lease)\b/.test(cmd) || /\bgit\s+push\b[^;&|]*\s\+\w/.test(cmd))
  decide("deny", "No force pushes. Ask Emile to do it if it's really needed.");
if (/\bgit\s+(reset\s+--hard|clean\s+-[a-z]*f|checkout\s+--\s+\.|restore\s+\.)/.test(cmd))
  decide("ask", "This throws away uncommitted work.");

// 5. Databases: only the throwaway copy hub_test may be dropped or wiped.
if (/\bdropdb\b/.test(cmd) && !/\bdropdb\b[^;&|]*\bhub_test\b/.test(cmd)) decide("deny", "Only hub_test may be dropped.");
if (/\b(drop\s+(table|database|schema)|truncate)\b/i.test(cmd) && !/hub_test/.test(cmd))
  decide("deny", "Destructive SQL is only allowed on hub_test.");
if (/\bdelete\s+from\b/i.test(cmd) && !/hub_test/.test(cmd)) decide("ask", "This deletes rows from the real database.");

// 6. rm -rf outside build output, the test cache and temp folders.
const rmRf = cmd.match(/\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*|-[a-zA-Z]*f[a-zA-Z]*r[a-zA-Z]*|-r\s+-f|-f\s+-r)\s+([^;&|]+)/);
if (rmRf) {
  const targets = rmRf[2].trim().split(/\s+/);
  const safe = (t) => /^(\.\/)?(\.next|node_modules|out|coverage)\/?$/.test(t) || /^(\/private)?\/tmp\//.test(t);
  if (!targets.every(safe)) decide("ask", `rm -rf on ${targets.join(" ")}`);
}

// 7. Stopping or replacing the scheduled jobs.
if (/\blaunchctl\s+(unload|bootout|remove)\b/.test(cmd)) decide("ask", "This stops a scheduled sync job.");
