import json
import re
from pathlib import Path

from penthouse_mcp import receipts
from penthouse_mcp.receipts import build_payload, receipt_items, receipt_text

LIDL_SYNC = Path(__file__).resolve().parents[2] / "scripts" / "lidl_sync.py"

SAMPLE = """<html><body><div>Lidl</div><div>1234 Example Ave, Brooklyn NY</div><div>11/02/2026 10:15</div>
<div>Chicken thighs 7.99 F</div><div>2.1 lb @ $3.80/lb</div>
<div>BANANAS 1.29 F</div><div>Lidl Plus discount -0.50 F</div>
<div>Paper towels 3.99 T</div><div>Total 13.27</div>
<div>Card **** 4321</div><div>Auth code 998877</div><div>Merchant ID 555</div></body></html>"""


def test_cut_stops_at_payment_block():
    text = receipt_text(SAMPLE)
    assert "Total 13.27" in text
    assert "4321" not in text and "998877" not in text and "Merchant" not in text


def test_food_lines_weights_and_discounts():
    items = receipt_items(receipt_text(SAMPLE))
    assert items == [
        {"name": "Chicken thighs", "qty": 2.1, "unit": "lb", "price": 7.99},
        {"name": "BANANAS", "qty": 1, "unit": "item", "price": 0.79},
    ]


def test_payload_has_no_card_data_and_a_stable_id(tmp_path):
    f = tmp_path / "r1.html"
    f.write_text(SAMPLE)
    p = build_payload(f)
    blob = json.dumps(p)
    assert "4321" not in blob and "998877" not in blob
    assert p["date"] == "2026-11-02" and p["store"] == "Lidl" and p["source"] == "mcp"
    assert p["extId"] == build_payload(f)["extId"]  # same file, same id: the endpoint skips re-imports


def test_regexes_match_lidl_sync():
    """receipts.py is a copy of the parser in scripts/lidl_sync.py; fail if they drift apart."""
    src = LIDL_SYNC.read_text()
    for name in ("ITEM", "WEIGHT", "COUNT", "DISCOUNT"):
        pattern = getattr(receipts, name).pattern
        assert re.search(rf'^{name} = re\.compile\(r"{re.escape(pattern)}"', src, re.M), name
    assert receipts.PAYMENT.pattern in src
