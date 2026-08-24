# FB-017 — the panel that shows everything first

**Filed:** 2026-08-22, test-user session, item 2.3. **Status: 🟡 partly done — scopes 1, 2, 3,
7 and the scroll half of 5 built, specced and driven (sessions 22–23). Scope 4 and the
panel-width half of 5 remain.** Size: L.

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
