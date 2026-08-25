# Phase 75 — next session

**State as of 2026-08-25 (session 27).** Session 26 paid the owed `test:ci` gate and wrote no
product code. **Session 27 built and drove FB-016** — the box-model overlay ships, AC1–AC4 are met,
and the only thing left in that task is **scope 4, the transform-origin crosshair**, which is left
deliberately and is a clean separable piece. Read *"What session 27 found"*, then pick from
*"First moves"*.

⚠️ **Peers.** `3878` is **opennoodl-78**, this checkout, and was idle and cooperative all session —
it caught that four of my files were untracked, not three, which is exactly the failure where a
pathspec commit leaves work behind. `39469` is `trybeup-prod-c0`, a different project. A socket
census tells you HOW MANY and HOW TO REACH; only `ListAgents` tells you WHICH PROJECT.

## What session 27 found

### 🔴 THE SCREENSHOT CHANGED THE DESIGN TWICE, AND NO SPEC WOULD HAVE

Both are in the shipped code and both were invisible to 47 green specs:

1. **The fact chip was covering the elements it was explaining.** It was placed above the hovered
   element, or below when there was no room. The first screenshot shows it sitting over the two
   siblings *underneath* the subject — and *"why has this gone under another group"* is one of the
   three questions it exists to answer. It goes **beside** now (right, then left, then above, then
   below). ✅ **A drive earns its cost on questions of this shape: not "is it right" but "can you
   still see the thing you asked about".**
2. **`getComputedStyle` answers `normal`, and `normal` answers nothing.** The chip read *"parent
   packs them: normal"*. Inside a flex container `normal` behaves as the stated default, so the
   default is what the line names now.

✅ **And the spec caught one the drive could not**: `chipPosition` clamped only its fallback
branch, so an element scrolled past the left edge got a chip placed off-screen *by the branch that
believed it had room*. Both axes are clamped on every branch now.

### ✅ Nine predictions, written before looking, each with its falsifier

All nine settled, none falsified — the table is in the task file. The two worth carrying:

- **The specified value is the only thing that answers "why is this full width".** The subject is
  **360px wide**; computed `width` would have said `fixed 360px`. `width: 100% of the parent` comes
  from `element.style`, and it is the difference between the overlay answering the question and
  restating the pixel the author can already see.
- **The design-mode gate was measured as an absence beside a known-firing signal.**
  `setEnabled(false)` → chip gone, **while the teal selection outline still drew at 360×60**.

### 🔴 NO SINGLE COLOUR CAN BE SEEN ON ARBITRARY CONTENT

A stroke needs relative luminance above ~0.10 to clear 3:1 against black and below ~0.30 to clear
white — and a colour in that band is a mid-tone that then fails against mid-tone content.
**Today's teal selection outline `#2CA7BA` is 2.86:1 on white**, below the non-text floor, and it
is in the spec as the control that proves the instrument can fail. Every structural edge is drawn
**twice**, near-black and near-white; the better of the pair, swept across all 1001 ground
luminances, never drops below **4.06:1**.

⚠️ **AC4 asked for rows in the editor's PAIRS table and did not get them, on purpose.** PAIRS
resolves named tokens out of `colors.css` in the editor's two themes; this overlay paints inside
the preview webview over a document the *author* wrote, where `--theme-color-*` does not exist
(`PreviewTokenInjector` injects the **project's** tokens, never the editor's). The claim is asked
of the right population in `noodl-viewer-react/tests/fb-016-overlay-contrast.test.ts`, and against
every ground rather than two.

## First moves, in order

1. **FB-016 scope 4 — the transform-origin crosshair** (S/M), if you want to close the task.
   Everything else in FB-016 lives in the viewer and needs nothing from the editor. This one does:
   the trigger is *"while the transform-origin field has focus"*, and only the editor knows that.
   It needs a call on the highlight bridge (beside `setDesignMode`, added this session in
   `viewer.jsx`) plus a focus/blur hook on that one property input. ⚠️ `Placement` is inside
   `Advanced CSS` as of `879f2f4c` and is reachable by typing `transform`.
2. **FB-022** (M/L) — drag-to-scrub numerics. FB-017's rows are settled and its geometry is stable.
3. **FB-021 is UNOWNED and its numbers are verified** (session 26, `4629dceb`). A `sizeMode`-gated
   port is *not* absent: `basic` suppresses only the property row, so **328 gated input ports on
   the shipped catalog are live, wireable, and have their value delivered then discarded**, against
   21 genuinely-absent `extended` ones. 🔴 Two traps in its task file: **21 is the group count AND
   the port count by coincidence** (count ports, never groups), and **all 21 `extended` ports are
   on data/logic nodes, none visual**. Seam: `portDecoration.ts`; splice: `modelProxy.ts:76`.
4. ⚠️ **Deliberate remainders, unchanged**: FB-011 AC1 superseded; FB-007's composer undriven in a
   browser; `apisurfaces.ts`' `personProfile` flat disc.
5. **Still needing Richard**: FB-017 scope 2's `Source Set` demotion; FIX-026 (a)/(b); FIX-027
   14/15/16 + 22; tsfixme baseline; prod `ANTHROPIC_API_KEY` (⚠️ **intro pricing ends 2026-08-31 —
   six days**); the 15 lessons' prose; Discord's row in the `?` menu; `/rfps` search.

## Found while working, owned by nobody

- ⚠️ **The auto-margin branch of FB-016's alignment fact is written and specced but was never
  exercised in a running app.** `Layout.align` uses `auto` margins only when the parent lays out in
  a **row**; the fixture's parent is a column, so every arm went down the `align-self` path.
- ⚠️ **A hand-written `rootComponent: "App"` in `project.json` did not give the project a home on
  its first open** — `getRootNode()` was `null`, the viewer drew `NoHomeError`, and calling
  `setRootComponent` from the console fixed it. On a **later open of the same file** it resolved at
  load. **Not characterised; deliberately not filed** — the difference between the two opens was
  never isolated. If you hit it, that is what it is.
- ⚠️ **The viewer bundle does not hot-reload.** A change to `noodl-viewer-react/src` needs an editor
  reload *and a reopen of the project*; the running viewer will otherwise keep answering from the
  old bundle, which reads exactly like a change that did not work. Cost ~10 minutes before I
  checked the string I had just changed.
- The highlighter's disposal bug is untouched: a **selected** node whose element has gone is never
  removed from `selectedNodes`, so it is revisited and `remove()`d every frame (recorded in
  `highlighter.ts`, correct semantics are a behavioural decision).
- ⚠️ **`AskAboutNodeDialog.module.scss` is STILL uncommitted — eighth session running.** Belongs to
  no session; Richard's call. Same for the phase-70/71/72 working files.
- Unchanged and unchased: `SidebarModel.switch('PortEditor')` crashes the panel; the Settings panel
  clips two rows; a `Number` node draws a group literally called `ADVANCED` beside the synthetic
  `Advanced CSS`; `getConnectionSourceLabel` returns nothing for the checkbox row; `check:css` in
  `nodegx-community` has one pre-existing non-ours violation.

## ⚠️ Harness

- ✅ **Read the driving index BEFORE the drive.** It was read first this time and every recipe in it
  held: launch, the recents store, the card click, the module registry.
- 🔴 **`cdp click` takes a SELECTOR, not coordinates** — `click "428,558"` fails with a
  `querySelector` SyntaxError that reads like a broken page. Tag the element
  (`setAttribute('data-cdp-target','1')`, clearing every old tag first) and click the attribute.
- ✅ **Design mode is the DEFAULT**, not a thing to switch on: `inspectMode = !previewMode`
  (`EditorDocument.tsx:172`). But a freshly opened project can land in preview — read
  `aria-pressed` on the two buttons inside `[aria-label="Editor mode"]`; the window is often narrow
  enough that they render as **icons with no text**, so matching on the string "Design" finds
  nothing.
- ✅ **A synthetic `mousemove` dispatched on the element reaches the Inspector's capture-phase
  listener** exactly as a real one does, and is enough to drive hover inspection. ⚠️ It is not an
  OS-level pointer; say so when claiming it.
- ✅ **`dev:stop` spared all six MCP helpers** (3 sessions × 2) — verified by `ps` after, not
  assumed. Launch and teardown both announced to `3878`.

## Gates, this tree (OpenNoodl, `cline-dev`) — 🔴 re-measure, never quote

- `packages/noodl-viewer-react` jest: **78 files / 1012 specs / 0 failures**. ✅ The floor *without*
  this session's three files was measured the same afternoon by ignoring them: **75 / 965**, so the
  delta is exactly this work and not a guess.
- `npm run typecheck:viewer`: **0 errors**.
- `npm run test:main`: **325 files / 5240 specs / 0 failures** — identical to session 26.
- ✅ **`test:ci` RUN 2026-08-25 11:18→11:31**: `Jasmine: 2849 specs, 4 failures (failed).` Seed
  **75572**. All four are `AIX-006 style vocabulary`, **by name**, the same four session 26 saw at
  seed 49062. **Spec count identical to the floor; no new name.**
  🔴 **THE FLOOR IS 4, NOT THE 10 STILL QUOTED IN OLDER FILES** — the other six were fixed on
  purpose on 08-21 (`dae76da8`, `a46b52ba`, `ea402850`, recorded in `4c038fa7`). A stale-HIGH floor
  hides up to six regressions.
  ⚠️ **The background-task notification said "exit code 0". The compound exit was 1** — which is
  what a *clean* floor exits. Neither number means anything: **completion is the summary line**,
  and the run is only real if `tests/test-results.json` has a **fresh mtime** (it was deleted
  before this run; the one on disk was two days stale and reads as a perfect pass).
- Not run, nothing touched them: `typecheck:core-ui`, `noodl-runtime`, all of `nodegx-community`.

## Gates, `nodegx-community`

Unchanged since session 18 and **not re-run**: 58 files / 1398 specs / 0 failures, `tsc` clean,
`build` clean, `check:css` 1 pre-existing violation. nexus-1 serves `acd4a9a`. **FB-016 is
viewer-side and does not deploy.**

## Session notes

- ✅ **Drive harness**: `npm run dev:debug -- --quiet` (background), wait for `launching Electron`
  (~60s this time), then `cdp -- health`.
- ✅ **Restored as found**: recents file's `fb016-drive` row removed after `dev:stop`; the temporary
  `translateY` used to bring an off-screen element into a screenshot was on a DOM node in a
  throwaway fixture and died with the stack.
- Fixture kept: **`NodeGX test projects/fb016-drive`** — one `Page` with `A wide 100%`, `B under A`,
  `C not centred`, `D centred (control)`, `E overflows right`, `F margins+padding`, plus the five
  radius arms carried over from `ac4-drive`. It is the file to re-run FB-016 against, and the
  `D`/`C` pair is what makes the alignment fact a measurement rather than a constant.
