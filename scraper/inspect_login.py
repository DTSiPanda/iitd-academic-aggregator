"""
inspect_login.py — Inspect Moodle login page elements for auto-login automation.
"""
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        print("[1] Navigating to moodle.iitd.ac.in/login/index.php ...")
        await page.goto("https://moodle.iitd.ac.in/login/index.php", wait_until="networkidle", timeout=30000)
        print(f"    URL: {page.url}")

        # Check for inputs
        inputs = await page.query_selector_all("input")
        for inp in inputs:
            name = await inp.get_attribute("name")
            id_val = await inp.get_attribute("id")
            type_val = await inp.get_attribute("type")
            placeholder = await inp.get_attribute("placeholder")
            print(f"    INPUT -> name: '{name}', id: '{id_val}', type: '{type_val}', placeholder: '{placeholder}'")

        # Check for buttons / form actions
        forms = await page.query_selector_all("form")
        for f in forms:
            action = await f.get_attribute("action")
            print(f"    FORM -> action: '{action}'")

        await browser.close()

asyncio.run(main())
