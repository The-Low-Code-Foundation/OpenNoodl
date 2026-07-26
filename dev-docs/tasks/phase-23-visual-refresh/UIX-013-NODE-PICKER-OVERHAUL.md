# UIX-013: Node Picker Overhaul

## Metadata

| Field | Value |
|-------|-------|
| **ID** | UIX-013 |
| **Phase** | Phase 23 — Visual Refresh (Track I) |
| **Tier** | 2 — surfaces (follow-up) |
| **Priority** | 🟠 High (the picker is on the path of every single node placement) |
| **Difficulty** | 🟡 Medium (contained React subtree; the risk is the keyboard-cursor reducer, not the CSS) |
| **Estimated Time** | ~1 week |
| **Prerequisites** | UIX-001 (tokens), UIX-005 (`CanvasTheme`), UIX-008 (light theme) — all landed. **UIX-012** (theme-aware node colour schemes) should land first; if it has not, this task must not re-solve it — see *Boundary with UIX-012*. |
| **Mock** | [`mocks/nodegx-node-picker-mock.html`](./mocks/nodegx-node-picker-mock.html) — three states: browse, search, no-results |
| **Branch** | commit directly to `cline-dev` (no task branches in this repo) |
| **Recommended executor** | 🔵 **Opus 5** — the visual work is straightforward, but the collapse/cursor state model has to be rebuilt without breaking keyboard navigation |

## Objective

Rebuild the node picker as a search-first, keyboard-first surface that matches the NodeGX visual
language, and retire the accordion whose collapse state is both the usability complaint and a
live state-management bug.

## Background

The picker is the most-used modal in the editor and the least-refreshed surface left after
Phase 23. Three complaints, reported from live use on 2026-07-26:

1. **Search filters but leaves you staring at collapsed categories.** The user searches, sees
   which categories contain results, and then has to open each one by hand.
2. **Node items are dark-navy blocks** that ignore the light theme (shared root cause with the
   connection popup — owned by UIX-012, not this task).
3. **The whole thing feels unfinished** next to the refreshed launcher and editor chrome — a
   fixed 800×600 panel whose entire right-hand pane is a "Noodl AI (Beta)" product promo, from
   a product that no longer exists under that name.

### The auto-expand bug is real, and it is not a missing feature

`openAllCategories()` **is** already called on search
([`NodePicker.hooks.ts:181-192`](../../../packages/noodl-editor/src/editor/src/views/NodePicker/NodePicker.hooks.ts#L181-L192)),
and `CursorActionType.HandleSearchUpdate` also calls `setAllCategoriesCollapsedState(stateCopy, false)`.
The reason it doesn't reliably work:

[`NodePickerCategory.tsx`](../../../packages/noodl-editor/src/editor/src/views/NodePicker/components/NodePickerCategory/NodePickerCategory.tsx)
takes `isCollapsed` as a prop, mirrors it into a local `useState` (line 39) synced by a
`useEffect` (lines 46-48) — but the header's `onClick` (line 70) mutates **only the local copy**
and never dispatches to the reducer. So a mouse click desyncs the component from
`cursorState.allCategories`, and any subsequent programmatic open/close computes from reducer
state the component has already diverged from. Two sources of truth for one boolean.

**Confirm this reproduction before building anything** — if the live failure turns out to have a
different cause, fix the actual cause and record the correction in NOTES rather than implementing
around this description.

## Current State

All of `views/NodePicker/**` is modern React with SCSS CSS Modules and is already ~100% tokenised
(zero hex/rgba literals in the subtree). The problems are structural, not stylistic debt:

| File | Lines | Issue |
|---|---|---|
| `NodePicker.tsx` | 81 | Tabs use core-ui `Tabs`/`TabsVariant.Text` — plain text, not the segmented control used elsewhere |
| `NodePicker.hooks.ts` | 527 | Search + cursor + docs fetching in one hook file |
| `NodePicker.reducer.ts` | 272 | `allCategories[].isCollapsed` — the collapse source of truth the category component ignores |
| `NodePickerCategory.tsx` | 102 | Local/reducer state drift (above) |
| `NodePicker.module.scss` | — | `height: 555px; //yeah, this is a hack` |
| `NodeLibrary.module.scss:31` | — | `left: 280px; // TODO: make this dynamic` |
| `createnewnodepanel.ts` | 99 | Legacy `View` wrapper; hardcodes `800px × 600px` in JS, with a comment that it must be kept in sync with the SCSS by hand |

Category taxonomy is **not** defined in the editor — it comes from the runtime blob
[`nodelibraryexport.js:404+`](../../../packages/noodl-runtime/src/nodelibraryexport.js#L404)
(`coreNodes[]` with `subCategories[].items[]`), turned into the picker's tree by
[`createnodeindex.ts`](../../../packages/noodl-editor/src/editor/src/utils/createnodeindex.ts).
**Do not restructure that taxonomy** — other consumers depend on its shape.

Node item icons come from `nodeNameToIconName()` in
[`EditorNode.tsx:17-46`](../../../packages/noodl-core-ui/src/components/common/EditorNode/EditorNode.tsx#L17-L46),
a hardcoded 14-case switch. Everything not in that list renders with no icon at all.

## Desired State

Per the mock. The load-bearing decisions, in priority order:

### 1. Search-first, and the accordion is gone

The category accordion is replaced by a **persistent left rail** of categories with live counts.
Nothing needs expanding to see what exists, which removes the reported bug by construction rather
than by fixing the sync.

- **Browse state:** results pane shows every category's nodes under sticky sub-headings; the rail
  filters, it does not collapse.
- **Search state:** results are **flat and ranked** — matches grouped under their category heading,
  exact name matches first (the existing `getMatchIndex` scoring in `NodePicker.hooks.ts` already
  produces the ordering; keep it). The rail turns into a result-count filter with non-matching
  categories **dimmed, not hidden**, so "0 under Navigation" is information rather than absence.
- **Match reasons:** when a node matches on something other than its display name (a `searchTags`
  entry, a port name), the card says so (`tag · text`). A result that appears for no visible
  reason reads as a bug.

### 2. Node cards that survive a theme flip

Category-tinted glyph on a neutral surface (`--bg-2` card, `color-mix(in srgb, var(--cat) 14%, transparent)`
glyph chip), replacing the saturated dark block. This is what makes them legible on light.

⚠️ **Boundary with UIX-012.** UIX-012 owns making `colorSchemeForNodeType` theme-aware at the
source. This task consumes whatever UIX-012 produces and **must not introduce a second colour
path**. If UIX-012 has not landed when this starts, coordinate — do not fork the palette. The
one thing this task owns is the *card treatment* (tinted glyph vs. filled block), not the
colour resolution behind it.

### 3. The right pane previews the node, not the product

The "Noodl AI (Beta)" promo is deleted. The pane always shows the node under the keyboard cursor
or mouse: name, category chip, description, key ports (with signal/data pin colours matching the
canvas), and "Open full docs". Docs fetching already exists in `NodePicker.hooks.ts`.

### 4. Keyboard-first, and it says so

`↑↓` navigate · `⏎` insert · `⌥⏎` insert & connect · `esc` close, in a persistent footer hint bar.
The keyboard cursor must be **visibly** on a card at all times (the accent ring in the mock), and
on search it starts on the top-ranked result.

- `⌥⏎` ("insert & connect") is in the mock as an **aspiration**. If it is not already wired,
  either implement it or drop the hint — do not ship a hint for a shortcut that does nothing.
  Record which you chose.

### 5. Structural cleanups

- One source of truth for collapse/filter state — the reducer. No mirrored local `useState`.
- Panel sizing derived once, not hardcoded in both `createnewnodepanel.ts` and the SCSS.
  Retire the `height: 555px` hack and the `left: 280px` TODO.
- Tabs become the segmented control used by the rest of the refreshed chrome.
- The mock is 1000×660 vs. today's 800×600. Confirm that fits the smallest supported editor
  window before committing to it; if not, keep the panel responsive rather than growing it blindly.

### Explicitly out of scope

- The Prefabs / Modules / Import-from-project tabs get the new **chrome** (tabs, search field,
  footer) but their card grids are not redesigned here.
- The category taxonomy in `nodelibraryexport.js`.
- `nodeNameToIconName`'s coverage gap — most nodes have no icon. Worth fixing, but it is an
  iconography task; **file it as a follow-up** rather than absorbing it. Until then, the card must
  degrade gracefully with no icon (the mock does not show this case — design it).

## Acceptance

Live-verified in a running editor, **both themes**, via the `run-editor` skill:

1. Open the picker with no query — categories, counts and recent nodes render; no dark-navy blocks
   on light.
2. Type a query — every match is visible immediately with **nothing collapsed**; counts in the rail
   match the results; non-matching categories dimmed.
3. **Click a category header, then search again** — expansion/filtering still behaves (the
   drift bug's regression test).
4. Keyboard-only: open → type → `↑↓` → `⏎` places the correct node on the canvas. The cursor is
   visible at every step.
5. Hover/cursor a node — the docs pane updates to that node.
6. A query with no matches shows the no-results state with working routing to the other tabs.
7. Flip the theme with the picker **open** — it re-themes without a reopen.
8. Screenshots of all three states in both themes, committed under `screenshots/uix-013/`.

Gates: editor `tsc` clean; hex ratchet unchanged for `noodl-editor` and `noodl-core-ui`;
existing NodePicker tests green (and extended to cover collapse/filter state, which is where the
regression risk lives).

## Notes for the executor

- Commit directly to `cline-dev` with a **pathspec limited to your files** — other sessions work
  in this repo concurrently; never `git add -A`.
- Live verification must run from the **primary checkout** — `lerna exec` resolves to the main
  checkout, not a worktree (see [parallel worktree traps](../../../dev-docs/tasks/phase-23-visual-refresh/PROGRESS.md)).
- The editor CDP session needs `--target=NodeGX`, and the default target changes after a project
  opens — re-select it.
- **The mock is a proposal, not a contract.** Spec wins over mock; mock wins over silence. If a
  layout decision fights the real data (128 nodes in one category, a 40-character node name, a
  project with 200 components), fix it in the implementation and say so in NOTES.
