"""
debug_moodlenew.py — Diagnose why moodlenew finds 0 courses.
Takes a screenshot + dumps course-related HTML for inspection.
"""
import asyncio
import os
import sys
from playwright.async_api import async_playwright
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

BASE_URL = "https://moodlenew.iitd.ac.in"
SESSION  = os.environ.get("MOODLENEW_SESSION", "").strip()

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        )
        await context.add_cookies([{
            "name":   "MoodleSession",
            "value":  SESSION,
            "domain": "moodlenew.iitd.ac.in",
            "path":   "/",
        }])
        page = await context.new_page()

        # Try /my/ first
        print("[1] Navigating to /my/ ...")
        await page.goto(f"{BASE_URL}/my/", wait_until="networkidle", timeout=30000)
        print(f"    Final URL: {page.url}")
        await page.screenshot(path="scraper/debug_my.png", full_page=True)
        print("    Screenshot saved -> scraper/debug_my.png")

        # Count course links with various selectors
        selectors = [
            "a[href*='/course/view.php']",
            "a[href*='course/view']",
            ".coursename a",
            ".course-info-container a",
            "[data-type='course'] a",
            ".card-title a",
            ".dashboard-card-deck a",
            "a[href*='moodlenew.iitd.ac.in/course']",
        ]
        print("\n[2] Testing selectors on /my/ :")
        for sel in selectors:
            els = await page.query_selector_all(sel)
            if els:
                sample = await els[0].get_attribute("href")
                print(f"    FOUND {len(els):3d}  [{sel}]  sample: {sample}")
            else:
                print(f"    empty       [{sel}]")

        # Try /my/courses
        print("\n[3] Navigating to /my/courses ...")
        await page.goto(f"{BASE_URL}/my/courses.php", wait_until="networkidle", timeout=30000)
        print(f"    Final URL: {page.url}")
        await page.screenshot(path="scraper/debug_courses.png", full_page=True)
        print("    Screenshot saved -> scraper/debug_courses.png")

        print("\n[4] Testing selectors on /my/courses :")
        for sel in selectors:
            els = await page.query_selector_all(sel)
            if els:
                sample = await els[0].get_attribute("href")
                print(f"    FOUND {len(els):3d}  [{sel}]  sample: {sample}")
            else:
                print(f"    empty       [{sel}]")

        # Print all unique hrefs containing 'course'
        all_links = await page.query_selector_all("a[href]")
        course_hrefs = set()
        for link in all_links:
            href = await link.get_attribute("href") or ""
            if "course" in href.lower():
                course_hrefs.add(href)

        print(f"\n[5] All hrefs containing 'course' ({len(course_hrefs)} found):")
        for h in sorted(course_hrefs)[:20]:
            print(f"    {h}")

        await browser.close()

asyncio.run(main())
