"""
Apple Notes "gym" note -> dashboard Gym room (workouts + sets).

Reads the note on this Mac, and only when its text changed since the last run asks the
gym-data-parser agent (.claude/agents/gym-data-parser.md, headless Claude Code) to turn it into
sessions, then sends them to POST /api/ingest/gym-note. The note has no dates: a session is the
nth line under each exercise of a split, and a new one is dated the day the note was last edited.

    python3 scripts/gym_sync.py              # normal run (launchd every 30 min)
    python3 scripts/gym_sync.py --dry-run    # parse and print, don't send
    python3 scripts/gym_sync.py --full       # re-read every session, not just the latest ones

Checking the note is free. Claude only runs when the note changed, re-reads only each split's
latest session and anything after it, and is capped at $0.50 a run.
If the site can't be reached, the parsed result is kept and sent next time without asking Claude again.

Reads INGEST_URL and INGEST_TOKEN from scripts/.env. INGEST_URL and GYM_STATE in the environment
override them, for testing against a copy. Standard library only (no venv needed).
"""

import argparse
import datetime as dt
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
ENV = HERE / ".env"
SCHEMA = HERE / "gym_schema.json"
STATE = Path(os.environ.get("GYM_STATE") or Path.home() / "Library/Application Support/hub/gym-sync.json")
NOTE_NAME = "gym"

# JXA: the note's text and the day it was last edited (local time). The newest note named "gym" wins.
READ_NOTE = """
const notes = Application("Notes").notes.whose({ name: { _equals: "%s" } })();
if (!notes.length) throw new Error("no note named %s");
notes.sort((a, b) => b.modificationDate() - a.modificationDate());
const d = notes[0].modificationDate();
const day = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
JSON.stringify({ text: notes[0].plaintext(), modified: day });
""" % (NOTE_NAME, NOTE_NAME)


def log(msg):
    print(f"[{dt.datetime.now():%Y-%m-%d %H:%M}] {msg}", flush=True)


def load_env():
    env = {}
    if ENV.exists():
        for line in ENV.read_text().splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    if os.environ.get("INGEST_URL"):
        env["INGEST_URL"] = os.environ["INGEST_URL"]  # e.g. a test server
    for k in ("INGEST_URL", "INGEST_TOKEN"):
        if not env.get(k):
            sys.exit(f"{k} is missing from scripts/.env")
    return env


def read_note():
    r = subprocess.run(["osascript", "-l", "JavaScript", "-e", READ_NOTE], capture_output=True, text=True, timeout=60)
    if r.returncode != 0:
        sys.exit(f"Couldn't read the note: {r.stderr.strip()} (allow Terminal or launchd to control Notes in System Settings > Privacy & Security > Automation)")
    return json.loads(r.stdout)


def load_state():
    try:
        return json.loads(STATE.read_text())
    except (OSError, ValueError):
        return {}


def save_state(state):
    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps(state, indent=2))


def parse(text, counts, full):
    """Runs the gym-data-parser agent headless and returns its JSON."""
    claude = os.environ.get("CLAUDE_BIN") or shutil.which("claude") or str(Path.home() / ".local/bin/claude")
    since = "" if full or not counts else "from: " + ", ".join(f"{k} {n}" for k, n in sorted(counts.items()))
    prompt = f"Parse this gym note. Today is {dt.date.today()}.\n{since}".strip()
    cmd = [
        claude, "-p", prompt,
        "--agent", "gym-data-parser",
        "--settings", '{"disableAllHooks": true}',  # the project's stop hook type-checks; not needed here
        "--tools", "",
        "--strict-mcp-config",
        "--no-session-persistence",
        "--max-budget-usd", "0.50",
        "--output-format", "json",
        "--json-schema", SCHEMA.read_text(),
    ]
    r = subprocess.run(cmd, input=text, capture_output=True, text=True, cwd=ROOT, timeout=600)
    if r.returncode != 0:
        sys.exit(f"Claude failed: {(r.stderr or r.stdout).strip()[:500]}")
    out = json.loads(r.stdout)
    if out.get("is_error"):
        sys.exit(f"Claude failed: {str(out.get('result'))[:500]}")
    result = out.get("structured_output") or out["result"]
    if isinstance(result, str):
        result = json.loads(re.sub(r"^\s*```(?:json)?\s*|\s*```\s*$", "", result))
    for key in ("splits", "ideas", "skipped"):
        if not isinstance(result.get(key), list):
            sys.exit(f"Parser answer is missing {key}")
    log(f"parsed with Claude (${out.get('total_cost_usd', 0):.3f})")
    return result


def summary(parsed):
    lines = []
    for sp in parsed["splits"]:
        lines.append(f"{sp['kind']}: {sp.get('sessionCount', '?')} sessions in the note")
        for s in sp["sessions"]:
            lines.append(f"  #{s['n']} {s['notes']}".rstrip())
            for e in s["exercises"]:
                sets = ", ".join(f"{x['weight']:g}x{x['reps']}" + (f"/{x['alt']}" if x["alt"] is not None else "") for x in e["sets"])
                lines.append(f"    {e['name']}: {sets}")
    if parsed["ideas"]:
        lines.append("ideas: " + ", ".join(parsed["ideas"]))
    if parsed["skipped"]:
        lines.append("couldn't read: " + " | ".join(parsed["skipped"]))
    return "\n".join(lines)


def send(env, payload):
    req = urllib.request.Request(
        env["INGEST_URL"].rstrip("/") + "/api/ingest/gym-note",
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {env['INGEST_TOKEN']}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="parse and print, don't send")
    ap.add_argument("--full", action="store_true", help="re-read every session")
    args = ap.parse_args()

    env = load_env()
    note = read_note()
    digest = hashlib.sha256(note["text"].encode()).hexdigest()
    state = load_state()

    if digest == state.get("sent") and not (args.full or args.dry_run):
        return  # unchanged since the last send: nothing to do, no Claude call

    if digest == state.get("parsed") and state.get("pending") and not (args.full or args.dry_run):
        parsed = state["pending"]  # parsed last time but not sent (site was down)
    else:
        parsed = parse(note["text"], {} if args.full else state.get("counts", {}), args.full)

    if args.dry_run:
        print(summary(parsed))
        return

    state.update(parsed=digest, pending=parsed)
    save_state(state)
    try:
        res = send(env, {"date": note["modified"], **parsed})
    except (urllib.error.URLError, OSError) as e:
        body = e.read().decode()[:300] if isinstance(e, urllib.error.HTTPError) else ""
        log(f"couldn't send, will retry next run: {e} {body}".rstrip())
        sys.exit(1)
    state.update(sent=digest, pending=None, counts=res.get("counts", {}))
    save_state(state)
    log(res.get("message", "sent"))


if __name__ == "__main__":
    main()
