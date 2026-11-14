#!/usr/bin/env python3
"""Receipt reader eval, part 1: the local parser behind the MCP tool `import_receipts`.

For each receipt in cases/ (made up, in the Lidl US layouts the app sees) the parser's items, date and
cut text are compared with a hand-written truth file next to it. No model is called, so it is free and
repeatable. Writes evals/receipts/results.json; evals/build_results.py turns it into evals/results.md.

Metrics: item recall (truth items found by name), item precision (parsed items that are real),
price match and qty+unit match (on found items, exact to the cent), date match, card-data leaks
(forbidden strings left in the cut text), and unrecognised layouts routed to the Claude fallback.
"""
import json
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent / "mcp"))
from penthouse_mcp.receipts import SUFFIXES, build_payload, receipt_items, receipt_text  # noqa: E402


def main():
    t = dict(truth_items=0, found=0, parsed=0, real=0, price_ok=0, qty_ok=0, dates=0, cases=0, leaks=0, fallback_ok=0, fallback_cases=0)
    per_case = []
    for f in sorted((HERE / "cases").iterdir()):
        if f.suffix not in SUFFIXES:  # truth files, .DS_Store, iCloud copies with other suffixes
            continue
        truth = json.loads(f.with_suffix(".truth.json").read_text())
        text = receipt_text(f.read_text())
        items = receipt_items(text)
        payload = build_payload(f)
        t["cases"] += 1
        t["truth_items"] += len(truth["items"])
        t["parsed"] += len(items)
        pool = list(items)  # each parsed item can satisfy one truth item (repeated names count twice)
        case = {"case": f.name, "missed": [], "wrong": [], "extra": [], "leaks": []}
        for want in truth["items"]:
            got = next((i for i in pool if i["name"] == want["name"]), None)
            if not got:
                case["missed"].append(want["name"])
                continue
            pool.remove(got)
            t["found"] += 1
            if abs(got["price"] - want["price"]) < 0.005:
                t["price_ok"] += 1
            else:
                case["wrong"].append(f'{want["name"]} price {got["price"]} != {want["price"]}')
            if got["unit"] == want["unit"] and abs(got["qty"] - want["qty"]) < 1e-9:
                t["qty_ok"] += 1
            else:
                case["wrong"].append(f'{want["name"]} qty {got["qty"]} {got["unit"]} != {want["qty"]} {want["unit"]}')
        t["real"] += len(truth["items"]) - len(case["missed"])
        case["extra"] = [i["name"] for i in pool]
        if payload["date"] == truth["date"]:
            t["dates"] += 1
        else:
            case["wrong"].append(f'date {payload["date"]} != {truth["date"]}')
        leaked = [s for s in truth["forbidden"] if s in text or s in json.dumps(payload)]  # the cut text and what would be sent
        case["leaks"] = leaked
        t["leaks"] += len(leaked)
        if truth.get("fallback_text"):
            t["fallback_cases"] += 1
            t["fallback_ok"] += int("text" in payload and "items" not in payload)
        per_case.append(case)
    r = lambda a, b: round(a / b, 3) if b else None
    out = {
        "cases": t["cases"], "truth_items": t["truth_items"],
        "item_recall": r(t["found"], t["truth_items"]), "item_precision": r(t["real"], t["parsed"]),
        "price_match": r(t["price_ok"], t["found"]), "qty_unit_match": r(t["qty_ok"], t["found"]),
        "date_match": r(t["dates"], t["cases"]), "card_data_leaks": t["leaks"],
        "unrecognised_routed_to_claude": f'{t["fallback_ok"]}/{t["fallback_cases"]}', "per_case": per_case,
    }
    (HERE / "results.json").write_text(json.dumps(out, indent=2) + "\n")
    print(json.dumps({k: v for k, v in out.items() if k != "per_case"}, indent=2))
    for c in per_case:
        if c["missed"] or c["wrong"] or c["extra"] or c["leaks"]:
            print(c)
    # hard requirements for CI: no card data leaves, and unrecognised layouts must go to the Claude fallback
    if t["leaks"] or t["fallback_ok"] != t["fallback_cases"]:
        sys.exit("FAIL: card data leaked or the fallback was not used")


if __name__ == "__main__":
    main()
