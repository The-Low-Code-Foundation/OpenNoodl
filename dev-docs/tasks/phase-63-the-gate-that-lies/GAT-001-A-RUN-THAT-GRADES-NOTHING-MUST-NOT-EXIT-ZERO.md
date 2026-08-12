# GAT-001 — A run that grades nothing must not exit zero

**Status:** 📋 open · ⭐ **the flagship** · **Tier 1: trust** · blocks nothing technically, blocks
everything epistemically

## The observation, exactly

2026-08-12, 23:40, quiet machine, ceiling raised to 35 minutes:

```
lines in log:            15,396
specs started:            2,620   (of 2,702)
"Jasmine:" line:          none
tests/test-results.json:  not written
exit code:                0
log tail:                 lerna success exec Executed command in 1 package: "npm run test:ci"
```

**Twenty-plus minutes of compute, no measurement, and a success exit.** Any script reading `$?`, any
CI, and any human who does not know to grep for a line that is absent, calls that a pass.

Two runs earlier the same evening *did* fail honestly — they printed
`Test run timed out after 900s without reporting results.` and exited 1. So the harness has a working
timeout path. Run 4 did not take it.

## 🔴 The mechanism is unknown, and finding it is half the task

Every failure path in [`test.js`](../../../packages/noodl-editor/test.js) calls `finish(1, …)`:

| Path | Line |
|---|---|
| overall timeout | `:88` |
| renderer fatal (reported by the renderer itself) | `:130` |
| `render-process-gone` | `:167` |
| `did-fail-load` | `:171` |
| `window-all-closed` before results | `:204` |

And `finish(0)` is reachable **only** from the `noodl-test-results` handler, which also writes the
JSON — and no JSON was written. So run 4 exited `0` without calling `finish` at all: the Electron app
ended some other way, with the default code.

⚠️ **Reproduce before fixing.** Candidates, none confirmed:

- The renderer died in a way that killed the app before `render-process-gone` could dispatch (the
  machine had 8.7 GB of swap in use; an OOM kill of the whole process group would do it).
- The event loop simply emptied. `overallTimeout.unref?.()` at `:90` means the timeout **cannot keep
  the process alive** — that is deliberate, but it also means that if the window is gone and no
  handles remain, Electron exits `0` before any guard fires.
- `app.exit()` raced something.

The second is the most interesting because it would be a *designed-in* hole rather than an accident,
and because `unref()` is exactly the kind of line that looks like hygiene.

## §1 — The harness must not be able to exit zero without a measurement

The invariant, stated so it can be tested:

> **`test:ci` exits `0` if and only if it received a results message with `totalCount > 0` and
> `failedCount === 0`.**

Everything else — timeout, crash, closed window, empty event loop, unknown — exits non-zero **and
says which**. A process-level guard is the shape that covers the unknown case, because a handler can
only catch a cause somebody thought of:

- an `app.on('quit')` / `process.on('exit')` guard that turns a zero exit into a non-zero one when
  `didReportResults` is false;
- ⚠️ **it must not swallow a real pass.** `didReportResults` is already the flag; set it before the
  exit rather than inferring from the code.

⚠️ **Do not simply drop the `unref()`.** It is there so a finished run is not held open by a pending
timer. If the empty-event-loop theory is the mechanism, the fix is a guard on exit, not a handle that
keeps the process alive for 35 minutes after it is done.

## §2 — The JSON becomes the readout, and can be told stale

`tests/test-results.json` already carries everything a reader needs and *nobody reads it* — this
session grepped 17,000-line logs four times instead, and briefly believed run 4 had passed because the
file from run 1 was still sitting there.

- **Stamp it.** A run id or a monotonically increasing counter, plus the git `HEAD` at the time, plus
  the spec seed (already present). ⚠️ **Not `Date.now()` alone as the only marker** — two runs in the
  same second are not the problem, a run from four hours ago is, and a human reading `19:10` when it
  is `23:40` has to notice. Make it something a consumer can *compare*, not merely display.
- **Delete it at the start of a run**, so an absent file is unambiguous and a stale one cannot be read
  as fresh.
- **Print the path** on completion, so the next session finds it without being told.

⚠️ It is gitignored, which is correct and must stay — the point is a local readout, not an artefact in
history.

## §3 — Say which kind of nothing happened

Three failures currently look similar in a log and are not the same:

| Kind | What it means | What to do |
|---|---|---|
| timed out | the suite is too slow for the ceiling | raise it, or fix the speed (GAT-004) |
| renderer gone | the suite crashed it | a real defect, probably memory |
| **exited without reporting** | unknown; the case this task exists for | investigate, do not re-run and hope |

The distinction matters because the standing advice — *"a run with no `Jasmine:` line graded nothing,
re-run it"* — is right for the first and **wrong for the third**, where re-running is how three
sessions concluded "the machine is slow" and stopped.

## Acceptance

- A run killed mid-suite (`kill -9` the renderer) exits non-zero and names the reason.
- A run whose results message never arrives exits non-zero, whatever else happens.
- A genuinely passing run still exits `0` — ⚠️ prove this one, it is the regression the guard could
  cause.
- `tests/test-results.json` is absent before a run and present after, carrying enough for a reader to
  tell it apart from the previous run's.
- ⚠️ **Prove the guard red:** stub the results handler so it never fires, and confirm the run exits
  non-zero rather than passing. A guard that has never been seen to fire is decoration.
- The three "nothing happened" kinds print distinguishable messages.

## Register

| # | Finding | State |
|---|---|---|
| G1 | A `test:ci` run graded 2,620 specs, wrote no summary and no JSON, and exited **0** | ✅ measured 2026-08-12 23:40, log `testci-r4.log`, wrapper exit captured separately |
| G2 | Every *known* failure path calls `finish(1, …)`; `finish(0)` is reachable only from the results handler, which also writes the JSON | ✅ read in source, `test.js:76-205` |
| G3 | The overall timeout is `unref()`d, so it cannot hold the process open — an empty event loop exits `0` | ✅ read in source, `test.js:90`. ⚠️ **Whether that is run 4's mechanism is unverified** |
| G4 | `tests/test-results.json` exists, is complete, and is not read by anyone | ✅ verified — this session read it for the first time and it had the answer all along |
| G5 | A stale `test-results.json` is indistinguishable from a fresh one | ✅ observed directly: run 1's file was read as though it were run 4's |
| G6 | Runs 2 and 3 *did* fail honestly with a timeout message and exit 1 | ✅ measured — the harness's timeout path works, so this is not a general failure of the guards |
