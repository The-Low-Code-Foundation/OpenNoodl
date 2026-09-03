# Next session — 🔴 RE-RULED 2026-09-03 (§50): EXP-013 first, then Tier 2.8 · §49 built the animation pair (`States` + `Animate To Value`) as two emitted modules graded frame by frame against the interpreter's own files, and the wired style sink; gated, 17/17 arms, driven 51/51 + a sabotage control (5 diffs, the two mid-tween steps); picker 90 → 92/127

## 🔴 Read this first — Richard, 2026-09-02: *"Stop fucking up the CPU."*

One heavy job at a time on this 16 GB box. Session 77 ran every gate alone (the full suite in
the background while only files were written; the arms sequential; the two drives after them)
and tore Chrome and the preview down in a `trap` (0 listeners, twice). A peer's dev stack came
up and went down mid-session — nothing of mine ran beside it. Memory:
`do-not-pile-cpu-work-on-a-shared-box`.

## The board, re-derived from the task files

| task | status |
|---|---|
| EXP-001 `@nodegx/core` | ✅ Published `0.1.0`; a peer's EXP-001 rows still uncommitted (theirs) |
| EXP-002 / 003 / 005 / 006 / 007 | unchanged |
| EXP-004 | 🟡 built + driven; drill-down panel + three lines for Richard remain |
| EXP-008 | ✅ `export-ledger:check` OK — 176 types, 99 translated |
| EXP-009 backend connection | 🟢 AC4 driven (§42); the client unchanged this session |
| EXP-010 | 🟢 |
| EXP-011 picker coverage | 🟡 **92/127 committed** — §49 `States` + `Animate To Value`; the ledger cannot see the wired style sink, which changes what every exported page can bind |
| EXP-012 | 🟢 |

## What session 77 did (EXP-011 §49)

1. **Read the runtime first**: states.ts (1127 lines), animate-to-value.ts, timerscheduler.ts,
   easecurves.ts, bezier-easing 1.1.1, and how a v2 project boots a node's parameters. Then
   `EXPECTED49.md` before any run, then the fixture `tests/fixtures/glow-desk`, then the
   reverted arm measured (every wire off both nodes dropped; a wire into `opacity` dropped too).
2. **Two emitted modules**: `src/lib/animate.ts` (the scheduler's one-timer engine as a `Run`
   over `requestAnimationFrame` with `runFrame` exported for tests, the four ease names, the
   bezier solver, `useAnimatedValue`) and `src/lib/states.ts` (the whole node as a machine —
   queue drained per pass, intermediates settled, colours through `setRGBA`, the Error text with
   "Did you mean" — plus `defineStates` and `useStates`).
3. **The planner**: `states-out`/`animate-out` reads, the `states-go` action (no chains ride on
   it — Done/Unchanged/Failure are node ports, so listeners passed once), `statesPlanOf` with
   the core cached before the listeners compile, the registration pass, `ownsChainOutput` for
   the `reached-<state>` family, the reads in Pass 4f, and **the wired style sink** on every
   `bindable` (`WIRED_STYLE_SINKS` in style.ts, `styleAttrs` in the emitter).
4. **Graded** in `tests/animation-pair.test.ts` (57 rows): §A loads the interpreter's own files
   and drives them at the same instants as the emitted modules; §B the translation with every
   refusal by name; §C the fixture typechecks. 🔴 The first emit handed the hooks the **store
   objects** (`useAnimatedValue(level, …)`) — typechecked, would never have moved; read off the
   page, pinned by B2/B6, and arm I.
5. Gates alone: tsc 0; suite 61 files 1755 (+2 rows, the file 57/57); ledger OK; picker 92,
   floor 92. **17/17 arms** (A needed a row; E was TS2367 first). **Drive 51/51**, control 46/51.
6. Committed by pathspec.

## 🔴 Do this next — EXP-013 first, then EXP-011 Tier 2.8 row 1 (Richard's ruling, 2026-09-03 — §50)

Richard re-read the remaining list on 2026-09-03 and reversed the "not a target" list: *"these are
much loved and used nodes."* Read **EXP-011 §50** and **§3 Tier 2.8** before anything else. The
board you inherit is not session 77's:

1. **EXP-013 — "Not exportable yet", said where the node is placed.** The next first job, before
   any node. Measured (§50.2): a refusal **cascades** — every node fired only by a refused node is
   refused as *"never fired by a translatable trigger"* — and **nothing in the editor reads the
   ledger** until the pre-flight, which lists components by count, not nodes. The task file has
   seven ACs; the attribution (AC3, naming the root of a cascade in `plan.ts`) is the code, the badge
   is a wire. Product surface: `run-editor`, one heavy job at a time.
2. **Then Tier 2.8 in the order §3 lists**: `Component Children` (a wrapper's children vanish),
   `Script` (ten in one MCP-built project), `Run Tasks`, `On App Error`, `Create New Array` (design
   session first — §7.3's anonymous-Id-by-wire mechanism is the work now), `Filter Records`,
   `Repeater Item`, the streaming trio, the three utilities, the component-object family, the
   component-stack trio, the relation pair, `Drag`. Then Tier 3.11, the transports.
3. **`Sign In With` is OUT** until provider sign-in is a product decision — do not build it.

Same shape as §41–§49 for every row: runtime file first, `EXPECTEDnn.md` before any run, refusals
by name, a fixture on disk, the reverted arm measured, the arms, the drive with a `trap` teardown,
commit by pathspec. The small rows session 77 listed (String-only Variable typing §49.3, the HTTP
body on the control-mint clause §48.6, the transform family) are still open and still small.

## Open residuals (registered, none blocks an AC)

- §49.3: the interpreter's token colour (owner NONE — a runtime defect in states.ts: a
  `var(--token)` value never reaches its colour with transitions on); the Number-constant typing
  gap (EXP-011); the bounce (self-drive) refused; a handler-only read in a listener chain
  unmeasured; the transform family unmapped.
- §48.6 / §47.3 / §46.6 / §45.3 / §44.3 / §43.3 / §41.3 unchanged.

## The numbers (last honest readings, s77)

```
packages/nodegx-export: tsc 0 · jest 61 files, 1755 rows at the full run (+2 rows after, the file 57/57) · 17/17 arms
export-ledger:check OK — 176 types, 99 translated · picker 92/127 (72.4%), floor 92, --check exit 0
drive run1: 51/51 cells (EXPECTED49.md), consoleErrors [], 0 listeners · control: 46/51, 5 diffs = D3 ×2, D10 ×3
```

## Instruments (s77 scratchpad `21bc4cc5-4ad3-44c7-8215-496aa003a2d5/scratchpad`)

`EXPECTED49.md`, `mkfixture49.js`, `emit49-before/` (the reverted arm), `emit49/`, `tc49.ts`,
`mut49.py` / `runmut49.sh` / `mut49-summary*.txt`, `arm49-*-{tsc,jest}.log`, `drive49.mjs` /
`drive49-run.sh` / `arm49-ctl.sh`, `drive49-run1.log` + `drive49-ctl.log` (+ `.drive.log`, the
`-out.json`s), `harness49/` (node_modules → s70's `harness43`), `jest-full-s77-1.log`,
`section49-draft.md`, `*.before` source snapshots.

## 🔴 What session 77 would tell you if it could only say three things

1. **A typecheck cannot see the wrong object handed to an `unknown` parameter.** The hooks were
   given the store objects and every gate was green; the emitted page, read, was not. Read the
   page before the first test.
2. **A node's outcome ports belong to the node, not to the trigger.** Done/Unchanged/Failure are
   pulsed by `reportOutcome` whichever port asked; arms printed per call site would have fired a
   chain for one trigger and printed it N times. Read `reportOutcome`'s caller before choosing a
   shape.
3. **Load the interpreter's whole node when the transcription is the deliverable.** Booting
   `states.ts` through a stand-in for `Node` and draining it as the runtime drains it found the
   boot transition, the reachable-only-after-a-failure Unchanged, and a colour defect the
   interpreter has had for years — none of which a translation test could see.

## Standing practice

`cline-dev`; commit by exact pathspecs; `git status | grep '^??'` first (`git add` untracked
before a pathspec commit or they are skipped silently); delete probe specs before committing;
reconcile the suite count against disk (61); `grep -a`; absolute paths; **`vm_stat` + `ps` before
any suite, never more than one of mine, tear servers down in a `trap`.**
