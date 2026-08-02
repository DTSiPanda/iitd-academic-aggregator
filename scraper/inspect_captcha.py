"""
inspect_captcha.py — Check IITD Moodle math captcha prompt text.
"""
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto("https://moodle.iitd.ac.in/login/index.php", wait_until="networkidle")

        # Dump full page text or form text
        content = await page.content()
        login_form = await page.query_selector("#login, .loginform, form")
        if login_form:
            text = await login_form.inner_text()
            print("--- LOGIN FORM TEXT ---")
            print(text)
            print("-----------------------")

        await browser.close()

asyncio.run(main())
