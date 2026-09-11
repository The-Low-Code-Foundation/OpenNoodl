# Phase 63 — there is no next session; read this if you're here anyway

**The phase SHIPPED 2026-08-27 in one session, commit `b9b4bf84`.** All six tasks resolved:
GAT-001…004 built and measured, GAT-005/006 closed unbuilt with the numbers that justify it.
[README.md](README.md) has the summary; [TASKS.md](TASKS.md) has the run table; each GAT file's
status header records what shipped and what was measured.

The headline: `test:ci` = **2,856 specs in 62–73s** (was 645s instrumented, with 900s timeouts
common), failures at the 4-name AIX-006 floor, and the runner refuses exit 0 without a fresh
`tests/test-results.json`.

## If you are debugging a slow or red suite, in order

1. Read `tests/test-results.json` — it is stamped (`gitHead`, `startedAt`) and the runner prints its
   path. Absent = the run graded nothing; the harness message says which kind of nothing.
2. Check the last `[gat004]` line of the log: `EventDispatcher.instance ended with N listeners`.
   **N≈16 is healthy. N≫100 means the listener leak is back** — look for a new suite bypassing the
   rollback in `tests/index.ts`, or a new `on()` path that isn't wrapped.
3. A whole suite red after its first spec, green in isolation = the **lazy-latch singleton** shape
   (see GAT-004 and `tracesession.spec.ts` — reset the latch in that suite's `beforeEach`).
4. Build slow again? The cache is `packages/noodl-editor/.webpack-cache` (405MB, gitignored).
   Deleting it costs one 43s cold build. Editing either webpack test config invalidates it — that
   is deliberate (`buildDependencies`).

## Loose ends deliberately left

- The four AIX-006 floor failures are a pre-existing AIX-006 matter, not this phase's.
- `NOODL_TEST_PROVE_GUARD=1 npm run test:_start_electron` re-proves the exit guard red in ~5s if
  anyone touches `test.js` or the runner.
- The `[gat004]`/`[listeners]`/`[progress]` instrumentation in `tests/index.ts` is cheap and is the
  regression canary — do not strip it as "debug logging".
