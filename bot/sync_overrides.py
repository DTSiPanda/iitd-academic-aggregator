"""
sync_overrides.py — Watches bot/overrides.json and copies it to public/overrides.json
whenever the bot writes a change.

Run alongside the Telegram bot:
  python bot/sync_overrides.py
"""

import time
import shutil
import os

SRC  = os.path.join(os.path.dirname(__file__), "overrides.json")
DEST = os.path.join(os.path.dirname(__file__), "..", "public", "overrides.json")

def sync():
    shutil.copy2(SRC, DEST)
    print(f"[sync] overrides.json -> public/overrides.json")

if __name__ == "__main__":
    last_mtime = 0
    print("[sync] Watching bot/overrides.json for changes...")
    while True:
        try:
            mtime = os.path.getmtime(SRC)
            if mtime != last_mtime:
                sync()
                last_mtime = mtime
        except FileNotFoundError:
            pass
        time.sleep(2)
