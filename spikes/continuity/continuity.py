"""Pure, in-memory continuity contract prototype; no application storage or I/O."""
from __future__ import annotations

from dataclasses import dataclass
from copy import deepcopy
from typing import Any, Mapping

CONTRACT_VERSION = 1


@dataclass(frozen=True)
class Snapshot:
    replica: str
    chapters: dict[str, dict[str, Any]]
    deleted: frozenset[str] = frozenset()
    applied_transfers: frozenset[str] = frozenset()
    contract_version: int = CONTRACT_VERSION

    @classmethod
    def create(cls, replica: str, chapters: Mapping[str, Mapping[str, Any]]) -> "Snapshot":
        return cls(replica, {key: deepcopy(dict(value)) for key, value in chapters.items()})

    def edit(self, chapter_id: str, value: Mapping[str, Any], replica: str | None = None) -> "Snapshot":
        chapters = deepcopy(self.chapters)
        chapters[chapter_id] = deepcopy(dict(value))
        return Snapshot(replica or self.replica, chapters, self.deleted - {chapter_id}, self.applied_transfers)

    def delete(self, chapter_id: str, replica: str | None = None) -> "Snapshot":
        chapters = deepcopy(self.chapters)
        chapters.pop(chapter_id, None)
        return Snapshot(replica or self.replica, chapters, self.deleted | {chapter_id}, self.applied_transfers)

    def to_dict(self) -> dict[str, Any]:
        return {"contractVersion": self.contract_version, "replica": self.replica,
                "chapters": deepcopy(self.chapters), "deleted": sorted(self.deleted),
                "appliedTransfers": sorted(self.applied_transfers)}

    @classmethod
    def from_dict(cls, value: Mapping[str, Any]) -> "Snapshot":
        if value.get("contractVersion") != CONTRACT_VERSION:
            raise ValueError(f"unsupported contractVersion: {value.get('contractVersion')!r}")
        chapters = value.get("chapters")
        if not isinstance(chapters, dict) or not all(isinstance(k, str) and isinstance(v, dict) for k, v in chapters.items()):
            raise ValueError("chapters must map string IDs to chapter objects")
        return cls(str(value["replica"]), deepcopy(chapters), frozenset(value.get("deleted", [])),
                   frozenset(value.get("appliedTransfers", [])), CONTRACT_VERSION)


@dataclass(frozen=True)
class ConflictPreview:
    chapter_id: str
    reason: str
    base: dict[str, Any] | None
    left: dict[str, Any] | None
    right: dict[str, Any] | None


@dataclass(frozen=True)
class MergeResult:
    snapshot: Snapshot
    conflicts: tuple[ConflictPreview, ...]


def reconcile(base: Snapshot, left: Snapshot, right: Snapshot) -> MergeResult:
    """Three-way merge. Conflicts remain explicit; no timestamp/LWW resolution."""
    merged: dict[str, dict[str, Any]] = {}
    deleted: set[str] = set()
    conflicts: list[ConflictPreview] = []
    ids = set(base.chapters) | set(base.deleted) | set(left.chapters) | set(left.deleted) | set(right.chapters) | set(right.deleted)

    def value(snapshot: Snapshot, chapter_id: str) -> dict[str, Any] | None:
        return deepcopy(snapshot.chapters[chapter_id]) if chapter_id in snapshot.chapters else None

    for chapter_id in sorted(ids):
        b, l, r = value(base, chapter_id), value(left, chapter_id), value(right, chapter_id)
        left_changed = l != b or ((chapter_id in left.deleted) != (chapter_id in base.deleted))
        right_changed = r != b or ((chapter_id in right.deleted) != (chapter_id in base.deleted))
        if left_changed and right_changed and l != r:
            reason = "delete-vs-edit" if (l is None) != (r is None) else "concurrent-edit"
            conflicts.append(ConflictPreview(chapter_id, reason, b, l, r))
            # Stable preview default only: retain a surviving side in the materialized view.
            chosen = l if l is not None else r
        elif left_changed:
            chosen = l
        elif right_changed:
            chosen = r
        else:
            chosen = b
        if chosen is None:
            deleted.add(chapter_id)
        else:
            merged[chapter_id] = chosen

    snapshot = Snapshot(left.replica, merged, frozenset(deleted), left.applied_transfers | right.applied_transfers)
    return MergeResult(snapshot, tuple(conflicts))


@dataclass(frozen=True)
class Transfer:
    transfer_id: str
    snapshot: Snapshot

    @classmethod
    def from_snapshot(cls, transfer_id: str, snapshot: Snapshot) -> "Transfer":
        return cls(transfer_id, Snapshot.from_dict(snapshot.to_dict()))

    def deliver(self, target: Snapshot, complete: bool = True) -> Snapshot:
        """An incomplete transport has no visible effect; retry applies atomically."""
        if not complete:
            return target
        return apply_transfer(target, self)


def apply_transfer(target: Snapshot, transfer: Transfer) -> Snapshot:
    if transfer.transfer_id in target.applied_transfers:
        return target
    source = transfer.snapshot
    # A single-replica snapshot transfer is a replaceable snapshot, not a merge;
    # callers needing concurrent preservation must reconcile against a shared base.
    return Snapshot(target.replica, deepcopy(source.chapters), source.deleted,
                    target.applied_transfers | source.applied_transfers | {transfer.transfer_id})
