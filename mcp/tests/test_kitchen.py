"""The Python port must give the same numbers as src/lib/kitchen.ts and src/lib/coach.ts.
Expected values are worked out from the TypeScript by hand; if kitchen.ts changes, update both."""

from penthouse_mcp.kitchen import add_days, days_left, e1rm, expiry_of, fmt_qty, item_cost, item_macros, monday_of

BEEF = {"unit": "g", "qty_start": 907, "price": 7.99, "kcal_per": 250, "protein_per": 17, "carbs_per": 0, "fat_per": 20}
EGGS = {"unit": "item", "qty_start": 12, "price": 3.0, "kcal_per": 70, "protein_per": 6, "carbs_per": 0.5, "fat_per": 5}


def test_item_cost_is_price_per_unit_times_amount():
    assert round(item_cost(BEEF, 453.5), 3) == round(7.99 / 907 * 453.5, 3)
    assert item_cost(EGGS, 2) == 0.5
    assert item_cost({**EGGS, "qty_start": 0}, 2) == 0


def test_macros_are_per_100g_or_per_item():
    m = item_macros(BEEF, 200)
    assert (m["kcal"], m["protein"]) == (500, 34)
    assert item_macros(EGGS, 3)["protein"] == 18


def test_expiry_uses_use_by_or_shelf_life():
    assert expiry_of({"place": "fridge", "bought": "2026-10-19", "use_by": None}) == "2026-10-24"
    assert expiry_of({"place": "freezer", "bought": "2026-10-19", "use_by": None}) == add_days("2026-10-19", 90)
    assert expiry_of({"place": "fridge", "bought": "2026-10-19", "use_by": "2026-10-30"}) == "2026-10-30"
    assert days_left({"place": "fridge", "bought": "2026-10-19", "use_by": None}, "2026-10-26") == -2


def test_e1rm_epley_and_bodyweight():
    assert e1rm(100, 5) == 100 * (1 + 5 / 30)
    assert e1rm(0, 12) == 0


def test_dates_and_format():
    assert monday_of("2026-11-04") == "2026-11-02"
    assert add_days("2026-10-31", 1) == "2026-11-01"
    assert fmt_qty(1360.5, "g") == "1.4 kg"
    assert fmt_qty(227, "g") == "227 g"
    assert fmt_qty(1, "serving") == "1 portion"
    assert fmt_qty(10, "item") == "10"
