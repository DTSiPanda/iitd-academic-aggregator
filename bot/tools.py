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


import base64
import requests

PUBLIC_OVERRIDES_PATH = os.path.join(os.path.dirname(__file__), "..", "public", "overrides.json")

def _load() -> dict:
    with open(OVERRIDES_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _push_to_github_api(content_str: str):
    token = os.getenv("GITHUB_TOKEN")
    repo  = os.getenv("GITHUB_REPO", "DTSiPanda/iitd-academic-aggregator")
    if not token:
        return

    url = f"https://api.github.com/repos/{repo}/contents/public/overrides.json"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json",
    }

    try:
        # Get existing file sha
        sha = None
        get_res = requests.get(url, headers=headers)
        if get_res.status_code == 200:
            sha = get_res.json().get("sha")

        encoded_content = base64.b64encode(content_str.encode("utf-8")).decode("utf-8")
        payload = {
            "message": "auto: update overrides via Telegram bot",
            "content": encoded_content,
            "branch": "main",
        }
        if sha:
            payload["sha"] = sha

        put_res = requests.put(url, headers=headers, json=payload)
        if put_res.status_code in (200, 201):
            print("[bot] Successfully synced overrides.json -> GitHub Repo!")
        else:
            print(f"[bot] GitHub API sync failed: {put_res.status_code} {put_res.text}")
    except Exception as e:
        print(f"[bot] Exception during GitHub API sync: {e}")


def _trigger_vercel_deploy():
    hook_url = os.getenv("VERCEL_DEPLOY_HOOK")
    if hook_url:
        try:
            requests.post(hook_url)
            print("[bot] Triggered Vercel Deploy Hook!")
        except Exception as e:
            print(f"[bot] Deploy hook error: {e}")


def _save(data: dict):
    content_str = json.dumps(data, indent=2, ensure_ascii=False)
    with open(OVERRIDES_PATH, "w", encoding="utf-8") as f:
        f.write(content_str)
    
    # Also write to public/ overrides for local dev
    try:
        with open(PUBLIC_OVERRIDES_PATH, "w", encoding="utf-8") as f:
            f.write(content_str)
    except Exception:
        pass

    # Push to GitHub API so Vercel & Raw GitHub content get updated immediately
    _push_to_github_api(content_str)
    _trigger_vercel_deploy()


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

    elif tool_name == "override_deadline":
        entry = {
            "course": args["course"],
            "item": args["item"],
            "due_date": args["due_date"],
            "note": args.get("note", ""),
            "added_at": datetime.now().isoformat()
        }
        data["deadline_overrides"].append(entry)
        _save(data)
        return f"📅 Got it — {args['item']} ({args['course']}) deadline set to {args['due_date']}."

    elif tool_name == "add_exam":
        # Remove existing exam with same name if present
        data["exams"] = [e for e in data["exams"] if e.get("name") != args["name"]]
        entry = {
            "name": args["name"],
            "start_date": args["start_date"],
            "end_date": args["end_date"],
            "courses": args.get("courses", []),
            "note": args.get("note", ""),
            "added_at": datetime.now().isoformat()
        }
        data["exams"].append(entry)
        _save(data)
        return f"📝 Exam added — {args['name']}: {args['start_date']} → {args['end_date']}."

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
