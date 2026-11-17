from __future__ import annotations

import sqlite3
from collections.abc import Iterable

from common import normalize_space

RecordIdentity = tuple[str | int | None, str | None, int | None]


def normalized_sequence(sequence: str | int | None) -> str:
    return normalize_space(str(sequence)) if sequence is not None else ""


def replacement_visibility(
    conn: sqlite3.Connection, source_id: int, identities: Iterable[RecordIdentity]
) -> list[int]:
    """Carry forward source-scoped hides and stop if a hidden occurrence cannot be identified."""
    replacements = [
        (normalized_sequence(seq), normalize_space(name), date) for seq, name, date in identities
    ]
    flags = [0] * len(replacements)
    hidden = conn.execute(
        "SELECT sequence_no, name, violation_date FROM offender_records WHERE source_id = ? AND is_hidden = 1",
        (source_id,),
    ).fetchall()
    for old_seq, old_name, old_date in hidden:
        sequence = normalized_sequence(old_seq)
        name = normalize_space(old_name)
        matches = [
            index
            for index, (new_seq, new_name, new_date) in enumerate(replacements)
            if (
                name and name == new_name
                and ((sequence and sequence == new_seq) or (old_date is not None and old_date == new_date))
            )
            or (sequence and sequence == new_seq and not name and old_date == new_date)
        ]
        if not matches:
            raise ValueError("Cannot safely match a hidden record in the replacement; review the source first")
        for index in matches:
            flags[index] = 1
    return flags
