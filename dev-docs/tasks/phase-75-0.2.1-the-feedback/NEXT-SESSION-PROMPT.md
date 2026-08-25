# Phase 75 — next session

**State as of 2026-08-25 (session 28).** Session 27 built and drove FB-016 scopes 1/2/3/5.
**Session 28 built and drove scope 4, the transform-origin crosshair, and FB-016 is now CLOSED** —
all five scopes ship, AC1–AC4 met. Read *"What session 28 found"*, then pick from *"First moves"*.

⚠️ **Peers.** `3878` is **opennoodl-78**, this checkout; idle and cooperative all session, and it
volunteered a machine reading before the drive without being asked. `39469` is `trybeup-prod-c0`, a
different project. A socket census tells you HOW MANY and HOW TO REACH; only `ListAgents` tells you
WHICH PROJECT.

## What session 28 found

### 🔴 THE SCREENSHOT CHANGED THE DESIGN TWICE AGAIN — same as session 27, one layer up

1. **`getComputedStyle` answers the *used* value, and on an untouched element that lies about
   provenance.** The label read `transform-origin: 180px 30px` for an element whose origin had
   **never been set**, and the second line restated the same two numbers. ✅ **There is no
   provenance to read** — computed style cannot say whether a declaration came from a stylesheet or
   from CSS's own initial value — so it is settled **by value**: an origin resolving to the centre
   of the box behaves as the default whoever wrote it. ✅ **And drop a derived line when the source
   line already IS the derivation.**
2. **The crosshair's label was covering the box-model fact chip**, hiding `width`, `height` and half
   the alignment sentence. 🔴 **When you add a second floating annotation, the obstacle is the
   FIRST one, not the element.** Proved the fix fired rather than assuming it: reconstructed the
   un-nudged spot in the running app (`WOULD_HAVE_OVERLAPPED: true`) and the label had moved.

### 🔴 TWO `cdp click`s ARE NOT A TAB — and it read as a product defect

The first P7 reading recorded a genuine crosshair blink. Driven as two separate `cdp click`
invocations, each opening and closing its own CDP connection, the window's OS focus churns in the
gap and `blur`/`focus` land in **different tasks**, so a debounce that is correct for a real tab
fires. ✅ **Isolating the gesture in ONE eval** (window holding OS focus) gave `blur:X` → `focus:Y`
in one task and **zero mutations** on the element under test. Both readings are true and answer
different questions — say which one you drove. Now in the driving index.

### 🔴 A SPEC ROW PASSED AGAINST A DELIBERATELY BROKEN IMPLEMENTATION

Three wrong candidates were built and run against the suite; each died on a different row. **One row
died on none**: the zoomed-page arm used `50% 50%`, and a percentage of the scaled rect and of the
unscaled layout box are the same fraction of the same element, so the zoom factor **cancels**.
Rewritten with a pixel origin. ⚠️ **Never use a percentage to test a scale** — ratios, fractions and
midpoints all silently survive a missing factor. **Starving the candidate is the only thing that
found it.**

### ⚠️ And one prediction whose NUMBER was wrong while its CLAIM held

P6 predicted the origin would land at "the top-centre of the bounding box" — true for a **square**,
and the fixture element is 360×60. The falsifier (*"lands at `rect.x, rect.y` ⇒ the naive
implementation"*) is what settled it. **Write falsifiers, not just expected values.**

## First moves, in order

1. **FB-022** (M/L) — drag-to-scrub numerics. FB-017's rows are settled and its geometry stable, and
   FB-016 no longer competes for the same files. ⚠️ **It will touch `NumberUnitInput.tsx`, which now
   carries `onFocus`/`onBlur`** — scrubbing must not fight the crosshair's focus tracker; a scrub
   that steals focus from a transform-origin field will drop the crosshair mid-drag.
2. **FB-021 is UNOWNED and its numbers are verified** (session 26, `4629dceb`). A `sizeMode`-gated
   port is *not* absent: `basic` suppresses only the property row, so **328 gated input ports on the
   shipped catalog are live, wireable, and have their value delivered then discarded**, against 21
   genuinely-absent `extended` ones. 🔴 Two traps in its task file: **21 is the group count AND the
   port count by coincidence** (count ports, never groups), and **all 21 `extended` ports are on
   data/logic nodes, none visual**. Seam: `portDecoration.ts`; splice: `modelProxy.ts:76`.
3. ⚠️ **Deliberate remainders, unchanged**: FB-011 AC1 superseded; FB-007's composer undriven in a
   browser; `apisurfaces.ts`' `personProfile` flat disc.
4. **Still needing Richard**: FB-017 scope 2's `Source Set` demotion; FIX-026 (a)/(b); FIX-027
   14/15/16 + 22; tsfixme baseline; prod `ANTHROPIC_API_KEY` (⚠️ **intro pricing ends 2026-08-31 —
   six days**); the 15 lessons' prose; Discord's row in the `?` menu; `/rfps` search.

## Found while working, owned by nobody

- ⚠️ **One commit in three dropped focus, and it is NOT characterised.** Committing `50 → 0` into
  `Transform Origin X` left `document.activeElement` as `BODY`. The next two commits kept focus, and
  the input node was proved identical across the commit (a `data-marker` attribute survived,
  `sameNodeAfterCommit: true`). The obvious hypothesis — "the first parameter ever set on a node
  rebuilds the panel" — **was tested on the sibling port and did not reproduce**. One observation.
- ⚠️ **The auto-margin branch of FB-016's alignment fact is still written, specced and never
  exercised in a running app** (unchanged from session 27) — `Layout.align` uses `auto` margins only
  when the parent lays out in a **row**, and the fixture's parent is a column.
- ⚠️ **The viewer bundle does not hot-reload** (confirmed again): a change to `noodl-viewer-react/src`
  needs an editor reload **and a reopen of the project**. Budget two reload cycles per viewer change.
- ⚠️ **`Transform Origin X/Y` are inside `Placement` inside `Advanced CSS`, and BOTH are collapsed.**
  The group headers report a zero-sized box while collapsed, so you cannot click your way in from
  the inside out. ✅ **Type into the `Filter properties` input instead** — `transform` reveals all
  six transform rows at once.
- The highlighter's disposal bug is untouched: a **selected** node whose element has gone is never
  removed from `selectedNodes`, so it is revisited and `remove()`d every frame.
- ⚠️ **`AskAboutNodeDialog.module.scss` is STILL uncommitted — ninth session running.** Belongs to
  no session; Richard's call. Same for the phase-70/71/72 working files.
- Unchanged and unchased: `SidebarModel.switch('PortEditor')` crashes the panel; the Settings panel
  clips two rows; a `Number` node draws a group literally called `ADVANCED` beside the synthetic
  `Advanced CSS`; `getConnectionSourceLabel` returns nothing for the checkbox row; `check:css` in
  `nodegx-community` has one pre-existing non-ours violation.

## ⚠️ Harness

- ✅ **Read the driving index BEFORE the drive.** Every recipe held: launch, the recents store, the
  card click, the module registry, tagging an element before clicking it.
- 🔴 **`--quiet` suppresses the `launching Electron` line entirely.** Do not wait for it — poll
  `curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/src/editor/index.bundle.js` for
  `200` and then `npm run cdp -- health`. A `000` means the dev middleware is wedged.
- 🔴 **`ng.nodes` does not exist; the view nodes are `ng.roots`** (`NodeGraphContextTmp.nodeGraph`).
  Walking `ng.nodes` returns an empty list, which reads exactly like "the project did not open".
- ⚠️ **`cdp type` INSERTS at the cursor, it does not replace.** Typing `0` into a field showing `50`
  gives `500`. To replace: native-setter write + an `input` event + a dispatched `keydown` Enter,
  which commits **without** blurring (the crosshair stays up).
- ✅ **A real `cdp click` is what gives the window OS focus** — needed before any focus-driven
  handler is believed. `document.hasFocus()` first, always.
- ✅ **`dev:stop` spared all 10 MCP helpers** (5 sessions × 2) — verified by `ps` after, not assumed.
  Launch and teardown both announced to `3878`.

## Gates, this tree (OpenNoodl, `cline-dev`) — 🔴 re-measure, never quote

- `packages/noodl-viewer-react` jest: **80 files / 1071 specs / 0 failures**. ✅ The floor *without*
  this session's two files was measured the same afternoon by ignoring them: **78 / 1012**, which is
  **identical to session 27's recorded floor**, so the delta is exactly `2 suites / 59 specs`.
- `npm run test:main`: **326 files / 5253 specs / 0 failures**, against session 27's 325 / 5240 —
  exactly the one new `tests-unit/fb-016` file and its 13 specs.
- `npm run typecheck:viewer`: **0 errors**. `npm run typecheck:editor`: **0 errors**.
- ✅ **`test:ci` RUN 2026-08-25 12:19→12:31**: `Jasmine: 2849 specs, 4 failures (failed).` Seed
  **99506**. All four are `AIX-006 style vocabulary`, **by name** — the same four at seeds 49062
  (s26) and 75572 (s27). **Spec count identical; no new name.**
  🔴 **THE FLOOR IS 4, NOT THE 10 STILL QUOTED IN OLDER FILES** — the other six were fixed on
  purpose on 08-21 (`dae76da8`, `a46b52ba`, `ea402850`, recorded in `4c038fa7`).
  ⚠️ **`test-results.json` was deleted before the run and came back with a fresh mtime.** Completion
  was read from the **summary line**; the background-task notification's "exit code 0" describes the
  `nohup` wrapper and means nothing either way.
- Not run, nothing touched them: `typecheck:core-ui`, `noodl-runtime`, all of `nodegx-community`.

## Gates, `nodegx-community`

Unchanged since session 18 and **not re-run**: 58 files / 1398 specs / 0 failures, `tsc` clean,
`build` clean, `check:css` 1 pre-existing violation. nexus-1 serves `acd4a9a`. **FB-016 is
viewer-side and does not deploy.**

## Session notes

- ✅ **Drive harness**: `npm run dev:debug -- --quiet` (background), poll port 8080 for `200`, then
  `cdp -- health`. First compile took ~3 min at load ~5 and swap 12.4G/13.3G.
- ✅ **Restored as found**: the recents file's `fb016-drive` row removed after `dev:stop`, and the
  `transformOriginX/Y` parameters the drive wrote onto node `A wide 100%` stripped back out of the
  fixture's `project.json`. The fixture is as session 27 left it.
- Fixture: **`NodeGX test projects/fb016-drive`** — `A wide 100%` … `F margins+padding` plus the five
  radius arms. For scope 4 the useful node is **`D centred (control)`** (160×60), because it has no
  transform parameters at all and is therefore the arm that exposes the default-wording question.
