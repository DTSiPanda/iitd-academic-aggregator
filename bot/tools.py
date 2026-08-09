"""
tools.py — Executes tool calls from Gemini and writes to overrides.json.
"""

import json
import os
from datetime import datetime, timedelta

OVERRIDES_PATH = os.path.join(os.path.dirname(__file__), "overrides.json")

# Lab schedule for auto-calculating report deadlines
LAB_GROUP_SCHEDULE = {
    "group1": {
        "CVP2502": {"day": "Monday",   "time": "15:00"},
        "CVP2601": {"day": "Tuesday",  "time": "15:00"},
        "CVP2401": {"day": "Friday",   "time": "14:00"},   # F slot → PF1 (2-4 PM)
        "CVP2702": {"day": "Thursday", "time": "15:00"},
        "MEP1000": {"day": "Monday",   "time": "09:00"},
    },
    "group2": {
        "CVP2502": {"day": "Tuesday",  "time": "15:00"},
        "CVP2601": {"day": "Thursday", "time": "15:00"},
        "CVP2401": {"day": "Monday",   "time": "14:00"},   # F slot → PF2 (2-4 PM)
        "CVP2702": {"day": "Friday",   "time": "15:00"},
        "MEP1000": {"day": "Monday",   "time": "09:00"},
    },
    "group3": {
        "CVP2401": {"day": "Tuesday",  "time": "14:00"},   # F slot → PF3 (2-4 PM)
        "CVP2702": {"day": "Monday",   "time": "15:00"},
        "CVP2502": {"day": "Thursday", "time": "15:00"},
        "CVP2601": {"day": "Friday",   "time": "15:00"},
        "MEP1000": {"day": "Thursday", "time": "09:00"},
    },
    "group4": {
        "CVP2601": {"day": "Monday",   "time": "15:00"},
        "CVP2401": {"day": "Thursday", "time": "14:00"},   # F slot → PF4 (2-4 PM)
        "CVP2702": {"day": "Tuesday",  "time": "15:00"},
        "CVP2502": {"day": "Friday",   "time": "15:00"},
        "MEP1000": {"day": "Thursday", "time": "09:00"},
    },
}

DAY_TO_INT = {
    "Monday": 0, "Tuesday": 1, "Wednesday": 2,
    "Thursday": 3, "Friday": 4, "Saturday": 5, "Sunday": 6
}


from supabase import create_client

PUBLIC_OVERRIDES_PATH = os.path.join(os.path.dirname(__file__), "..", "public", "overrides.json")

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://xkyrqufbvaiqrhljkcus.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

def _load() -> dict:
    """Load overrides — try Supabase first (always fresh), fall back to local file."""
    empty = {"cancellations": [], "deadline_overrides": [], "exams": [], "notes": [], "flagged": [], "lab_done": []}
    try:
        sp = create_client(SUPABASE_URL, SUPABASE_KEY)
        res = sp.table("overrides").select("data").eq("id", "user_overrides").single().execute()
        if res.data and res.data.get("data"):
            return res.data["data"]
    except Exception:
        pass
    # Fall back to local file
    try:
        with open(OVERRIDES_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return empty


def _push_to_supabase(data: dict):
    if not SUPABASE_KEY:
        return
    try:
        sp = create_client(SUPABASE_URL, SUPABASE_KEY)
        sp.table("overrides").upsert({
            "id": "user_overrides",
            "data": data,
            "updated_at": datetime.now().isoformat()
        }).execute()
        sp.table("overrides").upsert({
            "id": "current_overrides",
            "data": data,
            "updated_at": datetime.now().isoformat()
        }).execute()
        print("[bot] Successfully synced overrides -> Supabase DB!")
    except Exception as e:
        print(f"[bot] Supabase sync warning: {e}")


def _save(data: dict):
    content_str = json.dumps(data, indent=2, ensure_ascii=False)
    with open(OVERRIDES_PATH, "w", encoding="utf-8") as f:
        f.write(content_str)
    
    try:
        with open(PUBLIC_OVERRIDES_PATH, "w", encoding="utf-8") as f:
            f.write(content_str)
    except Exception:
        pass

    # Push to Supabase DB (Realtime instant update!)
    _push_to_supabase(data)


def _next_weekday_date(day_name: str, from_date: datetime = None) -> datetime:
    """Return the next occurrence of a given weekday from today (or from_date)."""
    base = from_date or datetime.now()
    target = DAY_TO_INT[day_name]
    current = base.weekday()
    days_ahead = (target - current) % 7
    if days_ahead == 0:
        days_ahead = 7
    return base + timedelta(days=days_ahead)


def _fix_year(date_str: str) -> str:
    """Ensure a date string has the correct current academic year."""
    if not date_str:
        return date_str
    now = datetime.now()
    # Academic year: Aug–Dec = current year, Jan–Jul = current year
    academic_year = str(now.year)
    # Replace clearly wrong past years (anything 2+ years ago)
    for past_year in [str(now.year - 2), str(now.year - 3), str(now.year - 4)]:
        if date_str.startswith(past_year + '-'):
            return date_str.replace(past_year + '-', academic_year + '-', 1)
    return date_str


def execute_tool(tool_name: str, args: dict, user_group: str = "group1") -> str:
    """Execute a tool call and write result to overrides.json. Returns human-readable confirmation."""
    data = _load()

    if tool_name == "cancel_class":
        entry = {
            "course": args["course"],
            "day": args["day"],
            "date": args.get("date"),
            "note": args.get("note", ""),
            "added_at": datetime.now().isoformat()
        }
        # Deduplicate by (course, day)
        data["cancellations"] = [c for c in data["cancellations"]
                                  if not (c["course"] == entry["course"] and c["day"] == entry["day"])]
        data["cancellations"].append(entry)
        _save(data)
        return f"❌ Noted — {args['course']} on {args['day']} marked as cancelled."

    elif tool_name == "override_deadline":
        due_date = _fix_year(args.get("due_date"))
        scope = args.get("scope", "wholeclass")
        course = args["course"]
        group_deadlines = {}

        if scope == "groupwise" or course.startswith("CVP") or (course == "MEP1000" and "lab" in args.get("item","").lower()):
            scope = "groupwise"
            for g_id in ["group1", "group2", "group3", "group4"]:
                info = LAB_GROUP_SCHEDULE.get(g_id, {}).get(course)
                if info:
                    next_lab = _next_weekday_date(info["day"])
                    h, m = map(int, info["time"].split(":"))
                    dt = next_lab.replace(hour=h, minute=m, second=0)
                    group_deadlines[g_id] = dt.strftime("%Y-%m-%dT%H:%M:00")

            if not due_date and user_group in group_deadlines:
                due_date = group_deadlines[user_group]
            elif not due_date:
                due_date = datetime.now().strftime("%Y-%m-%dT17:00:00")

            scope_label = "Groupwise (Calculated for All Groups 1-4)"
        else:
            due_date = due_date or datetime.now().strftime("%Y-%m-%dT17:00:00")
            scope_label = "Whole Class"

        entry = {
            "course": course,
            "item": args["item"],
            "due_date": due_date,
            "scope": scope,
            "group_deadlines": group_deadlines if scope == "groupwise" else {},
            "note": args.get("note", ""),
            "added_at": datetime.now().isoformat()
        }
        # Deduplicate by (course, item) — update existing instead of stacking
        data["deadline_overrides"] = [d for d in data["deadline_overrides"]
                                       if not (d["course"] == entry["course"] and
                                               d["item"].lower() == entry["item"].lower())]
        data["deadline_overrides"].append(entry)
        _save(data)
        return f"📅 Got it — {args['item']} ({course}) deadline set ({scope_label})."

    elif tool_name == "add_exam":
        s_date = _fix_year(args["start_date"])
        e_date = _fix_year(args.get("end_date", s_date))
        # Deduplicate case-insensitively by name
        data["exams"] = [e for e in data["exams"] if e.get("name", "").lower() != args["name"].lower()]
        entry = {
            "name": args["name"],
            "start_date": s_date,
            "end_date": e_date,
            "courses": args.get("courses", []),
            "note": args.get("note", ""),
            "added_at": datetime.now().isoformat()
        }
        data["exams"].append(entry)
        _save(data)
        courses_txt = f" ({', '.join(args['courses'])})" if args.get("courses") else ""
        return f"📝 Exam added — {args['name']}{courses_txt}: {s_date} → {e_date}."

    elif tool_name == "add_note":
        entry = {
            "course": args["course"],
            "text": args["text"],
            "priority": args.get("priority", "medium"),
            "added_at": datetime.now().isoformat()
        }
        # Deduplicate by (course, text)
        data["notes"] = [n for n in data["notes"]
                         if not (n["course"] == entry["course"] and
                                 n["text"].lower() == entry["text"].lower())]
        data["notes"].append(entry)
        _save(data)
        priority_emoji = {"high": "🔴", "medium": "🟡", "low": "🔵"}.get(args.get("priority", "medium"), "🟡")
        return f"{priority_emoji} Note saved for {args['course']}: \"{args['text']}\""

    elif tool_name == "flag_resource":
        entry = {
            "course": args["course"],
            "title": args["title"],
            "reason": args.get("reason", ""),
            "added_at": datetime.now().isoformat()
        }
        data["flagged"].append(entry)
        _save(data)
        return f"⭐ Flagged \"{args['title']}\" ({args['course']}): {args.get('reason', '')}"

    elif tool_name == "mark_lab_done":
        course = args["course"]
        done_date_str = args.get("done_date", datetime.now().strftime("%Y-%m-%d"))
        done_date = datetime.strptime(done_date_str, "%Y-%m-%d")

        # Calculate next lab session for this group
        lab_info = LAB_GROUP_SCHEDULE.get(user_group, {}).get(course)
        if lab_info:
            next_lab = _next_weekday_date(lab_info["day"], done_date)
            h, m = map(int, lab_info["time"].split(":"))
            due_dt = next_lab.replace(hour=h, minute=m, second=0)
            due_str = due_dt.strftime("%Y-%m-%dT%H:%M:00")
            report_item = f"Lab Report — {args.get('experiment', 'Experiment')}"

            # Add as deadline override
            data["deadline_overrides"].append({
                "course": course,
                "item": report_item,
                "due_date": due_str,
                "note": f"Auto-calculated: next {lab_info['day']} at {lab_info['time']}",
                "added_at": datetime.now().isoformat()
            })
            data["lab_done"].append({
                "course": course,
                "experiment": args.get("experiment", ""),
                "done_date": done_date_str,
                "report_due": due_str
            })
            _save(data)
            return (
                f"✅ Lab done logged — {course} ({args.get('experiment', '')})\n"
                f"📋 Report due: {next_lab.strftime('%A %d %b')} at {lab_info['time']} IST"
            )
        else:
            return f"✅ Lab done logged for {course}. (Could not auto-calculate deadline — group not set)"

    elif tool_name == "remove_override":
        category = args.get("category", "any")
        course = args.get("course", "").upper().strip()
        query = args.get("query", "").lower().strip()

        removed_count = 0
        removed_items = []

        # Deadlines
        if category in ["any", "deadlines", "deadline_overrides", "all"]:
            kept = []
            for d in data.get("deadline_overrides", []):
                match = True
                if course and d.get("course", "").upper() != course:
                    match = False
                if query and query not in d.get("item", "").lower() and query not in d.get("note", "").lower():
                    match = False
                if match and (course or query or category != "any"):
                    removed_count += 1
                    removed_items.append(f"Deadline: {d['course']} — {d['item']}")
                else:
                    kept.append(d)
            data["deadline_overrides"] = kept

        # Exams
        if category in ["any", "exams", "all"]:
            kept = []
            for e in data.get("exams", []):
                match = True
                if course and course not in [c.upper() for c in e.get("courses", [])]:
                    match = False
                if query and query not in e.get("name", "").lower() and query not in e.get("note", "").lower():
                    match = False
                if match and (course or query or category != "any"):
                    removed_count += 1
                    removed_items.append(f"Exam: {e['name']}")
                else:
                    kept.append(e)
            data["exams"] = kept

        # Notes
        if category in ["any", "notes", "all"]:
            kept = []
            for n in data.get("notes", []):
                match = True
                if course and n.get("course", "").upper() != course:
                    match = False
                if query and query not in n.get("text", "").lower():
                    match = False
                if match and (course or query or category != "any"):
                    removed_count += 1
                    removed_items.append(f"Note: {n['course']} — {n['text'][:30]}")
                else:
                    kept.append(n)
            data["notes"] = kept

        # Cancellations
        if category in ["any", "cancellations", "all"]:
            kept = []
            for c in data.get("cancellations", []):
                match = True
                if course and c.get("course", "").upper() != course:
                    match = False
                if query and query not in c.get("day", "").lower() and query not in c.get("note", "").lower():
                    match = False
                if match and (course or query or category != "any"):
                    removed_count += 1
                    removed_items.append(f"Cancellation: {c['course']} {c['day']}")
                else:
                    kept.append(c)
            data["cancellations"] = kept

        # Lab done
        if category in ["any", "lab_done", "all"]:
            kept = []
            for l in data.get("lab_done", []):
                match = True
                if course and l.get("course", "").upper() != course:
                    match = False
                if query and query not in l.get("experiment", "").lower():
                    match = False
                if match and (course or query or category != "any"):
                    removed_count += 1
                    removed_items.append(f"Lab: {l['course']} {l.get('experiment', '')}")
                else:
                    kept.append(l)
            data["lab_done"] = kept

        _save(data)
        if removed_count > 0:
            return f"🗑️ Removed {removed_count} item(s):\n• " + "\n• ".join(removed_items)
        return "No matching override found to remove."

    elif tool_name == "general_reply":
        return args.get("reply", "Got it!")

    return "Action completed."
