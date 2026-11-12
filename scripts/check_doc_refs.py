"""Fail if a `path:line` citation in the course docs points at a missing file or line.

A citation may name what it expects on that line: `path/to/file.py:12` (`symbol`).
Then the line must contain that text, so a shifted line is caught, not just a short file.
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ["DESIGN.md", "TESTING.md", "UBIQUITOUS_LANGUAGE.md"]
CITATION = re.compile(r"`([\w./()\[\]-]+\.\w+):(\d+)`(?:\s*\(`([^`]+)`\))?")


def check(doc: Path) -> tuple[int, list[str]]:
    problems: list[str] = []
    citations = CITATION.findall(doc.read_text(encoding="utf-8"))
    for path, line_text, expected in citations:
        target = ROOT / path
        where = f"{doc.name}: {path}:{line_text}"
        if not target.is_file():
            problems.append(f"{where} -> file does not exist")
            continue
        lines = target.read_text(encoding="utf-8").splitlines()
        line_number = int(line_text)
        if not 1 <= line_number <= len(lines):
            problems.append(f"{where} -> file has only {len(lines)} lines")
        elif not lines[line_number - 1].strip():
            problems.append(f"{where} -> line is blank")
        elif expected and expected not in lines[line_number - 1]:
            problems.append(f"{where} -> line does not contain '{expected}'")
    return len(citations), problems


def main() -> int:
    total, problems = 0, []
    for name in DOCS:
        doc = ROOT / name
        if not doc.is_file():
            problems.append(f"{name} is missing")
            continue
        count, found = check(doc)
        total += count
        problems.extend(found)
    for problem in problems:
        print(f"BROKEN {problem}")
    print(f"Checked {total} citations: {len(problems)} problem(s).")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
