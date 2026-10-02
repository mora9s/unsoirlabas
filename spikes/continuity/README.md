# P4 continuity feasibility spike

Status: **PARTIAL — contract mechanics validated in a deterministic, in-memory simulation; no sync architecture or deployment validated.** This isolated Python prototype is not imported by the React app. It reads only its committed synthetic fixture and creates no browser-storage, filesystem, network, cloud, OAuth, or account side effects.

## Questions and findings

- **Concurrent changes:** three-way comparison against a common snapshot identifies edits to the same chapter and emits a preview containing base, replica A, and replica B. The merge result exposes both alternatives; it does not select by timestamp or silently erase a side. The materialized preview keeps A when both are edits; this is a display convenience only, not a resolution decision. A product UI must require an explicit choice before finalizing.
- **Independent changes:** changes to different chapter IDs merge without a conflict.
- **Deletion versus edit:** represented as an explicit `delete-vs-edit` preview with one side `None` (deletion) and the edited content on the other. The materialized preview retains the edited content while the deletion remains in the conflict record; no side is discarded.
- **Interrupted/retried transfer:** incomplete delivery is a no-op; a completed transfer is applied atomically in the model and duplicate transfer IDs are idempotent. This is a deterministic simulation, not evidence of real transport atomicity.

## Contract sketch

`Snapshot` is JSON-compatible and explicitly versioned with `contractVersion: 1`. It carries a replica label, chapter map keyed by stable chapter ID, deletion IDs, and applied transfer IDs. Unknown contract versions and malformed chapter maps are rejected. `reconcile(base, a, b)` assumes both replicas derive from the same known base. It returns a materialized snapshot plus explicit conflict previews. `Transfer` wraps a snapshot and stable transfer ID.

This is a spike contract, not a durable wire protocol: it has no schema migration beyond rejecting unknown versions, authentication, authorization, encryption/key management, server sequencing, payload-size/quota controls, retention, conflict-resolution UI, or robust causal history. Do not connect it to real journals or storage.

## Runnable tests (Python standard library only)

From repository root:

```sh
python3 -m unittest discover -s spikes/continuity -v
```

The synthetic two-replica fixture is `fixtures/two-replicas.json`; the tests additionally synthesize deletion and interrupted-delivery cases without touching the app. The TDD baseline was RED: test discovery failed with `ModuleNotFoundError: No module named 'continuity'` before the contract implementation existed. After implementation the focused suite passes all 5 tests.

## Compared continuity paths

| Path | What the existing project already evidences | Continuity/security trade-offs | Scope/cost status |
|---|---|---|---|
| **Versioned archive transfer** | README documents local ZIP export/import, preview, safety copy, and manual handoff (including depositing the archive in Drive). Archive v2 includes personal chapters/plans and selected resized images; no merge is performed. Audio in IndexedDB is excluded. | User-controlled file movement; no live account connection or background sync. Archive may be copied into an account/provider chosen by the user. Current import replaces stated collections rather than merging. Protect downloaded archives and any cloud copy; no claim of end-to-end encryption. | This is the existing documented path. No new cloud spend, OAuth client, or live sync is introduced by this spike. Provider storage/transfer costs depend on the user's account and are not assessed. |
| **Private authenticated sync** | README documents a private local voice service behind private HTTPS/Tailscale for voice processing; it does not establish journal sync. Do not infer it is a continuity backend. | Would require a separate authenticated service contract, device/user authorization, transport security, server-side access isolation, deletion/retention rules, recovery, and conflict handling. Minimize stored fields and logs; avoid placing bearer credentials in frontend code. | Feasibility, hosting, operations, support burden, and cost are **unknown**. No endpoint, account, or service activated. |
| **OAuth Drive integration** | README documents optional Google Photos Picker access and manual archive placement in Drive; no direct Drive synchronization exists. | OAuth introduces consent/token lifecycle and provider access. Define the narrowest feasible scopes before implementation: prefer app-created files only (`drive.file`) if product behavior permits; do not request broad Drive access without a demonstrated need. Secure token storage, revocation, account switching, and conflict handling remain open. Photos Picker permission is not Drive sync authorization. | Client configuration and eligibility require validation. API/quota limits and any monetary cost are **unknown**; no OAuth client, permission, token, or remote file was created. No promises about availability or cost. |

## Boundaries and next decision

No production files, application routes, browser storage, real personal records, remote service, physical device, OAuth account, or Drive file were used. No physical two-device test or active remote synchronization was performed. This validates only the deterministic conflict/transfer contract behavior in a local simulation. Before any product implementation, decide whether the desired recovery level is satisfied by archive handoff or whether active sync justifies authentication, conflict-resolution UX, threat modeling, privacy review, and measured operating costs. The app's documented archive path replaces collections rather than merging; this spike's merge model must not be represented as a feature of the live application.
