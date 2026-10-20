"""
One-time Lidl Plus login for lidl_sync.py. Saves LIDL_REFRESH_TOKEN to scripts/.env.

Lidl's login page now has a captcha and several ways to sign in, so this doesn't type anything for you.
It opens a Chrome window on the real Lidl login page; you log in there yourself (phone, email, Google or Apple,
plus the SMS code). When Lidl hands back the login code, this swaps it for a refresh token and saves it.
Your password never passes through this script.

    scripts/.venv-lidl/bin/python scripts/lidl_login.py
"""

import re
import sys
import time
from pathlib import Path

from lidlplus import LidlPlusApi

HERE = Path(__file__).resolve().parent
ENV = HERE / ".env"
WAIT_MINUTES = 10


def find_code(browser):
    """The app redirect (com.lidlplus.app://callback?code=...) shows up as a Location header on accounts.lidl.com/connect."""
    for request in reversed(browser.requests):
        if "accounts.lidl.com/connect" not in request.url or not request.response:
            continue
        location = request.response.headers.get("Location", "") or ""
        if location.startswith("com.lidlplus.app://callback"):
            m = re.search(r"[?&]code=([^&#]+)", location)
            if m:
                return m.group(1)
    return None


def save_token(token):
    lines = ENV.read_text().splitlines() if ENV.exists() else []
    lines = [ln for ln in lines if not ln.startswith("LIDL_REFRESH_TOKEN=")]
    lines.append(f"LIDL_REFRESH_TOKEN={token}")
    ENV.write_text("\n".join(lines) + "\n")


def main():
    lidl = LidlPlusApi("en", "US")
    browser = lidl._init_chrome(headless=False)  # visible, so you can log in and solve the captcha
    try:
        browser.get(lidl._register_link)
        print("A Chrome window opened on the Lidl Plus login page.")
        print("Log in there the way you normally do (phone, email, Google or Apple), including the SMS code.")
        print("Accept the terms if it asks. This window closes by itself when it's done.")
        deadline = time.time() + WAIT_MINUTES * 60
        code = None
        while time.time() < deadline and not code:
            time.sleep(1)
            try:
                code = find_code(browser)
            except Exception:
                pass  # the window can be mid-navigation
        if not code:
            sys.exit(f"No login after {WAIT_MINUTES} minutes. Run it again when you're ready.")
    finally:
        try:
            browser.quit()
        except Exception:
            pass

    lidl._authorization_code(code)
    save_token(lidl.refresh_token)
    print("Logged in. Saved LIDL_REFRESH_TOKEN to scripts/.env.")


if __name__ == "__main__":
    main()
