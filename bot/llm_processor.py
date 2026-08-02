"""
llm_processor.py — Gemini powered NLP engine with expanded context window.

Injects full active overrides (notes, exams, cancellations, lab reports)
and course resource listings into the context window for maximum reasoning.
"""

import os
import json
from google import genai
from google.genai import types
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from config import GEMINI_API_KEY, SCHEDULE_CONTEXT, OVERRIDES_PATH, DATA_JSON_PATH

client = genai.Client(api_key=GEMINI_API_KEY)

# ── Tool definitions (function calling schema) ────────────────────────────────

TOOLS = [
    {
        "name": "cancel_class",
        "description": "Mark a lecture or lab as cancelled for a specific day/date.",
        "parameters": {
            "type": "object",
            "properties": {
                "course": {"type": "string", "description": "Course code e.g. CVL2702"},
                "day": {"type": "string", "description": "Day of week e.g. Wednesday"},
                "date": {"type": "string", "description": "Specific date YYYY-MM-DD if known, else null"},
                "note": {"type": "string", "description": "Optional reason for cancellation"}
            },
            "required": ["course", "day"]
        }
    },
    {
        "name": "override_deadline",
        "description": "Override or set a deadline for an assignment, quiz, or lab report. Supports groupwise (lab group schedule) or wholeclass (entire class).",
        "parameters": {
            "type": "object",
            "properties": {
                "course": {"type": "string", "description": "Course code e.g. CVP2401 or CVL2702"},
                "item": {"type": "string", "description": "Name of the assignment, quiz, or lab report"},
                "due_date": {"type": "string", "description": "ISO date-time e.g. 2026-08-08T17:00:00 or YYYY-MM-DD. Optional if groupwise lab auto-calculates."},
                "scope": {"type": "string", "enum": ["groupwise", "wholeclass"], "description": "groupwise = scheduled per lab group slot, wholeclass = for entire class"},
                "note": {"type": "string"}
            },
            "required": ["course", "item"]
        }
    },
    {
        "name": "add_exam",
        "description": "Add or update an exam milestone (Minor 1, Minor 2, Endsem, Quiz etc.).",
        "parameters": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Exam or Quiz name e.g. Quiz 1"},
                "start_date": {"type": "string", "description": "YYYY-MM-DD"},
                "end_date": {"type": "string", "description": "YYYY-MM-DD, same as start if single day"},
                "courses": {"type": "array", "items": {"type": "string"}, "description": "Courses covered"},
                "note": {"type": "string"}
            },
            "required": ["name", "start_date", "end_date"]
        }
    },
    {
        "name": "add_note",
        "description": "Add a sticky note or insight to a course. Use for syllabus hints, prof announcements, important dates.",
        "parameters": {
            "type": "object",
            "properties": {
                "course": {"type": "string"},
                "text": {"type": "string", "description": "The note content"},
                "priority": {"type": "string", "enum": ["high", "medium", "low"], "description": "high = exam/critical, medium = important, low = FYI"}
            },
            "required": ["course", "text", "priority"]
        }
    },
    {
        "name": "flag_resource",
        "description": "Flag a Moodle file or tutorial sheet as important for exams or study.",
        "parameters": {
            "type": "object",
            "properties": {
                "course": {"type": "string"},
                "title": {"type": "string", "description": "Partial or full title of the resource"},
                "reason": {"type": "string", "description": "Why it's flagged"}
            },
            "required": ["course", "title", "reason"]
        }
    },
    {
        "name": "mark_lab_done",
        "description": "Mark a lab experiment as completed. Auto-calculates report due date as next week's same lab slot.",
        "parameters": {
            "type": "object",
            "properties": {
                "course": {"type": "string", "description": "Lab course code e.g. CVP2401"},
                "experiment": {"type": "string", "description": "Experiment name or number"},
                "done_date": {"type": "string", "description": "Date performed YYYY-MM-DD, defaults to today"}
            },
            "required": ["course"]
        }
    },
    {
        "name": "general_reply",
        "description": "Use when the message is a question or doesn't map to any structured action. Reply conversationally.",
        "parameters": {
            "type": "object",
            "properties": {
                "reply": {"type": "string", "description": "Your conversational reply to the user"}
            },
            "required": ["reply"]
        }
    }
]


def _get_dynamic_context() -> str:
    """Load active overrides & data.json into the LLM system prompt context window."""
    ctx_lines = [SCHEDULE_CONTEXT, "\n=== ACTIVE DATABASE OVERRIDES & STATE ==="]

    if os.path.exists(OVERRIDES_PATH):
        try:
            with open(OVERRIDES_PATH, "r", encoding="utf-8") as f:
                overrides = json.load(f)
                ctx_lines.append(json.dumps(overrides, indent=2))
        except Exception:
            pass

    if os.path.exists(DATA_JSON_PATH):
        try:
            with open(DATA_JSON_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                courses_summary = []
                for c in data.get("courses", []):
                    courses_summary.append({
                        "id": c["id"],
                        "name": c["name"],
                        "files_count": len(c.get("new_items", [])),
                        "assignments": [a.get("title") for a in c.get("assignments", [])]
                    })
                ctx_lines.append("\n=== RECENT MOODLE COURSES SUMMARY ===")
                ctx_lines.append(json.dumps(courses_summary, indent=2))
        except Exception:
            pass

    return "\n".join(ctx_lines)


def process_message(user_message: str, history: list = None) -> list:
    """
    Send user message to Gemini (1M+ Token Context Window) with full active database context.
    Returns a list of { "tool": str, "args": dict } objects.
    """
    tool_declarations = [
        types.FunctionDeclaration(**t) for t in TOOLS
    ]

    full_system_context = _get_dynamic_context()

    # Build messages sequence with full context
    contents = []
    if history:
        for h in history:
            role = h.get("role", "user")
            text = h.get("text", "")
            contents.append(types.Content(role=role, parts=[types.Part(text=text)]))

    contents.append(
        types.Content(role="user", parts=[
            types.Part(text=(
                f"The student says: \"{user_message}\"\n\n"
                "Extract all actions from this message. Call the appropriate tools. "
                "Today's context: you know their full schedule and active database state. Use IST timezone."
            ))
        ])
    )

    # Use gemini-2.5-flash model with 1 Million+ token context window
    response = client.models.generate_content(
        model="gemini-3.1-flash-lite",
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=full_system_context,
            tools=[types.Tool(function_declarations=tool_declarations)],
            temperature=0.1,
        )
    )

    calls = []
    if response.candidates and response.candidates[0].content.parts:
        for part in response.candidates[0].content.parts:
            if part.function_call:
                calls.append({
                    "tool": part.function_call.name,
                    "args": dict(part.function_call.args)
                })

    if not calls:
        text = response.text if response.text else "Got it!"
        calls.append({
            "tool": "general_reply",
            "args": {"reply": text}
        })

    return calls


if __name__ == "__main__":
    result = process_message("What exams and notes do I currently have saved?")
    print(json.dumps(result, indent=2))
