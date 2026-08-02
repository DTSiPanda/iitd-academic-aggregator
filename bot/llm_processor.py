"""
llm_processor.py — Gemini 3.1 Flash Lite powered NLP engine.

Takes a natural language message from the user and returns structured
tool calls that update overrides.json.
"""

import os
import json
from google import genai
from google.genai import types
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from config import GEMINI_API_KEY, SCHEDULE_CONTEXT

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
        "description": "Override or set a deadline for an assignment or lab report.",
        "parameters": {
            "type": "object",
            "properties": {
                "course": {"type": "string"},
                "item": {"type": "string", "description": "Name of the assignment or lab report"},
                "due_date": {"type": "string", "description": "ISO date-time e.g. 2026-08-08T17:00:00"},
                "note": {"type": "string"}
            },
            "required": ["course", "item", "due_date"]
        }
    },
    {
        "name": "add_exam",
        "description": "Add or update an exam milestone (Minor 1, Minor 2, Endsem etc.).",
        "parameters": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Exam name e.g. Minor 1"},
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
        "description": "Add a sticky note or insight to a course. Use for syllabus hints, prof announcements, important topics.",
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


def process_message(user_message: str) -> list:
    """
    Send user message to Gemini 3.1 Flash Lite with schedule context.
    Returns a list of { "tool": str, "args": dict } objects.
    Can return multiple tool calls from one message.
    """
    # Build tool declarations
    tool_declarations = [
        types.FunctionDeclaration(**t) for t in TOOLS
    ]

    response = client.models.generate_content(
        model="gemini-3.1-flash-lite",
        contents=[
            types.Content(role="user", parts=[
                types.Part(text=(
                    f"The student says: \"{user_message}\"\n\n"
                    "Extract all actions from this message. Call the appropriate tools. "
                    "Today's context: you know their full schedule. Use IST timezone."
                ))
            ])
        ],
        config=types.GenerateContentConfig(
            system_instruction=SCHEDULE_CONTEXT,
            tools=[types.Tool(function_declarations=tool_declarations)],
            temperature=0.1,
        )
    )

    calls = []
    for part in response.candidates[0].content.parts:
        if part.function_call:
            calls.append({
                "tool": part.function_call.name,
                "args": dict(part.function_call.args)
            })

    # Fallback: if no tool calls, use text as general_reply
    if not calls:
        text = response.text if response.text else "I didn't quite get that. Could you rephrase?"
        calls.append({
            "tool": "general_reply",
            "args": {"reply": text}
        })

    return calls


if __name__ == "__main__":
    # Quick test
    result = process_message("Prof cancelled Wednesday Hydraulics and said chapter 3 is out of syllabus for minor")
    print(json.dumps(result, indent=2))
