# Un soir là-bas — checkpoint P0/P1

Worktree: `/home/smora/Workspace/unsoirlabas-long`, branch `feat/personal-roadmap-long`, based on `9093761`. This checkpoint covers the settled local PWA/offline lot and the P1 durable-media migration. No P2/P3/P4 implementation is claimed.

## Delivered locally

- P0 (`t_fa1579b9`): executed this worktree's lint, production build, full browser acceptance suite, and backend tests. The branch is based on `9093761`; unrelated generated screenshot changes are excluded from the delivery.
- P1 PWA/offline (`t_f7fee089`): production manifest with decoded 192×192 and 512×512 PNG install icons; build-generated service worker version derived from the exact shell asset paths and bundled content; required-shell `cache.addAll` fails installation and removes the incomplete cache; API paths are excluded; current/previous shell caches are bounded; previous hashed JS/CSS remain addressable for compatibility; offline navigation reads the current cache document. No automatic reload is triggered.
- P1 durable media (`t_c2445958`): personal image bytes now live in `un-soir-la-bas-media-v1` IndexedDB and stored journal envelopes retain only versioned `idb:media:<id>` references. Migration writes blobs before replacing a validated local envelope, preserves byte-for-byte historical source under the recovery key, records migration state, and never replaces malformed storage. Rendering resolves references to stable Blob URLs; unavailable IndexedDB, missing bytes, quota, and corruption are surfaced without claiming a save. Explicit chapter updates run orphan cleanup across the legacy trip, multi-trip journals, and unsaved drafts, so a shared reference remains live until no collection retains it. Shared Web Locks now serialize media publication, storage migration, cleanup, legacy-journal migration, unsaved-draft writes/discards, and archive restoration across tabs; operations fail explicitly where Web Locks are unavailable. Cleanup fails closed on malformed/unknown envelopes, and archive restore preserves the current legacy Philippines journal when restoring an older archive without personal journals.
- Portable archive/restore: ZIP creation resolves IndexedDB bytes into archive entries. A fresh browser restores the same chapter IDs, order, cover, tone, and binary media, then writes new IndexedDB references; the archive itself contains no Google OAuth token or photo-provider URL.
- Related P1 subset: offline status and local writing/trip-context flow remain covered; the storage estimate explicitly is not a backup; the evening ritual opens the selected trip context without inventing dates. The trip/storage UX existed in this worktree and was preserved, not expanded into the unimplemented roadmap scope.

## Verification on final code

- `npm run lint` — passed.
- `npm run build` — passed.
- `PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/google-chrome npm run test:acceptance` — 95 passed, 3 skipped (98 total). The Playwright projects run ordinary acceptance against production preview and the four source-module durability regressions against a Vite dev server; no tests are omitted from the canonical command.
- `PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/google-chrome npx playwright test --config=tests/media-durability.config.ts` — 4 passed (re-run independently).
- `PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/google-chrome npx playwright test tests/archive.spec.ts:167` — 1 passed; the historical archive retains Oslo and legacy Philippines journal/counts.
- `python3 -m pytest -q tests/backend` — 9 passed; FastAPI `on_event` deprecation warnings only.
- Vite dev browser smoke — 0 service-worker registrations, 0 controllers. No phone installation or physical network-loss test was performed.

## Pending / not claimed

- `t_c2445958` physical device/browser-storage eviction testing remains a device gate; local browser migration/rollback/archive evidence is complete.
- `t_17cf2d5d` voice/evening-ritual simplification: current voice flow is retained; no new one-voice/three-photo simplification or recording behavior is claimed.
- Real phone PWA installation, icon/install affordance review, and airplane-mode reload remain human/device gates.
- Other P0 reconciliation beyond this branch's tested baseline, all P2/P3/P4 lots, authentication/retention gates, and the separate continuity spike integration remain outside this commit. Continuity spike commit `f658745127677266c8af08b9a79572efb4c678ab` is integrated as a bounded local spike only and is explicitly not active sync.

See `evidence/personal-roadmap-results.json` for exact commands, counts, artifact paths, and outstanding gates.
