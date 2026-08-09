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

KNOWN_COURSES = {
    "CVL1301": "Surveying & Remote Sensing",
    "CVL2001": "Climate Change & Adaptation",
    "CVL2401": "Geological Engineering",
    "CVL2502": "Analysis of Determinate Structures",
    "CVL2601": "Traffic & Transportation Planning",
    "CVL2702": "Hydraulics",
    "CVP2401": "Geological Engineering Lab",
    "CVP2502": "Solid Mechanics & Structural Lab",
    "CVP2601": "Traffic & Transport Planning Lab",
    "CVP2702": "Fluid Mechanics & Hydraulics Lab",
    "MEP1000": "Introduction to Engineering Systems",
}

COURSE_NAME_MAP = {
    "ANALYSIS OF DETERMINATE STRUCTURES":               "CVL2502",
    "CLIMATE CHANGE AND ADAPTATION":                    "CVL2001",
    "ENGINEERING VISUALIZATION":                        "MEP1000",
    "INTRODUCTION TO ENGINEERING SYSTEMS":              "MEP1000",
    "FLUID MECHANICS AND HYDRAULICS LAB":               "CVP2702",
    "GEOLOGICAL ENGINEERING LAB":                       "CVP2401",
    "GEOLOGICAL ENGINEERING":                           "CVL2401",
    "HYDRAULICS":                                       "CVL2702",
    "SOLID MECHANICS AND STRUCTURAL ANALYSIS LABORATORY": "CVP2502",
    "SOLID MECHANICS AND STRUCTURAL ANALYSIS":          "CVP2502",
    "SURVEYING AND REMOTE SENSING":                     "CVL1301",
    "TRAFFIC AND TRANSPORTATION PLANNING":              "CVL2601",
    "TRAFFIC ENGINEERING AND TRANSPORTATION PLANNING LABORATORY": "CVP2601",
    "TRAFFIC ENGINEERING AND TRANSPORTATION PLANNING":  "CVP2601",
}

def detect_course_code(name: str) -> str | None:
    if not name:
        return None
    name_upper = name.upper().strip()
    for code in KNOWN_COURSES:
        if code in name_upper:
            return code
    for phrase, code in COURSE_NAME_MAP.items():
        if phrase in name_upper:
            return code
    return None


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
        """Auto-login using KERBEROS_ID / KERBEROS_USER & KERBEROS_PASS with captcha solving and retries."""
        user = os.environ.get("KERBEROS_USER", "").strip() or os.environ.get("KERBEROS_ID", "").strip()
        password = os.environ.get("KERBEROS_PASS", "").strip()
        if not user or not password:
            print(f"  [{self.label}] ⚠️ Session expired and KERBEROS_ID/KERBEROS_PASS not set in .env")
            return False

        print(f"  [{self.label}] 🔑 Attempting auto-login for user '{user}'...")
        for attempt in range(1, 4):
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
                        # Find captcha input field
                        captcha_inp = await page.query_selector(
                            "#valuepkg3, input[name='valuepkg3'], input[name*='valuepkg'], input[name*='captcha'], input[type='text']:not([name='username'])"
                        )
                        if captcha_inp:
                            await captcha_inp.fill(captcha_ans)
                            print(f"  [{self.label}] 🧩 (Attempt {attempt}) Captcha solved: {captcha_ans}")

                # Click login button
                await page.click("#loginbtn, button#loginbtn, input[type='submit']")
                await page.wait_for_load_state("networkidle", timeout=30000)

                if "login" not in page.url:
                    print(f"  [{self.label}] 🎉 Auto-login successful on attempt {attempt}!")
                    return True
                else:
                    print(f"  [{self.label}] ⚠️ Auto-login attempt {attempt} did not complete, retrying...")
                    await page.wait_for_timeout(1000)
            except Exception as e:
                print(f"  [{self.label}] ⚠️ Auto-login attempt {attempt} exception: {e}")
                await page.wait_for_timeout(1000)

        print(f"  [{self.label}] ❌ Auto-login failed after 3 attempts.")
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

    async def _clean_title(self, el) -> str:
        """Extract and clean title from an activity link/container."""
        title = ""
        # Try aria-label first
        aria = (await el.get_attribute("aria-label") or "").strip()
        if aria:
            title = aria
        else:
            # Try instancename or activityname child
            title_el = await el.query_selector(".instancename, .activityname")
            if title_el:
                title = (await title_el.inner_text()).strip()
            else:
                title = (await el.inner_text()).strip()

        # Remove common Moodle type suffixes & noise
        noise_patterns = [
            r"\s*File$", r"\s*URL$", r"\s*Page$", r"\s*Folder$",
            r"\s*Assignment$", r"\s*Quiz$", r"\s*Forum$", r"\s*Announcement$",
            r"\s*External tool$", r"\s*Document$", r"\s*PDF document$",
            r"^Course name\s*", r"^Course image\s*"
        ]
        for pat in noise_patterns:
            title = re.sub(pat, "", title, flags=re.IGNORECASE).strip()

        # Remove excess internal whitespace/newlines
        title = re.sub(r"\s+", " ", title).strip()
        return title

    async def scrape_course(self, page: Page, context: BrowserContext, course_url: str, course_name: str) -> dict:
        """Scrape a single course page for files, folders, urls, assignments, and quizzes."""
        print(f"  [{self.label}] Scraping: {course_name}")
        result = {"resources": [], "assignments": [], "page_title": ""}

        course_code = detect_course_code(course_name) or "general"

        try:
            await page.goto(course_url, wait_until="domcontentloaded", timeout=35000)

            # Expand all collapsed sections in modern Moodle / moodlenew
            try:
                expand_btns = await page.query_selector_all(
                    "[data-action='expand-all'], .expandall, .collapse-all-sections a, "
                    "button.section-toggle, [aria-expanded='false']"
                )
                for btn in expand_btns:
                    try:
                        await btn.click(timeout=800)
                    except Exception:
                        pass
                await page.wait_for_timeout(800)
            except Exception:
                pass

            # If course name is unknown, extract it from the page heading
            if not course_name:
                for sel in ["h1", ".page-header-headings h1", ".course-fullname", ".coursename"]:
                    h1 = await page.query_selector(sel)
                    if h1:
                        resolved = (await h1.inner_text()).strip()
                        if resolved and "course image" not in resolved.lower():
                            result["page_title"] = resolved
                            course_name = resolved
                            course_code = detect_course_code(course_name) or "general"
                            print(f"  [{self.label}]   name from page: {course_name}")
                            break

            # Find all activity links and content links across the page
            link_els = await page.query_selector_all(
                "a[href*='/mod/resource/view.php'], "
                "a[href*='/mod/folder/view.php'], "
                "a[href*='/mod/url/view.php'], "
                "a[href*='/mod/page/view.php'], "
                "a[href*='/mod/assign/view.php'], "
                "a[href*='/mod/quiz/view.php'], "
                "a[href*='pluginfile.php'], "
                "a[href*='drive.google.com'], "
                "a[href*='onedrive.live.com'], "
                "a[href*='1drv.ms'], "
                "a[href*='dropbox.com'], "
                ".activity-item a.aal_link, "
                ".activityinstance a, "
                ".activity-basis a"
            )

            seen_urls = set()
            collected_resources = []
            collected_assignments = []

            # First pass: collect metadata from DOM before doing any async downloads/navigations
            for el in link_els:
                try:
                    href = await el.get_attribute("href")
                    if not href or href.startswith("#") or href.startswith("javascript:"):
                        continue

                    full_url = href if href.startswith("http") else self.base_url + href
                    if full_url in seen_urls:
                        continue
                    seen_urls.add(full_url)

                    title = await self._clean_title(el)
                    if not title or len(title) < 2:
                        continue

                    # Filter out navigation links
                    lower_url = full_url.lower()
                    if any(skip in lower_url for skip in ["/user/", "/grade/", "/message/", "/calendar/", "/badges/", "/participants"]):
                        continue

                    # Classify link type
                    if "/mod/assign/" in lower_url:
                        collected_assignments.append({"title": title, "url": full_url, "type": "assignment"})
                    elif "/mod/quiz/" in lower_url:
                        collected_assignments.append({"title": title, "url": full_url, "type": "quiz"})
                    elif "/mod/resource/" in lower_url or "pluginfile.php" in lower_url:
                        collected_resources.append({"title": title, "url": full_url, "type": "file"})
                    elif "/mod/folder/" in lower_url:
                        collected_resources.append({"title": title, "url": full_url, "type": "folder"})
                    elif "/mod/url/" in lower_url or "drive.google" in lower_url or "onedrive" in lower_url or "dropbox" in lower_url or "/mod/page/" in lower_url:
                        collected_resources.append({"title": title, "url": full_url, "type": "url"})
                    elif any(lower_url.endswith(ext) for ext in [".pdf", ".pptx", ".docx", ".zip", ".xlsx", ".dwg", ".dxf", ".ipt"]):
                        collected_resources.append({"title": title, "url": full_url, "type": "file"})
                except Exception:
                    continue
            # Second pass: Process resources and unpack folder activities
            folder_urls_to_unpack = []
            for res in collected_resources:
                try:
                    if res["type"] == "folder":
                        folder_urls_to_unpack.append(res)
                    elif res["type"] == "file":
                        local_file_url = await self._download_resource_file(page, course_code, res["title"], res["url"])
                        result["resources"].append({
                            "title": res["title"],
                            "url": local_file_url,
                            "type": "file",
                            "uploaded_at": None,
                        })
                    else:
                        result["resources"].append({
                            "title": res["title"],
                            "url": res["url"],
                            "type": res["type"],
                            "uploaded_at": None,
                        })
                except Exception as ex:
                    print(f"  [{self.label}] ⚠️ Resource error: {ex}")
                    continue

            # Unpack files inside folders using a secondary page
            if folder_urls_to_unpack:
                folder_page = await context.new_page()
                try:
                    for fld in folder_urls_to_unpack:
                        try:
                            unpacked_files = await self._extract_folder_files(folder_page, fld["url"], fld["title"], course_code)
                            if unpacked_files:
                                result["resources"].extend(unpacked_files)
                            else:
                                # Keep folder URL as fallback
                                result["resources"].append({
                                    "title": fld["title"],
                                    "url": fld["url"],
                                    "type": "url",
                                    "uploaded_at": None,
                                })
                        except Exception:
                            result["resources"].append({
                                "title": fld["title"],
                                "url": fld["url"],
                                "type": "url",
                                "uploaded_at": None,
                            })
                finally:
                    await folder_page.close()

            # Third pass: Process assignments and quizzes using a secondary page (avoids destroying main DOM)
            if collected_assignments:
                detail_page = await context.new_page()
                try:
                    for a in collected_assignments:
                        try:
                            due_date = await self._get_item_due_date(detail_page, a["url"], a["type"])
                            result["assignments"].append({
                                "title": a["title"],
                                "url": a["url"],
                                "due_date": due_date,
                            })
                        except Exception:
                            result["assignments"].append({
                                "title": a["title"],
                                "url": a["url"],
                                "due_date": None,
                            })
                finally:
                    await detail_page.close()

        except Exception as e:
            print(f"  [{self.label}] Error scraping {course_name}: {e}")

        print(f"  [{self.label}]   → {len(result['resources'])} resources, {len(result['assignments'])} assignments")
        return result

    async def _extract_folder_files(self, page: Page, folder_url: str, folder_title: str, course_code: str) -> list[dict]:
        """Inspect a Moodle folder activity to extract individual downloadable files."""
        files = []
        try:
            await page.goto(folder_url, wait_until="domcontentloaded", timeout=20000)
            file_links = await page.query_selector_all(".fp-filename-icon a, span.fp-filename a, a[href*='pluginfile.php']")
            seen_furls = set()
            for flink in file_links:
                href = await flink.get_attribute("href")
                if not href or href.startswith("#") or href in seen_furls:
                    continue
                seen_furls.add(href)
                fname = (await flink.inner_text()).strip()
                if not fname:
                    fname = re.sub(r"\?.*$", "", href).split("/")[-1]
                full_furl = href if href.startswith("http") else self.base_url + href
                title = f"{folder_title} — {fname}" if folder_title.lower() not in fname.lower() else fname
                local_file = await self._download_resource_file(page, course_code, title, full_furl)
                files.append({
                    "title": title,
                    "url": local_file,
                    "type": "file",
                    "uploaded_at": None,
                })
        except Exception as e:
            print(f"  [{self.label}] ⚠️ Error inspecting folder {folder_url}: {e}")
        return files

    async def _get_item_due_date(self, page: Page, item_url: str, item_type: str = "assignment") -> str | None:
        """Navigate to an assignment or quiz page and extract the due date."""
        try:
            await page.goto(item_url, wait_until="domcontentloaded", timeout=18000)

            # Look in tables or text blocks for due date / close date
            rows = await page.query_selector_all("tr, .activity-information, [data-region='activity-dates']")
            for row in rows:
                text = (await row.inner_text()).lower()
                if "due" in text or "close" in text or "closes" in text:
                    # Look for date value
                    val_el = await row.query_selector("td.cell.c1, td:last-child, .text-muted, div:last-child")
                    if val_el:
                        val_text = (await val_el.inner_text()).strip()
                        if val_text and len(val_text) > 4:
                            return val_text
                    return text.strip()
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

            # Check if file already exists with any known extension
            known_exts = [".pdf", ".pptx", ".docx", ".doc", ".zip", ".png", ".jpg", ".dwg", ".dxf", ".ipt", ".iam", ".idw", ".xlsx", ".rar", ".7z"]
            for ext in known_exts:
                existing_path = os.path.join(save_dir, f"{safe_title}{ext}")
                if os.path.exists(existing_path):
                    return f"/files/{course_code}/{safe_title}{ext}"

            print(f"  [{self.label}] 📥 Downloading file: {title}...")
            response = await page.request.get(res_url, timeout=25000)
            if response.status == 200:
                content_type = response.headers.get("content-type", "").lower()
                cd = response.headers.get("content-disposition", "")
                ext = ".pdf"

                # Check filename from Content-Disposition header first
                if "filename=" in cd:
                    match = re.search(r'filename=["\']?([^"\';]+)["\']?', cd)
                    if match:
                        orig_ext = os.path.splitext(match.group(1).strip())[1].lower()
                        if orig_ext and len(orig_ext) <= 6:
                            ext = orig_ext

                if ext == ".pdf":
                    if "presentation" in content_type or "powerpoint" in content_type or "pptx" in content_type:
                        ext = ".pptx"
                    elif "word" in content_type or "document" in content_type or "docx" in content_type:
                        ext = ".docx"
                    elif "png" in content_type:
                        ext = ".png"
                    elif "jpeg" in content_type or "jpg" in content_type:
                        ext = ".jpg"
                    elif "zip" in content_type:
                        ext = ".zip"
                    elif "dwg" in content_type or "autocad" in content_type:
                        ext = ".dwg"
                    elif "dxf" in content_type:
                        ext = ".dxf"
                    elif "excel" in content_type or "spreadsheet" in content_type or "xlsx" in content_type:
                        ext = ".xlsx"

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
                data = await self.scrape_course(page, context, course["url"], course["name_raw"])
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
