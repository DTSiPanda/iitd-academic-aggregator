"""
captcha_solver.py — Parse and solve IITD Moodle math captchas.
Handles prompts like:
- "Please enter first value 91 , 89 =" -> 91
- "Please enter second value 91 , 89 =" -> 89
- "Please add 12 + 5 =" -> 17
- "Please subtract 20 - 4 =" -> 16
"""
import re

def solve_moodle_captcha(prompt_text: str) -> str | None:
    text = prompt_text.strip()

    # 1. "Please enter first value X , Y ="
    match1 = re.search(r"first value\s*(\d+)\s*,\s*(\d+)", text, re.IGNORECASE)
    if match1:
        return match1.group(1)

    # 2. "Please enter second value X , Y ="
    match2 = re.search(r"second value\s*(\d+)\s*,\s*(\d+)", text, re.IGNORECASE)
    if match2:
        return match2.group(2)

    # 3. "Please add X + Y ="
    match3 = re.search(r"add\s*(\d+)\s*\+\s*(\d+)", text, re.IGNORECASE)
    if match3:
        return str(int(match3.group(1)) + int(match3.group(2)))

    # 4. "Please subtract X - Y ="
    match4 = re.search(r"subtract\s*(\d+)\s*-\s*(\d+)", text, re.IGNORECASE)
    if match4:
        return str(int(match4.group(1)) - int(match4.group(2)))

    # 5. Direct equation "X + Y =" or "X - Y ="
    match5 = re.search(r"(\d+)\s*([\+\-])\s*(\d+)\s*=", text)
    if match5:
        num1 = int(match5.group(1))
        op   = match5.group(2)
        num2 = int(match5.group(3))
        return str(num1 + num2 if op == '+' else num1 - num2)

    return None

if __name__ == "__main__":
    test_cases = [
        "Please enter first value 91 , 89 =",
        "Please enter second value 91 , 89 =",
        "Please add 12 + 5 =",
        "Please subtract 20 - 4 =",
    ]
    for tc in test_cases:
        ans = solve_moodle_captcha(tc)
        print(f"PROMPT: '{tc}' -> ANSWER: '{ans}'")
