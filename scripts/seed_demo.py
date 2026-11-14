#!/usr/bin/env python3
"""Fill a fresh Penthouse with made-up demo data, so a reviewer sees live panels without my real data.

    INGEST_BASE_URL=http://localhost:3000 INGEST_TOKEN_FOR_SEED=<the INGEST_TOKEN of that server> python3 scripts/seed_demo.py

Only the standard library. Re-running is safe: sleep, to-dos and gym sessions are upserts.
Meals are keyed by date, time and name, so run it once against a clean database.
"""
import json
import os
import sys
import urllib.request
from datetime import date, timedelta

BASE = os.environ.get("INGEST_BASE_URL", "http://localhost:3000").rstrip("/")
TOKEN = os.environ.get("INGEST_TOKEN_FOR_SEED") or sys.exit("set INGEST_TOKEN_FOR_SEED (the INGEST_TOKEN of the server you are seeding)")


def post(kind, body):
    req = urllib.request.Request(
        f"{BASE}/api/ingest/{kind}",
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        print(f"{kind:10} {r.status}")


today = date.today()
days = [(today - timedelta(days=i)).isoformat() for i in range(7)]

post("sleep", [
    {"date": d, "totalMin": 420 + 15 * (i % 4), "deepMin": 80, "remMin": 100, "lightMin": 220, "awakeMin": 20,
     "recovery": 70 + 3 * (i % 5), "hrv": 60 + i, "rhr": 52, "bedtime": "23:40", "waketime": "07:20", "source": "demo"}
    for i, d in enumerate(days)
])
post("meals", [
    {"date": d, "time": "08:30", "name": "Eggs, toast, avocado", "kcal": 540, "protein": 28, "carbs": 42, "fat": 28, "source": "demo"}
    for d in days[:3]
])
post("todos", [
    {"id": "demo-1", "title": "Reply to the recruiter", "due": days[0], "sender": "Demo Co"},
    {"id": "demo-2", "title": "Finish the data viz draft", "due": (today + timedelta(days=2)).isoformat(), "sender": "Course"},
])
post("gym-note", {
    "date": days[0],
    "splits": [{"kind": "push", "sessions": [{"n": 1, "notes": "", "exercises": [
        {"name": "Flat DB press", "sets": [{"weight": 50, "unit": "lb", "reps": 8, "alt": None}, {"weight": 50, "unit": "lb", "reps": 7, "alt": None}]},
    ]}]}],
})
print("done")
