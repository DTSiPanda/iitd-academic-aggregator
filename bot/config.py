import os
from dotenv import load_dotenv

load_dotenv()

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_OWNER_ID  = int(os.environ.get("TELEGRAM_OWNER_ID", "0")) if os.environ.get("TELEGRAM_OWNER_ID") else 0
GEMINI_API_KEY     = os.environ.get("GEMINI_API_KEY", "")

IMAP_SERVER = os.environ.get("IMAP_SERVER", "imap.iitd.ac.in")
IMAP_PORT   = int(os.environ.get("IMAP_PORT", 993))
KERBEROS_ID = os.environ.get("KERBEROS_ID", "")
KERBEROS_PASS = os.environ.get("KERBEROS_PASS", "")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OVERRIDES_PATH = os.path.join(BASE_DIR, "overrides.json")
DATA_JSON_PATH = os.path.join(BASE_DIR, "..", "public", "data.json")
SCHEDULES_PATH = os.path.join(BASE_DIR, "..", "lab_schedules", "schedules.json")
CONTACTS_PATH  = os.path.join(BASE_DIR, "instructor_contacts.json")

SCHEDULE_CONTEXT = """
You are an academic assistant for an IIT Delhi Civil Engineering 2nd year student.

COURSES:
- CVL1301: Surveying & Remote Sensing | Mon 8AM, Thu 8AM | WS 101 (SeNSE) | Sri Harsha Kota
- CVL2001: Climate Change & Adaptation | Mon 12PM, Tue 12PM, Fri 12PM | LH 108 | Gazala Habib
- CVL2401: Geological Engineering | Tue 11AM, Fri 11AM | Block VI LT 2 | Bappaditya Manna
- CVL2502: Analysis of Determinate Structures | Tue 10AM, Wed 10AM, Fri 10AM | WS 101 | Sahil Bansal
- CVL2601: Traffic & Transportation Planning | Tue 9AM, Wed 9AM, Fri 9AM | LH 416 | Pramesh Kumar
- CVL2702: Hydraulics | Tue 8AM, Wed 8AM, Fri 8AM | LH 416 | Saumava Dey
- MEP1000: Intro to Engineering Systems | Tue 5PM | Dogra Hall (+ Lab Mon/Thu at CSC)

LABS (per group — weekly rotation):
- CVP2401 Geological Lab | Deepanshu Shirole | Block IV Rm 331
- CVP2502 Solid Mechanics Lab | Allan Lambor Marbaniang | Block V Rm 216
- CVP2601 Traffic Lab | Pramesh Kumar | Blk IV-3F 4-A-8
- CVP2702 Hydraulics Lab | Deo Raj Kaushal | Blk V V312/V313

LAB REPORT RULE: Report due at the NEXT scheduled lab session for that course (exactly 7 days after performing the experiment, same time slot).

TUTORIAL SHEETS: No scheduled slot — just practice PDFs uploaded to Moodle. No deadline unless prof explicitly says so.
"""
