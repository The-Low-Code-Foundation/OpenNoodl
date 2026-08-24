# Phase 75 — next session

**State as of 2026-08-25 (session 24).** Session 24 **closed FB-017 AC6**, both halves, and made the
AC7 filter header genuinely sticky on the way past. `6d640c29` (fix) and `bcc3c489` (notes).
**FB-017 is now AC4 only**, plus scope 2's `Source Set` demotion, which is Richard's. Read *"What
session 24 found"*, then FB-017's own file.

⚠️ **Peers.** Sockets at teardown (`ls -l /tmp/cc-socks/`): `3878`, `39469`, `47493` (me).
`ListAgents` — **and only `ListAgents`** — names them: `3878` is **opennoodl-78**, this checkout,
FB-023; **`39469` is `trybeup-prod-c0`, a different project in a different checkout**. That
misidentification cost session 23 three dropped messages. A socket census tells you HOW MANY and HOW
TO REACH. It never tells you WHICH PROJECT.

## What session 24 found

### 🔴 SESSION 22's NUMBERS WERE MEASURING A DIFFERENT ELEMENT THAN ITS SENTENCE SAID

The task file said *"the panel width moves with selection — Group `0030` → 312px, Image `0032` →
346px"*, and scoped the fix as *shared sidebar layout, every panel driven, a session's work*.
Re-measured first, and:

| Element | Group | Image |
| --- | --- | --- |
| `FrameDivider` | 380 | 380 |
| `SideNavigation .Panel` — **the side panel** | **327** | **327** |
| the property column inside it | 312 | **346** |

**The side panel has not moved on selection since FIX-009** grouped `components` / `PropertyEditor`
/ `PortEditor` under one `selection-slot` width key. 312 → 346 was the *content column* overflowing
its own scroller sideways (`scrollLeft` 33.5 — 34px of every row off the right edge). ✅ **Re-measure
before inheriting a scope estimate; the number can be right and the noun wrong.**

### 🔴 ONE CAUSE, THREE SYMPTOMS — AND THE THIRD NEEDED BOTH HALVES

`.sidebar-property-editor` and `.sidebar-panel` are **scroll containers whose content has never
overflowed them** (the panel lives inside `ScrollArea`, whose `.Container` is `min-height: 100%` and
just grows). That single fact produced: scroll-restore reading a permanent `0` (s22), `position:
sticky` inert (s23), and the column width defect (s24).

⚠️ **Session 23 cleared only one of the two and read "sticky cannot work here without re-parenting
the box above the `ScrollArea`".** With `.sidebar-property-editor` alone opted out the box still
measured **−16px** at `scrollTop: 400`. With both, it sits at **277 = the scrollport's own top**.
Neither half is sufficient alone, and the half-measurement read exactly like an impossibility.

### ⚠️ A CENSUS THAT WILL LOOK LIKE A FINDING TO THE NEXT PERSON

Driving the 13 rail panels gives navPanel widths of 327 / 339 / 379 / 399 / 419 / 459 / 559. Those
are **declared `defaultWidth`s** at each `register()` call, minus a 1px border — by design, not
content-driven. `editor-sidebar-widths` was absent from `editorSettings.json` the whole time.

## First moves, in order

1. **FB-017 AC4 — the corner-radius-on-Image hint.** The last thing in FB-017 that is anyone's to
   build. Still wants **a measured list of offenders** rather than an open-ended system; the
   corner-radius/clip one is the only one named so far.
2. **FB-016** (M/L) — box-model overlay, transform-origin crosshair. ⚠️ `Placement` is inside
   `Advanced CSS` as of `879f2f4c` and is reachable by typing `transform`.
3. **FB-022** (M/L) — drag-to-scrub numerics; FB-017's rows are settled and its column no longer
   moves, so the geometry is now stable to build against.
4. 🔴 **FB-021 is UNOWNED and available.** Its file carries an ended session's measured correction
   (`13ecc573`, theirs, unverified by me): a `sizeMode`-gated port is *not* absent — `basic`
   suppresses only the property row, so **328 gated input ports on the shipped catalog are live,
   wireable, and have their value delivered then discarded**, against 21 genuinely-absent `extended`
   ones. That inverts the task's own ground truth. **Re-check those numbers before building on
   them.**
   ✅ The AC7 overlap is measured and closed: `ModelProxy.getPorts` splices condition-filtered ports
   out *before* `Ports._getPorts`, so the filter can neither hide nor reveal a gated port. 🔴 **The
   precondition lives in FB-021's own task file (`dce7e65a`), not here** — in short, if FB-021
   reveals those rows each must be a real view carrying `name`/`displayName`, not only a decorated
   element. Seam: `portDecoration.ts`; splice: `modelProxy.ts:76`.
5. ⚠️ **Deliberate remainders, unchanged**: FB-011 AC1 superseded; FB-007's composer undriven in a
   browser; `apisurfaces.ts`' `personProfile` flat disc — still nobody's decision.
6. **Still needing Richard**: FB-017 scope 2's `Source Set` demotion (it sits in the `Image` subject
   group, so demoting one port is exactly the per-port tiering Ruling 1 rejected); FIX-026 (a)/(b);
   FIX-027 14/15/16 + 22; tsfixme baseline; prod `ANTHROPIC_API_KEY` (⚠️ **intro pricing ends
   2026-08-31 — six days**); the 15 lessons' prose; Discord's row in the `?` menu; `/rfps` search.

## Found while working, owned by nobody

- 🔴 **`SidebarModel.switch('PortEditor')` crashes the panel** — `TypeError: … reading 'on'` at
  `componentports.tsx:387`, caught by the `ErrorBoundary`. Pre-existing and **not user-reachable**
  (no rail icon; it is only opened by `switchToNode`), but it means `PortEditor` is the one
  registered panel session 24 could not drive **in its real state**. `fix012-drive` has a component
  with ports if someone wants to close that gap.
- ⚠️ **The Settings panel clips two rows** — `.property-label-col`, 154 client / 278 scroll.
  Pre-existing, untouched, a different chain (Settings has no `ScrollArea`).
- ⚠️ **A `Number` node draws a top-level group literally called `ADVANCED`**, expanded, beside the
  synthetic `Advanced CSS`. Correct under Ruling 2, but two different "advanced" things on screen.
- ⚠️ **`AskAboutNodeDialog.module.scss` is STILL uncommitted — sixth session running.** Belongs to
  no session; Richard's call. Same for the phase-70/71/72 working files.
- ⚠️ Unchanged and unchased: `getConnectionSourceLabel` returns nothing for the checkbox row;
  `check:css` in `nodegx-community` has one pre-existing non-ours violation; the editor mirror never
  renders port DIRECTION.

## ⚠️ Harness corrections, session 24 — each cost a false reading

1. 🔴 **A stale `data-*` click tag sends the click to the FIRST match in document order.** Tagging a
   second element without clearing the first had `cdp click` report success at coordinates belonging
   to the page root. **Clear every tag before setting one.**
2. 🔴 **A programmatic `scrollTop =` does not reliably deliver its `scroll` event in an occluded
   renderer.** The listener was bound and correct; the stored offset simply never updated, which
   reads exactly like a broken feature. `el.dispatchEvent(new Event('scroll'))` proved the binding in
   one call.
3. ⚠️ **A CSS-module edit does not hot-reload here** — `[HMR] Nothing hot updated`, then
   measurements identical to baseline in every digit. **Read the computed style before believing a
   null result.** `cdp reload` + re-open the project is the fix.
4. ⚠️ These still stand from session 23: never write `input.value` on a React input;
   `editorSettings.json` nests under `settings` and writes asynchronously; `cdp -- type` **appends**;
   `cdp -- reload` closes the project.

## Gates, this tree (OpenNoodl, `cline-dev`) — 🔴 re-measure, never quote

Measured at `6d640c29`:

- `npm run test:main`: **323 files / 5210 specs / 0 failures**, exit 0. **Identical to session 23's
  floor** — no drift, no flakes.
- `npm run typecheck:editor`: **0 errors**, exit 0.
- **Not run** — nothing touched them: `test:ci` (Electron), `typecheck:core-ui` (s21 measured 44
  pre-existing `TS2307`), `noodl-runtime`, `noodl-viewer-react`, all of `nodegx-community`.
- ⚠️ **No spec was added.** The defect is layout; jsdom computes none of it, and a `toContain` over
  CSS source passes on a declaration deleted from the cascade. The evidence is the drive, including
  a control pair that varies only the two declarations in the running editor.

## Gates, `nodegx-community`

Unchanged since session 18 and **not re-run**: 58 files / 1398 specs / 0 failures, `tsc` clean,
`build` clean, `check:css` 1 pre-existing violation. nexus-1 serves `acd4a9a`. **FB-017 is
editor-side and does not deploy.**

## Session notes

- ✅ **Drive harness**: `npm run dev:debug -- --quiet` (background, no `&`), wait for `launching
  Electron`, then `cdp -- health`. Editor webpack ~90s; each CSS edit needs a full reload.
- ✅ **`dev:stop` spared all 6 MCP helpers** (3 sessions × 2) — verified by `ps` after, not assumed.
  Launch and teardown both announced to `3878`.
- ✅ **Restored as found**: my `fb017-drive` row removed from the launcher recents; theme back to
  dark; `propertyPanel.groupExpansion` still `{}`. ⚠️ The recents list is **54 rows, not 56** — the
  app itself pruned two scratchpad fixtures whose directories no longer exist
  (`uni011-drive`, `cn003-kit-drive`). Not damage; recorded so the number is not a surprise.
- Fixture kept: `NodeGX test projects/fb017-drive` (9 nodes: Groups, Text, Image, Icon, Checkbox,
  four connected sources — the Image's bound `src` is what made the column overflow).
