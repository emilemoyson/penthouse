#!/bin/bash
# Notification: a macOS banner when Claude is waiting on Emile.
msg=$(jq -r '.message // "Claude Code needs you"' 2>/dev/null | tr -d '"\\' | cut -c1-180)
osascript -e "display notification \"${msg:-Claude Code needs you}\" with title \"Penthouse\" sound name \"Glass\"" >/dev/null 2>&1
exit 0
