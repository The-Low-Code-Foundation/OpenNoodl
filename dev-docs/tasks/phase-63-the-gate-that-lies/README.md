# Phase 63 — The gate that lies, and the twenty minutes it costs (Track GAT)

**Created:** 2026-08-12
**Status:** ✅ **SHIPPED 2026-08-27** — GAT-001…004 built and measured; 005/006 closed as unnecessary.
Tasks are **[TASKS.md](TASKS.md)** (GAT-001…006). Headline, same suite, same machine:
**2,856 specs in 62.6s** (four runs earlier that week could not finish inside 900s), failures back to
the 4-name AIX-006 floor, and a gate that can no longer exit 0 without a fresh
`tests/test-results.json` to show for it. The leak was real and measured: **91% of the run** (587.6s
of 645.4s) was inside `Model.notifyListeners`, almost all of it the `EventDispatcher.instance`
fan-out scanning a cumulative 1.54 billion listener entries; a per-spec listener rollback in
`tests/index.ts` removed it. Details and the two surprises (Electron's `app.exit()` ignores the
`process.exitCode` rewrite that plain Node honours; exempting *grouped* listeners from rollback
reclaims **nothing** because the leak is owners that never call `off`) are in the task files.
**Origin:** Richard, 2026-08-12, after a session in which `test:ci` was run four times and produced a
usable answer once:

> *"This is a fucking nightmare. We can't keep developing if every jasmine test or whatever you were
> doing takes like 30 minutes. What can we do to unfuck this for all future tasks?"*

**Every number in this phase was measured on 2026-08-12**, on this hardware, from four consecutive
`test:ci` runs whose logs are quoted below. Nothing here is inferred from reading code alone; where a
mechanism is *not* yet proven, it says so and the task carries a reproduce-first instruction.

## The premise, in one sentence

The gate is slow, and that is the *second* problem — **the first is that it can exit `0` having
graded nothing**, which is indistinguishable from a pass.

## The four runs, as measured

| Run | Lines | `10000 listeners` warnings | Specs started | `Jasmine:` line | Exit |
|---|---|---|---|---|---|
| 19:10, on `ea92f0e3` | 17,406 | 12,368 (**71%**) | 2702 | ✅ 2702 specs, 6 failures, seed 23155 | 1 (real failures) |
| 22:31 | 12,082 | 9,163 (**76%**) | 1,294 | ❌ none | 1, *timed out at 900s* |
| 22:55 | 13,615 | 9,412 (**69%**) | 1,958 | ❌ none | 1, *timed out at 900s* |
| 23:40, ceiling raised to 35 min | 15,396 | 10,496 (**68%**) | 2,620 | ❌ none | 🔴 **0** |

Read the last row twice. It ran for over twenty minutes, graded 2,620 of 2,702 specs, wrote **no
summary line and no `tests/test-results.json`**, and **exited zero**. Every automated reading of that
run — and every human one that trusts `$?` — calls it a pass.

## What is actually on disk

| The cost | What the product does | Where |
|---|---|---|
| **93 seconds, every run** | webpack rebuilds the whole test bundle from scratch; there is no `cache` entry in the config | [`webpack.test.js`](../../../packages/noodl-editor/webpackconfigs/webpack.test.js), [`webpack.test-ci.js`](../../../packages/noodl-editor/webpackconfigs/webpack.test-ci.js) |
| **~70% of all log output** | past 10,000 listeners, **every** `on()` call logs a line | [`model.js:17-19`](../../../packages/noodl-editor/src/shared/model.js) |
| **Every one of those lines crosses a process boundary** | in CI the handler forwards *all* renderer console output to stdout | [`test.js:161-165`](../../../packages/noodl-editor/test.js) |
| **Listeners are never removed** | `on()` appends forever; `off(group)` only removes listeners that were given a group, and no spec passes one | [`model.js:10-21`, `:83-92`](../../../packages/noodl-editor/src/shared/model.js) |
| **Dispatch is O(n) over every listener ever added** | `notifyListeners` walks the whole array, running `shouldNotify` — which does string `indexOf` — on each | [`model.js:55-80`](../../../packages/noodl-editor/src/shared/model.js) |
| **A run that grades nothing can exit 0** | every *known* failure path calls `finish(1, …)`, so the 23:40 run took a path nobody has identified | [`test.js:76-84`, `:167-205`](../../../packages/noodl-editor/test.js) |

### The dispatch cost, benchmarked

`Model.notifyListeners` copied verbatim, listeners registered for events *other* than the one
dispatched (the suite's actual shape — a singleton with thousands of subscribers, most uninterested):

```
    10 listeners -> 0.0013 ms/notify  (1x)
   100 listeners -> 0.0011 ms/notify  (1x)
  1000 listeners -> 0.0106 ms/notify  (8x)
  5000 listeners -> 0.0509 ms/notify  (41x)
 10000 listeners -> 0.0996 ms/notify  (79x)
 20000 listeners -> 0.1873 ms/notify  (149x)
```

Linear in the listener count, as the source says it must be. **The suite therefore gets slower the
longer it runs**, which is consistent with all four runs dying in the last quarter and none in the
first half — but consistency is not proof, and GAT-004 must reproduce it before claiming it.

## ⚠️ Correction 1 — "the run timed out" was true twice and wrong once

The standing advice ([`test.js:40-58`](../../../packages/noodl-editor/test.js)) is that a run with no
`Jasmine:` line has *"graded nothing"*, and that the usual cause is a thrashing machine. That is the
right reading of runs 2 and 3, which both printed `Test run timed out after 900s`.

**It is the wrong reading of run 4**, which printed no such line, exited `0`, and ended with
`lerna success`. Treating all four the same way is how three sessions in a row concluded "the machine
is slow" and stopped there. **A timeout and a silent zero-exit are different defects** and only one of
them is about speed.

## ⚠️ Correction 2 — the results already exist in a file, and nobody reads it

[`test.js:110-115`](../../../packages/noodl-editor/test.js) writes `tests/test-results.json` —
`totalCount`, `failedCount`, `seed`, and every failure's `fullName` — precisely so *"a CI run that
loses its log tail can still see what happened"*.

Every session so far, including this one, has instead grepped 17,000 lines of log for a `Jasmine:`
line. The standing memory rule *"only the `Jasmine:` line counts"* is a rule about the **log**, and it
quietly taught everyone to ignore the structured artefact sitting next to it. GAT-001 makes the JSON
the primary readout.

⚠️ The file is **gitignored and not timestamped in any obvious way**, so a stale copy from an earlier
run reads exactly like a fresh one — which is how this session briefly believed run 4 had passed. Any
consumer must be able to tell.

## ⚠️ Correction 3 — the warning is not the leak, and fixing it fixes nothing on its own

It is tempting to read *"more than 10000 listeners"* as the bug. It is the **symptom**, and the log
line is a *third* thing again:

1. Specs leak listeners onto singletons — the defect (GAT-004).
2. Dispatch is O(n), so the leak costs time — the consequence.
3. Past 10,000, each `on()` logs — noise that costs IPC, and **only** noise (GAT-002).

Silencing (3) makes runs quieter and shorter and leaves (1) and (2) exactly where they are. Doing it
first is still right — it is five minutes and it stops the log drowning the answer — but it must not
be mistaken for the fix, and GAT-002's acceptance says so explicitly.

## What this phase is not

- **Not a rewrite of `Model`.** It is used everywhere and a new event system is a different phase.
  GAT-004 removes listeners; it does not redesign subscription.
- **Not a migration off Jasmine.** The editor's two runners are a recorded fact of this repo and
  moving 2,700 specs is not what any of this is about.
- **Not about making the drives faster.** Live QA is slow because it drives a real editor, which is
  the point of it.

## The shape of the answer

Three tiers, in the order they pay off:

1. **Trust** (GAT-001) — a run that grades nothing must be impossible to mistake for a pass. Nothing
   else in this phase is worth doing until the gate stops lying, because every measurement after it is
   taken on faith.
2. **Cheap speed** (GAT-002, GAT-003) — roughly 90 seconds of build and ~10,000 IPC writes per run,
   for about an hour of work between them.
3. **The real fix** (GAT-004), then **structure** (GAT-005, GAT-006) — stop the degradation, then stop
   paying for the slow suite on changes that cannot affect it.
