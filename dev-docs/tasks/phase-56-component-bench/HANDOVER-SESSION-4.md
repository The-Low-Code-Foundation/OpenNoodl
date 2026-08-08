# Phase 56 — handover after session 4 (2026-08-08)

**What ran:** **BEN-003**, built and **driven**, every acceptance criterion closed with a measured
number — plus a mid-session ask from Richard (the node canvas should follow the bench) which turned
out to expose the last place the bench was still a snapshot.

The channel question BEN-003 insisted be answered *in writing before any UI* was answered by probing
a live bench client, and the answer was not the one the task expected. Two defects had to be fixed
before the read-out could exist at all, and both were of this phase's recurring shape: **a mechanism
that is exactly right and has no consequence** — or worse, has a consequence somewhere else.

Read [HANDOVER-SESSION-3.md](HANDOVER-SESSION-3.md) first; its traps still govern, and B10 and B16
are now the same family with three cases.

## What is on the branch

| Commit | What |
|---|---|
| `47e335a2` | **BEN-003/1** — the channel. Runtime stamps `clientId` on four replies; `sendTraceEnabled` gains a `target`; `TraceSession` stops accepting another client's buffer. 4 runtime specs |
| `9d2fb762` | **Richard's ask** — the canvas follows the bench, and the inputs rail re-derives its interface live instead of freezing with the export |
| `6983d881` | **BEN-003/2** — the outputs read-out: value rows, a signal log, and a logic-only component previewing for the first time. 10 editor specs |
| (this one) | register rows B15–B19, the task file's acceptance table, and this file |

## The channel: one, not two — and the task file was right to demand a probe

BEN-003 planned `getPortValues` for values and the trace for signals. **`getPortValues` can never
show a signal**: measured, `Pressed` reads `"undefined"` before, during and after firing, because a
signal has no state to read. And `getTraceEvents(afterSeq)` is a **tail read rather than a sample**,
so it loses nothing between pulls — the Risks table's own *"a signal that fires between polls is
missed and the rail lies by omission"*, avoided rather than mitigated.

A component output is legible as an edge landing on the mounted component's `Component Outputs` node:

```
seq=6 cause=0 kind=signal be-button.onClick       -> be-co.Pressed = true
seq=8 cause=5 kind=value  be-counter.currentCount -> be-co.Count   = 6
```

`getPortValues` survives in one role: **seeding** the value rows, because a value set before the
bench armed is in no buffer.

## The two defects that had to be fixed first

### 1. No reply on this channel said who sent it (B15)

All eight replies of the probe arrived with `clientId: undefined`. The relay forwards viewer traffic
**verbatim**, and the runtime never stamped its own id — though `sendInputResult` and
`sendNodeLibrary` always did, which is what makes the omission an oversight rather than a design.

`TraceSession` already anticipates the broadcast and de-duplicates by `seq`. That defends against
re-delivery of **its own** client's buffer. A *second* traced client numbers from 1 independently,
hits the `highest < lastSeq` branch, and **replaces a human's recording with the bench's**. The
component bench is precisely that second client, so this was a precondition and not a follow-up.

Also fixed: `TraceSession` chose `clientsWithRuntime(Browser)[0]`, and a `sandbox-` window is a
browser runtime too — which of them was "the preview" was an accident of registration order.

### 2. Arming was a broadcast (B17)

Measured before building anything: arming from a third peer armed **both** viewers, and the app
preview answered `enabled:true`. Adding `target` fixes it with **no runtime change**, because the
relay routes any message carrying one — B2's finding arriving a second time, in a second place.

```
armed with target=<bench>  →  bench {"enabled":true,"owners":["ben003-probe2"]}
                              app   {"enabled":false,"owners":[]}
```

## Richard's ask, and what it exposed

*"When previewing a single component, the node canvas should show that component's nodes, and I
should be able to tweak it and see the changes live — including new ports — but still navigate away."*

The canvas half is small: `revealBenchTarget` fires `ComponentPanel.SwitchToComponent` from the two
places a **user** asks for a bench target. ⚠️ Deliberately **not** from the surface that renders one —
`VisualCanvas` remounts on layout changes and re-claims its scope, so navigating from there would
yank the canvas back every time and undo a deliberate move away.

The live half exposed something better. The running bench **already** received graph edits — its
export contains the component being edited, so it applies the editor's ordinary broadcast
`modelUpdate` deltas like any other viewer. The *rail* was the only half that could not see them,
because it was built once with the export. So the fix is to re-derive the **interface** (one
`getPorts()` call) without rebuilding the export, which would reload the window and destroy the state
someone is inspecting.

⚠️ **The derived interface keeps its identity when nothing changed, and that is load-bearing.**
`Model.parametersChanged` fires on every keystroke anywhere in the editor, and each row's draft is
reset by an effect keyed on `port` — a fresh object per event would wipe what the user was typing
from a property edit three panels away.

## What the drive proved

Every number came out of the running editor.

| Claim | Evidence |
|---|---|
| A click **inside** the component appends its signal | `Press me` clicked in the webview; `+4.8s Pressed` appeared after **1.2s**, on the interval pull alone |
| A value output moves when an input feeding it changes | three `Bump` pulses: `Count` **0 → 3**; the in-component click made it **4** |
| **The previously impossible case** | `/Components/BenchLogicProbe` has no visual root, mounts, says *"nothing to draw — feed it inputs and watch the outputs rail"*, and gives `Count` **0 → 3** with three `Changed` rows |
| Polling stops when the bench is not the active mode | counted on the wire: **15** `getTraceEvents` in 10s benched, **0** in 12s after switching to App |
| A recording in progress is undisturbed | app preview still `{"enabled":true,"owners":["human-hud"],"highestSeq":37}` after the bench mounted, ran and tore down |
| The canvas follows, and lets go | `/Pages/Landing` → `/Components/BenchEmitter` on bench; opening `PuppyCard` moved the canvas and it **stayed** there while the preview stayed benched |
| A new port reaches the rail with no reload | `LiveAdded` added → row appears; removed → row goes. The marker planted in the bench window survived both |
| A graph tweak renders live | a node's `label` parameter changed → bench rendered `"Press me"` → `"TWEAKED LIVE"`, marker intact |

## ⚠️ Traps, for whoever drives next

- **A spec file not exported from its directory's `index.ts` never runs, and the suite stays green
  (B18).** `tests/index.ts` re-exports one barrel per directory and each barrel names its files by
  hand — there is no glob. Ten specs were written, typechecked, and **dead**; the only tell was the
  `Jasmine:` **count** being unchanged. Compare the count against the previous session's before
  believing a green run.
- **This channel is a display dialect, not JSON (B19).** `previewValue` writes the literal
  `undefined` for an unset value and wraps strings in quotes they never had. `{ exists: true,
  value: "undefined" }` means *the port holds nothing*. The read-out printed the word before that was
  understood, and it was found by mounting the same component twice and getting a different answer.
- **A read on an occluded bench is stale, and the read is not what is wrong (B16).** `Count=3`,
  pulse, read → `3`; force a frame with a screenshot, read → `4`. A queued parameter is applied on a
  frame and an occluded renderer runs none.
- **A targeted message is invisible to a third-party spy**, which is the targeting working rather
  than the send failing. Verify the *consequence* instead.
- **The sandbox clientId is stable across a bench target change** — `useSandboxViewer` memoises it
  for the life of the mount. A driver comparing clientIds to detect teardown will conclude, wrongly,
  that teardown did not run.
- **The context menu must be measured and clicked in one step.** Measuring in one `eval` and clicking
  in the next missed the item by ~30px; the popup layer re-positions between calls.

## Fixtures

Two were authored in `NodeGX test projects/Puppy test 3`, because **the corpus contained no component
with a declared output at all** — the same gap session 3 found for typed inputs:

- **`/Components/BenchEmitter`** — a value output (`Count`) and a signal output (`Pressed`), plus a
  button so a click *inside* the component can be driven;
- **`/Components/BenchLogicProbe`** — no visual root. Inputs → a counter → outputs, and nothing to
  draw.

## Gates

- `npm run test:main`: **80 suites, 1085 tests, all passing** — unchanged.
- `noodl-runtime` jest: **127 suites, 2310 passing, 13 skipped** — unchanged, plus the 4 new specs.
  H1 was confirmed **red** without the fix.
- `typecheck:editor`, `typecheck:editor-tests`: clean. `eslint` clean on every new file; the 8
  remaining errors in touched directories are at the same lines as at the base commit.
- `npm run test:ci`: **`Jasmine: 2538 specs, 6 failures`** against session 3's `2510 / 6`. **28 new
  specs, all mine, all passing**, and the **same 6 inherited failures** — 4 `AIX-006 style
  vocabulary`, 2 `AI model registry`, neither file in this diff. Compare the count, not the summary.

⚠️ **It took three runs to get that line, and the two bad ones are the lesson (B20).** Three specs
covering `revealBenchTarget` substituted `ProjectModel.instance` with a small fake. Clearing it
afterwards gave **2541 / 65** — 59 unrelated failures in four later directories. *Restoring* it gave
a **900s timeout with no `Jasmine:` line at all**. Both times this suite's own rows were green. The
rows were deleted rather than repaired; the behaviour is covered by the live drive above.

## What to do next, in order

1. **BEN-005**, scenarios — and note that the outputs read-out gives it something to save *besides*
   inputs, which BEN-005 as written does not anticipate.
2. **BEN-007** last and live.
3. **Loose ends**, none blocking: the remount branch of Reset still has no live case (B13);
   `SiteHeader`'s six literal `Text` placeholders on the bench are still unexplained; and B19 has no
   way to tell a genuine string `"undefined"` from an unset port — the read-out prefers the reading
   that is nearly always right.
