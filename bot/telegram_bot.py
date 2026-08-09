"""
telegram_bot.py — Personal Telegram bot for manual academic intelligence.

Run: python bot/telegram_bot.py

Commands:
  /start   — Welcome + set your lab group
  /week    — Show this week's schedule
  /due     — Show upcoming deadlines
  /new     — Show latest Moodle uploads
  /sync    — Trigger a Moodle scrape
  /clear   — Clear a specific override (interactive)

Or just message naturally:
  "Hydraulics cancelled Wednesday"
  "Minor 1 is Sep 15 to Sep 20"
  "Lab report for CVP2401 due Friday"
  "Prof said chapter 3 is out of syllabus"
"""

import os
import json
import logging
import requests
from datetime import datetime
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application, CommandHandler, MessageHandler,
    CallbackQueryHandler, ContextTypes, filters
)
from dotenv import load_dotenv
from llm_processor import process_message
from tools import execute_tool, PUBLIC_OVERRIDES_PATH, _push_to_supabase

load_dotenv()

TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
OWNER_ID = int(os.environ["TELEGRAM_OWNER_ID"])  # Always has access
OVERRIDES_PATH = os.path.join(os.path.dirname(__file__), "overrides.json")
DATA_JSON_PATH = os.path.join(os.path.dirname(__file__), "..", "public", "data.json")
SCHEDULES_PATH = os.path.join(os.path.dirname(__file__), "..", "lab_schedules", "schedules.json")

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://xkyrqufbvaiqrhljkcus.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

# --- Auth cache: reload from Supabase at most every 5 minutes ---
_auth_cache: set[int] = {OWNER_ID}
_auth_cache_time: float = 0.0
_AUTH_TTL = 300  # seconds

def _get_allowed_ids() -> set[int]:
    """Return the set of authorized Telegram IDs, refreshed from Supabase every 5 min."""
    import time
    global _auth_cache, _auth_cache_time
    if time.time() - _auth_cache_time < _AUTH_TTL:
        return _auth_cache
    try:
        from supabase import create_client
        sp = create_client(SUPABASE_URL, SUPABASE_KEY)
        rows = sp.table("authorized_users").select("telegram_id").execute()
        ids = {int(r["telegram_id"]) for r in (rows.data or [])}
        ids.add(OWNER_ID)  # Owner always included
        _auth_cache = ids
        _auth_cache_time = time.time()
        logging.info(f"[Auth] Loaded {len(ids)} authorized users from Supabase")
    except Exception as e:
        logging.warning(f"[Auth] Could not load from Supabase, using cached list: {e}")
    return _auth_cache

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO
)

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]


def _load_overrides() -> dict:
    with open(OVERRIDES_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _load_data() -> dict:
    if os.path.exists(DATA_JSON_PATH):
        with open(DATA_JSON_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def _load_schedules() -> dict:
    with open(SCHEDULES_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _get_group(context: ContextTypes.DEFAULT_TYPE) -> str:
    return context.user_data.get("lab_group", "group1")


# ── Command Handlers ──────────────────────────────────────────────────────────

def _is_owner(update: Update) -> bool:
    return update.effective_user.id in _get_allowed_ids()


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not _is_owner(update):
        return
    keyboard = [
        [
            InlineKeyboardButton("Group 1", callback_data="group_group1"),
            InlineKeyboardButton("Group 2", callback_data="group_group2"),
        ],
        [
            InlineKeyboardButton("Group 3", callback_data="group_group3"),
            InlineKeyboardButton("Group 4", callback_data="group_group4"),
        ],
    ]
    await update.message.reply_text(
        "👋 *IITD Academic Bot*\n\n"
        "I'm your personal academic assistant. Tell me anything:\n"
        "• _\"Hydraulics cancelled Wednesday\"_\n"
        "• _\"Minor 1 is Sep 15-20\"_\n"
        "• _\"Lab report for CVP2401 due Friday\"_\n"
        "• _\"Prof said chapter 3 is out of syllabus\"_\n\n"
        "First, select your lab group:",
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup(keyboard)
    )


async def group_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id not in _get_allowed_ids():
        return
    query = update.callback_query
    await query.answer()
    group = query.data.replace("group_", "")
    context.user_data["lab_group"] = group
    group_label = f"Group {group.replace('group', '')}"
    await query.edit_message_text(
        f"✅ Set to *{group_label}*.\n\nNow just message me naturally — I'll update your dashboard automatically.",
        parse_mode="Markdown"
    )


async def week_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not _is_owner(update):
        return
    schedules = _load_schedules()
    overrides = _load_overrides()
    group = _get_group(context)
    cancelled = {(c["course"], c["day"]) for c in overrides.get("cancellations", [])}

    lines = ["📅 *This Week's Schedule*\n"]
    for day in DAYS:
        slots = []
        for slot in schedules.get("lecture_schedule", {}).get(day, []):
            key = (slot["course"], day)
            status = "~~" if key in cancelled else ""
            slots.append(f"  {status}`{slot['time']:>14}` {slot['course']} — {slot.get('venue', '')}{status}")

        for slot in schedules.get("lab_groups", {}).get(group, []):
            if slot["day"] == day:
                key = (slot["course"], day)
                status = "~~" if key in cancelled else ""
                slots.append(f"  {status}`{slot['time']:>14}` 🔬 {slot['course']} Lab — {slot.get('venue', '')}{status}")

        if slots:
            lines.append(f"*{day.upper()}*")
            lines.extend(slots)
            lines.append("")

    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")


async def due_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not _is_owner(update):
        return
    data = _load_data()
    overrides = _load_overrides()
    now = datetime.now()

    items = []

    # From Moodle assignments
    for course in data.get("courses", []):
        for a in course.get("assignments", []):
            if a.get("due_date"):
                items.append({
                    "label": f"{course['id']} — {a['title']}",
                    "due": a["due_date"],
                    "source": "moodle"
                })

    # From overrides (lab reports + manual deadlines)
    for d in overrides.get("deadline_overrides", []):
        items.append({
            "label": f"{d['course']} — {d['item']}",
            "due": d["due_date"],
            "source": "manual"
        })

    items.sort(key=lambda x: x["due"])

    lines = ["📋 *Upcoming Deadlines*\n"]
    for item in items:
        try:
            due_dt = datetime.fromisoformat(item["due"].replace("Z", "+00:00"))
            days_left = (due_dt.replace(tzinfo=None) - now).days
            icon = "🔴" if days_left <= 1 else ("🟡" if days_left <= 3 else "🟢")
            lines.append(f"{icon} {item['label']}\n   Due: {item['due'][:10]} ({days_left}d left)")
        except Exception:
            lines.append(f"• {item['label']} — {item['due']}")

    if len(lines) == 1:
        lines.append("No upcoming deadlines 🎉")

    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")


async def new_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not _is_owner(update):
        return
    data = _load_data()
    lines = ["🆕 *Latest Uploads*\n"]
    count = 0
    for course in data.get("courses", []):
        new_items = [i for i in course.get("new_items", []) if i.get("is_new")]
        for item in new_items[:3]:
            cat_icon = {"lab": "🔬", "tutorial": "📝", "lecture": "📄", "notice": "📢"}.get(item.get("category"), "📄")
            lines.append(f"{cat_icon} *{course['id']}* — {item['title']}")
            count += 1
    if count == 0:
        lines.append("Nothing new since last scrape.")
    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")


async def notes_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not _is_owner(update):
        return
    overrides = _load_overrides()
    notes = overrides.get("notes", [])
    lines = ["📌 *Course Notes*\n"]
    if not notes:
        lines.append("No notes yet. Tell me anything your prof said!")
    for note in notes:
        p = note.get("priority", "medium")
        icon = {"high": "🔴", "medium": "🟡", "low": "🔵"}.get(p, "🟡")
        lines.append(f"{icon} *{note['course']}*: {note['text']}")
    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")


async def sync_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not _is_owner(update):
        return
    await update.message.reply_text("⚡ Initiating full platform sync (Moodle + Webmail)...")
    
    # 1. Trigger GitHub Actions scraper workflow if GITHUB_TOKEN is available
    token = os.getenv("GITHUB_TOKEN")
    repo = os.getenv("GITHUB_REPO", "DTSiPanda/iitd-academic-aggregator")
    gh_triggered = False
    if token:
        try:
            url = f"https://api.github.com/repos/{repo}/actions/workflows/scrape.yml/dispatches"
            headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github.v3+json"}
            res = requests.post(url, headers=headers, json={"ref": "main"})
            if res.status_code == 204:
                gh_triggered = True
        except Exception:
            pass

    # 2. Run Webmail scraper directly
    try:
        import sys
        sys.path.append(os.path.join(os.path.dirname(__file__), "..", "scraper"))
        from webmail_scraper import fetch_recent_instructor_emails, process_emails_with_gemini
        mails = fetch_recent_instructor_emails()
        if mails:
            process_emails_with_gemini(mails)
    except Exception as e:
        print(f"[bot] Sync webmail error: {e}")

    msg = "✅ Webmail sync complete!"
    if gh_triggered:
        msg += "\n🚀 Triggered Moodle scraper on GitHub Actions!"
    else:
        msg += "\n💡 Tip: Add GITHUB_TOKEN to Render env to trigger remote Moodle scraper on demand."

    await update.message.reply_text(msg)


async def webmail_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not _is_owner(update):
        return
    await update.message.reply_text("📧 Checking IITD Webmail for recent instructor emails...")
    try:
        import sys
        sys.path.append(os.path.join(os.path.dirname(__file__), "..", "scraper"))
        from webmail_scraper import fetch_recent_instructor_emails, process_emails_with_gemini
        
        mails = fetch_recent_instructor_emails()
        if not mails:
            await update.message.reply_text("📧 Checked Webmail: No new relevant instructor emails found.")
        else:
            await update.message.reply_text(f"📧 Found {len(mails)} instructor email(s). Processing with Gemini...")
            process_emails_with_gemini(mails)
            await update.message.reply_text("✅ Webmail sync complete! Overrides updated.")
    except Exception as e:
        await update.message.reply_text(f"⚠️ Webmail sync error: {str(e)}")


# ── Natural Language Message Handler ─────────────────────────────────────────

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not _is_owner(update):
        return
    user_msg = update.message.text
    group = _get_group(context)

    # Rolling multi-turn conversation memory
    if "chat_history" not in context.user_data:
        context.user_data["chat_history"] = []
    history = context.user_data["chat_history"]

    await update.message.chat.send_action("typing")

    try:
        tool_calls = process_message(user_msg, history=history)
        replies = []
        for call in tool_calls:
            result = execute_tool(call["tool"], call["args"], user_group=group)
            replies.append(result)
        response = "\n\n".join(replies)

        # Store in rolling history (keep last 10 turns = 20 messages)
        history.append({"role": "user", "text": user_msg})
        history.append({"role": "model", "text": response})
        if len(history) > 20:
            context.user_data["chat_history"] = history[-20:]

    except Exception as e:
        response = f"⚠️ Error processing message: {str(e)}"

    await update.message.reply_text(response)


# ── /list Command — Show all overrides ───────────────────────────────────────

async def list_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not _is_owner(update):
        return
    overrides = _load_overrides()
    lines = ["📋 *All Current Overrides*\n"]

    if overrides.get("exams"):
        lines.append("*📝 Exams:*")
        for i, e in enumerate(overrides["exams"]):
            courses = f" ({', '.join(e['courses'])})" if e.get('courses') else ""
            lines.append(f"  {i+1}. {e['name']}{courses}: {e['start_date']} → {e['end_date']}")

    if overrides.get("deadline_overrides"):
        lines.append("\n*📅 Deadlines:*")
        for i, d in enumerate(overrides["deadline_overrides"]):
            lines.append(f"  {i+1}. {d['course']} — {d['item']} (due {d['due_date'][:10]})")

    if overrides.get("notes"):
        lines.append("\n*📌 Notes:*")
        for i, n in enumerate(overrides["notes"]):
            p = {"high": "🔴", "medium": "🟡", "low": "🔵"}.get(n.get("priority", "medium"), "🟡")
            lines.append(f"  {i+1}. {p} {n['course']}: {n['text']}")

    if overrides.get("cancellations"):
        lines.append("\n*❌ Cancellations:*")
        for i, c in enumerate(overrides["cancellations"]):
            lines.append(f"  {i+1}. {c['course']} — {c['day']}")

    if overrides.get("lab_done"):
        lines.append("\n*✅ Labs Done:*")
        for i, l in enumerate(overrides["lab_done"]):
            lines.append(f"  {i+1}. {l['course']} — {l.get('experiment','?')} (report due {l['report_due'][:10]})")

    if len(lines) == 1:
        lines.append("Nothing saved yet. All overrides are empty.")

    lines.append("\n_Use /remove to delete any item._")
    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")


# ── /remove Command — Interactive item removal ────────────────────────────────

async def remove_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not _is_owner(update):
        return
    overrides = _load_overrides()
    keyboard = []

    for i, e in enumerate(overrides.get("exams", [])):
        courses = f" ({', '.join(e['courses'])})" if e.get("courses") else ""
        keyboard.append([InlineKeyboardButton(
            f"❌ Exam: {e['name']}{courses} ({e['start_date']})",
            callback_data=f"del_exam_{i}"
        )])

    for i, d in enumerate(overrides.get("deadline_overrides", [])):
        keyboard.append([InlineKeyboardButton(
            f"❌ Deadline: {d['course']} — {d['item'][:30]}",
            callback_data=f"del_deadline_{i}"
        )])

    for i, n in enumerate(overrides.get("notes", [])):
        p = {"high": "🔴", "medium": "🟡", "low": "🔵"}.get(n.get("priority", "medium"), "🟡")
        keyboard.append([InlineKeyboardButton(
            f"❌ Note {p}: {n['course']} — {n['text'][:30]}",
            callback_data=f"del_note_{i}"
        )])

    for i, c in enumerate(overrides.get("cancellations", [])):
        keyboard.append([InlineKeyboardButton(
            f"❌ Cancel: {c['course']} {c['day']}",
            callback_data=f"del_cancel_{i}"
        )])

    for i, l in enumerate(overrides.get("lab_done", [])):
        keyboard.append([InlineKeyboardButton(
            f"❌ Lab done: {l['course']} {l.get('experiment','')}",
            callback_data=f"del_lab_{i}"
        )])

    keyboard.append([InlineKeyboardButton("🗑 Clear ALL overrides", callback_data="del_ALL")])

    if len(keyboard) == 1:
        await update.message.reply_text("Nothing to remove — all overrides are empty.")
        return

    await update.message.reply_text(
        "Tap an item to remove it:",
        reply_markup=InlineKeyboardMarkup(keyboard)
    )


async def clear_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not _is_owner(update):
        return
    import json as _json
    overrides = {"cancellations": [], "deadline_overrides": [], "exams": [], "notes": [], "flagged": [], "lab_done": []}
    with open(OVERRIDES_PATH, "w", encoding="utf-8") as f:
        _json.dump(overrides, f, indent=2)
    with open(PUBLIC_OVERRIDES_PATH, "w", encoding="utf-8") as f:
        _json.dump(overrides, f, indent=2)
    _push_to_supabase(overrides)
    await update.message.reply_text("🗑️ All bot additions & overrides cleared successfully!")


async def remove_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id not in _get_allowed_ids():
        return
    query = update.callback_query
    await query.answer()
    data = query.data

    import json as _json
    with open(OVERRIDES_PATH, "r", encoding="utf-8") as f:
        overrides = _json.load(f)

    if data == "del_ALL":
        overrides = {"cancellations": [], "deadline_overrides": [], "exams": [], "notes": [], "flagged": [], "lab_done": []}
        msg = "🗑 All overrides cleared!"
    elif data.startswith("del_exam_"):
        idx = int(data.split("_")[-1])
        removed = overrides["exams"].pop(idx)
        msg = f"✅ Removed exam: {removed['name']}"
    elif data.startswith("del_deadline_"):
        idx = int(data.split("_")[-1])
        removed = overrides["deadline_overrides"].pop(idx)
        msg = f"✅ Removed deadline: {removed['item']} ({removed['course']})"
    elif data.startswith("del_note_"):
        idx = int(data.split("_")[-1])
        removed = overrides["notes"].pop(idx)
        msg = f"✅ Removed note: {removed['text'][:40]}"
    elif data.startswith("del_cancel_"):
        idx = int(data.split("_")[-1])
        removed = overrides["cancellations"].pop(idx)
        msg = f"✅ Removed cancellation: {removed['course']} {removed['day']}"
    elif data.startswith("del_lab_"):
        idx = int(data.split("_")[-1])
        removed = overrides["lab_done"].pop(idx)
        # Also remove corresponding deadline_override if present
        overrides["deadline_overrides"] = [
            d for d in overrides["deadline_overrides"]
            if not (d["course"] == removed["course"] and "Lab Report" in d["item"])
        ]
        msg = f"✅ Removed lab entry: {removed['course']}"
    else:
        msg = "Unknown action."

    # Save + push to Supabase
    from tools import _save
    _save(overrides)

    await query.edit_message_text(msg)


import threading
import time
import urllib.request
from http.server import HTTPServer, BaseHTTPRequestHandler

class HealthCheckHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-type", "text/plain")
        self.end_headers()
        self.wfile.write(b"IITD Academic Bot is active!")

    def log_message(self, format, *args):
        pass # suppress HTTP logs

def _keep_alive_loop():
    """Periodically ping self endpoint every 10 minutes to prevent Render free instance sleep."""
    render_url = os.environ.get("RENDER_EXTERNAL_URL")
    if not render_url:
        return
    print(f"[BOT] Render Keep-Alive active for: {render_url}")
    while True:
        try:
            time.sleep(600)  # Ping every 10 minutes
            req = urllib.request.Request(
                f"{render_url.rstrip('/')}/",
                headers={"User-Agent": "RenderKeepAlive/1.0"}
            )
            with urllib.request.urlopen(req, timeout=10):
                pass
        except Exception:
            pass

def start_health_server():
    port = int(os.environ.get("PORT", 8080))
    # Start self keep-alive thread
    threading.Thread(target=_keep_alive_loop, daemon=True).start()
    try:
        server = HTTPServer(("0.0.0.0", port), HealthCheckHandler)
        server.serve_forever()
    except Exception as e:
        print(f"[BOT] Health server warning: {e}")

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    # Start HTTP server on PORT for Render Web Service (Free Tier)
    threading.Thread(target=start_health_server, daemon=True).start()

    app = Application.builder().token(TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("week", week_command))
    app.add_handler(CommandHandler("due", due_command))
    app.add_handler(CommandHandler("new", new_command))
    app.add_handler(CommandHandler("notes", notes_command))
    app.add_handler(CommandHandler("list", list_command))
    app.add_handler(CommandHandler("remove", remove_command))
    app.add_handler(CommandHandler("clear", clear_command))
    app.add_handler(CommandHandler("sync", sync_command))
    app.add_handler(CommandHandler("webmail", webmail_command))
    app.add_handler(CommandHandler("mail", webmail_command))
    app.add_handler(CallbackQueryHandler(remove_callback, pattern="^del_"))
    app.add_handler(CallbackQueryHandler(group_callback, pattern="^group_"))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    print("[BOT] IITD Academic Bot is running...")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()

