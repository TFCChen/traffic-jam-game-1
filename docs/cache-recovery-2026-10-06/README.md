# Cached release recovery

The legacy production worker served cached navigation documents first. On localhost,
Vite did not provide a replacement worker, so the previously installed production
worker continued serving an old release after ordinary reloads. Unversioned GLB
URLs also allowed a release to reuse an older vehicle interior.

## Changes

- Vite serves a recovery worker at the original `/sw.js` URL. It claims existing
  clients, removes only `traffic-jam-` CacheStorage entries, unregisters itself,
  and navigates open clients to the live development application.
- Production installs a complete offline snapshot before activating automatically.
  Navigation prefers the network and falls back to the snapshot when unavailable.
- GLB requests carry a content revision derived from all model files. The offline
  fallback accepts only the matching snapshot revision.
- Production worker registration bypasses HTTP script caching and checks for
  updates. Vercel marks `/sw.js` as non-cacheable.
- localStorage progress, drafts and preferences are never cleared.

## Verification

`npm test` passed all existing game, storage, model, dynamics and camera checks.
`npm run build` replayed 40 official solutions and generated the offline snapshot.

`node scripts/verify-cache-recovery.mjs <isolated-browser-CDP-URL>` installs a
deliberately stale cache-first worker at localhost:4173, demonstrates its old
document, and performs an ordinary reload to trigger recovery. Service-worker
bypass and HTTP-cache disabling are **not** used. It verifies zero remaining
registrations, removal of game caches, preservation of an unrelated cache and a
progress marker, and versioned model requests. The temporary public fixture is
removed after the test. `before.png` shows the stale document; `after.png` shows
the recovered game with its guide dismissed.

`node scripts/verify-production-cache.mjs` serves the built release at port 4174
in an isolated browser. It replaces the active worker with the legacy fixture,
then verifies automatic release recovery and offline navigation. The server
rejects connections during the offline phase so worker requests cannot silently
reach the network. The offline racer GLB SHA-256 matches the local release file;
a mismatched model revision fails instead of serving an old model. Progress
survives and the obsolete game cache is deleted. See both JSON reports.

The user's ChatGPT browser session was not available to the Codex browser tools.
Its next normal refresh will request the replacement worker from localhost.
