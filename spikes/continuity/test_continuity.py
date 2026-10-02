import json
import unittest
from pathlib import Path

from continuity import Snapshot, Transfer, reconcile, apply_transfer

FIXTURE = json.loads((Path(__file__).parent / "fixtures/two-replicas.json").read_text())


def chapter(title, text):
    return {"title": title, "text": text}


class ContinuityContractTests(unittest.TestCase):
    def setUp(self):
        self.base = Snapshot.from_dict(FIXTURE["base"])

    def test_concurrent_edits_create_preview_and_preserve_both_sides(self):
        left = Snapshot.from_dict(FIXTURE["concurrentEditReplicas"]["a"])
        right = Snapshot.from_dict(FIXTURE["concurrentEditReplicas"]["b"])
        merged = reconcile(self.base, left, right)
        self.assertEqual(len(merged.conflicts), 1)
        conflict = merged.conflicts[0]
        self.assertEqual(conflict.reason, "concurrent-edit")
        self.assertEqual(conflict.chapter_id, "chapter-1")
        self.assertEqual(conflict.left, chapter("Lagoon", "A-side recollection"))
        self.assertEqual(conflict.right, chapter("Lagoon", "B-side recollection"))
        self.assertEqual(merged.snapshot.chapters["chapter-1"], chapter("Lagoon", "A-side recollection"))

    def test_independent_edits_merge_without_conflict(self):
        base = Snapshot.from_dict({**FIXTURE["base"], "chapters": {**FIXTURE["base"]["chapters"], "chapter-2": {"title": "Market", "text": "shared second baseline"}}})
        left = Snapshot.from_dict(FIXTURE["independentEditReplicas"]["a"])
        right = Snapshot.from_dict(FIXTURE["independentEditReplicas"]["b"])
        merged = reconcile(base, left, right)
        self.assertEqual(merged.conflicts, ())
        self.assertEqual(merged.snapshot.chapters, {"chapter-1": chapter("Lagoon", "A-side recollection"), "chapter-2": chapter("Market", "B-side recollection")})

    def test_delete_versus_edit_is_conflict_and_both_are_retained(self):
        deleted = self.base.delete("chapter-1")
        edited = self.base.edit("chapter-1", chapter("Beach", "kept edit"), replica="replica-b")
        merged = reconcile(self.base, deleted, edited)
        conflict = merged.conflicts[0]
        self.assertEqual(conflict.reason, "delete-vs-edit")
        self.assertIsNone(conflict.left)
        self.assertEqual(conflict.right, chapter("Beach", "kept edit"))
        self.assertEqual(merged.snapshot.chapters["chapter-1"], chapter("Beach", "kept edit"))

    def test_interrupted_transfer_retries_idempotently(self):
        target = Snapshot.create("replica-b", {})
        source = self.base.edit("chapter-1", chapter("Beach", "new"))
        transfer = Transfer.from_snapshot("transfer-1", source)
        partial = transfer.deliver(target, complete=False)
        self.assertEqual(partial, target)
        applied = apply_transfer(target, transfer)
        retried = apply_transfer(applied, transfer)
        self.assertEqual(retried, applied)
        self.assertEqual(retried.chapters["chapter-1"], chapter("Beach", "new"))

    def test_contract_is_versioned_and_rejects_unknown_versions(self):
        encoded = self.base.to_dict()
        self.assertEqual(encoded["contractVersion"], 1)
        self.assertEqual(Snapshot.from_dict(encoded), self.base)
        encoded["contractVersion"] = 99
        with self.assertRaises(ValueError):
            Snapshot.from_dict(encoded)


if __name__ == "__main__":
    unittest.main(verbosity=2)
