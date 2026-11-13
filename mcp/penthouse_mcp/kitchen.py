"""Python port of the kitchen math in src/lib/kitchen.ts and src/lib/dates.ts (no database here).

Keep in step with the TypeScript: tests/test_kitchen.py checks the same cases.
Macros are per 100 g/ml, or per item/serving.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

TZ = ZoneInfo("America/New_York")
SHELF_DAYS = {"fridge": 5, "freezer": 90, "pantry": 180}
USE_SOON_DAYS = 3


def today_iso() -> str:
    """Today's date in New York, like todayISO() in dates.ts."""
    return datetime.now(TZ).date().isoformat()


def add_days(s: str, n: int) -> str:
    return (date.fromisoformat(s) + timedelta(days=n)).isoformat()


def days_between(a: str, b: str) -> int:
    return (date.fromisoformat(b) - date.fromisoformat(a)).days


def monday_of(s: str) -> str:
    d = date.fromisoformat(s)
    return (d - timedelta(days=d.weekday())).isoformat()


def per_base(unit: str) -> int:
    return 100 if unit in ("g", "ml") else 1


def item_cost(item: dict, amount: float) -> float:
    return item["price"] / item["qty_start"] * amount if item["qty_start"] > 0 else 0.0


def item_macros(item: dict, amount: float) -> dict[str, float]:
    k = amount / per_base(item["unit"])
    return {m: item[f"{m}_per"] * k for m in ("kcal", "protein", "carbs", "fat")}


def expiry_of(item: dict) -> str:
    return item.get("use_by") or add_days(item["bought"], SHELF_DAYS.get(item["place"], 5))


def days_left(item: dict, today: str) -> int:
    """Days before it should be used, negative when past."""
    return days_between(today, expiry_of(item))


def e1rm(weight: float, reps: int) -> float:
    """Epley estimate, same as e1rm in src/lib/coach.ts. Only meaningful for weighted sets."""
    return weight * (1 + reps / 30) if weight > 0 else 0.0


def fmt_qty(qty: float, unit: str) -> str:
    if unit in ("g", "ml"):
        n = round(qty)
        if n >= 1000:
            return f"{round(n / 100) / 10:g} {'kg' if unit == 'g' else 'l'}"
        return f"{n} {unit}"
    n = round(qty * 10) / 10
    if unit == "item":
        return f"{n:g}"
    if unit == "serving":
        return f"{n:g} {'portion' if n == 1 else 'portions'}"
    return f"{n:g} {unit}"
