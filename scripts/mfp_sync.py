"""
MyFitnessPal diary -> dashboard kitchen panel.

MyFitnessPal has no public API and blocks scripted logins, so this reads the diary
with the session from your browser (log in at myfitnesspal.com in Chrome once; any Chrome profile).
It sends one row per meal (Breakfast, Lunch, Dinner, Snacks) to POST /api/ingest/meals.
Re-running is safe: the site upserts on (date, time, name).

    scripts/.venv/bin/python scripts/mfp_sync.py            # today and yesterday
    scripts/.venv/bin/python scripts/mfp_sync.py --days 7   # backfill a week
    scripts/.venv/bin/python scripts/mfp_sync.py --dry-run  # print, don't send

Reads INGEST_URL (e.g. https://your-site.vercel.app) and INGEST_TOKEN from scripts/.env.
"""

import argparse
import datetime as dt
import glob
import json
import os
import sys
import urllib.request
from pathlib import Path

import browser_cookie3
import myfitnesspal

HERE = Path(__file__).resolve().parent

# Fixed times so each meal keeps the same (date, time, name) key between runs
MEAL_TIMES = {"breakfast": "08:00", "lunch": "12:30", "dinner": "19:00", "snacks": "16:00"}


def load_env():
    env = {}
    path = HERE / ".env"
    if path.exists():
        for line in path.read_text().splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    for k in ("INGEST_URL", "INGEST_TOKEN"):
        if not env.get(k):
            sys.exit(f"{k} is missing from scripts/.env")
    return env


def mfp_cookies():
    """Cookies from whichever Chrome profile is logged in to MyFitnessPal (Default, Profile 2, ...)."""
    base = os.path.expanduser("~/Library/Application Support/Google/Chrome")
    for path in [os.path.join(base, "Default", "Cookies")] + sorted(glob.glob(os.path.join(base, "Profile *", "Cookies"))):
        if not os.path.exists(path):
            continue
        jar = browser_cookie3.chrome(cookie_file=path, domain_name="myfitnesspal.com")
        if any("session-token" in c.name for c in jar):
            return jar
    sys.exit("Not logged in to myfitnesspal.com in any Chrome profile on this Mac")


def meal_rows(client, day):
    diary = client.get_date(day.year, day.month, day.day)
    rows = []
    for meal in diary.meals:
        if not meal.entries:
            continue
        t = meal.totals
        foods = ", ".join(e.short_name or e.name for e in meal.entries)
        rows.append(
            {
                "date": day.isoformat(),
                "time": MEAL_TIMES.get(meal.name.lower(), "21:00"),
                "name": f"{meal.name.title()}: {foods}"[:200],
                "kcal": int(round(t.get("calories", 0))),
                "protein": round(t.get("protein", 0), 1),
                "carbs": round(t.get("carbohydrates", 0), 1),
                "fat": round(t.get("fat", 0), 1),
                "source": "mfp",
            }
        )
    return rows


def post(env, rows):
    req = urllib.request.Request(
        env["INGEST_URL"].rstrip("/") + "/api/ingest/meals",
        data=json.dumps(rows).encode(),
        headers={"Authorization": f"Bearer {env['INGEST_TOKEN']}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.loads(res.read())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=2, help="how many days back, including today")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    env = load_env()
    client = myfitnesspal.Client(cookiejar=mfp_cookies())
    today = dt.date.today()
    rows = []
    for i in range(args.days):
        rows += meal_rows(client, today - dt.timedelta(days=i))

    stamp = dt.datetime.now().strftime("%Y-%m-%d %H:%M")
    if args.dry_run:
        print(json.dumps(rows, indent=2))
        return
    if not rows:
        print(f"{stamp} nothing logged")
        return
    print(f"{stamp} {post(env, rows)}")


if __name__ == "__main__":
    main()
