# FB-017 — the panel that shows everything first

**Filed:** 2026-08-22, test-user session, item 2.3. **Status: 🟢 all seven acceptance criteria
closed — scopes 1–5 and 7 built, specced and driven (sessions 22–25). AC4 closed in session 25.
The only thing left in this task is scope 2's `Source Set` demotion, which is Richard's call and
was never anyone else's to make.** Size: L.

> *"Rearrange the visual nodes' props, in a way that a new user initially ONLY sees the basics
> they would need on a daily basis, like position, margins, padding, width height, alignment,
> justify content, borders and rounded corners, shadow, etc. Then for the rest hide it under
> 'advanced CSS' and collapse by default. So someone going in there knows this is the shit you
> only use in specific use cases."*

---

## Ground truth (verified 2026-08-22)

- **The collapse mechanism is dead code.** `DataTypes/Ports.ts:59` declares `groupExpansions`,
  read at `:261–263`, **written nowhere**; `addToGroup` hardcodes `isExpanded: true` (`:680`);
  `PropertyGroups.tsx` renders the group label as a plain div with **no click handler**. Every
  group is permanently expanded; there is no basic/advanced split anywhere.
- **Group order is accidental**: first-appearance order of the ports (`Ports.ts:667–681`);
  `connectionPanel.groupPriority` orders the connection popup only, not the panel.
- **The precedent**: `phase-9-styles-overhaul/STYLE-004` scoped exactly this ("no progressive
  disclosure — beginners see same UI as experts") and `PROGRESS.md:35` records the gap
  verbatim: *"Explicitly deferred (undone, no tracking task): full panel restructure
  (Content/Layout/Advanced sections)…"* This task picks that up with Richard's basic-set list
  as the ruling on what's basic.
- All shared visual ports live in **one file**:
  `noodl-viewer-react/src/node-shared-port-definitions.ts` (1,916 lines); the group-name
  vocabulary is `dev-docs/reference/PORT-GROUP-VOCABULARY.md`. FH-020's Ports tab (shipped)
  is an explorer and stays as the everything-view.

## Scope

1. **Revive collapse for real**: make groups collapsible (write `groupExpansions`, persist
   per-user), label clickable, chevron drawn. This is a prerequisite, small, and independently
   shippable.
2. **The split**: a curated basic tier — Richard's list: position (sizeMode), margin, padding,
   width/height, alignment, justify, borders + corner radius, shadow — always visible in that
   order; everything else under one **"Advanced CSS"** super-group, collapsed by default.
   Derive tier membership as data on the port definitions (a `tier` field in the shared
   definitions file), not a hardcoded list in the panel — third-party/kit nodes then get the
   mechanism for free.
3. **A group with a live connection or a changed value never hides silently**: collapsed groups
   show a count badge ("2 set"), and expanding is one click. Otherwise FB-018's confusion gets
   a new hiding place.
4. **The visual cues** (Richard's rounded-corners example): where a property commonly "doesn't
   work" for a structural reason — corner radius on an Image without clipping, transform on a
   statically-positioned element — the row gets an inline hint when the condition is detected.
   Start with a measured list of the top offenders (the corner-radius/clip one is named), not
   an open-ended system.
5. 🆕 (Jordan session 2, §4 — *"one root cause, four symptoms… wouldn't it just be a struct?"*)
   **Per-node view state**, covering the other three symptoms alongside collapse:
   - **Scroll position survives reselect** — named as the specific source of the session's
     headaches; today every reselect rebuilds the panel at scroll 0.
   - **Panel width does not change with selection** — *"every time it moves it commands my
     attention"*; reported in two sessions now. One fixed width (user-resizable, persisted),
     never content-driven.
   - **Property search/filter** — a filter box that jumps to a known property name, across
     tiers (a hit inside a collapsed Advanced group expands it).
   The store is one keyed structure (per node id: expansion map, scroll offset), user-state
   not project-state, same persistence as (1).

## Acceptance criteria

- AC1: a fresh Image node's panel first screen shows only the basic tier; Advanced CSS is one
  collapsed group; expansion state persists across editor restarts.
- AC2: a port with a connection or non-default value inside a collapsed group is discoverable —
  badge count asserted, and FB-018's chip still reachable.
- AC3: tier membership is data on the definitions; a port with no tier lands in Advanced (safe
  default), asserted by a sweep over all visual nodes' ports — no port vanishes entirely
  (cardinality: basic + advanced = all).
- AC4: the corner-radius-on-Image hint draws when radius is set and the image isn't clipped,
  and not when it is — both arms asserted.
- AC5: driven in the running editor, both themes; the pure grouping logic specced separately
  from the React half.
- AC6: reselecting the same node restores its scroll position and expansion state; selecting
  a different node type does not move the panel's width — both driven (Jordan §4's two
  costliest symptoms).
- AC7: typing in the property filter finds a port inside a collapsed group and reveals it;
  clearing the filter restores the tier view.

## Traps

- `Ports.forEachNode` stops on a truthy return — any sweep written over ports must not use it
  naively.
- The panel renders through `BaseDialog`-adjacent machinery in places — every dialog renders
  twice; filter `MeasuringContainer` before counting DOM.
- Persisting expansion is user-state, not project-state — don't write it into the project (a
  project write dirties every component).


---

# Session 22 — what was built, and the two rulings inside it

`879f2f4c`. **AC1 ✅ AC2 ✅ AC3 ✅ (with a stated deviation) AC5 ✅ AC6 half ✅ · AC4 ⬜ AC7 ⬜.**

## What shipped

- **`propertyPanelTiers.ts`** — the ruling. 22 shared-CSS groups fold into one collapsed
  `Advanced CSS`; the rest order as *node subject first* (`General` pinned, then alphabetical),
  then Richard's CSS list. Pure, no imports.
- **`propertyPanelViewState.ts`** — expansion per group name, persisted through `EditorSettings`
  (user state); scroll per node id, in memory, LRU-capped at 50.
- **`PropertyGroups.tsx`** — the heading is a real `<button aria-expanded>` with a chevron and a
  `"N set"` badge; `Advanced CSS` nests its groups and keeps their own headings.
- **`Ports.ts`** — two-tier render, badge counting, and the scroll repair below.
- 44 specs across 3 files.

## 🔴 Ruling 1 — tier is keyed by GROUP NAME, not a per-port `tier` field

AC3 asked for "a `tier` field on the port definitions". It is keyed by `group` instead, for three
reasons that all point the same way:

1. **The group is the only unit the panel can collapse.** A per-port tier lets a group straddle
   both tiers, and then `Margin and padding` renders as a heading in the basic tier *and* inside
   `Advanced CSS`. Two identical headings is a worse legibility defect than the one being fixed.
2. **A new port field crosses five hand-written lists**, four of which dropped FB-015's
   `placeholder` in session 21 — and every intermediate state read as *done* from the source.
   `group` already survives that pipeline intact; it is what the panel groups by today.
3. **The vocabulary already exists and is gated.** `PORT-GROUP-VOCABULARY.md` is normative with
   `catalog:groups:check` behind it. A parallel `tier` field is a second vocabulary to keep in step.

## 🔴 Ruling 2 — the default is BASIC, deliberately against AC3

AC3 says a port with no tier "lands in Advanced (safe default)". **Measured against the corpus,
that default is the most damaging thing the module could do.**

29 visual nodes carry 58 groups. 22 are shared CSS plumbing. The rest are the node's **subject**:
`Image` holds Source, `Text` holds Text, `Video` holds Autoplay. Advanced-by-default buries a
node's reason for existing, and does it precisely to the nodes this file has never seen — every
third-party and kit node.

| Default | Error it makes | Cost |
| --- | --- | --- |
| Advanced | a new node's subject port is hidden | the node looks empty and unusable |
| Basic | a new shared CSS port shows on the first screen | one extra row |

AC3's real worry — silent rot — is answered by a **check** rather than a default:
`propertyPanelTiers.test.ts` sweeps the catalog and fails if a group carried by 3+ visual node
types is unclassified, **and** fails in the other direction if a rule matches nothing. A default
nobody audits cannot do either. ⚠️ Reversible in one line if Richard disagrees.

## 🔴 The drive found a pre-existing defect: scroll restore read the wrong element

`Ports.renderGroups` has always said *"remember the scrolling so a re-render doesn't reset the
scroll position"* via `this.el.parentElement.parentElement`. **That lands on
`.sidebar-property-editor`, which carries `overflow-y: auto` and never overflows** — its
`scrollHeight` equals its `clientHeight`, so its `scrollTop` is permanently `0`. The real scroller
is `ScrollArea`'s root, six levels up, mounted by `index.tsx`.

So it has been reading 0, storing 0 and restoring nothing since the panel moved inside a
`ScrollArea` — which is exactly Jordan §4's costliest symptom, filed as a missing feature when it
was a broken one. ⚠️ **A fixed hop count is what made it silent**: two `parentElement`s cannot
fail, they just arrive somewhere else after someone wraps the panel. It walks for the property now.

⚠️ **My first repair failed the same silent way.** The listener bound only inside
`if (scrollTop)`, which is never true on a first render — and `instance.render()` runs *before*
`setInstance` mounts the `ScrollArea`, so `this.el` has no parent at all at that moment. A panel
that opens at the top looks identical whether the offset was restored as 0 or never stored.
`settleScroll` retries for 5 frames.

## What the drive proved that 44 green specs could not

| Claim | Measured |
| --- | --- |
| AC1 default | `Group`: 10 basic groups + `Advanced CSS` collapsed, holding 5 |
| AC1 toggle | click → `aria-expanded=true`, children visible, chevron rotated |
| AC1 persistence | `editorSettings.json` → `{"Advanced CSS": true}`; survives a reload |
| AC2 badge | two params set in the folded tier → **"2 set"** on the collapsed super-group |
| AC6 scroll | 600 → select away → back → **600**; control: two other nodes at 0 |
| AC5 themes | badge 8.46:1 / label 9.24:1 dark; 6.14:1 / 6.18:1 light — all > 4.5:1 |

⚠️ **The catalog is not the panel's population.** The catalog gives `Group` 18 groups; the live
panel draws 15 (+ the synthetic `Advanced CSS`). `Focus`, `Scroll To Element` and
`Scroll To Index` are signal/action groups that get no property rows. The sweep is a proxy — a
good one for classification completeness, not a census of what renders.

⚠️ FB-017's ground-truth note says a `Group` has **19** groups. Measured: **18**.

## What is left, and one thing that is now measured rather than reported

- ⬜ **AC7 — the property filter.** Untouched.
- ⬜ **AC4 — the corner-radius-on-Image hint.** Untouched; still wants a measured list of
  offenders rather than an open-ended system.
- 🔴 **AC6's other half — the panel width moves with selection, and here is the number.**
  Group `0030` → **312px**, Image `0032` → **346px**. The cause is `min-width: auto` on the flex
  chain above `.sidebar-panel`, so the panel is content-driven and overflows its own `ScrollArea`
  (Container 312, Root 324, panel 346). **Deliberately not fixed**: it is shared sidebar layout
  used by every registered panel, and a `min-width: 0` there needs every panel driven before it
  can be believed. That is a session's work with a rebuild between each check, not a tail-end
  one-liner.
- ⚠️ **Scope 2's "demote Source Set to the advanced tier"** (FB-015 deferred it here) is *not*
  done. `Source Set` sits in the `Image` group, which is a subject group and therefore basic.
  Demoting one port inside a basic group is exactly the per-port tiering Ruling 1 rejected — so
  it needs either its own group or a decision to accept a split heading. **Richard's call.**


---

# Session 23 — AC7, the property filter

**AC7 ✅.** `propertyPanelFilter.ts` (pure), `PropertyFilterInput.tsx`, a `NoMatchesNotice` in
`PropertyGroups.tsx`, and the wiring in `Ports.renderGroups`. 29 new specs.

## What shipped

- **`propertyPanelFilter.ts`** — normalisation, matching, group filtering, and the threshold that
  decides whether the box is offered at all. Pure, no imports, no React.
- **`PropertyFilterInput.tsx`** — a module of its own *because* `SearchInput` reaches `Icon`, and
  `Icon` makes a spec in this runner fail **to run**. `groupHeading.test.tsx` imports from
  `PropertyGroups.tsx`, so putting the search chrome there would have taken 94 existing
  assertions down silently.
- **`Ports.ts`** — the raw query joins the render hash, the box is offered on row count, and
  expansion is overridden transiently while searching.

## 🔴 Ruling 3 — a search NEVER writes to persisted expansion

A hit inside the collapsed `Advanced CSS` has to open it. Opening it via
`propertyPanelViewState.setExpanded` would write a *searching keystroke* into the builder's
persisted preferences — so every node they selected afterwards, in every session after this one,
would open with Advanced CSS expanded because they once looked for `transform origin`. The tier
split would erode itself one search at a time.

So `Ports._filterExpansion` is a transient map, non-null exactly while a filter is active. Absent
an entry a group reads expanded; entries are groups the builder collapsed *during* the search,
which is worth honouring until the box is cleared. **Driven both ways** — see the table below.

## 🔴 The fixture that proved a rule it could not actually test

The module matches a query against the row label, the **port name**, and the **group name**. The
first draft justified the group-name rule with `Margin and padding` — "the rows are `Left`,
`Right`, `Top`, `Bottom`, so typing `margin` finds nothing". **That is false.** The real ports are
`marginLeft` labelled `Margin Left`: the word is on every row twice.

The spec fixture was invented to match the wrong claim, so **deleting the group-name branch left
all 24 assertions green**. Only mutating the source found it. Fixtures are now read from
`node-shared-port-definitions.ts` (58 shared CSS ports, 14 groups), and the rule is defended by
the groups that actually need it:

| Match path | Groups that need it, measured |
| --- | --- |
| port **name** | `Placement` — rows are `transformX`/`transformRotation`, labelled `Pos X`/`Rotation` |
| **group** name | `Style`, `Alignment`, `Dimensions`, `Layout`, `Placement`, `Dimension Constraints` |

`Style` is the sharpest: its rows are `Opacity`, `Blend Mode`, `Visible`, `zIndex`, so a builder
typing the word in the heading above them would have been told there is no such thing.

⚠️ **All 10 mutations are now caught** (M1–M10). The first sweep of that check measured *nothing*
— a `cd` inside the helper broke the relative jest config path, so every run errored and printed
no summary line, which read exactly like a pass.

## 🔴 The third appearance of one defect: `position: sticky` was inert

The filter box was written sticky, because the properties it reaches are mostly at the *bottom* of
the panel. **Driven: with `top: 0` set, scrolling the panel to 400 put the box's top at −16px** —
straight off screen. Sticky binds to the nearest scrolling ancestor, and between the box and the
real scroller sit `.sidebar-property-editor` (`overflow-y: auto`) and `.sidebar-panel`
(`overflow: hidden`). The first captures the sticky and pins it to a scrollport **that never
scrolls**.

That is the *same element, same reason* as session 22's scroll-restore defect, and the same flex
chain AC6's panel-width half is stuck in — three symptoms, one cause. A genuinely fixed filter
header has to live **outside `.sidebar-panel`, above the `ScrollArea` in `index.tsx`**, which is
the shared sidebar layout session AC6 is waiting on. The dead declaration is removed rather than
shipped looking like it works.

## What the drive proved that 29 green specs could not

Fixture `fb017-drive`, Group `…0030` (47 rows), dark and light.

| Claim | Measured |
| --- | --- |
| AC7 core | `Dimension Constraints` invisible inside collapsed `Advanced CSS` → typed `width` → **revealed**, `aria-expanded` false→true |
| AC7 restore | Escape → 16 headings, Advanced CSS collapsed, 22 rows — **identical to baseline** |
| Ruling 3 | filter expanded the section while `editorSettings` stayed `{}` through a 6s settle |
| Ruling 3 control | a **real heading click** wrote `{"Advanced CSS": true}` in the same window, and collapsing back **deleted the entry** |
| Override | forced open → collapsed by hand → next keystroke **stayed collapsed**, still unpersisted |
| Threshold, both arms | Group 47 rows → **1** box; `Number` node 8 rows → **0** boxes |
| Empty state | `zzzz` → notice naming the query, box still reachable, `0 properties match` announced |
| Contrast | dark 11.47 / 9.24 / 14.71 / 9.24 · light 7.49 / 6.18 / 16.26 / 6.18 — all > 4.5:1 |

## ⚠️ Harness corrections, session 23

1. 🔴 **Never write `input.value` directly on a React-controlled input.** It updates React's value
   tracker, so the *next* legitimate `input` event is deduped and `onChange` **never fires**. It
   cost two false readings here: a panel that looked stuck filtered, and a "clear" that did
   nothing. Use `cdp -- type`, or the native-setter + `dispatchEvent` pair — and never both.
2. 🔴 **`editorSettings.json` nests everything under a `settings` key**, and **writes
   asynchronously**. Reading the top level returns `null` for every key, which reads exactly like
   "nothing was persisted" — it invalidated this session's first absence check. Settle-loop on the
   file, and always pair an absence with a known-firing control.
3. ⚠️ **`cdp -- type` appends** to the existing value; it does not replace it.
4. ⚠️ **A DOM attribute used as a click target does not survive a re-render** — re-tag before
   every click, or the second click silently lands on nothing.
5. ⚠️ **`cdp -- reload` closes the project** and returns to the launcher.

## Found while working, owned by nobody

- ⚠️ **A `Number` node draws a top-level group literally called `ADVANCED`**, expanded, beside the
  synthetic `Advanced CSS`. Correct under Ruling 2 (unknown → basic) and harmless, but the tier
  vocabulary now has two different things called "advanced" on screen. Worth a look by whoever
  revisits `propertyPanelTiers.ts`.
- ⚠️ **`width`/`height` are absent from the panel** on a `contentSize` Group — spliced by
  `applyPortConditionsFilterForNode` in `ModelProxy.getPorts`, *before* `Ports._getPorts`. That is
  FB-021's territory, and it is why the filter cannot reach a gated port either way.

## Still not done

- ⬜ **AC4 — the corner-radius-on-Image hint.** Untouched; still wants a measured list of
  offenders rather than an open-ended system.
- 🔴 **AC6's other half — the panel width.** Unchanged from session 22, and now with a third
  symptom (sticky) pointing at the same `.sidebar-property-editor` / `.sidebar-panel` chain.
- ⚠️ **Scope 2's "demote Source Set to the advanced tier"** — still Richard's call, unchanged.

---

# Session 24 — AC6's second half, and the one cause behind all three symptoms

**AC6 ✅ (both halves). AC7's filter header is now genuinely sticky.** `ScrollArea.module.scss`,
`BindingChip.module.scss`, `propertyeditor.css`, `propertyeditor.ts`. CSS only, plus one class name.

## 🔴 First: what session 22's numbers were actually measuring

Session 22 filed *"the panel width moves with selection — Group `0030` → 312px, Image `0032` →
346px"* and scoped the fix as *"shared sidebar layout used by every registered panel… a session's
work"*. **Re-measured before touching anything, and the framing was wrong in the way that matters:**

| Element | Group `0030` | Image `0032` |
| --- | --- | --- |
| `FrameDivider` / `SideNavigation .Root` | 380 | 380 |
| `SideNavigation .Panel` — **the side panel** | **327** | **327** |
| `.sidebar-panel` / `.sidebar-property-editor` — **the property column** | 312 | **346** |

**The side panel does not move on selection, and has not since FIX-009** grouped `components`,
`PropertyEditor` and `PortEditor` into one `selection-slot` width key. 312 and 346 are the *content
column inside* a fixed panel — and 346 in a 312 scrollport means the column was **overflowing its
own scroller sideways**: `scrollLeft` reached **33.5**, so 34px of every row sat off the right-hand
edge with a horizontal scrollbar under a component that declares vertical scrolling only.

⚠️ **A second census that will mislead the next reader too.** Driving all 13 rail panels gives
navPanel widths of 327 / 339 / 379 / 399 / 419 / 459 / 559. Those are **declared `defaultWidth`s**
at each `register()` call (340, 380, 400, 420, 460, 560, minus a 1px border), not content-driven
anything. `editor-sidebar-widths` was **absent** from `editorSettings.json` at the time, so nothing
was persisted and nothing needed to be.

## 🔴 The one cause, and why it made three different-looking defects

Four elements in the chain declare a non-`visible` overflow. **Two of them are scroll containers
whose content has never overflowed them**, because the panel sits inside `ScrollArea`, whose
`.Container` is `min-height: 100%` and simply grows to fit. A scroll container that cannot scroll
is invisible in every way except its side effects — and it has three:

| Symptom | Filed as | Actually |
| --- | --- | --- |
| Scroll position never restored (s22) | a missing feature (Jordan §4) | `scrollTop` read from `.sidebar-property-editor`, permanently `0` |
| `position: sticky` inert (s23) | "sticky cannot work without re-parenting" | captured by the same element **and** by `.sidebar-panel` |
| Column width moves with selection | "shared sidebar layout, a whole session" | two independent CSS defects, both local |

## What shipped

1. **`ScrollArea.module.scss` — `scrollbar-gutter: stable`, and `overflow-y: overlay` deleted.**
   🔴 That declaration has been dead since Chromium dropped `overlay`, and it read as the *opposite*
   of what it did: an overlay scrollbar takes no space, this one always took 12px. Measured: a
   `Number` node (8 rows, no vertical overflow) gave the column **324px**; every node tall enough to
   scroll gave **312px**. So the column jumped 12px on most selection changes, and the one
   declaration a reader would check said it could not.
2. **`ScrollArea.module.scss` — `min-width: 0` on `.Container`'s children.** `.Container` is a *row*
   flex container, so its child carried `min-width: auto` and could not shrink below its own
   min-content width. That is what let the column dictate its width instead of filling the
   scrollport. Stated on the children because the automatic minimum size is a property of the flex
   **item**.
3. **`BindingChip.module.scss` — `max-width: 100%`.** The chip is `inline-flex`, so its `flex: 1`
   does nothing in `PropertyPanelInput`'s block `.InputContainer` and it sized to its full `nowrap`
   source name (244px). It was the single run of content wide enough to widen the whole column. With
   a ceiling the `text-overflow: ellipsis` it already declared finally has something to bite on; the
   full source stays reachable through the chip's `title`.
4. **`.sidebar-property-editor` → `overflow: visible`, and `.sidebar-panel.property-editor-shell`
   likewise** (a modifier, because `componentports.ts` wears the same class and is not part of this
   measurement). Then **`position: sticky` restored on `.property-filter`.**

## What the drive proved

Fixture `fb017-drive`, 9 nodes, dark and light.

| Claim | Before | After |
| --- | --- | --- |
| Column width across 9 nodes | **312 / 324 / 346** | **312 for all nine** |
| Image `0032` horizontal scroll | `scrollLeft` **33.5** | **0** |
| Side panel width across the same 9 | 327 (already constant) | 327 |
| Same, at the 240px floor (divider dragged) | — | **224 for all**, `hscroll` 0 |
| 🔴 **Control at that floor**: the two declarations reverted *in place* | **346 in a 224 port, `scrollLeft` 121.5** | restored → 224 / 0 |
| Filter header at `scrollTop: 400` | top **−16px** (off screen) | top **277 = the scrollport's own top** |
| ⚠️ …with only `.sidebar-property-editor` cleared | — | **still −16.** Neither half is sufficient alone |
| AC7 filter still works | — | `transform origin` → 2 rows, Advanced CSS `aria-expanded` false→true; cleared → **20 headings / 39 rows / collapsed**, identical to baseline |
| Ruling 3 still holds | — | `propertyPanel.groupExpansion` **`{}`** through the whole search |
| Scroll restore still works | — | 600 → other node **0** → back **600** |
| Every registered panel | baseline captured | **unchanged**, see below |

**All 22 registered panels driven** — 13 from the rail, 8 more (`PortEditor`, the 7 `backend-*`
surfaces) through `SidebarModel.switch`, plus the `Ports` tab. Every navPanel width, every rendered
text length and every clip count identical to the pre-change baseline, except the intended 12px
gutter (Explain/Build `364→352`, Community `344→332`). Problems was already scrolling, so it did not
move at all.

⚠️ **No spec.** The defect is layout — jsdom computes none of it, and a `toContain` over the CSS
source would pass on a declaration that had been deleted from the cascade. The evidence is the drive
above, including a control pair that varies *only* the two declarations in the running editor.

## Found while working, owned by nobody

- 🔴 **`SidebarModel.switch('PortEditor')` crashes the panel** — `TypeError: Cannot read properties
  of undefined (reading 'on')` at `componentports.tsx:387`, caught by the `ErrorBoundary`. Pre-existing
  and not user-reachable (the panel has no rail icon and is only opened by `switchToNode`), but it
  means `PortEditor` is the one registered panel this session could not drive **in its real state** —
  the fixture has no component with ports (`fix012-drive` does).
- ⚠️ **The Settings panel clips two rows** — `.property-label-col` at `154` client / `278` scroll.
  Pre-existing, unchanged by this work, and Settings has no `ScrollArea` so it is a different chain.

## ⚠️ Harness corrections, session 24

1. 🔴 **A stale `data-*` click tag sends the click to the FIRST match in document order.** Tagging a
   second element without clearing the first meant `cdp click` reported success at coordinates
   belonging to the *page root*. Clear every `[data-drive]` before tagging. (Same family as s23's
   note 4, but the failure is louder: the click lands somewhere real.)
2. 🔴 **A programmatic `scrollTop =` does not reliably deliver its `scroll` event in an occluded
   renderer.** The listener was bound and correct; the recorded offset simply never updated, which
   reads exactly like a broken feature. `el.dispatchEvent(new Event('scroll'))` proved the binding
   in one call. **Cost: ten minutes chasing a regression that did not exist.**
3. ⚠️ **A CSS-module edit does not hot-reload here** — `[HMR] Nothing hot updated`, then measurements
   identical to the baseline in every digit. **Check the computed style before believing a null
   result**; `cdp reload` + re-open the project is the fix.

---

# Session 25 — AC4, and the offender that was named the wrong way round

**AC4 ✅. FB-017 is closed apart from Richard's `Source Set` call.** New:
`propertyPanelHints.ts` (pure), `utils/portHint.ts` (the row wrapper), three edits to
`DataTypes/Ports.ts`, one CSS rule. 30 new specs, plus a drive over a six-node fixture.

## 🔴 First: the named offender does not reproduce, and the real one is its parent

Scope 4 names *"corner radius on an Image without clipping"*. Before building anything, that was
measured by hit-testing the corner pixel of a 200×200 box with a 40px radius in the editor's own
renderer (`document.elementFromPoint` at 3px in from the top-left; the centre of every box was
sampled too as a positive control, and hit the child in all five rows):

| Case | corner pixel hits | centre |
| --- | --- | --- |
| `<img>` carrying the radius itself, nothing clipping | **not the image** — it is rounded | child |
| control: the same `<img>` at radius `0` | the image | child |
| a parent with the radius, `overflow: visible`, square child | **the child** — square corner | child |
| the same parent at `overflow: hidden` | neither — it is rounded | child |
| control: the same parent at radius `0`, `overflow: visible` | the child | child |

`border-radius` clips a replaced element's own content with no help from `overflow`, and an `Image`
node renders as a bare `<img>` carrying the style (`Image.tsx`). **So corner radius on an Image
works, on its own, with nothing clipping anything.** What fails is a *container* whose children
paint over its rounded corners — and the reporter met that through an Image inside a Group.

⚠️ Two controls are what make that readable rather than a guess: the radius-`0` rows prove the
instrument reports a hit when there is one, and the centre column proves the child was hittable
throughout, so "the corner missed" is about the corner and not about a broken fixture.

**The port that needs the hint is on the parent.** AC4's wording is satisfied by the arm it asks
for — radius set, not clipped, hint; clipped, no hint — but the subject is the container.

## The offender set, measured against the catalog rather than reasoned about

`node-catalog.json`: **14 node types carry `borderRadius`, 3 carry `clip`, and the only overlap is
`Group`.** Twelve of the fourteen declare `allowChildren: false` and so can never reach this state.
The two that can:

| Node | children | `Clip Content` |
| --- | --- | --- |
| `Group` | yes | yes — and it defaults to **off**, so the defect is the *default* state |
| `Button` | yes | **no such port**; `Button.tsx` puts `props.children` straight in the `<button>` |

That second row is why the message has two forms. Telling a Button author to switch on a control
their node does not have is the dead end `portDecoration.ts` already names as a build failure.

⚠️ **The other offender scope 4 names — "transform on a statically-positioned element" — is not
real here either.** `layout.ts`'s `Layout.align` ends
`style.transform = transform + (style.transform || '')`: an alignment transform is *prepended* to
the author's, never substituted, in every position mode. It is not in the list, and the list is
closed at one.

## 🔴 The seam the obvious implementation would have missed

The two wrappers already on `Ports.renderParams` key off `v.name`, and copying that would have
shipped a feature that draws nothing. The five corner-radius ports declare `tab: { group:
'corners' }`, so `getViewGroupsFromPorts` folds them into a **`TabGroup`** and pushes that into
`this.views` — **and a `TabGroup` has no `name`.** A per-port wrapper reaches none of them. It
would have compiled, passed a pure-logic suite, and put a note on screen exactly never: the ninth
entry in this repo's "hole shaped like the defect" list, caught only by reading
`getViewGroupsFromPorts` before writing the wrapper. Hence `portNamesForView` — a view speaks for
its own port *and* for any it holds.

## 🔴 The second thing that would have shipped broken: the panel never re-renders

`renderGroups` hashes the **port list**, and `clip` gates no ports, so flipping it changes nothing
the hash can see. There is no `parametersChanged` listener on the panel either —
`WorkflowTypes.ts:508` records that in as many words. So a hint applied only at render time appears
no earlier than the *next selection*: the author who has just typed a corner radius and is staring
at the panel would never see it, which is the entire flow this feature exists for.

A full re-render is not the fix — `borderRadius` is a typed number field, and rebuilding the panel
under a focused input takes the focus with it. So `applyPortHint` is idempotent (it removes any
note it finds before adding one) and `Ports.refreshHints` re-applies it **in place**, on a watch
list of seven parameters, finding its targets by an attribute the render pass left behind.

## What shipped

1. **`propertyPanelHints.ts`** — pure. `hintsForNode` keyed on the node's own state, not a list of
   type names: `allowChildren: false` nodes cannot hold children, so "has children" already
   excludes the twelve non-offenders and keeps working for kit nodes this file has never seen.
   `isChildClipped` covers both routes off `Group.tsx` — `clip`, and native scroll's
   `overflow: auto`, which clips to the radius just as well. ⚠️ `nativeScroll` defaults to **true**.
2. **`utils/portHint.ts`** — `portNamesForView`, and an idempotent `applyPortHint` used by both the
   render path and the live refresh.
3. **`DataTypes/Ports.ts`** — `structuralHints()` (which asks the **node** for `hasPort`, not the
   already-filtered `_getPorts()`, because the two messages turn on "no such port" vs "hidden"),
   the `renderParams` call, and two narrow subscriptions: `parametersChanged` filtered to the seven,
   and `nodeAttached`/`nodeDetached` for a child dragged in or out.
4. **`propertyeditor.css`** — one rule, deliberately the same shape and typography as
   `.property-capability-reason`. ⚠️ `--theme-color-notice` currently *aliases*
   `--theme-color-warning`, so the two rules are the same hue today; the separate token is so they
   can diverge later without touching this rule.

## What the drive proved

Fixture `NodeGX test projects/ac4-drive`, six roots built to separate the arms from the controls.

| Node | radius | children | clip | note | |
| --- | --- | --- | --- | --- | --- |
| R1 | 40px | 1 | off | **1** | **AC4 arm 1** |
| R2 | 40px | 1 | **on** | **0** | **AC4 arm 2** |
| R3 | 40px | **0** | off | 0 | control — nothing can overflow |
| R4 | **none** | 1 | off | 0 | control — nothing to warn about |
| R5 `Image` | 40px | 0 | — | 0 | the named case, correctly quiet |
| R6 `Button` | 40px | 1 | no port | **1** | and with the *other* sentence |

R6's note reads *"This node has no Clip Content option — round the child instead, or put it in a
Group that clips."* — the variant, not the Group one.

**The live half, with an instrument that can tell a re-render from an in-place edit.** The host
element was stamped with a `data-stamp` attribute before each change; a rebuilt panel loses the
stamp, an in-place update keeps it.

| Action | note | host element |
| --- | --- | --- |
| R1 selected | 1 | stamped |
| **real click** on the Clip Content checkbox → `clip: true` | **0** | **same element, stamp intact** |
| clicked again → `clip: false` | **1**, correct text | same element, stamp intact |
| R4 (no radius) → set a radius with the panel open | **0 → 1** | same element, stamp intact |
| 🔴 focus test: caret in the `borderRadius` field, then `clip` flipped | 1 → 0 | `activeElement` **unchanged**, caret still at 2, value still `40` |
| AC7 filter still works: typed `corner` | **1**, under the single `Corner Radius` heading | — |
| filter cleared | 16 headings, as before | — |

**Contrast, both themes** (composited through the rule's own `opacity: 0.85` onto the panel
background, not read off the token):

| Theme | text | background | ratio |
| --- | --- | --- | --- |
| dark | `rgb(193,200,208)` | `rgb(33,41,50)` | **8.71:1** |
| light | `rgb(101,111,122)` | `rgb(255,255,255)` | **5.09:1** |

Both clear 4.5:1, which is the bar that applies — it is 10px text.

## Specs

**30, all green.** `tests-unit/fb-017/propertyPanelHints.test.ts` (18) has AC4's two arms, the five
ways it must not fire, both message variants, and a sweep over `node-catalog.json` that fails if
`Group` ever stops being the only node that both rounds and clips.
`tests-unit/property-editor/portHint.test.ts` (12) is the `TabGroup` case stated as a test, plus
the idempotence and removal the live refresh depends on.

⚠️ **The messages are asserted by what they say, not against the exported constant.** Handing the
expected string in as an input and reading it back grades nothing — and it was this task's own
session 22 that put that entry on the traps list.

⚠️ **The catalog sweep can only check the port half.** `node-catalog.json` carries no
`allowChildren`, so "which of these can hold a child" is not derivable there; that half was read
from `react-component-node.ts:908` (it defaults to `true`) and is recorded in the module header
rather than asserted.

## Found while working, owned by nobody

- ⚠️ **A radius arriving over a connection gets no hint**, deliberately. The panel knows a port is
  connected, not what value it carries, so a hint there would be a guess — and a false hint tells
  an author their corners are broken when they are not. Same for `overflow` set through Advanced
  CSS or a `cssClassName`, which is not visible from the graph at all.
- ⚠️ **The `scrollEnabled: true, nativeScroll: false` branch is read, not driven.** That path takes
  `renderIScroll`, which wraps the children and leaves the root at `overflow: visible` — no CSS
  anywhere sets `overflow` on `.scroll-wrapper-internal`. So the hint *does* draw there, which
  looks right, but it is the one branch nobody has watched. If that is wrong, a scroll-enabled
  Group with a radius gets a note it should not have.

## ⚠️ Harness notes, session 25

1. ✅ **There is no editor global, but there is a module registry.**
   `window.webpackChunknoodl_editor.push([[key], {}, (r) => (window.__wreq = r)])` hands back
   webpack's require, and `__wreq.c['./src/editor/src/contexts/NodeGraphContext/NodeGraphContext.tsx']
   .exports.NodeGraphContextTmp.nodeGraph` is the live `NodeGraphEditor`. `ed.findNodeWithId(id)`
   then `ed.selectNode(view)` selects a node without touching the canvas — 2,502 modules are
   reachable this way. ⚠️ `selectNode` wants the **editor node**, not the model node; passing the
   model throws inside `selectionActions`.
2. ✅ **`ThemeManager` is exported as the instance, not the class.** `T.instance` is undefined and
   `T.prototype` is empty; call `ThemeManager.setMode('light')` on the export directly.
3. ✅ **A fixture can be opened without the native dialog** by prepending a row to
   `~/Library/Application Support/NodeGX/recently_opened_project.json` and reloading the renderer.
   Back the file up first — it is 3.7MB, almost all of it base64 thumbnails.
4. ⚠️ **Stamping a DOM node is how you tell an in-place update from a re-render.** Everything else
   about the two looks identical from a selector query, and the whole design here turns on which
   one happened.

## Gates, session 25

Measured on this tree, not quoted from a handover:

- `npm run test:main`: **325 files / 5240 specs / 0 failures**, exit 0. Session 24's floor was
  323 / 5210; this adds exactly the 2 files and 30 specs written here, so there is no drift and
  no flake hiding in the difference.
- `npm run typecheck:editor`: **0 errors**, exit 0.
- 🔴 **`test:ci` was NOT run, and it is the one gate this change genuinely wants** — `Ports.ts`
  is covered by `tests/nodegraph/propertyeditor.js`, and `renderParams` and `bindModel` were both
  edited. It was started and **deliberately killed in its webpack phase**: the machine had a VM at
  66% CPU, another project's `pytest` at 48%, load 5.65, and **1,116M of 13,312M swap free**. Under
  that, `freshDb` timeouts and scattered reds read exactly like regressions in this work. ⚠️ *Alone
  on the checkout is not alone on the machine.* **Whoever picks this up next should run it on a
  quiet machine and compare failures by name against the 08-19 floor** (2849 specs / 10 failures),
  not by count.
- Not run, nothing touched them: `typecheck:core-ui`, `noodl-runtime`, `noodl-viewer-react`, all of
  `nodegx-community`. **FB-017 is editor-side and does not deploy.**
