#!/usr/bin/env python3
"""Gym-note parser eval.

Runs the gym-data-parser agent (headless Claude Code, same call as scripts/gym_sync.py) on
evals/gym/note.txt and scores the answer against hand-checked facts about that note.

  python3 evals/gym/score.py --runs 3        # call the parser 3 times, write evals/gym/results.json
  python3 evals/gym/score.py --from-file X   # score a saved parser answer, no model call

Each check is one fact I derived by counting lines in the note by hand (see CHECKS). A check passes
only if the parser's answer matches that fact exactly; nothing is scored by similarity.
"""
import argparse
import importlib.util
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent


def load_gym_sync():
    spec = importlib.util.spec_from_file_location("gym_sync", ROOT / "scripts" / "gym_sync.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def session(out, kind, n):
    for sp in out["splits"]:
        if sp["kind"] == kind:
            return next((s for s in sp["sessions"] if s["n"] == n), None)
    return None


def norm(t):
    return t.lower().replace("-", " ")


def sets(out, kind, n, name):
    """Sets of the exercise whose name contains `name` (case-insensitive), in session n. None if absent."""
    s = session(out, kind, n)
    if not s:
        return None
    hits = [e for e in s["exercises"] if norm(name) in norm(e["name"])]
    return hits[0]["sets"] if hits else None


def reps(ss):
    return None if ss is None else [x["reps"] for x in ss]


def weights(ss):
    return None if ss is None else [x["weight"] for x in ss]


def count(out, kind):
    return next((sp["sessionCount"] for sp in out["splits"] if sp["kind"] == kind), None)


def absent(out, kind, n, name, anchor):
    """True only if session n exists, the anchor exercise is in it (so the session was really read), and `name` is not."""
    s = session(out, kind, n)
    if not s:
        return False
    names = [norm(e["name"]) for e in s["exercises"]]
    return any(norm(anchor) in x for x in names) and not any(norm(name) in x for x in names)


def skipped_has(out, text):
    return any(text in s for s in out["skipped"])


# (id, what the note says, test). Session numbers are counted per split, one line per exercise per session.
CHECKS = [
    ("push-count", "Push has 8 sessions (longest exercise has 8 lines)", lambda o: count(o, "push") == 8),
    ("pull-count", "Pull has 6 sessions (face pull has 6 lines, abs has 6)", lambda o: count(o, "pull") == 6),
    ("push1-db-press", "Push 1 DB press: 45lb x 9, 9, 7", lambda o: weights(sets(o, "push", 1, "flat")) == [45, 45, 45] and reps(sets(o, "push", 1, "flat")) == [9, 9, 7]),
    ("push3-pec-skipped", "Push 3 pec flys: a lone x, so no sets", lambda o: absent(o, "push", 3, "pec fly", "flat")),
    ("push2-pec-two-sets", "Push 2 pec flys: 85lb x 10 x 8, only two sets", lambda o: reps(sets(o, "push", 2, "pec fly")) == [10, 8]),
    ("push7-pec-three-weights", "Push 7 pec flys: 100lb x 12, 105lb x 11, 110lb x 9 on one line", lambda o: weights(sets(o, "push", 7, "pec fly")) == [100, 105, 110] and reps(sets(o, "push", 7, "pec fly")) == [12, 11, 9]),
    ("push2-lat-alt", "Push 2 cable lat raises: '12 (11) x 14(14)' has left/right reps", lambda o: [(x["reps"], x["alt"]) for x in sets(o, "push", 2, "lateral raise") or []] == [(12, 11), (14, 14)]),
    ("push4-tricep-typo-not-invented", "Push 4 tricep line 'x is 11 x 10 x 7' is a typo: skipped, or exactly 11/10/7, never other numbers", lambda o: (sets(o, "push", 4, "tricep") is None) and skipped_has(o, "is 11") or reps(sets(o, "push", 4, "tricep")) == [11, 10, 7]),
    ("push7-abs-trailing-x", "Push 7 abs '50lb x 12 x 13 x ' has two complete sets", lambda o: reps(sets(o, "push", 7, "abs")) == [12, 13]),
    ("push1-abs-leading-x", "Push 1 abs is a lone x: no abs sets in Push 1", lambda o: absent(o, "push", 1, "abs", "flat")),
    ("push-include-db-press", "'include DB press (5)' (an incline press, typo for incline) is its own exercise: Push 1 is 40lb x 8, 8, 6", lambda o: reps(sets(o, "push", 1, "incline") or sets(o, "push", 1, "include")) == [8, 8, 6]),
    ("pull1-pullup-bodyweight", "Pull 1 pull up: 9 x 9 x 9 with weight 0", lambda o: reps(sets(o, "pull", 1, "pull up")) == [9, 9, 9] and weights(sets(o, "pull", 1, "pull up")) == [0, 0, 0]),
    ("pull1-no-spaces-x", "Pull 1 close grip: '85lb x 10 11 11' reads as 10, 11, 11", lambda o: reps(sets(o, "pull", 1, "close grip")) == [10, 11, 11]),
    ("pull2-seated-rows-mixed", "Pull 2 seated rows: 75lb x 10, 85lb x 12 x 12", lambda o: weights(sets(o, "pull", 2, "seated row")) == [75, 85, 85] and reps(sets(o, "pull", 2, "seated row")) == [10, 12, 12]),
    ("pull-remark-not-exercise", "'pull up competition v a friend (lost)' is a remark, not an exercise", lambda o: sets(o, "pull", 1, "pull up") is not None and all("competition" not in e["name"].lower() for sp in o["splits"] for s in sp["sessions"] for e in s["exercises"])),
    ("pull6-face-pull-remark", "Pull 5 face pull is 50lb x 11 x 11 x 11; Pull 6 face pull is 'x (i did reverse pec fly instead)': no sets", lambda o: weights(sets(o, "pull", 5, "face pull")) == [50, 50, 50] and not sets(o, "pull", 6, "face pull")),
    ("ideas", "ideas = chest press, pectoral fly, cable chest fly", lambda o: sorted(i.lower().strip() for i in o["ideas"]) == ["cable chest fly", "chest press", "pectoral fly"]),
    ("no-sets-from-x-weeks", "No session has an exercise with an empty sets list", lambda o: sum(len(s["exercises"]) for sp in o["splits"] for s in sp["sessions"]) >= 30 and all(e["sets"] for sp in o["splits"] for s in sp["sessions"] for e in s["exercises"])),
]


def score(out):
    rows = []
    for cid, what, test in CHECKS:
        try:
            ok = bool(test(out))
        except Exception as e:  # a malformed answer fails the check instead of crashing the run
            ok, what = False, f"{what} (error: {type(e).__name__})"
        rows.append({"id": cid, "what": what, "pass": ok})
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", type=int, default=1)
    ap.add_argument("--from-file")
    ap.add_argument("--selftest", action="store_true", help="an empty answer must fail every check")
    a = ap.parse_args()
    if a.selftest:
        empty = {"splits": [], "ideas": [], "skipped": []}
        passed = [r["id"] for r in score(empty) if r["pass"]]
        print("selftest:", "ok, an empty answer passes no check" if not passed else f"BROKEN, an empty answer passes {passed}")
        return 1 if passed else 0
    if a.from_file:
        outs = [json.loads(Path(a.from_file).read_text())]
    else:
        gs = load_gym_sync()
        text = (HERE / "note.txt").read_text()
        outs = []
        for _ in range(a.runs):
            try:
                outs.append(gs.parse(text, {}, True))
            except SystemExit as e:  # parse() exits when Claude fails: count it as a failed run, never reuse old results
                print("parser run failed:", e)
                outs.append(None)
    runs = [score(o) if o is not None else [{"id": c[0], "what": c[1], "pass": False} for c in CHECKS] for o in outs]
    per_check = {c[0]: sum(r[i]["pass"] for r in runs) for i, c in enumerate(CHECKS)}
    result = {"runs": len(runs), "checks": len(CHECKS), "per_run_passed": [sum(x["pass"] for x in r) for r in runs],
              "failed_runs": sum(o is None for o in outs), "per_check_passes": per_check, "details": runs[0] if len(runs) == 1 else None}
    (HERE / "results.json").write_text(json.dumps(result, indent=2) + "\n")
    good = [o for o in outs if o is not None]
    if good and not a.from_file:
        (HERE / "last-output.json").write_text(json.dumps(good[-1], indent=2) + "\n")
    for cid, n in per_check.items():
        what = next(c[1] for c in CHECKS if c[0] == cid)
        print(f"{'PASS' if n == len(runs) else 'FAIL'}  {n}/{len(runs)}  {cid}: {what}")
    print(f"\n{result['per_run_passed']} of {len(CHECKS)} checks per run")
    return 0 if all(n == len(runs) for n in per_check.values()) else 1


if __name__ == "__main__":
    sys.exit(main())
