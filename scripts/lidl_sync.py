"""
Lidl Plus receipts -> dashboard kitchen (grocery runs + fridge).

Lidl has no public API. This uses the unofficial `lidl-plus` package to log in and list receipts,
then fetches each receipt's printed text and sends it to POST /api/ingest/groceries,
where Claude reads the lines and fills in sizes and macros. Each receipt is sent with its Lidl id,
so re-running is safe: receipts the site already has are skipped without another Claude call.
It can stop working whenever Lidl changes their app.

Setup (its own venv, because its dependencies clash with the MyFitnessPal ones):
    python3 -m venv scripts/.venv-lidl && scripts/.venv-lidl/bin/pip install -r scripts/requirements-lidl.txt

One-time login: opens Chrome on the Lidl login page, you log in yourself, it saves LIDL_REFRESH_TOKEN to scripts/.env.
(The package's own `lidl-plus auth` no longer works: Lidl redesigned the login page and added a captcha.)
    scripts/.venv-lidl/bin/python scripts/lidl_login.py

    scripts/.venv-lidl/bin/python scripts/lidl_sync.py              # receipts from the last 14 days
    scripts/.venv-lidl/bin/python scripts/lidl_sync.py --days 60    # backfill
    scripts/.venv-lidl/bin/python scripts/lidl_sync.py --dry-run    # print the newest receipt, don't send

Reads INGEST_URL, INGEST_TOKEN, LIDL_REFRESH_TOKEN and optionally LIDL_COUNTRY (US) and LIDL_LANGUAGE (en) from scripts/.env.
"""

import argparse
import datetime as dt
import html
import json
import re
import sys
import urllib.request
from pathlib import Path

import requests
from lidlplus import LidlPlusApi

HERE = Path(__file__).resolve().parent
ENV = HERE / ".env"
TICKETS = "https://tickets.lidlplus.com/api"


def load_env():
    env = {}
    if ENV.exists():
        for line in ENV.read_text().splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    for k in ("INGEST_URL", "INGEST_TOKEN", "LIDL_REFRESH_TOKEN"):
        if not env.get(k):
            sys.exit(f"{k} is missing from scripts/.env")
    return env


def save_refresh_token(old, new):
    """Lidl may hand out a new refresh token when the old one is used; keep the newest."""
    if new and new != old:
        ENV.write_text(ENV.read_text().replace(old, new))


def receipt_text(raw_html):
    """The printed receipt as plain lines, cut before the payment block (card details never leave this Mac)."""
    t = re.sub(r"(?is)<(style|script)[^>]*>.*?</\1>", "", raw_html)
    t = re.sub(r"(?i)<br\s*/?>|</(span|div|p|tr)>", "\n", t)
    t = html.unescape(re.sub(r"<[^>]+>", "", t))
    lines = [re.sub(r"[ \t]+", " ", ln).strip() for ln in t.splitlines()]
    out = []
    for ln in lines:
        if re.match(r"^(Card|Cash|Change|Total Savings|barcode|Client ID|Merchant ID)\b", ln, re.I):
            break
        if ln:
            out.append(ln)
    return "\n".join(out)


ITEM = re.compile(r"^(?P<name>.+?) (?P<price>-?\d+\.\d{2}) (?P<flags>[A-Z]{1,3})$")
WEIGHT = re.compile(r"^(?P<qty>\d+(?:\.\d+)?) (?P<unit>lb|kg|oz) @ \$ ?[\d.]+/(?:lb|kg|oz)$", re.I)
COUNT = re.compile(r"^(?P<qty>\d+) @ \$ ?[\d.]+$")
DISCOUNT = re.compile(r"^(?P<name>.*(?:discount|coupon|savings).*?) (?P<amount>-\d+\.\d{2})(?: [A-Z]{1,3})?$", re.I)


def receipt_items(text):
    """Food lines from a Lidl US receipt. F marks food (FT: taxable food); T alone is non-food and is skipped."""
    items, last = [], None
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
            last["unit"] = w.groupdict().get("unit", "item").lower() if "unit" in w.groupdict() else "item"
    return items


def headers(lidl):
    """Just the login. The package's fake app headers (App-Version 999.99.9) make Lidl's bot protection stall every request."""
    if not lidl.token:
        lidl._renew_token()
    return {"Authorization": f"Bearer {lidl.token}", "Accept-Language": "en"}  # the ticket API wants a 2-letter code


def list_tickets(lidl, country):
    """All receipts, newest first. The ticket API can be slow, so allow more time than the package does."""
    kwargs = {"headers": headers(lidl), "timeout": 30}
    url = f"{TICKETS}/v2/{country}/tickets"
    first = requests.get(f"{url}?pageNumber=1&onlyFavorite=False", **kwargs)
    first.raise_for_status()
    data = first.json()
    tickets = data.get("tickets", [])
    pages = -(-int(data.get("totalCount", 0)) // max(int(data.get("size", 1)), 1))
    for page in range(2, pages + 1):
        tickets += requests.get(f"{url}?pageNumber={page}&onlyFavorite=False", **kwargs).json().get("tickets", [])
    return tickets


def fetch_receipt(lidl, country, ticket_id):
    kwargs = {"headers": headers(lidl), "timeout": 30}
    # v2 used to return JSON lines; it now fails for most countries, v3 returns the printed receipt as HTML
    res = requests.get(f"{TICKETS}/v3/{country}/tickets/{ticket_id}", **kwargs)
    res.raise_for_status()
    data = res.json()
    return receipt_text(data.get("htmlPrintedReceipt") or "")


def local_date(stamp):
    """Receipt time is UTC; the dashboard counts days in New York."""
    t = dt.datetime.fromisoformat(str(stamp).replace("Z", "+00:00"))
    return (t - dt.timedelta(hours=4 if 3 <= t.month <= 11 else 5)).date().isoformat()


def post(env, payload):
    req = urllib.request.Request(
        env["INGEST_URL"].rstrip("/") + "/api/ingest/groceries",
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {env['INGEST_TOKEN']}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as res:
        return json.loads(res.read())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=14, help="how many days back")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    env = load_env()
    country = env.get("LIDL_COUNTRY", "US")
    lidl = LidlPlusApi(env.get("LIDL_LANGUAGE", "en"), country, refresh_token=env["LIDL_REFRESH_TOKEN"])
    # renew first and save right away: Lidl can rotate the refresh token, and a failed fetch must not lose the new one
    lidl._renew_token()
    save_refresh_token(env["LIDL_REFRESH_TOKEN"], lidl.refresh_token)
    tickets = list_tickets(lidl, country)

    since = (dt.date.today() - dt.timedelta(days=args.days)).isoformat()
    recent = [t for t in tickets if local_date(t["date"]) >= since]
    stamp = dt.datetime.now().strftime("%Y-%m-%d %H:%M")

    if args.dry_run:
        if not tickets:
            print("No receipts on this Lidl Plus account.")
            return
        t = tickets[0]
        print(json.dumps({k: v for k, v in t.items() if k != "articlesCount"}, indent=2, default=str))
        text = fetch_receipt(lidl, country, t["id"])
        print(text)
        print("\nItems the dashboard would get:")
        for it in receipt_items(text):
            print(f"  {it['name']:<28} {it['qty']:>6} {it['unit']:<5} ${it['price']:.2f}")
        return

    if not recent:
        print(f"{stamp} no receipts in the last {args.days} days")
        return
    for t in recent:
        text = fetch_receipt(lidl, country, t["id"])
        if not text:
            print(f"{stamp} {t['id']}: empty receipt, skipped")
            continue
        payload = {"extId": f"lidl:{t['id']}", "date": local_date(t["date"]), "store": "Lidl", "source": "lidl"}
        items = receipt_items(text)
        # lines read here; Claude only fills in sizes and macros. If the format ever changes, fall back to sending the text.
        if items:
            payload["items"] = items
        else:
            payload["text"] = text
        if not items:  # with parsed items the total is the food lines only, so deodorant and tax don't count as food spending
            try:
                payload["total"] = float(str(t.get("totalAmount")).replace(",", "."))
            except ValueError:
                pass
        print(f"{stamp} {payload['date']} {post(env, payload).get('message')}")


if __name__ == "__main__":
    main()
