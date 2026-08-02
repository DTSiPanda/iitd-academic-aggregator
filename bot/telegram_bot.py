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
from datetime import datetime
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application, CommandHandler, MessageHandler,
    CallbackQueryHandler, ContextTypes, filters
)
from dotenv import load_dotenv
from llm_processor import process_message
from tools import execute_tool

load_dotenv()

TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
OWNER_ID = int(os.environ["TELEGRAM_OWNER_ID"])  # Only this user can use the bot
OVERRIDES_PATH = os.path.join(os.path.dirname(__file__), "overrides.json")
DATA_JSON_PATH = os.path.join(os.path.dirname(__file__), "..", "public", "data.json")
SCHEDULES_PATH = os.path.join(os.path.dirname(__file__), "..", "lab_schedules", "schedules.json")

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
    return update.effective_user.id == OWNER_ID


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
    if update.effective_user.id != OWNER_ID:
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
            if res.status_code == 24:
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

    await update.message.chat.send_action("typing")

    try:
        tool_calls = process_message(user_msg)
        replies = []
        for call in tool_calls:
            result = execute_tool(call["tool"], call["args"], user_group=group)
            replies.append(result)
        response = "\n\n".join(replies)
    except Exception as e:
        response = f"⚠️ Error processing message: {str(e)}"

    await update.message.reply_text(response)


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
    app.add_handler(CommandHandler("sync", sync_command))
    app.add_handler(CommandHandler("webmail", webmail_command))
    app.add_handler(CommandHandler("mail", webmail_command))
    app.add_handler(CallbackQueryHandler(group_callback, pattern="^group_"))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    print("[BOT] IITD Academic Bot is running...")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
