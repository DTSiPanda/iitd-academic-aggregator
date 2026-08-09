"""
normalize.py — Merges scraper output from both Moodles into a single data.json.

Key logic:
- For each course (matched by name/code), picks the Moodle with MORE content
- Deduplicates resources by title
- Marks items as is_new if they weren't in the previous data.json
"""

import json
import os
import re
from datetime import datetime, timezone


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

COURSE_COLORS = {
    "CVL1301": "#6366f1",
    "CVL2001": "#10b981",
    "CVL2401": "#f59e0b",
    "CVL2502": "#3b82f6",
    "CVL2601": "#ef4444",
    "CVL2702": "#8b5cf6",
    "CVP2401": "#f97316",
    "CVP2502": "#06b6d4",
    "CVP2601": "#84cc16",
    "CVP2702": "#ec4899",
    "MEP1000": "#14b8a6",
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
    """Try to find a known course code in the raw course name string.
    First checks for explicit code (e.g. CVL2502), then falls back to
    full-name matching for moodlenew courses that omit the code.
    """
    name_upper = name.upper().strip()
    # 1. Code-based match (e.g. "2601-CVL2502A ANALYSIS...")
    for code in KNOWN_COURSES:
        if code in name_upper:
            return code
    # 2. Name-based match for moodlenew plain-English titles
    for phrase, code in COURSE_NAME_MAP.items():
        if phrase in name_upper:
            return code
    return None


def classify_item(title: str, item_type: str = "file") -> str:
    """Classify a resource into one of 4 categories:
    'lab'      -> Lab manuals, reports, lab sheets, experiment handouts
    'tutorial' -> Tutorial sheets, problem sets, homework, assignments
    'lecture'  -> Lecture slides, course notes, readings, syllabus
    'notice'   -> Seatings, venue notices, marks lists, group lists (administrative noise)
    """
    t = title.lower()

    # 1. Administrative noise / notices
    notice_keywords = ["seating", "venue notice", "group list", "quiz seating", "marks", "grade", "notice", "cancelled", "suspension"]
    for kw in notice_keywords:
        if kw in t:
            return "notice"

    # 2. Lab manuals & lab worksheets
    lab_keywords = ["lab", "manual", "exp ", "experiment", "worksheet", "handout", "taz2010", "grid sheet"]
    for kw in lab_keywords:
        if kw in t:
            return "lab"

    # 3. Tutorial sheets & problem sets
    tut_keywords = ["tut", "tutorial", "problem set", "assignment", "sheet", "hw", "homework"]
    for kw in tut_keywords:
        if kw in t:
            return "tutorial"

    # 4. Core study materials / lecture slides (default)
    return "lecture"


def get_lab_group_deadlines(course_code: str, lab_schedules: dict) -> dict[str, str]:
    """Map each lab group (group1, group2, group3, group4) to their scheduled lab day/time string."""
    deadlines = {}
    if not lab_schedules:
        return deadlines
    for group_id, slots in lab_schedules.items():
        for slot in slots:
            if slot.get("course") == course_code:
                deadlines[group_id] = f"{slot.get('day')} at {slot.get('time')}"
    return deadlines





def parse_moodle_date(date_str: str | None) -> str | None:
    """Convert Moodle date strings to ISO 8601 UTC format."""
    if not date_str:
        return None
    # Moodle typically outputs: "Sunday, 7 August 2026, 11:59 PM"
    # or "7 August 2026, 11:59 PM" etc.
    formats = [
        "%A, %d %B %Y, %I:%M %p",
        "%d %B %Y, %I:%M %p",
        "%A, %d %B %Y, %H:%M",
        "%d %B %Y, %H:%M",
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(date_str.strip(), fmt)
            # Treat as IST (UTC+5:30) and convert to UTC
            from datetime import timedelta
            dt_utc = dt - timedelta(hours=5, minutes=30)
            return dt_utc.replace(tzinfo=timezone.utc).isoformat()
        except ValueError:
            continue
    return None


def load_previous_data(data_json_path: str) -> dict:
    """Load existing data.json to detect newly added items."""
    if not os.path.exists(data_json_path):
        return {}
    with open(data_json_path, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except Exception:
            return {}


def get_previous_resource_titles(prev_data: dict, course_id: str) -> set:
    """Get set of resource titles already in previous data.json for a course."""
    for course in prev_data.get("courses", []):
        if course.get("id") == course_id:
            return {item["title"] for item in course.get("new_items", [])}
    return set()


def get_previous_assignment_titles(prev_data: dict, course_id: str) -> set:
    for course in prev_data.get("courses", []):
        if course.get("id") == course_id:
            return {a["title"] for a in course.get("assignments", [])}
    return set()


def merge(old_results: list, new_results: list, data_json_path: str) -> dict:
    """
    Merge results from both Moodles into a single normalized payload.
    For each course, pick the Moodle with more content (auto-detect active one).
    """
    prev_data = load_previous_data(data_json_path)
    now = datetime.now(timezone.utc).isoformat()
    lab_schedules, lecture_schedule, semester_timeline = load_lab_schedules()

    # Safety guard logic removed from here, moving it to after merging courses

    # Group all scraped courses by detected course code
    by_code: dict[str, list] = {}
    for entry in (old_results + new_results):
        code = detect_course_code(entry.get("name_raw", ""))
        if code:
            by_code.setdefault(code, []).append(entry)
        else:
            # Unknown course — skip
            pass

    courses_out = []
    for code, entries in by_code.items():
        # Pick the entry with the most content (active Moodle)
        best = max(entries, key=lambda e: e["resource_count"] + e["assignment_count"] * 2)

        prev_res_titles = get_previous_resource_titles(prev_data, code)
        prev_assign_titles = get_previous_assignment_titles(prev_data, code)

        # Build resource list — deduplicate by title
        seen_titles = set()
        resources_out = []
        for res in best.get("resources", []):
            t = res["title"]
            if t in seen_titles:
                continue
            seen_titles.add(t)
            is_new = t not in prev_res_titles
            category = classify_item(t, res.get("type", "file"))
            
            # Calculate group deadlines for lab items
            group_deadlines = {}
            if category == "lab":
                group_deadlines = get_lab_group_deadlines(code, lab_schedules)

            resources_out.append({
                "type": res.get("type", "file"),
                "title": t,
                "url": res["url"],
                "category": category,
                "group_deadlines": group_deadlines,
                "uploaded_at": res.get("uploaded_at") or now,
                "is_new": is_new,
            })

        # Sort: newest first
        resources_out.sort(key=lambda x: x["uploaded_at"], reverse=True)

        # Build assignments list
        assignments_out = []
        seen_assign = set()
        for a in best.get("assignments", []):
            t = a["title"]
            if t in seen_assign:
                continue
            seen_assign.add(t)
            due_iso = parse_moodle_date(a.get("due_date"))
            assignments_out.append({
                "title": t,
                "url": a["url"],
                "due_date": due_iso,
                "due_date_raw": a.get("due_date"),
                "is_new": t not in prev_assign_titles,
            })

        # Sort: soonest due first
        assignments_out.sort(
            key=lambda x: x["due_date"] or "9999",
        )

        static_meta = STATIC_COURSES_META.get(code, {})
        courses_out.append({
            "id": code,
            "name": KNOWN_COURSES.get(code, best["name_raw"]),
            "moodle": best["moodle"],
            "color": COURSE_COLORS.get(code, "#6366f1"),
            "url": best["url"],
            "instructor": static_meta.get("instructor"),
            "credits": static_meta.get("credits"),
            "venue": static_meta.get("venue"),
            "new_items": resources_out,
            "assignments": assignments_out,
        })

    prev_course_count = len(prev_data.get('courses', []))
    new_course_count = len(courses_out)
    # If we got significantly fewer courses than before, keep existing data to avoid wipe
    if prev_course_count > 0 and new_course_count < prev_course_count * 0.5:
        print(f"[SAFETY] Scraper returned only {new_course_count}/{prev_course_count} courses. Preserving existing data.")
        return prev_data

    return {
        "last_updated": now,
        "courses": courses_out,
        "lab_schedules": lab_schedules,
        "lecture_schedule": lecture_schedule,
        "semester_timeline": semester_timeline,
    }


STATIC_COURSES_META: dict[str, dict] = {}

def load_lab_schedules() -> tuple[dict, dict, dict]:
    """Load the manually maintained lab, lecture schedules, and semester_timeline."""
    global STATIC_COURSES_META
    schedule_path = os.path.join(
        os.path.dirname(__file__), "..", "public", "schedules.json"
    )
    if os.path.exists(schedule_path):
        with open(schedule_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            for c in data.get("courses", []):
                STATIC_COURSES_META[c["id"]] = c
            return data.get("lab_groups", {}), data.get("lecture_schedule", {}), data.get("semester_timeline", {})
    return {}, {}, {}


def write_data_json(payload: dict, output_path: str):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    print(f"\n[+] data.json written -> {output_path}")
    print(f"   Courses: {len(payload['courses'])}")
    print(f"   Last updated: {payload['last_updated']}")

    # Push to Supabase DB if credentials are present
    sp_url = os.getenv("SUPABASE_URL", "https://xkyrqufbvaiqrhljkcus.supabase.co")
    sp_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if sp_key:
        try:
            from supabase import create_client
            sp = create_client(sp_url, sp_key)
            sp.table("moodle_data").upsert({
                "id": "current_data",
                "data": payload,
                "updated_at": datetime.now().isoformat()
            }).execute()
            print("   [+] Successfully synced moodle_data -> Supabase DB!")
        except Exception as e:
            print(f"   [!] Supabase sync warning: {e}")
