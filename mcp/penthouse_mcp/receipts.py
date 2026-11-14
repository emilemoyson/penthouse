"""Lidl US printed receipts read locally, cut before the payment block (card data never leaves the Mac).

The cut and the line parser are copies of receipt_text / receipt_items in scripts/lidl_sync.py
(that module can't be imported here: it needs the lidl-plus package). tests/test_receipts.py
fails if the regexes in the two files drift apart.
"""

from __future__ import annotations

import hashlib
import html
import re
from datetime import datetime
from pathlib import Path

from .kitchen import TZ

SUFFIXES = {".txt", ".html", ".htm"}

PAYMENT = re.compile(r"^(Card|Cash|Change|Total Savings|barcode|Client ID|Merchant ID|Visa|Mastercard|Amex|Discover|Debit|Credit|Auth|Approval|Tender)\b", re.I)
ITEM = re.compile(r"^(?P<name>.+?) (?P<price>-?\d+\.\d{2}) (?P<flags>[A-Z]{1,3})$")
WEIGHT = re.compile(r"^(?P<qty>\d+(?:\.\d+)?) (?P<unit>lb|kg|oz) @ \$? ?[\d.]+/(?:lb|kg|oz)$", re.I)
COUNT = re.compile(r"^(?P<qty>\d+) @ \$? ?[\d.]+$")
DISCOUNT = re.compile(r"^(?P<name>.*(?:discount|coupon|savings).*?) (?P<amount>-\d+\.\d{2})(?: [A-Z]{1,3})?$", re.I)
DATE_US = re.compile(r"\b(?P<m>\d{1,2})/(?P<d>\d{1,2})/(?P<y>\d{2}|\d{4})\b")
DATE_ISO = re.compile(r"\b(?P<y>20\d{2})-(?P<m>\d{2})-(?P<d>\d{2})\b")


def receipt_text(raw: str) -> str:
    """Plain lines of a receipt (HTML or text), cut before the payment block."""
    t = re.sub(r"(?is)<(style|script)[^>]*>.*?</\1>", "", raw)
    t = re.sub(r"(?i)<br\s*/?>|</(span|div|p|tr)>", "\n", t)
    t = html.unescape(re.sub(r"<[^>]+>", "", t))
    lines = [re.sub(r"[ \t]+", " ", ln).strip() for ln in t.splitlines()]
    out = []
    for ln in lines:
        if PAYMENT.match(ln):
            break
        if ln:
            out.append(ln)
    return "\n".join(out)


def receipt_items(text: str) -> list[dict]:
    """Food lines. F marks food (FT: taxable food); T alone is non-food and is skipped."""
    items: list[dict] = []
    last: dict | None = None
    for ln in text.splitlines():
        if DISCOUNT.match(ln):
            if last is not None:
                last["price"] = round(max(0.0, last["price"] + float(DISCOUNT.match(ln)["amount"])), 2)
            continue
        m = ITEM.match(ln)
        if m:
            last = None
            if "F" in m["flags"] and float(m["price"]) > 0:
                last = {"name": m["name"].strip(), "qty": 1, "unit": "item", "price": float(m["price"])}
                items.append(last)
            continue
        w = WEIGHT.match(ln) or COUNT.match(ln)
        if w and last is not None:
            last["qty"] = float(w["qty"])
            last["unit"] = w["unit"].lower() if "unit" in w.groupdict() else "item"
    return items


def receipt_date(text: str, path: Path) -> str:
    """Date printed on the receipt, else the file's modified day in New York."""
    m = DATE_ISO.search(text)
    if m:
        return f"{m['y']}-{m['m']}-{m['d']}"
    m = DATE_US.search(text)
    if m:
        y = int(m["y"])
        y = y + 2000 if y < 100 else y
        try:
            return datetime(y, int(m["m"]), int(m["d"])).date().isoformat()
        except ValueError:
            pass
    return datetime.fromtimestamp(path.stat().st_mtime, TZ).date().isoformat()


def build_payload(path: Path) -> dict:
    """What import_receipts sends to /api/ingest/groceries for one file. Only the cut text is used."""
    text = receipt_text(path.read_text(errors="replace"))
    digest = hashlib.sha256(text.encode()).hexdigest()[:24]
    payload: dict = {
        "extId": f"file:{digest}",
        "date": receipt_date(text, path),
        "store": "Lidl" if "lidl" in text.lower() else "",
        "source": "mcp",
    }
    items = receipt_items(text)
    if items:
        payload["items"] = items
    elif text.strip():
        payload["text"] = text  # format not recognised: the server reads the (already cut) text with Claude
    return payload
