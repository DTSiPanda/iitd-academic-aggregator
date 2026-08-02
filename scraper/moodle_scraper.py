"""
Moodle Scraper — works for BOTH moodle.iitd.ac.in and moodlenew.iitd.ac.in
Uses session cookie injection (no password needed).
"""

import asyncio
import json
import os
import re
from datetime import datetime, timezone
from dotenv import load_dotenv
from playwright.async_api import async_playwright, Page, BrowserContext
from captcha_solver import solve_moodle_captcha


COURSE_CODES = [
    "CVL1301", "CVL2001", "CVL2401",
    "CVL2502", "CVL2601", "CVL2702",
    "CVP2401", "CVP2502", "CVP2601", "CVP2702",
    "MEP1000"
]


class MoodleScraper:
    def __init__(self, base_url: str, session_value: str, label: str):
        self.base_url = base_url.rstrip("/")
        self.session_value = session_value
        self.label = label  # "old" or "new" — for logging

    async def _set_cookie(self, context: BrowserContext):
        domain = self.base_url.replace("https://", "")
        await context.add_cookies([{
            "name": "MoodleSession",
            "value": self.session_value,
            "domain": domain,
            "path": "/",
        }])

    async def _auto_login(self, page: Page) -> bool:
        """Auto-login using KERBEROS_USER & KERBEROS_PASS with captcha solving."""
        user = os.environ.get("KERBEROS_USER", "").strip()
        password = os.environ.get("KERBEROS_PASS", "").strip()
        if not user or not password:
            print(f"  [{self.label}] ⚠️ Session expired and KERBEROS_USER/KERBEROS_PASS not set in .env")
            return False

        print(f"  [{self.label}] 🔑 Attempting auto-login for user '{user}'...")
        try:
            await page.goto(f"{self.base_url}/login/index.php", wait_until="networkidle", timeout=30000)
            
            # Fill username & password
            await page.fill("#username, input[name='username']", user)
            await page.fill("#password, input[name='password']", password)

            # Detect & solve math captcha if present
            login_form = await page.query_selector("#login, .loginform, form")
            if login_form:
                form_text = await login_form.inner_text()
                captcha_ans = solve_moodle_captcha(form_text)
                if captcha_ans:
                    # Find captcha input field (usually valuepkg3 or similar text input)
                    captcha_inp = await page.query_selector("input[name*='valuepkg'], input[name*='captcha']")
                    if captcha_inp:
                        await captcha_inp.fill(captcha_ans)
                        print(f"  [{self.label}] 🧩 Captcha solved automatically: {captcha_ans}")

            # Click login button
            await page.click("#loginbtn, input[type='submit']")
            await page.wait_for_load_state("networkidle", timeout=30000)

            if "login" not in page.url:
                print(f"  [{self.label}] 🎉 Auto-login successful!")
                return True
            else:
                print(f"  [{self.label}] ❌ Auto-login failed — check credentials.")
                return False
        except Exception as e:
            print(f"  [{self.label}] ❌ Auto-login exception: {e}")
            return False

    async def _is_logged_in(self, page: Page) -> bool:
        """Check if session cookie is valid, or perform auto-login if expired."""
        await page.goto(f"{self.base_url}/my/", wait_until="networkidle", timeout=40000)
        if "login" not in page.url:
            return True
        # Session cookie expired — try auto-login
        print(f"  [{self.label}] ⚠️ Session cookie expired. Attempting auto-login...")
        return await self._auto_login(page)

    async def get_enrolled_courses(self, page: Page) -> list[dict]:
        """Scrape the dashboard for enrolled course links."""
        print(f"  [{self.label}] Fetching enrolled courses from dashboard...")
        await page.goto(f"{self.base_url}/my/", wait_until="networkidle", timeout=40000)
        # Wait for course links to be rendered (moodlenew loads them via JS)
        try:
            await page.wait_for_selector("a[href*='/course/view.php']", timeout=10000)
        except Exception:
            pass  # No courses found — will return empty list

        # Deduplicate by course ID (moodlenew has 2 links per course: image + text)
        seen_ids: dict[str, dict] = {}
        course_links = await page.query_selector_all("a[href*='/course/view.php']")
        for link in course_links:
            href = await link.get_attribute("href") or ""
            match = re.search(r"id=(\d+)", href)
            if not match:
                continue
            course_id = match.group(1)

            # Priority: aria-label > inner_text (avoids "Course image" alt texts)
            aria  = (await link.get_attribute("aria-label") or "").strip()
            text  = (await link.inner_text()).strip()
            title = aria if aria else text
            # Strip common moodlenew prefixes like "Course name\nACTUAL TITLE"
            for prefix in ["Course name\n", "Course image\n", "Course name", "Course image"]:
                if title.lower().startswith(prefix.lower()):
                    title = title[len(prefix):].strip()
                    break
            if "course image" in title.lower() or "course name" == title.lower():
                title = ""

            full_url = href if href.startswith("http") else self.base_url + href
            if course_id not in seen_ids:
                seen_ids[course_id] = {
                    "moodle_id": course_id,
                    "url": full_url,
                    "name_raw": title,
                }
            elif title and not seen_ids[course_id]["name_raw"]:
                seen_ids[course_id]["name_raw"] = title

        courses = list(seen_ids.values())

        print(f"  [{self.label}] Found {len(courses)} enrolled courses")
        return courses

    async def scrape_course(self, page: Page, course_url: str, course_name: str) -> dict:
        """Scrape a single course page for files and assignments."""
        print(f"  [{self.label}] Scraping: {course_name}")
        result = {"resources": [], "assignments": [], "page_title": ""}

        try:
            await page.goto(course_url, wait_until="domcontentloaded", timeout=30000)

            # If course name is unknown, extract it from the page heading
            if not course_name:
                for sel in ["h1", ".page-header-headings h1", ".course-fullname", ".coursename"]:
                    h1 = await page.query_selector(sel)
                    if h1:
                        resolved = (await h1.inner_text()).strip()
                        if resolved and "course image" not in resolved.lower():
                            result["page_title"] = resolved
                            course_name = resolved
                            print(f"  [{self.label}]   name from page: {course_name}")
                            break

            # --- RESOURCES (files, PDFs, slides) ---
            resource_els = await page.query_selector_all(
                "li.activity.resource, li.modtype_resource, "
                ".activityinstance a[href*='mod/resource'], "
                "a[href*='mod/resource/view.php']"
            )
            seen_res = set()
            for el in resource_els:
                try:
                    href = await el.get_attribute("href")
                    if not href or href in seen_res:
                        continue
                    seen_res.add(href)

                    # Get the title — either from the element itself or a child
                    title_el = await el.query_selector(".instancename, .activityname")
                    if title_el:
                        title = (await title_el.inner_text()).strip()
                    else:
                        title = (await el.inner_text()).strip()

                    # Clean up title (Moodle sometimes appends " File" suffix)
                    title = re.sub(r"\s+File$", "", title).strip()
                    if not title:
                        continue

                    full_url = href if href.startswith("http") else self.base_url + href
                    
                    # Download file using Playwright's authenticated request session
                    local_file_url = await self._download_resource_file(page, result["course_id"], title, full_url)

                    result["resources"].append({
                        "title": title,
                        "url": local_file_url,
                        "type": "file",
                        "uploaded_at": None,  # will attempt to fill below
                    })
                except Exception:
                    continue

            # Also pick up URLs and pages (folders, external links)
            other_els = await page.query_selector_all(
                "a[href*='mod/url/view.php'], a[href*='mod/page/view.php'], "
                "a[href*='mod/folder/view.php']"
            )
            for el in other_els:
                try:
                    href = await el.get_attribute("href")
                    if not href or href in seen_res:
                        continue
                    seen_res.add(href)
                    title_el = await el.query_selector(".instancename, .activityname")
                    title = (await (title_el or el).inner_text()).strip()
                    title = re.sub(r"\s+(URL|Page|Folder)$", "", title).strip()
                    if not title:
                        continue
                    full_url = href if href.startswith("http") else self.base_url + href
                    result["resources"].append({
                        "title": title,
                        "url": full_url,
                        "type": "url",
                        "uploaded_at": None,
                    })
                except Exception:
                    continue

            # --- ASSIGNMENTS ---
            assign_els = await page.query_selector_all(
                "li.activity.assign a[href*='mod/assign'], "
                "li.modtype_assign a[href*='mod/assign'], "
                "a[href*='mod/assign/view.php']"
            )
            seen_assign = set()
            for el in assign_els:
                try:
                    href = await el.get_attribute("href")
                    if not href or href in seen_assign:
                        continue
                    seen_assign.add(href)
                    title_el = await el.query_selector(".instancename, .activityname")
                    title = (await (title_el or el).inner_text()).strip()
                    title = re.sub(r"\s+Assignment$", "", title).strip()
                    if not title:
                        continue

                    full_url = href if href.startswith("http") else self.base_url + href

                    # Try to get due date from assignment page
                    due_date = await self._get_assignment_due_date(page, full_url)

                    result["assignments"].append({
                        "title": title,
                        "url": full_url,
                        "due_date": due_date,
                    })
                    # Go back to course page after visiting assignment
                    await page.goto(course_url, wait_until="domcontentloaded", timeout=30000)
                except Exception:
                    continue

        except Exception as e:
            print(f"  [{self.label}] Error scraping {course_name}: {e}")

        print(f"  [{self.label}]   → {len(result['resources'])} resources, {len(result['assignments'])} assignments")
        return result

    async def _get_assignment_due_date(self, page: Page, assign_url: str) -> str | None:
        """Navigate to an assignment page and extract the due date."""
        try:
            await page.goto(assign_url, wait_until="domcontentloaded", timeout=20000)

            # Moodle shows due date in a table row with "Due date" label
            rows = await page.query_selector_all("tr")
            for row in rows:
                label_el = await row.query_selector("td.cell.c0, th")
                if label_el:
                    label_text = (await label_el.inner_text()).lower()
                    if "due" in label_text:
                        value_el = await row.query_selector("td.cell.c1, td:last-child")
                        if value_el:
                            due_str = (await value_el.inner_text()).strip()
                            return due_str
        except Exception:
            pass
        return None

    async def _download_resource_file(self, page: Page, course_code: str, title: str, res_url: str) -> str:
        """Download resource file from Moodle using Playwright's authenticated request context."""
        try:
            safe_title = re.sub(r'[^a-zA-Z0-9_\-]', '_', title).strip('_')
            if not safe_title:
                safe_title = "resource"

            save_dir = os.path.join(os.path.dirname(__file__), "..", "public", "files", course_code)
            os.makedirs(save_dir, exist_ok=True)

            # Check if file already exists
            for ext in [".pdf", ".pptx", ".docx", ".doc", ".zip", ".png", ".jpg"]:
                existing_path = os.path.join(save_dir, f"{safe_title}{ext}")
                if os.path.exists(existing_path):
                    return f"/files/{course_code}/{safe_title}{ext}"

            print(f"  [{self.label}] 📥 Downloading file: {title}...")
            response = await page.request.get(res_url)
            if response.status == 200:
                content_type = response.headers.get("content-type", "").lower()
                ext = ".pdf"
                if "presentation" in content_type or "powerpoint" in content_type:
                    ext = ".pptx"
                elif "word" in content_type or "document" in content_type:
                    ext = ".docx"
                elif "png" in content_type:
                    ext = ".png"
                elif "jpeg" in content_type or "jpg" in content_type:
                    ext = ".jpg"
                elif "zip" in content_type:
                    ext = ".zip"

                file_path = os.path.join(save_dir, f"{safe_title}{ext}")
                with open(file_path, "wb") as f:
                    f.write(await response.body())

                rel_url = f"/files/{course_code}/{safe_title}{ext}"
                print(f"  [{self.label}] ✅ Saved local file -> {rel_url}")
                return rel_url
        except Exception as e:
            print(f"  [{self.label}] ⚠️ Download skipped for '{title}': {e}")
        return res_url

    async def scrape_all(self) -> list[dict]:
        """Main entry point — returns scraped course data from this Moodle."""
        results = []

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            )
            await self._set_cookie(context)
            page = await context.new_page()

            # Check session validity
            if not await self._is_logged_in(page):
                print(f"  [{self.label}] ⚠️  Session cookie expired! Please refresh it.")
                await browser.close()
                return []

            print(f"  [{self.label}] ✅ Session valid")

            # Get enrolled courses
            courses = await self.get_enrolled_courses(page)

            for course in courses:
                data = await self.scrape_course(page, course["url"], course["name_raw"])
                results.append({
                    "moodle": self.label,
                    "moodle_id": course["moodle_id"],
                    "name_raw": data.get("page_title") or course["name_raw"],
                    "url": course["url"],
                    "resources": data["resources"],
                    "assignments": data["assignments"],
                    "resource_count": len(data["resources"]),
                    "assignment_count": len(data["assignments"]),
                })

            await browser.close()

        return results
