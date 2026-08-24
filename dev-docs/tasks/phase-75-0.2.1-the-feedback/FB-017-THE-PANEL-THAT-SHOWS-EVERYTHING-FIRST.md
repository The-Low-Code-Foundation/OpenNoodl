# FB-017 — the panel that shows everything first

**Filed:** 2026-08-22, test-user session, item 2.3. **Status: 🟡 partly done — scopes 1, 2, 3
and the scroll half of 5 built, specced and driven in session 22 (`879f2f4c`). Scopes 4, 7 and
the panel-width half of 5 remain.** Size: L.

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
