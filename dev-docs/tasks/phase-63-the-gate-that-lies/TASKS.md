# Phase 63 — the tasks (GAT: the gate that lies)

**Created:** 2026-08-12, out of [README.md](README.md) and four consecutive `test:ci` runs that
produced one usable answer between them.

**Every number in these files was measured on 2026-08-12.** Anything marked ⚠️ **unverified** must be
confirmed before the task depending on it is worked — and the phase's own headline mechanism (the
listener leak causing the slowdown) is one of them.

## The one-line premise

The gate is slow, and that is the **second** problem — the first is that it can exit `0` having graded
nothing, which is indistinguishable from a pass.

| Task | File | One line | Tier | State |
|---|---|---|---|---|
| GAT-001 ⭐ | [GAT-001-A-RUN-THAT-GRADES-NOTHING-MUST-NOT-EXIT-ZERO.md](GAT-001-A-RUN-THAT-GRADES-NOTHING-MUST-NOT-EXIT-ZERO.md) | **the flagship** — make the gate incapable of reporting success it did not measure, and make the JSON the readout | 1 · trust | ✅ **shipped 2026-08-27**, guard proven red |
| GAT-002 | [GAT-002-THE-WARNING-THAT-COSTS-TEN-THOUSAND-WRITES.md](GAT-002-THE-WARNING-THAT-COSTS-TEN-THOUSAND-WRITES.md) | log the listener warning once, not 10,496 times | 1 · speed | ✅ **shipped 2026-08-27**, fired once in the pre-fix run, never after GAT-004 |
| GAT-003 | [GAT-003-THE-BUILD-THAT-STARTS-FROM-SCRATCH.md](GAT-003-THE-BUILD-THAT-STARTS-FROM-SCRATCH.md) | a webpack filesystem cache — 93 seconds a run, every run | 1 · speed | ✅ **shipped 2026-08-27**: 43s cold → 1.5s warm, invalidation proven |
| GAT-004 ⭐ | [GAT-004-THE-LISTENER-THAT-IS-NEVER-REMOVED.md](GAT-004-THE-LISTENER-THAT-IS-NEVER-REMOVED.md) | **the real fix** — specs leak onto singletons and dispatch is O(n), so the suite degrades as it runs | 2 | ✅ **shipped 2026-08-27**: §0 measured 91% of the run in dispatch; per-spec rollback; 645s → 62.6s |
| GAT-005 | [GAT-005-THE-FAST-SUITES-COME-FIRST.md](GAT-005-THE-FAST-SUITES-COME-FIRST.md) | stop paying twenty minutes for a change the Electron suite cannot see | 3 | ❎ **closed unbuilt 2026-08-27** — the slow suite is now ~90s end to end; selection machinery costs more than running it |
| GAT-006 | [GAT-006-SHARD-THE-ELECTRON-SUITE.md](GAT-006-SHARD-THE-ELECTRON-SUITE.md) | one renderer, 2,700 serial specs, N cores idle | 3 | ❎ **closed unbuilt 2026-08-27** per its own §0: post-004 spec time is 62.6s, far under the five-minute bar |

## Suggested order, and why

1. **GAT-001 first, and alone if the session is short.** Every other measurement in this phase — every
   before/after, every "that made it faster" — is taken on a gate that can currently report a pass it
   did not measure. Fixing speed first means proving it with an instrument known to lie.
2. **GAT-002 and GAT-003 next**, in either order. Together they are about an hour and take roughly 90
   seconds and ~10,000 IPC writes out of every run. Neither changes what is tested.
3. **GAT-004** is the one that matters and the one that can go wrong. It needs a reproduction before a
   fix — see its ⚠️ — and it touches a class used everywhere.
4. **GAT-005** after 004, because sharding or splitting a suite that degrades over its own run just
   distributes the degradation.
5. **GAT-006 last, and possibly never.** If 004 lands and the suite comes back to a few minutes, the
   complexity of sharding buys much less. It is specced so the decision is informed, not so it is
   inevitable.

## The measurement that decides whether this worked

Before and after, on a quiet machine, with `git status` recorded (a sibling's uncommitted specs get
graded too, and have moved the total by +20 before):

```
NOODL_TEST_TIMEOUT_MINUTES=35 npm run test:ci
```

then read **`packages/noodl-editor/tests/test-results.json`**, not the log.

The current baseline, 2026-08-12 on `ea92f0e3`, quiet machine:

```
2702 specs, 6 failures, seed 23155
AIX-006 style vocabulary ×4 · AI model registry ×2
```

⚠️ **Compare names, never counts.** 12 is reachable by a real regression and by an order-dependent
fixture, and only the names tell them apart. That rule survives this phase unchanged.

## What "done" looks like

- A run that grades nothing cannot exit `0`, and says which of the several ways it failed.
- `test:ci` on an unchanged tree completes in **under five minutes** on this hardware.
- The log is dominated by specs, not by one repeated warning.
- A change to `noodl-core-ui` alone does not require the Electron suite to have an opinion.

## How it ended (2026-08-27, all four runs seed 00697 except run 1, quiet machine, `32005f9b` + this phase's edits)

| Run | Config | Wall (specs) | Failures | EventDispatcher at end |
|---|---|---|---|---|
| 1 | GAT-001/002/003 + instrumentation, no teardown | 645.4s | 4 (AIX-006 floor, by name) | 11,338 · NodeLibrary 22,572 |
| 2 | + full per-spec rollback | 72.7s | 4 floor **+ 10 TraceSession** (latched singleton, see GAT-004) | 16 |
| 3 | rollback exempting grouped listeners | 654.0s | 4 floor | 11,338 — **exemption reclaimed nothing** |
| 4 | full rollback + TraceSession latch reset | **62.6s** | **4 — the floor, by name** | **16** |

Done-list verdicts: the first three hold, measured. The fourth is closed the other way: at ~90s
end-to-end (2s warm build + boot + 62.6s specs), running the Electron suite on every change is
cheaper than any machinery for skipping it — that is GAT-005's ❎, not a compromise on it.

⚠️ For future readers: the §0-style instrumentation and the rollback live in
[`tests/index.ts`](../../../packages/noodl-editor/tests/index.ts); every run now prints `[gat004]`
lines at the end. **If `EventDispatcher.instance` at end is much above ~20, the leak is back** — that
line is the regression canary, and it costs nothing.
