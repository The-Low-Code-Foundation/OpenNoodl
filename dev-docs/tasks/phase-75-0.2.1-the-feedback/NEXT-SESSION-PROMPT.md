# Phase 75 — next session

**State as of 2026-08-25 (session 26).** Session 25 **closed FB-017 AC4**, and with it **FB-017
itself** — all seven acceptance criteria are done. The only thing left in that task is scope 2's
`Source Set` demotion, which is Richard's call and always was. **Session 26 paid the owed `test:ci`
gate, verified FB-021's disputed population, and discharged FB-016 scope 5's open precondition — it
wrote no product code.** Read *"What session 25 found"*, then pick from *"First moves"*.

✅ **The owed gate is paid, and it is clean.** Session 26 ran `test:ci`: **2849 specs / 4 failures**,
all `AIX-006`, no new names. 🔴 **And the floor everyone quotes is wrong: it is 4, not 10** — the
other six were fixed deliberately on 08-21 and the stale number would have hidden up to six
regressions. See *Gates*.

⚠️ **Peers.** Sockets at teardown (`ls -l /tmp/cc-socks/`): `3878`, `39469`, `47493` (me).
`ListAgents` — **and only `ListAgents`** — names them: `3878` is **opennoodl-78**, this checkout;
**`39469` is `trybeup-prod-c0`, a different project in a different checkout**. A socket census tells
you HOW MANY and HOW TO REACH. It never tells you WHICH PROJECT.

## What session 25 found

### 🔴 THE NAMED OFFENDER WAS THE WRONG WAY ROUND

Scope 4 names *"corner radius on an Image without clipping"*. It does not reproduce. Hit-testing the
corner pixel of a 200×200 box with a 40px radius, in the editor's own renderer:

| Case | corner pixel hits |
| --- | --- |
| `<img>` carrying the radius itself, nothing clipping | **not the image** — it is rounded |
| control: same `<img>` at radius `0` | the image |
| a parent with the radius, `overflow: visible`, square child | **the child** — square corner |
| the same parent at `overflow: hidden` | neither |
| control: same parent at radius `0` | the child |

`border-radius` clips a replaced element's content without `overflow`, and an `Image` node renders
as a bare `<img>` carrying the style. **The port that needs the hint is on the parent container.**
The reporter met the defect through an Image inside a Group and attributed it to the Image.

✅ **Two controls are what make that a measurement rather than a guess** — the radius-`0` rows prove
the instrument reports a hit when there is one, and every box's centre was sampled too (child, in
all five), so "the corner missed" is about the corner and not a broken fixture.

The second offender scope 4 names, *"transform on a statically-positioned element"*, is not real
here either: `Layout.align` ends `style.transform = transform + (style.transform || '')`, so an
alignment transform is **prepended**, never substituted. **The measured list is closed at one.**

### 🔴 TWO THINGS THAT WOULD HAVE SHIPPED DRAWING NOTHING

1. **The corner-radius rows arrive inside a nameless `TabGroup`.** The two wrappers already on
   `Ports.renderParams` key off `v.name`; the five radius ports declare `tab: { group: 'corners' }`
   and get folded into a `TabGroup`, which has no `name`. Copying the existing pattern would have
   compiled, passed a pure-logic suite, and put a note on screen **never**.
2. **The panel does not re-render on a parameter change.** `renderGroups` hashes the *port list*,
   and `clip` gates no ports; there is no `parametersChanged` listener either
   (`WorkflowTypes.ts:508` says so outright). A hint applied only at render time appears no earlier
   than the next selection — so the author who has just typed a radius never sees it, which is the
   whole flow. Fixed by an idempotent `applyPortHint` plus `Ports.refreshHints`, in place, on a
   seven-parameter watch list. **A full re-render would take the focus out of the field being
   typed in.**

✅ **The instrument that separates in-place from re-render is a `data-stamp` on the host element.**
A rebuilt panel loses it; an in-place edit keeps it. Nothing else about the two looks different from
a selector query.

### The offender set, from the catalog

14 node types carry `borderRadius`, 3 carry `clip`, **`Group` is the only overlap**. Twelve of the
14 declare `allowChildren: false`. The two that can reach the state: `Group` (clip defaults **off**,
so the defect is the default) and `Button` (**no clip port at all**) — which is why the message has
two forms.

## First moves, in order

1. ✅ **DONE (session 26) — `test:ci` is paid.** 2849 specs / 4 failures, no new names. Full
   readout and its caveat in *Gates* below. **Nothing here is owed any more; start at 2.**
2. **FB-016** (M/L) — box-model overlay, transform-origin crosshair. ⚠️ `Placement` is inside
   `Advanced CSS` as of `879f2f4c` and is reachable by typing `transform`.
   ✅ **Scope 5's open precondition is discharged** (session 26, `4629dceb`): Jordan's element really
   does round, so there is no upstream render bug to file — the square outline is the overlay.
   🔴 But **do not mirror `border-radius` unconditionally**: in the *container* case the corner
   genuinely is square, because the child paints over it. Mirror it only where the element actually
   clips — itself if replaced (`<img>`), otherwise only under a clipping `overflow`.
3. **FB-022** (M/L) — drag-to-scrub numerics. FB-017's rows are settled, its column no longer moves,
   and the geometry is stable to build against.
4. **FB-021 is UNOWNED and available — and its numbers are now verified** (session 26, `4629dceb`),
   so the "re-check before building" warning is discharged. A `sizeMode`-gated port is *not* absent:
   `basic` suppresses only the property row, so **328 gated input ports on the shipped catalog are
   live, wireable, and have their value delivered then discarded**, against 21 genuinely-absent
   `extended` ones. Re-derived from the artefacts: 328 + 21 = 349 counted fresh from
   `node-catalog.json`, the default-to-basic at `nodelibraryexport.ts:150` and the semantics at
   `portConnectivity.ts:28-29` both verbatim. **Build on them.**
   🔴 Two traps recorded in the task file: **21 is the group count AND the port count by
   coincidence** (count ports, never groups — it will diverge), and **all 21 `extended` ports are on
   data/logic nodes, none visual**, so every gated port an author meets while laying out a page is
   in the 328. The AC7 overlap is measured and closed; the precondition lives in FB-021's own task
   file (`dce7e65a`), not here. Seam: `portDecoration.ts`; splice: `modelProxy.ts:76`.
5. ⚠️ **Deliberate remainders, unchanged**: FB-011 AC1 superseded; FB-007's composer undriven in a
   browser; `apisurfaces.ts`' `personProfile` flat disc — still nobody's decision.
6. **Still needing Richard**: FB-017 scope 2's `Source Set` demotion (it sits in the `Image` subject
   group, so demoting one port is exactly the per-port tiering Ruling 1 rejected); FIX-026 (a)/(b);
   FIX-027 14/15/16 + 22; tsfixme baseline; prod `ANTHROPIC_API_KEY` (⚠️ **intro pricing ends
   2026-08-31 — six days**); the 15 lessons' prose; Discord's row in the `?` menu; `/rfps` search.

## Found while working, owned by nobody

- ⚠️ **A radius arriving over a connection gets no hint**, deliberately — the panel knows a port is
  connected, not what it carries, and a false hint is worse than a missing one. Same for `overflow`
  set through Advanced CSS or a `cssClassName`.
- ⚠️ **The `scrollEnabled: true, nativeScroll: false` branch is read, not driven.** That path takes
  `renderIScroll`, which leaves the root at `overflow: visible` (no CSS anywhere touches
  `.scroll-wrapper-internal`), so the hint draws there. It is the one branch nobody has watched.
- Unchanged from session 24 and still nobody's: `SidebarModel.switch('PortEditor')` crashes the
  panel (`componentports.tsx:387`, not user-reachable); the Settings panel clips two rows;
  a `Number` node draws a top-level group literally called `ADVANCED` beside the synthetic
  `Advanced CSS`.
- ⚠️ **`AskAboutNodeDialog.module.scss` is STILL uncommitted — seventh session running.** Belongs to
  no session; Richard's call. Same for the phase-70/71/72 working files.
- Unchanged and unchased: `getConnectionSourceLabel` returns nothing for the checkbox row;
  `check:css` in `nodegx-community` has one pre-existing non-ours violation; the editor mirror never
  renders port DIRECTION.

## ⚠️ Harness — and a correction about it

🔴 **Three things this session "discovered" were already written down, and re-deriving them cost
about forty minutes.** The driving index says *read before a drive*; it was not read first. The
module-registry route, `selectNode` taking the view node, and opening a project by writing the
recents store are all already recorded. **Read the driving index before the next drive.** What
follows is the working form of each, not a claim that any of it is new.

1. ✅ **There is no editor global, but there IS a module registry.**
   `window.webpackChunknoodl_editor.push([[key], {}, (r) => (window.__wreq = r)])` returns webpack's
   require; 2,502 modules become reachable.
   `__wreq.c['./src/editor/src/contexts/NodeGraphContext/NodeGraphContext.tsx'].exports
   .NodeGraphContextTmp.nodeGraph` is the live `NodeGraphEditor`. Then
   `ed.findNodeWithId(id)` → `ed.selectNode(view)` **selects a node with no canvas clicking at all.**
   ⚠️ `selectNode` wants the **editor node**, not the model node; passing the model throws.
2. ✅ **`ThemeManager` is exported as the instance, not the class** — `T.instance` is undefined and
   `T.prototype` is empty. Call `ThemeManager.setMode('light')` on the export directly.
3. ✅ **A fixture opens without the native dialog**: prepend a row to
   `~/Library/Application Support/NodeGX/recently_opened_project.json`, reload the renderer, click
   the card. **Back the file up first — 3.7MB, almost all base64 thumbnails** — and restore it after.
4. ⚠️ Still true from session 24: clear every `data-*` click tag before setting a new one; a
   programmatic `scrollTop =` does not reliably deliver its `scroll` event; a CSS-module edit does
   not hot-reload; `cdp -- type` **appends**; never write `input.value` on a React input (use the
   prototype setter plus an `input` event).

## Gates, this tree (OpenNoodl, `cline-dev`) — 🔴 re-measure, never quote

- `npm run test:main`: **325 files / 5240 specs / 0 failures**, exit 0. Session 24's floor was
  323 / 5210; the difference is exactly the 2 files and 30 specs added here.
- `npm run typecheck:editor`: **0 errors**, exit 0.
- ✅ **`test:ci` RUN 2026-08-25 10:13→10:26 (session 26), the owed gate is paid**:
  `Jasmine: 2849 specs, 4 failures (failed).` Seed **49062**.
  **Spec count is identical to the 08-19 floor (2849), and all 4 failures are `AIX-006 style
  vocabulary` — a family the floor already carried 4 of. No new failure name; nothing in FB-017's
  area.** The floor's other six (2× AI model registry, 1× AIX-011, 3× SUB-011) passed, and they
  **ran** — 6 / 60 / 16 spec-starts respectively, checked, because an absence proves nothing without
  a known-firing signal beside it.
  🔴 **THE FLOOR IS 4, AND HAS BEEN SINCE 08-21 — the "10" everyone compares against is stale by
  four days and I nearly relayed it forward.** The six did not draw kindly; they were **fixed, on
  purpose**, and the repo says so: `dae76da8` (the fx expression form → SUB-011 ×3), `a46b52ba`
  (a gateway user's default model → AI model registry ×2), `ea402850` (the D13 double-report, which
  also freed AIX-006's repair rounds), and `4c038fa7` recording the measurement — *"2849 specs, 6
  failures. The 3× SUB-011 and 2× AI model registry are gone by name."*
  ⚠️ **`4c038fa7`'s sixth was never one of the ten**: `AIX-011 criterion 7 — createPlanDocWriter`
  settles async undo writes on a fixed **30 ms `setTimeout`** that a loaded runner loses. It is a
  timing fragility, to be fixed **at the constant, not at the assertion**. It ran here (31 specs)
  and passed. Expect it to come and go with machine load; it is not a regression.
  🔴 **Why this is worth more than the run itself: a stale-HIGH floor hides regressions.** Comparing
  against 10 means six real failures could land and still read as "under the floor". Compare against
  **4**, by name, and treat a fifth name as yours.
  ⚠️ **The `test-results.json` on disk was from 08-23 08:54, two days stale.** It was deleted before
  the run. Left alone it reads as a clean pass — delete it every time and require a fresh mtime.
- Not run, nothing touched them: `typecheck:core-ui`, `noodl-runtime`, `noodl-viewer-react`, all of
  `nodegx-community`.

## Gates, `nodegx-community`

Unchanged since session 18 and **not re-run**: 58 files / 1398 specs / 0 failures, `tsc` clean,
`build` clean, `check:css` 1 pre-existing violation. nexus-1 serves `acd4a9a`. **FB-017 is
editor-side and does not deploy.**

## Session notes

- ✅ **Drive harness**: `npm run dev:debug -- --quiet` (background, no `&`), wait for `launching
  Electron`, then `cdp -- health`. Editor webpack ~90s.
- ✅ **`dev:stop` spared all 6 MCP helpers** (3 sessions × 2) — verified by `ps` after, not assumed.
  Launch and teardown both announced to `3878`.
- ✅ **Restored as found**: recents file restored from backup (54 rows, `ac4-drive` row removed);
  theme back to dark; the fixture's `clip` and `borderRadius` edits reverted; the property filter
  cleared.
- Fixture kept: `NodeGX test projects/ac4-drive` — six roots that separate AC4's two arms from four
  controls (`R1` radius+child+clipOFF, `R2` clipON, `R3` no child, `R4` no radius, `R5` Image,
  `R6` Button). It is the file to re-run the drive against.
