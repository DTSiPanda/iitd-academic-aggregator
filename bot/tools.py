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
        "CVP2401": {"day": "Thursday", "time": "13:00"},
        "CVP2702": {"day": "Thursday", "time": "15:00"},
        "MEP1000": {"day": "Monday",   "time": "09:00"},
    },
    "group2": {
        "CVP2502": {"day": "Tuesday",  "time": "15:00"},
        "CVP2601": {"day": "Thursday", "time": "15:00"},
        "CVP2401": {"day": "Friday",   "time": "13:00"},
        "CVP2702": {"day": "Friday",   "time": "15:00"},
        "MEP1000": {"day": "Monday",   "time": "09:00"},
    },
    "group3": {
        "CVP2401": {"day": "Monday",   "time": "13:00"},
        "CVP2702": {"day": "Monday",   "time": "15:00"},
        "CVP2502": {"day": "Thursday", "time": "15:00"},
        "CVP2601": {"day": "Friday",   "time": "15:00"},
        "MEP1000": {"day": "Thursday", "time": "09:00"},
    },
    "group4": {
        "CVP2601": {"day": "Monday",   "time": "15:00"},
        "CVP2401": {"day": "Tuesday",  "time": "13:00"},
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
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhreXJxdWZidmFpcXJobGprY3VzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTY3MzY0MCwiZXhwIjoyMTAxMjQ5NjQwfQ.jgn76pM-QDaSD0jseu1h_kgZGyL_59_gQH3jh157Ids")

def _load() -> dict:
    with open(OVERRIDES_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


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
        data["cancellations"].append(entry)
        _save(data)
        return f"❌ Noted — {args['course']} on {args['day']} marked as cancelled."

def _fix_year(date_str: str) -> str:
    if not date_str:
        return date_str
    for past in ["2025-", "2024-", "2023-"]:
        if date_str.startswith(past):
            return date_str.replace(past, "2026-", 1)
    return date_str


def execute_tool(tool_name: str, args: dict, user_group: str = "group1") -> str:
    data = _load()

    if tool_name == "cancel_class":
        entry = {
            "course": args["course"],
            "day": args["day"],
            "date": args.get("date"),
            "note": args.get("note", ""),
            "added_at": datetime.now().isoformat()
        }
        data["cancellations"].append(entry)
        _save(data)
        return f"❌ Noted — {args['course']} on {args['day']} marked as cancelled."

    elif tool_name == "override_deadline":
        due_date = _fix_year(args["due_date"])
        entry = {
            "course": args["course"],
            "item": args["item"],
            "due_date": due_date,
            "note": args.get("note", ""),
            "added_at": datetime.now().isoformat()
        }
        data["deadline_overrides"].append(entry)
        _save(data)
        return f"📅 Got it — {args['item']} ({args['course']}) deadline set to {due_date}."

    elif tool_name == "add_exam":
        s_date = _fix_year(args["start_date"])
        e_date = _fix_year(args.get("end_date", s_date))
        # Remove existing exam with same name if present
        data["exams"] = [e for e in data["exams"] if e.get("name") != args["name"]]
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

    elif tool_name == "general_reply":
        return args.get("reply", "Got it!")

    return "Action completed."
