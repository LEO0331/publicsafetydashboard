from __future__ import annotations

import sys
import trace
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGETS = [
    ROOT / "scripts" / "common.py",
    ROOT / "scripts" / "crawl_sources.py",
    ROOT / "scripts" / "geocode_locations.py",
    ROOT / "scripts" / "pdf_parser.py",
    ROOT / "scripts" / "export_geocode_cache.py",
    ROOT / "scripts" / "seed_initial_data.py",
    ROOT / "scripts" / "seed_geocode_cache.py",
]
THRESHOLD = 80.0


def executable_lines(path: Path) -> set[int]:
    return set(trace._find_executable_linenos(str(path)))  # type: ignore[attr-defined]


def main() -> int:
    sys.path.insert(0, str(ROOT / "scripts"))
    tracer = trace.Trace(count=True, trace=False, ignoredirs=[sys.prefix, sys.exec_prefix])
    suite = tracer.runfunc(unittest.defaultTestLoader.discover, str(ROOT / "tests" / "unit"), pattern="test_*.py")
    runner = unittest.TextTestRunner(verbosity=1)
    result = tracer.runfunc(runner.run, suite)
    if not result.wasSuccessful():
        return 1

    counts = tracer.results().counts
    total_lines = 0
    total_covered = 0
    print("Python project coverage")
    print("file | line % | covered/lines")
    for target in TARGETS:
        lines = executable_lines(target)
        covered = {
            lineno
            for (filename, lineno), count in counts.items()
            if count and Path(filename).resolve() == target.resolve() and lineno in lines
        }
        total_lines += len(lines)
        total_covered += len(covered)
        percent = (len(covered) / len(lines) * 100) if lines else 100.0
        print(f"{target.relative_to(ROOT)} | {percent:.2f} | {len(covered)}/{len(lines)}")

    overall = (total_covered / total_lines * 100) if total_lines else 100.0
    print(f"all tracked python files | {overall:.2f} | {total_covered}/{total_lines}")
    if overall < THRESHOLD:
        print(f"Python coverage {overall:.2f}% is below required {THRESHOLD:.2f}%", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
