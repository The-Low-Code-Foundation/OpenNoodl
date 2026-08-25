# Phase 75 — next session

**State as of 2026-08-25 (session 29).** Session 28 closed FB-016. **Session 29 built, specced and
drove FB-022 — drag-to-scrub — and it is CLOSED, AC1–AC5.** Read *"What session 29 found"*, then
pick from *"First moves"*.

⚠️ **Peers.** `3878` is **opennoodl-78**, this checkout — idle and cooperative all session, and it
volunteered a machine reading before both `test:ci` runs without being asked. `39469` is
`trybeup-prod-c0`, a different project. A socket census tells you HOW MANY and HOW TO REACH; only
`ListAgents` tells you WHICH PROJECT. 🔴 **`SendMessage` to a cross-session peer needs the `[ref]`**
— the bare name is rejected with the ref in the error, so just re-send.

## What session 29 found

### 🔴 A GREEN SUITE OF 83 SPECS MISSED TWO DEFECTS. THE DRIVE FOUND BOTH IN TEN MINUTES.

Both were *individually plausible everywhere you looked*, which is why nothing caught them.

1. **The fake was MORE CAPABLE than the real object.** `scrubCommit`'s spec used a fake node with
   `notifyListeners`. The thing it stands for — **`ModelProxy`, not `NodeGraphNode`** — did not
   have it. The first real undo threw, and the field kept showing the dragged value while the
   project held the old one. ✅ **A fake can always be given a method; only the real source can
   say whether it exists.** The guard now parses `modelProxy.ts` and checks the methods
   `commitScrub` calls are declared.
2. **A default declared as a STRING is a type the declaration and its reader can disagree about
   silently.** `transformOriginX` declares `default: '50'`. My reader took `number` only, so a
   +30px drag wrote **30** into a field that had been showing **50** — the panel stringifies
   whatever it gets, so the display was right the whole time. Across the 33 scrubbable ports:
   **14 number / 5 string / 14 absent**, and ⚠️ **three of the five strings are `'Auto'`**, so
   coercion had to be *rejecting* too. 🔴 **It fails as a plausible value, never as an error.**

### ⚠️ A THIRD STRING DEFAULT LIVES OUTSIDE THE CORPUS I BUILT

The AC4 corpus is the **shared mixins only**. A peer's prompt to widen the check found
`visual/circle.ts` giving `size` (type `number`) `default: '100'`. **A per-node port is invisible
to a shared-mixin sweep.** There is now a grep over the whole viewer source beside it.

### ✅ What starving the candidates was worth

18 deliberately-broken implementations, each killed on rows that name the right defect —
**including the documented `UndoActionGroup` `ptr = 0` trap** (constructor `do`/`undo` form pushes
fine and then never fires). 🔴 **But one mutant killed ZERO rows and that was the real finding**:
making `writeScrubStep` record undo *per pixel* — the exact defect AC1 exists to prevent — changed
nothing, because the fake ignored the third argument. **The suite was green and meaningless.**

## First moves, in order

1. **FB-021** (M) — gated ports render disabled with their reason. **UNOWNED, numbers verified**
   (s26, `4629dceb`). `basic` suppresses only the property row, so **328 gated input ports on the
   shipped catalog are live, wireable, and have their value delivered then discarded**, against 21
   genuinely-absent `extended` ones. 🔴 Two traps in its file: **21 is the group count AND the port
   count by coincidence** (count ports, never groups), and **all 21 `extended` ports are on
   data/logic nodes, none visual**. Seam: `portDecoration.ts`; splice: `modelProxy.ts:76`.
   ⚠️ **`modelProxy.ts` now has a `notifyListeners` forwarder** (FB-022) — read it before editing.
2. **FB-023** — was being worked by `3878` this session; check with it before starting.
3. ⚠️ **Deliberate remainders, unchanged**: FB-011 AC1 superseded; FB-007's composer undriven in a
   browser; `apisurfaces.ts`' `personProfile` flat disc.
4. **Still needing Richard**: FB-017 scope 2's `Source Set` demotion; FIX-026 (a)/(b); FIX-027
   14/15/16 + 22; tsfixme baseline; prod `ANTHROPIC_API_KEY` (⚠️ **intro pricing ends 2026-08-31 —
   six days**); the 15 lessons' prose; Discord's row in the `?` menu; `/rfps` search.

## Found while working, owned by nobody

- ⚠️ **FB-022's crosshair interaction is settled by MECHANISM, not by pixels.** In Design mode the
  viewer frame has **zero rendered elements**, so `[data-noodl-transform-origin]` stayed
  `display: none` throughout — including in the control reading before any focus. What was
  measured is that the field keeps focus and `transformOriginFocus.focused` still holds the port.
  🔴 **Driving the crosshair needs the app RUNNING, which is a different mode from the one the
  property panel lives in.** Nobody has driven those two together.
- ⚠️ **`user-select: none` was confirmed *set* during a drag and restored after, but never
  confirmed to visibly prevent a selection being painted.** Same for a mouseup genuinely outside
  the OS window — document listeners make it work in principle and it was not observed.
- ⚠️ **One commit in three dropped focus and is still NOT characterised** (s28, unchanged). The
  obvious hypothesis was tested on the sibling port and did not reproduce. One observation.
- ⚠️ **The auto-margin branch of FB-016's alignment fact is still written, specced and never
  exercised in a running app** — `Layout.align` uses `auto` margins only when the parent lays out
  in a **row**, and the fixture's parent is a column.
- ⚠️ **`AskAboutNodeDialog.module.scss` is STILL uncommitted — tenth session running.** Belongs to
  no session; Richard's call. Same for the phase-70/71/72 working files.
- The highlighter's disposal bug is untouched: a **selected** node whose element has gone is never
  removed from `selectedNodes`, so it is revisited and `remove()`d every frame.
- Unchanged and unchased: `SidebarModel.switch('PortEditor')` crashes the panel; the Settings panel
  clips two rows; a `Number` node draws a group literally called `ADVANCED` beside the synthetic
  `Advanced CSS`; `getConnectionSourceLabel` returns nothing for the checkbox row; `check:css` in
  `nodegx-community` has one pre-existing non-ours violation.

## ⚠️ Harness — three corrections from this session

- 🔴 **`test-results.json` is at `packages/noodl-editor/tests/`, NOT `packages/noodl-editor/`.**
  The "delete it before the run" precaution was aimed at the wrong path and was a **no-op**. Both
  runs were read from the **summary line** plus a fresh mtime instead.
- ⚠️ **`window.NodeGraphContextTmp` is NOT a window global — and that is not a correction to the
  older note, which never said it was.** That note reaches it through the **module cache**. I probed
  the wrong container, got `undefined`, and nearly filed it as the note being wrong. 🔴 **Checking
  the wrong container is not evidence against a claim.** Plain `window.__nodeGraphEditor` was the
  live editor here (one project, no AI preview canvas); the older note's warning is about the state
  *after* a preview canvas renders. ✅ Settle it by `ed.el.getBoundingClientRect()` — 0×0 = detached.
  `ed.forEachNode(cb)` returns on truthy; `ed.selectNode` wants a VIEW, not a model.
- 🔴 **The editor opens in PREVIEW; the property panel needs the pencil `ModeSegmentedButton`**
  (`button[class*=ModeSegmentedButton][aria-pressed=false]`). And ⚠️ **`Transform Origin X/Y` are
  inside collapsed groups reporting a 0×0 box** — ✅ type `transform` into the **`Filter
  properties`** input (there are two `SearchInput`s; the other is `Filter components`).
- ✅ **`cdp drag "<x,y>" "<x,y>" [steps]` exists** and is the only correct way to drive a gesture —
  press, 12 moves at 16ms, release, **on one connection**. Two `cdp click`s are not a gesture.
- ✅ **To read the undo queue live**: rebuild the webpack require
  (`webpackChunknoodl_editor.push([[Symbol()],{},r=>req=r])`), then
  `req('./src/editor/src/models/undo-queue-model.ts').UndoQueue.instance`. `window.__req` is absent.
- ⚠️ **A backgrounded `npm run test:ci` reports "completed, exit code 0" within ~90 seconds** — that
  is the `nohup` wrapper, not the suite. Hit twice this session. **Poll for the summary line.**

## Gates, this tree (OpenNoodl, `cline-dev`) — 🔴 re-measure, never quote

- `npm run test:main`: **331 files / 5338 specs / 0 failures** (s28: 326 / 5253) — the five new
  `tests-unit/fb-022` files and their 85 specs.
- ✅ **`test:ci` RUN TWICE, both after and before the drive's fixes**: 13:06→13:19 seed **26506**,
  and 13:41→13:54 seed **48211**. Both `Jasmine: 2849 specs, 4 failures (failed).` All four
  `AIX-006 style vocabulary`, **by name** — same four as s26/s27/s28. **The floor is 4, not the 10
  still quoted in older files.** Two seeds in one afternoon now stand behind it.
  ⚠️ A peer predicted a possible fifth (`AIX-011 criterion 7`, the 30ms flake) because an iOS
  simulator was pinning a core. **It did not fire** — so that flake survives at least one
  core-pinned run, and *"a loaded runner loses it"* is too broad. The trigger is unidentified.
- `npm run typecheck:editor`: **0 errors**, and **proved to see the four new files** by planting 4
  errors (4 reported, naming exactly them) and removing them.
- 🔴 **`npm run typecheck:core-ui` is a PRE-EXISTING DIRTY GATE: 44 errors, none of them mine.**
  `@noodl-viewer-cloud/execution-history` resolution, VersionControlPanel, AiSettings. ⚠️ Its only
  "scrub" hit is `main/src/execution-history/scrub.ts`, an unrelated file sharing the word. **Do
  not quote this gate as passing.**
- Not run, nothing touched them: `typecheck:viewer`, `typecheck:core-ui` fixes, `noodl-runtime`,
  all of `nodegx-community`.

## Gates, `nodegx-community`

Unchanged since session 18 and **not re-run**: 58 files / 1398 specs / 0 failures, `tsc` clean,
`build` clean, `check:css` 1 pre-existing violation. nexus-1 serves `acd4a9a`. **FB-022 is
editor-side and does not deploy.**

## Session notes

- ✅ **Drive harness**: `npm run dev:debug -- --quiet` (background), poll
  `curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/src/editor/index.bundle.js` for
  `200`, then `npm run cdp -- health`. First compile took ~90s on a warm tree.
- ✅ **Prove your code is loaded**: `curl …/index.bundle.js | grep -o SYM | wc -l` — used three
  times this session, including to confirm each hot fix had compiled before re-driving.
- ✅ **Restored as found**: drove a **copy** (`fb022-drive`), deleted it afterwards; the recents row
  removed after `dev:stop`; the real `fb016-drive` fixture untouched (mtime still 12:19:47).
- ✅ **`dev:stop` reported 25 processes and spared all 8 MCP helpers** — verified by `ps` after, not
  assumed. Launch and both `test:ci` runs announced to `3878`, teardown too.
