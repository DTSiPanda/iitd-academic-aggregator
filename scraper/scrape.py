# -*- coding: utf-8 -*-
"""
scrape.py — Main orchestrator.
Runs scrapers for both Moodles, merges results, writes public/data.json.

Usage:
  python scraper/scrape.py

Environment variables (set via .env locally, GitHub Secrets in CI):
  MOODLE_SESSION      — Session cookie for moodle.iitd.ac.in
  MOODLENEW_SESSION   — Session cookie for moodlenew.iitd.ac.in
"""

import asyncio
import os
import sys

# Force UTF-8 output on Windows
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

from dotenv import load_dotenv

# Load .env file if present (local dev only)
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

from moodle_scraper import MoodleScraper
from normalize import merge, write_data_json

DATA_JSON_PATH = os.path.join(os.path.dirname(__file__), "..", "public", "data.json")


async def main():
    moodle_session = os.environ.get("MOODLE_SESSION", "").strip()
    moodlenew_session = os.environ.get("MOODLENEW_SESSION", "").strip()
    kerberos_id = os.environ.get("KERBEROS_ID", "").strip() or os.environ.get("KERBEROS_USER", "").strip()

    if not moodle_session and not moodlenew_session and not kerberos_id:
        print("❌ Missing session cookies and Kerberos ID. Set MOODLE_SESSION/MOODLENEW_SESSION or KERBEROS_ID/KERBEROS_PASS env vars.")
        sys.exit(1)

    print("[*] Starting Moodle scrape...\n")

    old_scraper = MoodleScraper(
        base_url="https://moodle.iitd.ac.in",
        session_value=moodle_session,
        label="old"
    )
    new_scraper = MoodleScraper(
        base_url="https://moodlenew.iitd.ac.in",
        session_value=moodlenew_session,
        label="new"
    )

    print("[1/2] Scraping moodle.iitd.ac.in...")
    old_results = await old_scraper.scrape_all()

    print("\n[2/2] Scraping moodlenew.iitd.ac.in...")
    new_results = await new_scraper.scrape_all()

    print(f"\n[*] Merging results ({len(old_results)} old + {len(new_results)} new courses)...")
    payload = merge(old_results, new_results, DATA_JSON_PATH)

    write_data_json(payload, DATA_JSON_PATH)

    # Print summary
    print("\n[*] Summary:")
    for course in payload["courses"]:
        new_count = sum(1 for r in course["new_items"] if r["is_new"])
        print(f"   {course['id']} ({course['moodle']}) — "
              f"{len(course['new_items'])} resources "
              f"({new_count} new), "
              f"{len(course['assignments'])} assignments")


if __name__ == "__main__":
    asyncio.run(main())
