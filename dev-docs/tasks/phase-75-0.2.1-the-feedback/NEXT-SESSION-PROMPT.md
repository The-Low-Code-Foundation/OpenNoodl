# Phase 75 — next session

**State as of 2026-08-25 (session 25).** Session 25 **closed FB-017 AC4**, and with it **FB-017
itself** — all seven acceptance criteria are done. The only thing left in that task is scope 2's
`Source Set` demotion, which is Richard's call and always was. Read *"What session 25 found"*, then
pick from *"First moves"*.

⚠️ **One gate is owed.** `test:ci` was started and killed in its webpack phase because the machine
was not quiet. It is the gate this change most wants. See *Gates* below — that is the first thing
to do if you land on a quiet machine.

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

1. 🔴 **Run `test:ci` on a quiet machine** and compare by name against the 08-19 floor (2849 specs /
   10 failures). Check `vm.swapusage` and `ps -r` first — *alone on the checkout is not alone on the
   machine*. Completion is the **summary line**, never `$?`.
2. **FB-016** (M/L) — box-model overlay, transform-origin crosshair. ⚠️ `Placement` is inside
   `Advanced CSS` as of `879f2f4c` and is reachable by typing `transform`.
3. **FB-022** (M/L) — drag-to-scrub numerics. FB-017's rows are settled, its column no longer moves,
   and the geometry is stable to build against.
4. 🔴 **FB-021 is UNOWNED and available.** Its file carries an ended session's measured correction
   (`13ecc573`, theirs, unverified by me): a `sizeMode`-gated port is *not* absent — `basic`
   suppresses only the property row, so **328 gated input ports on the shipped catalog are live,
   wireable, and have their value delivered then discarded**, against 21 genuinely-absent `extended`
   ones. That inverts the task's own ground truth. **Re-check those numbers before building on
   them.** The AC7 overlap is measured and closed; the precondition lives in FB-021's own task file
   (`dce7e65a`), not here. Seam: `portDecoration.ts`; splice: `modelProxy.ts:76`.
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

## ✅ Harness gains, session 25 — each of these saves a session

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
- 🔴 **`test:ci` NOT RUN** — started, then killed in its webpack phase. VM at 66% CPU, a foreign
  `pytest` at 48%, load 5.65, **1,116M of 13,312M swap free**. Under that you get `freshDb`
  timeouts and scattered reds that read exactly like regressions in this work. **This is the first
  move above.**
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
