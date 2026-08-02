"""
webmail_scraper.py — Scrapes IITD Webmail via IMAP for instructor announcements.

Connects to imap.iitd.ac.in:993, searches for emails from registered instructor/TA
addresses, and uses Gemini 3.1 Flash Lite to extract structured action items directly into
bot/overrides.json.
"""

import os
import json
import imaplib
import email
from email.header import decode_header
from datetime import datetime, timedelta
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

IMAP_SERVER = os.getenv("IMAP_SERVER", "imap.iitd.ac.in")
IMAP_PORT   = int(os.getenv("IMAP_PORT", 993))
USERNAME    = os.getenv("KERBEROS_ID")
PASSWORD    = os.getenv("KERBEROS_PASS")

CONTACTS_FILE = os.path.join(os.path.dirname(__file__), "..", "bot", "instructor_contacts.json")
OVERRIDES_FILE = os.path.join(os.path.dirname(__file__), "..", "bot", "overrides.json")
PUBLIC_OVERRIDES = os.path.join(os.path.dirname(__file__), "..", "public", "overrides.json")

def load_instructor_emails() -> set:
    if not os.path.exists(CONTACTS_FILE):
        return set()
    with open(CONTACTS_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    emails = set()
    for c in data.get("contacts", []):
        if c.get("email"):
            emails.add(c["email"].strip().lower())
    return emails

def parse_header_str(val):
    if not val:
        return ""
    decoded = decode_header(val)
    parts = []
    for content, enc in decoded:
        if isinstance(content, bytes):
            parts.append(content.decode(enc or "utf-8", errors="ignore"))
        else:
            parts.append(str(content))
    return "".join(parts)

def fetch_recent_instructor_emails():
    instructor_emails = load_instructor_emails()
    if not USERNAME or not PASSWORD:
        print("[webmail] Missing KERBEROS_ID or KERBEROS_PASS in .env")
        return []

    print(f"[webmail] Connecting to {IMAP_SERVER}:{IMAP_PORT} as {USERNAME}...")
    try:
        mail = imaplib.IMAP4_SSL(IMAP_SERVER, IMAP_PORT)
        mail.login(USERNAME, PASSWORD)
        mail.select("INBOX")
    except Exception as e:
        print(f"[webmail] IMAP connection failed: {e}")
        return []

    # Search emails from past 14 days
    since_date = (datetime.now() - timedelta(days=14)).strftime("%d-%b-%Y")
    status, messages = mail.search(None, f'(SINCE "{since_date}")')
    
    if status != "OK" or not messages[0]:
        print("[webmail] No recent emails found.")
        mail.logout()
        return []

    email_ids = messages[0].split()
    print(f"[webmail] Found {len(email_ids)} total emails in past 14 days. Filtering for instructors...")
    
    extracted_mails = []
    for eid in email_ids[-30:]: # Check last 30 emails max for efficiency
        res, msg_data = mail.fetch(eid, "(RFC822)")
        for response_part in msg_data:
            if isinstance(response_part, tuple):
                msg = email.message_from_bytes(response_part[1])
                from_hdr = parse_header_str(msg.get("From"))
                subject = parse_header_str(msg.get("Subject"))
                date_hdr = parse_header_str(msg.get("Date"))

                # Check if sender matches any instructor
                from_lower = from_hdr.lower()
                is_match = any(inst in from_lower for inst in instructor_emails) or any(kw in subject.lower() for kw in ["cvl", "cvp", "mep1000", "iitd"])
                
                if is_match:
                    # Extract plain text body
                    body = ""
                    if msg.is_multipart():
                        for part in msg.walk():
                            if part.get_content_type() == "text/plain":
                                body += part.get_payload(decode=True).decode(errors="ignore")
                    else:
                        body = msg.get_payload(decode=True).decode(errors="ignore")

                    extracted_mails.append({
                        "from": from_hdr,
                        "subject": subject,
                        "date": date_hdr,
                        "body": body[:1500] # limit body text
                    })

    mail.logout()
    print(f"[webmail] Extracted {len(extracted_mails)} relevant instructor/course emails.")
    return extracted_mails

def process_emails_with_gemini(emails_list):
    if not emails_list:
        return

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("[webmail] No GEMINI_API_KEY found.")
        return

    client = genai.Client(api_key=api_key)
    from llm_processor import SCHEDULE_CONTEXT, TOOLS

    tool_declarations = [types.FunctionDeclaration(**t) for t in TOOLS]

    for em in emails_list:
        prompt = (
            f"INSTRUCTOR EMAIL RECEIVED:\n"
            f"From: {em['from']}\n"
            f"Subject: {em['subject']}\n"
            f"Date: {em['date']}\n\n"
            f"Body:\n{em['body']}\n\n"
            "Extract any course cancellations, deadline updates, notes, exam announcements, or lab report details. Call appropriate tools."
        )

        try:
            response = client.models.generate_content(
                model="gemini-3.1-flash-lite",
                contents=[types.Content(role="user", parts=[types.Part(text=prompt)])],
                config=types.GenerateContentConfig(
                    system_instruction=SCHEDULE_CONTEXT,
                    tools=[types.Tool(function_declarations=tool_declarations)],
                    temperature=0.1
                )
            )

            if response.candidates and response.candidates[0].content.parts:
                for part in response.candidates[0].content.parts:
                    if part.function_call:
                        from tools import execute_tool
                        fn_name = part.function_call.name
                        fn_args = dict(part.function_call.args)
                        print(f"[webmail] Extracted action: {fn_name}({fn_args})")
                        execute_tool(fn_name, fn_args)
        except Exception as e:
            print(f"[webmail] Gemini processing error for email '{em['subject']}': {e}")

    # Copy updated overrides to public
    if os.path.exists(OVERRIDES_FILE):
        import shutil
        shutil.copy2(OVERRIDES_FILE, PUBLIC_OVERRIDES)
        print("[webmail] Synced bot/overrides.json -> public/overrides.json")

if __name__ == "__main__":
    mails = fetch_recent_instructor_emails()
    process_emails_with_gemini(mails)
