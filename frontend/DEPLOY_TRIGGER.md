# Deployment Triggers

This file exists to force a frontend bundle rebuild on each meaningful change.
Add a one-line entry whenever a deploy is needed but no other source file has
changed (rare). Most changes already trigger a rebuild via webpack hashing.

## Log

- 2026-05-05 — v9 cache bump: force-unregister old service worker on first load
  to evict the stale dashboard bundle that was hiding the Quick Recharge toggle
  fetch. Pairs with `service-worker.js` cache version v8 → v9 and the
  one-time `paras_force_refresh_v9` localStorage marker in `index.js`.
