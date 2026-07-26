# UIX-013 — Node Picker Overhaul — NOTES

**Status:** ✅ Complete — implemented, gated and live-verified in both themes
**Executor:** Opus 5
**Date:** 2026-07-26

---

## The spec's premise was half stale — and the half that was stale mattered

The spec says the auto-expand failure is a live state-management bug in
`NodePickerCategory`: the component mirrored its `isCollapsed` prop into local
`useState`, the header's `onClick` wrote only to the local copy, so a mouse
click desynced it from `cursorState.allCategories` and later programmatic opens
computed from state the component had diverged from.

**That bug was already fixed — by UIX-012, which landed in `78df460`.** Reading
the files before building anything (as the spec asks) found:

- `NodePickerCategory.tsx:46-51` — the mirrored `useState` was gone, replaced by
  `const isCollapsedState = isCollapsed;` and a comment naming the drift;
- `NodePicker.reducer.ts` — `toggleCategoryByName` added, `setCategoryCollapsed`
  made copy-on-write, and `UpdateAllCurrentCategories` taught to carry collapsed
  state across a re-parse (the *second* cause: re-parsing on every keystroke
  reset every category to `isCollapsed: true`, undoing the expand-on-search that
  had just been dispatched);
- `tests/nodepicker/NodePickerReducer.test.ts` — nine specs pinning it.

So the reported user-visible complaint ("search leaves you staring at collapsed
categories") had already had its cause removed. What had *not* changed is the
thing that made the bug possible: a design where "which categories are open" is
state at all.

This task therefore did what the spec's Desired State asks rather than
re-fixing the cause: **the accordion is gone**, and with it
`allCategories[].isCollapsed`, the three-mode cursor context
(search / category / node), `NodePickerCategory`, `NodePickerSubCategory`,
`NodePickerSection`, `NodePickerNodeGroup`, `NodePickerNode`,
`NodePickerOtherItem` and `NodePicker.selectors.ts`. There is no collapsed flag
left to keep in sync, which is a stronger guarantee than a passing sync test.

---

## What shipped

### Layout

Per the mock: head (segmented tabs + `esc to close`, then the search row with a
live result readout), body (category rail · results · node preview), and a
persistent footer hint bar.

| Piece | File |
|---|---|
| Result model — matching, ranking, grouping, counts | `NodePicker.search.ts` (new) |
| Interaction state — query, rail filter, cursor | `NodePicker.reducer.ts` (rewritten) |
| React wiring — state, keys, docs fetch, ports | `NodePicker.hooks.ts` (rewritten) |
| Panel geometry, one source | `NodePicker.constants.ts` (new) |
| Recently placed nodes | `NodePicker.recents.ts` (new) |
| Node glyphs | `NodePicker.icons.ts` (new) |
| Card, rail, results, preview, search bar, footer, empty state | `components/NodePicker*/` (new) |
| Segmented tab variant + `slotEnd` | `noodl-core-ui` `Tabs` |

### The keyboard cursor is a *key*, not an index

The one piece of real state-model risk. Results are re-ranked on every
keystroke, so an index cursor points at whatever slid into that slot. The
reducer stores the cursored item's key and derives the index from the flat
render order (`itemKeys`, pushed in by the view). Consequences, all specced:

- re-ranking moves the highlight *with* the node;
- when the cursored node stops matching, the cursor re-anchors to the top-ranked
  result — which is also how "on search it starts on the top result" falls out;
- the cursor is never nowhere while there is something to be on.

### Search ranking

Kept the existing ordering semantics (name matches ranked by where the term
appears, ties to the shorter name) and fixed a latent defect while porting it:
the old `getMatchIndex` returned `true` for a search-tag match, which then went
into `a.matchIndex - b.matchIndex` arithmetic as `1`, ranking tag matches
between "starts with" and "contains at index 2". Tag and port matches are now
banded strictly below every name match, and every non-name match states its
reason on the card (`tag · text`, `port · bodyText`), as the spec requires.

### Decisions where the mock and reality disagreed

- **Panel size.** The mock is 1000 × 660; the editor window's minimum is
  **600 × 300** (`main/main.js:275`), so a fixed panel that size does not fit the
  smallest supported window. The mock size is now a *maximum*, clamped to the
  viewport in `NodePicker.constants.ts` and consumed by both
  `createnewnodepanel.ts` (PopupLayer measures the element before React renders)
  and the React tree, passed as a prop so the two cannot disagree. Below 760px
  the preview column drops, below 560px the rail drops too, and the grid goes
  3 → 2 → 1 columns. The `height: 555px; //yeah, this is a hack` and the
  `left: 280px; // TODO` are both gone.
- **`⌥⏎` insert & connect — dropped, per the spec's instruction not to ship a
  hint for a shortcut that does nothing.** No call site gives the picker a
  source port: all four (`InteractionController`, `NodeContextMenu` ×2,
  `EditorTopbar`) pass only `model`/`parentModel`/`pos`/`runtimeType`. Wiring it
  would mean plumbing a pending connection through every entry point plus
  port-compatibility matching — a task, not a footnote. **Filed as a follow-up
  (see below).**
- **Port pin colours** follow the canvas wires (`--theme-color-wire-signal` /
  `--theme-color-wire-data`) rather than the mock's category tints, because the
  spec asks for "signal/data pin colours matching the canvas" and the mock's
  choice (`--node-logic` for signal) does not.
- **No-icon cards** (~90% of node types — `nodeNameToIconName` covers 14) get a
  tinted **letter** in the glyph chip. The mock has no case for this; a blank
  chip reads as a loading failure and a generic category glyph reads as a
  wrong icon.
- **`←→` navigate by one card, `↑↓` by one row.** The search field keeps focus
  the whole time the picker is open (that is what makes it type-first), so the
  caret has first claim on `←→`: the cursor only takes them once the caret has
  nowhere left to go inside the query. `↑↓` are unambiguous — a single-line
  input has no use for them — and move by the grid's column count, which is the
  only way the 2nd and 3rd card of a row are reachable at all.
- **Insert closes the picker.** It did not before (clicks land inside the popup,
  so PopupLayer's outside-click never fires). Placing a node is the end of the
  interaction; leaving the panel covering the node just created is not a
  feature.

### Boundary with UIX-012 — respected

No second colour path. Cards, rail dots and preview chips tint from
`--cat`, a CSS custom property set from the UIX-001
`--theme-color-node-category-*` tokens in `styles/_tints.scss`. Because it is a
plain CSS variable, a theme flip re-tints the open picker with no re-render and
no subscription — which is also what satisfies acceptance criterion 7. The
`CanvasTheme`/`useNodeColorScheme` resolution UIX-012 owns is untouched, and
`EditorNode` (still used by the references panel and the property editor) was
left exactly as it is.

### Two defects found by using it, not by looking at it

Both were invisible in a screenshot and obvious within a minute of driving the
picker:

1. **The preview pane reverted on mouse-out.** It rendered `hovered ?? cursored`,
   so taking the mouse off a card — including the trip to the pane itself, to
   scroll it — snapped the preview back to the keyboard cursor, and crossing
   another card on the way switched it again. Fixed by removing the second
   state: **hover moves the keyboard cursor**, after a **130ms dwell** so a card
   crossed in passing cannot claim the pane, and nothing is cleared on
   mouse-out. One highlight, one source of truth, and the pane holds what you
   last pointed at. (`useHoverPreview`; verified live — deliberate hover
   switches, mouse-out holds, a 60ms crossing does not switch.)
2. **"Key ports" were not key.** `Group` declares 111 ports; declaration order
   opens with `cssClassName`/`styleCss` and the runtime's own `index` order
   opens with four margins. The selection is now tiered — ungrouped and
   `General` inputs first, signal outputs first, each tier in declared order —
   with an `8 of 111` readout so the truncation is stated rather than implied.

Also from live use: the docs pane rendered a YouTube **error box** (the player
refuses a `file://` origin) plus three orphaned "Tutorial N" captions. Embeds
are now stripped with their caption and the duplicate leading `<h1>`, so the
pane opens on the description.

### Other user-visible changes

- The **"Noodl AI (Beta)" promo is deleted** — with it the news carousel
  (`useGetSliderNews`, `useGetDefaultDocs`, `NodePickerClearNews`) and its
  call in `EditorPage.tsx`. The pane previews the node under the cursor or
  mouse: name, category chip, documentation, key ports, "Open full docs".
- **Recent nodes** (rail, `localStorage`, max 5) — clicking one inserts it.
- The **comment action** survived the accordion's deletion as a keyboard-
  reachable result row in an "Other" group, matching on `comment` as before.
- **No-results** state routes to Modules / Prefabs / clear, per the mock.

---

## Gates

| Gate | Result |
|---|---|
| `noodl-editor` `tsc --noEmit` | clean |
| `noodl-core-ui` `tsc --noEmit` | clean (only pre-existing `@noodl-store`/`@noodl-versioning` path-alias errors from editor files it pulls in) |
| Hex ratchet | `noodl-editor` 16 = baseline 16, `noodl-core-ui` 0 — unchanged |
| Picker specs | 22 specs, green (`tests/nodepicker/`, rewritten + new) |
| Full editor suite | **1388 specs, 0 failures** |

**Note on the run.** For a while `test:ci` could not even compile: a concurrent
session was mid-edit in `models/AiAssistant/client/*` (an `AiUsage` type gaining
`cacheReadTokens` / `cacheWriteTokens` ahead of its fixtures), which failed
webpack's type-check in `tests/ai/*` before any spec ran. Those errors were
never from this task's files, and the final run — after that edit settled — is
green at 1388/0. One earlier run of the *same* build failed a
`/remaining-comp` / `/shared-comp` component spec that passed on the next two
runs; not a picker spec, and it looks flaky rather than broken. Worth a second
pair of eyes if it recurs.

---

## Traps hit

- **ts-loader keeps compiling deleted files.** After deleting the seven
  accordion components, the running dev server kept emitting
  `TS2305 … has no exported member 'ICursorState'` from files that no longer
  existed on disk, through five rebuild cycles. `tsc` was clean the whole time.
  Restarting the dev server cleared it. If a webpack error names a file you have
  deleted, believe the filesystem.
- **The editor suite is Jasmine, not Jest** (`npm run test:ci`, bundled into
  Electron). No `toHaveLength` — `expect(x.length).toBe(n)`. And a new spec file
  is invisible until it is added to `tests/<dir>/index.ts`, which is re-exported
  from `tests/index.ts` (the spec-barrel trap, again).
- **`.popup-layer-popup` sets its own `border-radius: var(--radius-lg)`** behind
  the panel. The mock's 14px would show the wrapper's corners; the panel matches
  the wrapper at `--radius-lg`.
- **HMR updates the module but not the closure that holds the old component.**
  `CreateNewNodePanel` is an imperative class instantiated inside
  `EditorTopbar`'s click handler, so after a picker edit the *next* open still
  built the previous component tree — the served bundle had the change and the
  running app did not. Reload the page (to `index.html`; the SPA's
  `file:///dashboard/projects` route 404s on a raw reload) rather than trusting
  an HMR "App is up to date".
- **`git rm --cached` stages a deletion into the shared index, and a concurrent
  session will commit it.** The seven deleted accordion components and
  `NodePicker.selectors.ts` were staged that way and were swept into the
  BAK-009 session's `c263b9c` — a commit that has nothing to do with the node
  picker. Functionally harmless (the files are gone either way), but the history
  now attributes them wrongly. In this repo, delete with a plain `rm` and let
  `git add -A <pathspec>` record the deletion at commit time. This is the same
  shared-tree trap PLAT-002 recorded; it is still live.

---

## Follow-ups filed

- **UIX-014 — node iconography coverage.** `nodeNameToIconName` covers 14 of
  ~130 node types; everything else falls back to a letter. Explicitly out of
  scope here per the spec.
- **UIX-015 — insert & connect (`⌥⏎`).** Needs a pending-connection context
  plumbed through the four picker entry points plus port-compatibility matching.
  The footer will advertise it when it exists.

---

## Live QA — all eight criteria, both themes

Driven through CDP against the `qa-target` project. Screenshots in
[`screenshots/uix-013/`](./screenshots/uix-013/).

| # | Criterion | Result |
|---|---|---|
| 1 | Browse: categories, counts, recents; no dark-navy blocks on light | ✅ `browse-light.png` / `browse-dark.png` — 106 nodes, per-category counts, Recent populated |
| 2 | Type a query: everything visible, nothing collapsed, counts agree, non-matches dimmed | ✅ `search-light.png` / `search-dark.png` — 7 results in 1 category, six categories dimmed at 0 |
| 3 | Click a category, then search (the drift bug's regression) | ✅ filtered to `Read & Write Data` (6 sub-groups), then `text` → filter falls back to All, all 7 matches visible, cursor on the top result |
| 4 | Keyboard-only: open → type → arrows → `⏎` places the right node | ✅ `Text Input` placed on canvas and the picker closed (`after-insert-dark.png`); undone afterwards |
| 5 | Hover/cursor a node → the pane updates | ✅ and it now *stays* — see the hover fix above |
| 6 | No-results state with working routing | ✅ `no-results-light.png` / `no-results-dark.png` — Modules / Prefabs / Clear, footer drops the shortcut hints |
| 7 | Flip the theme with the picker **open** | ✅ re-tints in place, no reopen — the tint is a CSS variable, so this holds by construction |
| 8 | Screenshots of all three states in both themes | ✅ 6 + 1 committed |

## Residuals

- **`⌥⏎` insert & connect** is not implemented (UIX-015) — deliberately, and the
  hint is absent rather than dead.
- **Icon coverage**: 14 of ~130 node types have a glyph; the rest fall back to a
  tinted letter (UIX-014).
- The Prefabs / Modules / Import tabs got the new chrome only, as specced —
  their card grids are untouched.
- `Group`'s "key ports" are better but still not what a person would pick; the
  heuristic is only as good as the runtime's port grouping.
