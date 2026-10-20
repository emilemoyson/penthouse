// PreToolUse (Edit|Write): secrets files are off limits; the hooks and settings that guard them need a yes from Emile.
import { readFileSync } from "node:fs";

const input = JSON.parse(readFileSync(0, "utf8"));
const file = String(input.tool_input?.file_path ?? "");

function decide(permissionDecision, reason) {
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision, permissionDecisionReason: reason } }),
  );
  process.exit(0);
}

if (/(^|\/)\.env(?!\.example$)[^/]*$/.test(file)) decide("deny", "Env files hold secrets. Emile edits them by hand.");
if (/\/\.claude\/(settings(\.local)?\.json|hooks\/)/.test(file) && file.includes("penthouse"))
  decide("ask", "This changes the project's safety hooks or permissions.");
