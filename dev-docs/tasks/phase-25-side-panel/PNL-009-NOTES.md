# PNL-009 — Floating & full panel modes: notes

**Status:** 🚧 **Half complete** — the mode system is built and validated; the `LocalBackendCard`
portal consolidation is **not started**.
**Spec:** [PNL-009-FLOAT-AND-FULL-MODES.md](./PNL-009-FLOAT-AND-FULL-MODES.md)

## The "validate before building" gate

The spec made this task conditional: *"Before implementing, confirm the need."* **Richard answered
"build it"** on 2026-07-27, having seen Tier 1 land. That is the decision this work proceeds on;
recorded here so the next reader knows it was asked and answered rather than assumed.

## What is done

### The modes are CSS-only, and that is load-bearing

`SideNavigation .Panel` gets `position: fixed` plus insets in the detached modes. **The panel element
never changes parent.** That is the whole design: `propertyeditor`, `ProjectSettingsPanel` and
`componentports` host legacy imperative views through `Frame`, and those bind listeners in `render()`
and hold direct DOM references — re-parenting their subtree would remount them with no guarantee they
survive.

The one assumption this rests on is that no ancestor establishes a containing block for fixed
positioning (a `transform`, `filter`, `perspective`, `contain: paint` or `will-change` anywhere up the
tree defeats `position: fixed`). **Verified live, not assumed** — full mode measures
`position: fixed`, x 52, width 1349 inside a 1400px window, i.e. it escapes both `SideNavigation
.Root`'s and the frame divider's `overflow: hidden`.

### The legacy-view test the spec insists on

Put the property editor into a mode and back, then use it:

- **Same DOM node.** `window.__legacyEl === document.querySelector('.property-header-name')` after the
  mode change: **true**. Nothing remounted.
- **Listeners intact.** A legacy property input in a floating panel still accepts typing — its value
  went `"chat"` → `"chatZ"`. That is the legacy `View`'s own change path, not React's.

So no panel needs the exemption. `LEGACY_HOSTING_PANELS` in `SidePanel.tsx` is the empty list the
escape hatch lives in if that ever changes: the float/full buttons go disabled with a reason rather
than breaking the panel.

### Behaviour, measured

```
✓ full: the panel is fixed and fills the editor area right of the rail  {"pos":"fixed","x":52,"w":1349}
✓ full: the rail is still there and 52px wide
✓ full: switching panels from the rail stays in full mode               bar="APP SETUP"
✓ full: Escape returns to docked
✓ floating: the panel is a fixed card over the canvas                   {"x":96,"y":94,"w":422,"h":522}
✓ floating: dragging the bar moves the card                            96,94 -> 276,166
✓ floating: the grip resizes the card                                  422x522 -> 542x582
✓ floating: position and size come back per panel                      after a switch away and back
✓ floating: the canvas takes the full width underneath                 1348px
```

Position and size persist per panel per project, in `'editor-sidebar-float-rects'` beside PNL-003's
widths, under the same project key. A floating card is constrained so it can never cover the rail and
always leaves 120px of its header grabbable — a card you cannot reach is a card you cannot close.

A detached panel also gets its own bar: the thing you grab to move a floating card, the panel's name,
and a close button. That is the header and escape route the spec wants for the full-screen surfaces.

Screenshots: `screenshots/pnl-009/{full,floating}--{dark,light}.png`.

## What is NOT done

**The `LocalBackendCard` portal consolidation — the half with independent justification.** Seven
surfaces (Schema, Data, Permissions, Triggers, Email, Auth, Search — the spec says six; it is seven)
still render through `createPortal(…, document.body)` into a `position: fixed` overlay with a
hardcoded `rgba(0, 0, 0, 0.85)` scrim that predates the light theme. None of that is touched. The
acceptance items 2 and 3 are therefore **not met**, and `grep` will still find both.

The mode system this work delivers is the thing that migration needs to land on, so the ordering is
not wasted — but the spec's own advice was to do the consolidation *first*, and this did not.

**Also not verified:** item 6's "a floating panel does not trap focus", and the popup-positioning
check in the executor notes (a colour picker opened from a floating panel appearing in the right
place, and PNL-002's dismissal behaving when the panel is not where popups assume it is). Both want
doing before this is called finished.

## Findings

- **The mode buttons only exist on `BasePanel` panels.** They ride in `PanelHeader`'s mode slot, and
  15 panels have no `BasePanel` header — Components and Search among them. So today you can only
  detach the panels that already have a header. **PNL-005 is what fixes this**, and it is the reason
  that task is listed as a prerequisite.
- **The property editor cannot be put into full mode from the UI at all.** It has no header (so no
  mode buttons), and full mode covers the canvas — so you cannot select a node to reach it while in
  full. Floating is reachable, which is why the legacy test above uses it.
- **Every mounted panel renders its own copy of the mode buttons**, so `data-test` ids for them are
  not unique — all the hidden panels have one too. Anything scripted must filter on
  `getBoundingClientRect().width > 0`. Cost three false failures here.

## Gates

Editor `tsc` clean. `npm run colors` 16/16. PNL-001's panel-geometry gate 11/11 at 1280×720.

`npm run test:ci` reports **1 failure**: *"Project import and export unit tests re-keys imported node
ids while reusing the target component id (characterization) — Expected 8 to be 5"*. **It is not from
this work**: with every PNL-009 change stashed the same spec fails identically, with the same numbers.
The tip moved during this session (a concurrent session merged DEP-008 and a PLAT-003 slice, and the
spec count went 1441 → 1481), so it arrived with one of those. Flagged, not adopted.

---

# PNL-009, second pass — the half that had not been done

**Status:** the three items above ("What is NOT done") are now done. The portal
consolidation landed, the `⋯` overflow menu exists, F28 is fixed, and the two
never-verified behaviours are scripted assertions rather than checklist lines.
**Nothing here has been seen in a running editor** — see *Could not verify*.

Commits: `27db2488` (the `⋯` menu + F28), `a17c7dd7` (the portal consolidation),
`291ec4da` (the gates), `693fbb7e` (sort-order fix).

## 1. The seven `LocalBackendCard` portals

They are **registered transient panels** now, opened in full mode. The spec
offered registration or an ad-hoc child of full mode and said to prefer
registration; this takes it, and the reason is that registration is the only one
of the two that does not require rebuilding four things that already exist — the
rail stays live, `Escape` docks, the detached bar gives a close route, and
PNL-003 remembers the width per surface.

New file: `LocalBackendCard/backendSurfaces.tsx` — the table, the registration,
and `openBackendSurface(kind, props)`. One line added to `router.setup.ts`.

**How the props get in.** `SidebarItem.panelProps` is read by the panel factory
*at render time*, not at registration time (`createPanel` closes over `item` and
reads `item.panelProps` when React calls it). So writing `panelProps` immediately
before `switch()` is the supported way to hand a transient panel its arguments.
The alternative — a public "switch with props" on `SidebarModel` — is a wider
change to a model three other tasks are touching this phase, and was not worth it
for seven call sites.

`switch()` short-circuits when the panel is already active, which would leave a
surface showing the previous backend's data with new props sitting unread. Not
reachable from today's UI (the card is hidden while a surface is open), but it
re-announces `activeChanged` rather than relying on that staying true.

**Acceptance item 3 resolves by deletion, not by tokens.** The scrim was
`rgba(0, 0, 0, .85)` on a `position: fixed; inset: 0; z-index: 9999` overlay.
Full mode covers the editor area *beside* the 52px rail rather than on top of it,
so there is no scrim at all — no scrim colour to get right in two themes. That is
a stronger form of the acceptance than a tokenised scrim would have been.

Grep, which the spec asked for as the evidence:

```
$ grep -rn "createPortal" .../BackendServicesPanel/
LocalBackendCard.tsx:74      (a comment describing what this replaced)
LocalBackendCard.tsx:322     (a comment describing what this replaced)
backendSurfaces.tsx:7        (a comment describing what this replaced)
$ grep -rn "rgba(0, 0, 0, 0.85)\|SchemaPanelOverlay" packages/noodl-editor/src/
LocalBackendCard.module.scss:166  (the comment that replaced the rule)
```

No code, in either case.

**The spec says six surfaces. There are seven.** And `views/panels/search/` is
**not** the dead duplicate the phase's finding register (F18) says it is: it is
BAK-008's backend full-text search, imported at `LocalBackendCard.tsx:25` before
this change and registered as `backend-search` after it. The editor's own Search
panel is `views/panels/search-panel/search-panel` (rail id `search`), a different
file registered separately in `router.setup.ts`. **F18 is wrong and acting on it
would delete BAK-008's UI.**

## 2. The `⋯` overflow menu

Float and Full carry `data-panel-chrome="secondary"` — the hook PNL-005 left —
and a `⋯` appears in their place under a 357px frame. Three details worth having
written down:

- **The tag is on a wrapper `<span>`, not on the button.** `Tooltip` puts a
  block-level trigger div between the mode group and the button; hiding the
  button alone would leave that div and the mode group's 2px gap behind.
- **The "show `⋯`" rule lives in `SidePanel.model.scss`, not in core-ui.** The
  hide half is core-ui's (settled territory); its inverse has to live where the
  button is built. Both query the same `panel-frame` container, and the band
  boundary is imported from `panel-bands.scss` rather than restated, so the two
  halves cannot drift. The import is a relative cross-package path rather than
  the `@noodl-core-ui` webpack alias: **no `.scss` in the editor package resolves
  a cross-package `@use` today**, sass-loader alias resolution is therefore
  unproven here, and a sass resolution failure is a blank editor rather than a
  type error. Not worth the elegance.
- **The menu anchors to its button** (`showContextMenuInPopup` gains an optional
  `attachTo`, additive and backwards compatible). The default anchor is
  `screen.getCursorScreenPoint()`, which is right for a right-click and wrong for
  a button — and is also why a cursor-anchored menu cannot be asserted on by a
  script: a synthesised click does not move the OS cursor.

### Assertion F: measured, not hoped

The editor could not be launched from this worktree (`lerna exec` resolves the
package root to the main checkout, so anything launched here runs main-checkout
code). So the header's arithmetic was settled a different way: **a static replica
compiled from the real `.module.scss` files, the real SVG assets and the real
token stylesheets, measured in headless Chrome** with the same `measureText`
binary search assertion F uses.

Recipe, in case anyone wants to redo it — it is a scratch tool, deliberately not
committed, because a replica that drifts from the app is worse than no replica:

1. `npx sass --load-path=packages/noodl-core-ui/src/components/sidebar` over
   `PanelHeader.module.scss`, `BasePanel.module.scss`, `IconButton.module.scss`,
   `Icon.module.scss`, `Tooltip.module.scss`, `SheetSelector.module.scss` and
   `SidePanel.model.scss`. Sass does **not** hash class names — webpack's
   `css-loader` does — so every file emits its own `.Root` and they collide;
   prefix each sheet's `.Root` before concatenating or the header comes out
   122px tall with 60px buttons.
2. Transcribe the markup from `BasePanel.tsx` / `PanelHeader.tsx` /
   `IconButton.tsx` / `SheetSelector.tsx`, inline the four token `.css` files,
   and inline the real SVGs (they carry `width`/`height`; `@svgr/webpack` runs
   with `svgo: false`, so the app's intrinsic sizes are the file's).
3. `Google Chrome --headless --dump-dom` with the measurement written into the
   DOM. `--font-family` is `-apple-system`, so macOS Chrome and Electron resolve
   the same face and `measureText` agrees with the app.

Results, `.PanelItem` width → title width / characters of "Components" that fit:

| panel | before | after |
|---|---|---|
| 240 (phase minimum) | 38px / **2** | 80px / **7** |
| 260 | 58px / 5 | 100px / **10** |
| 278 (Components' registered 280px default, less borders) | 76px / **7** | 118px / **10** |
| 326 | 124px / 10 | 166px / 10 |
| 357 (band edge) | 155px / 10 | 197px / 10 |
| 360 (band off, four buttons again) | 152px / 10 | 152px / 10 |
| 380 | 172px / 10 | 172px / 10 |

Assertion F's floor for "Components" is 10 (min of `--min-title-chars` 12 and the
title's own length). It is checked on the **wide pass only**, i.e. at the panel's
default width. Components registers `defaultWidth: 280`, which lands at 278 and
was **7 characters — red**; it is now 118px and all 10 fit. **F should pass.** The
240px column is not gated (F does not run on the narrow pass) but went 2 → 7.

**A discrepancy I could not reproduce, stated plainly.** PNL-005-NOTES quotes the
gate reporting `title "Components" renders only 2 of 10 characters ("Co…") in
24px at a 380px panel`. The replica says 172px and all 10 characters at 380px, and
I could not find the missing ~148px: the mode group measures 133px (four buttons
at 32/32/32/24 plus gaps and the divider), the Components action slot is a
`SheetSelector` whose trigger is 45px with the default "All" label and at most
~125px with a long sheet name, and `BaseDialog` returns `null` when hidden so
`Tooltip` contributes nothing. Either that run had something in the header this
tree does not, or the reported panel width was not the panel's. **Whichever it
is, the fix direction is the same and the "Co…" it reported is exactly what the
replica reproduces at 240–278px** — so I implemented the fix rather than the
number. If F is still red after the merge, the failure line now prints the header
budget (title / action slot / mode group / visible control count), which says in
one line whether the remedy is in `SidePanel.tsx` or in the panel itself.

**One thing this fix cannot reach, and it is core-ui's.** `.Children` is
`flex: 0 0 auto` — the panel's own action slot never shrinks, so a panel with a
large enough `headerSlot` can starve the title no matter what the mode group
does. Demoting Float and Full buys ~42px, which is enough for every panel the
gate currently walks, but it is a fixed budget against an unbounded consumer.
**Recommendation, not done (settled territory):** `.Children { flex: 0 1 auto;
min-width: 0 }` plus a `min-width` floor on `.Title`, so the squeeze is shared
rather than landing entirely on the title. Reporting it as instructed.

## 3. F28, and the two unverified items

**F28 — verified before applying, and the stated fix is right.** Every mounted
panel did render its own mode buttons: `SidePanel` keeps inactive panels mounted
behind `display: none` and one `PanelModeSlotProvider` wrapped all of them, so
`BasePanel` → `usePanelModeSlot()` returned the same non-null slot in every one.
Moving the provider inside the `.map()` with `slot={id === activeId ? modeSlot :
null}` makes `PanelHeader`'s `{Boolean(modeSlot) && …}` render no mode group at
all for hidden panels. The only cost is a provider element per panel; the context
value already changed on every `SidePanel` render, so nothing re-renders that did
not before.

**Item 6 (focus is not trapped) and the popup-positioning check are now
assertions**, in a new `dev-docs/tasks/phase-23-visual-refresh/corpus/panel-modes.mjs`:

| # | assertion |
|---|---|
| 1 | full: `position: fixed`, left = rail edge, fills the editor area |
| 2 | full: **the rail is hit-testable** (`elementFromPoint` lands in the rail) — the thing `z-index: 9999` got wrong |
| 3 | full: switching panels from the rail stays in full |
| 4 | full: `Escape` docks |
| 5 | floating: the panel is a fixed card narrower than the editor area |
| 6 | floating: dragging the bar moves the card, and dragging to (4, 4) still leaves it clear of the rail |
| 7 | **floating: `Tab` from inside the panel reaches something outside it within 25 presses** — acceptance item 6 |
| 8 | **floating: ⌘B still hides it** — the other half of item 6 |
| 9 | floating: the `⋯` appears once the card is dragged narrow, and Float/Full disappear (also reports the DOM counts, so an F28 regression is visible) |
| 10 | **floating: the `⋯` menu overlaps its button horizontally and sits within 40px of it vertically** — the popup-position check |
| 11 | **floating: a gesture that starts inside the popup and ends on the canvas does NOT dismiss** — PNL-002's rule, from the one place a panel is not where popups assume it is |
| 12 | floating: a click that starts and ends on the canvas does dismiss |

It inherits `panel-chrome.mjs`'s robustness rules: per-check isolation, screenshots
taken before asserting, JSON flushed after every check, every injected style and
the device-metrics override released in a `finally`, the panel put back to docked,
and three consecutive CDP timeouts abort cleanly.

## 4. `panel-chrome.mjs`: one harness defect fixed, F strengthened

- **Defect.** `root.querySelectorAll('[class*="PanelItem"]')` also matches
  `PanelItems`, the wrapper PNL-009 added around the list — and `querySelectorAll`
  returns the ancestor first. The gate has been measuring the *container* and
  reporting `panelId: null`; it only kept working because every measurement
  re-filters on visibility. Now anchored on `[data-panel-id]`. **This is a
  plausible partial explanation for the 24px figure above** and is worth a look
  when the gate is next run.
- **F now prints the header's width budget** with each failure, so a red F names
  the culprit instead of just the symptom.
- **F is no longer "expected red".** It was written that way pending the `⋯`; the
  `⋯` exists, so the summary section says it is a real failure now. The exit code
  is unchanged (it always counted).

## 5. Deviations, with reasoning

1. **The scrim is deleted rather than tokenised.** Acceptance item 3 asks that
   whatever replaces `rgba(0,0,0,.85)` be token-driven and correct on light.
   Nothing replaces it: full mode does not dim anything. Stronger than asked.
2. **`⋯` holds Float and Full only**, not "panel options" generally. The mock's
   button is titled "Float, Full, and panel options"; there are no other panel
   options to put in it today, and inventing some was out of scope.
3. **The `⋯`'s container query is duplicated in the editor package** rather than
   living beside its inverse in core-ui. Reasoning above; core-ui is settled
   territory and I was told to report rather than edit.
4. **The surfaces keep their own headers.** They render a bar with the backend
   name and a close button, so a full-mode surface wears two bars: PNL-009's
   detached bar (name + dock) and the surface's own (backend + return to Backend
   Services). Giving them `PanelHeader` would be a redesign, which the phase
   README explicitly parks. Flagged as a look-at-it item, not fixed.
5. **`ShowContextMenuInPopup.tsx` was touched** — not in my territory list, but
   not in the forbidden list either. One optional argument, additive, no existing
   call site changes behaviour.
6. **`router.setup.ts` was touched** — one import and one call.

## 6. Numbers

| Gate | Before | After |
|---|---|---|
| `npx tsc -p packages/noodl-editor --noEmit` | clean | clean |
| `node scripts/hex-color-ratchet.js` | `noodl-editor 16 / baseline 16`, `=` | `16 / 16`, `=` |
| `npx sass` on both changed `.module.scss` | compiles | compiles; band resolves to `@container panel-frame (max-width: 357px)` |
| `node --check` on both corpus scripts | OK | OK |

**The ratchet does not move, and the expectation that it would is wrong.** The
brief predicted deleting the scrim would improve the editor's hex count.
`scripts/hex-color-ratchet.js:59` is `/#[0-9a-fA-F]{3,8}\b/g` — it counts `#hex`
only. The scrim was `rgba(0, 0, 0, 0.85)` and the overlay's shadow was
`rgba(0, 0, 0, 0.5)`; neither was ever counted, so deleting them changes nothing.
Two real `rgba` literals did leave the codebase; the ratchet simply does not see
that class of hardcoded colour. Worth knowing before someone else predicts a
number from it.

## 7. Could not verify — the honest list

Nothing below was run. The editor cannot be launched from this worktree
(`lerna exec` resolves to the main checkout, so a pass or a fail would both be
about someone else's code), and `npm run test:ci` has the same problem.

**Must be run from the primary checkout, in this order:**

1. `npx tsc -p packages/noodl-editor --noEmit` — expect clean.
2. `node scripts/hex-color-ratchet.js` — expect `16 / 16`, `=`.
3. `npm run test:ci` for `noodl-editor`. Note the pre-existing failure the first
   pass recorded ("Project import and export … Expected 8 to be 5"); it is not
   from this work and was failing with everything stashed.
4. With a dev editor up and a project open:
   `node dev-docs/tasks/phase-23-visual-refresh/corpus/panel-chrome.mjs --json /tmp/chrome.json`
   — **this is the acceptance for the `⋯`.** Expect assertion F green for
   `components`. If it is red, the failure line now prints the header budget.
5. `node dev-docs/tasks/phase-23-visual-refresh/corpus/panel-modes.mjs --json /tmp/modes.json`
   — the mode-system behaviours.

**Live QA, in order, because each step leaves the editor where the next one needs it:**

1. Open Backend Services. Start a local backend. Click **Data** → it should fill
   the editor area beside the rail, with a bar naming it and a close button.
2. **While it is open, click another rail icon.** The rail must work. This is the
   single most important thing to check: it is what the old overlay got wrong.
3. `Escape` → docks at 860px (clamped to leave 320px of canvas). Click the
   Backend Services rail icon to get back.
4. Repeat 1–3 for **Schema** and **Access**, and for **Triggers / Email / Search /
   Sign-in providers** from the card's `⋯`.
5. In the Data browser, open **New record**. Its modal is `position: fixed;
   z-index: 1000` and now lives inside the panel's stacking context
   (`.Panel` is `z-index: 5`) instead of inside a `z-index: 9999` portal. It
   should still cover the viewport and sit above the panel. **This is the change
   most likely to have a visual regression and it is not asserted by anything.**
   Same for **Create table** in Schema.
6. Drag the panel narrow (below ~360px). Float and Full should vanish and `⋯`
   appear; the title must still read "Components", not "Co…".
7. Open the `⋯` in a **floating** panel that has been dragged away from its
   default position. The menu must appear under the button.
8. The colour picker from a floating property editor — `panel-modes.mjs` asserts
   the `⋯` menu's anchoring, which exercises the same `PopupLayer` positioning
   path, but **it does not open a colour picker**. That specific surface is still
   unverified by hand.
9. Both themes, per the acceptance. No screenshots were captured this pass;
   `panel-modes.mjs` writes them to `screenshots/pnl-009/gate--*.png` when run.

**Known unknowns, named rather than glossed:**

- **The two-bar look** on a full-mode backend surface (deviation 4).
- **Surfaces are no longer width-capped.** The old overlay centred them at
  `max-width: 900px`; full mode gives them the whole editor area (~1348px at
  1400). The data browser gains from that; Schema and Access may look stretched.
  The phase parks their design, so this is a "look at it" not a "fix it".
- **`@use` of a cross-package relative path in `SidePanel.model.scss`** compiles
  under `npx sass`, but has never been through this webpack's sass-loader. If the
  editor comes up blank after merge, that import is the first suspect.
- **Whether the surfaces survive being docked.** They were designed for a 900px
  modal; 860px docked should be fine, but nobody has looked.
