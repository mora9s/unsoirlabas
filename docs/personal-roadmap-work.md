# Un soir là-bas — checkpoint P0/P1

Worktree: `/home/smora/Workspace/unsoirlabas-long`, branch `feat/personal-roadmap-long`, based on `ee031a3`. This checkpoint covers only the settled local PWA/offline lot and already-present related local UX; no P2/P3/P4 implementation is claimed.

## Delivered locally

- P0 (`t_fa1579b9`): executed the current worktree's lint, production build, full browser acceptance suite, and backend tests. The branch remains based on `ee031a3`; unrelated generated screenshot changes are excluded from the delivery.
- P1 PWA/offline (`t_f7fee089`): production manifest with decoded 192×192 and 512×512 PNG install icons; build-generated service worker version derived from the exact shell asset paths and bundled content; required-shell `cache.addAll` fails installation and removes the incomplete cache; API paths are excluded; current/previous shell caches are bounded; previous hashed JS/CSS remain addressable for compatibility; offline navigation uses the cached document. No automatic reload is triggered.
- Related P1 subset: offline status and local writing/trip-context flow remain covered; the storage estimate explicitly is not a backup; the evening ritual opens the selected trip context without inventing dates. The trip/storage UX existed in this worktree and was preserved, not expanded into the unimplemented roadmap scope.

## Verification on final code

- `npm run lint` — passed.
- `npm run build` — passed.
- `PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/google-chrome npm run test:acceptance` — 84 passed, 3 skipped (87 total).
- `python3 -m pytest -q tests/backend` — 9 passed; FastAPI `on_event` deprecation warnings only.
- Focused PWA/storage/evening specs — 6 passed; the separate PWA update/offline run passed 4/4. The final full acceptance run reran all of them.
- Vite dev browser smoke — 0 service-worker registrations, 0 controllers. No phone installation or physical network-loss test was performed.

## Pending / not claimed

- `t_c2445958` media portability: photos remain localStorage data URLs; IndexedDB migration, legacy migration/rollback and real restore evidence remain pending.
- `t_17cf2d5d` voice/evening-ritual simplification: current voice flow is retained; no new one-voice/three-photo simplification or recording behavior is claimed.
- Real phone PWA installation, icon/install affordance review, and airplane-mode reload remain human/device gates.
- Other P0 reconciliation beyond this branch's tested baseline, all P2/P3/P4 lots, authentication/retention gates, and the separate continuity spike integration remain outside this commit. Continuity spike commit `f658745127677266c8af08b9a79572efb4c678ab` is not cherry-picked here and is explicitly not active sync.

See `evidence/personal-roadmap-results.json` for exact commands, counts, artifact paths, and outstanding gates.
