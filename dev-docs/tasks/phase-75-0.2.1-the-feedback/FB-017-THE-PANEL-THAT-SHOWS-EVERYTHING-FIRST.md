# FB-017 — the panel that shows everything first

**Filed:** 2026-08-22, test-user session, item 2.3. **Status: ⬜ open — specified once
(STYLE-004), then explicitly deferred with no tracking task. This is that task.** Size: L.

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
