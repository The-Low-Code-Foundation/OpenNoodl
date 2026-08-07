# PNL-006: Components Panel Restyle

## Metadata

| Field | Value |
|-------|-------|
| **ID** | PNL-006 |
| **Phase** | Phase 25 — Side Panel (Track J) |
| **Tier** | 3 — surfaces |
| **Priority** | 🟠 High (the most-used panel in the editor) |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 3–4 days |
| **Prerequisites** | PNL-005 (header). Consumes PNL-004's `PanelRow` if landed, but doesn't need it. |
| **Mock** | [`mocks/nodegx-side-panel-mock.html`](./mocks/nodegx-side-panel-mock.html) — the Components before/after pair, and the live tree in the prototype |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟠 **Opus 4.8** |

## Objective

Make the component tree scannable and legible in both themes — carrying component *kind* in the glyph,
depth in an indent guide, and selection in a treatment that doesn't recolour the label.

## Background

Reported as *"the component panel is still a bit messy and hard to see in light mode."* The light-mode
part has a specific cause: `.TreeItem.Selected` sets both
`background-color: var(--theme-color-primary-transparent)` **and**
`color: var(--theme-color-primary)`
([`ComponentsPanel.module.scss:91-94`](../../../packages/noodl-editor/src/editor/src/views/panels/ComponentsPanelNew/ComponentsPanel.module.scss#L91-L94)).
Azure text on a 12%-azure tint is low contrast on a light ground — the selected row is the *least*
readable row in the tree. Rows are also 11px, which is the smallest type anywhere in the refreshed UI.

The messiness is structural: every node in the tree gets the same folder-or-page glyph regardless of
what it is, and each nesting level costs 18px of indent with nothing to follow, so at four levels deep
(`/Pop-ups/Privacy/Terms of Use Popup` in the reported project) you are counting pixels to work out
parentage.

## Current State

`ComponentsPanelNew/` is modern React (migrated from jQuery in TASK-008) with a CSS module, ~264 lines
in `ComponentsPanelReact.tsx` plus `components/ComponentTree`, `ComponentItem`, `FolderItem`,
`RenameInput`, `SheetSelector`, and five hooks. The structure is fine; this is a styling and
information-design task, not a rewrite.

| What | Where | Issue |
|---|---|---|
| Header | `ComponentsPanel.module.scss:15-30` | own `bg-3` 36px bar — **PNL-005 removes this** |
| Rows | `:77-102` | 11px, 6px/10px padding, one hover, selection recolours label |
| Caret | `:104-118` | text `▶`/`▼` glyphs at 8px, not icons |
| Glyph | `:127-134` | one `.Icon` rule, `fg-default`, no kind distinction |
| Warning | `:143-154` | a filled amber circle with a `!`, 16px |
| Indent | inline `padding-left` per depth | no guides |
| Filtering | — | none; you switch to the Search panel |

## Desired State

Per the mock:

- **26px rows, 12px labels.** Folder rows at weight 600 in `fg-2`; component rows in `fg-2`, home
  component at weight 650 in `fg-1`.
- **Selection**: `accent-soft` fill + a **2px accent bar on the left edge** + label at `fg-1`. The
  label colour does not change — that is the light-mode fix.
- **Caret**: the real chevron icon, rotating on expand, `fg-3`.
- **Kind-carrying glyphs** in the canvas category colours, so the tree scans like the graph does:
  page, popup, visual, logic, component. The colours must come from the **same source the canvas
  painter uses** (UIX-005's `CanvasTheme` / UIX-012's theme-aware node colours) — not a second palette
  in this panel's stylesheet. If you cannot resolve a component's kind, fall back to the neutral
  component glyph; do not guess.
- **Indent guides**: a 1px `border-1` vertical rule per ancestor level, so depth is readable at four
  levels.
- **Home component**: a filled home glyph in the brand coral (the one sanctioned non-danger use of it,
  per the phase-23 de-red rule).
- **Warnings**: a 6px amber dot at the row's right edge, with a tooltip count, replacing the 16px
  badge. Clicking it routes to Problems filtered to that component — check `ProblemsPanel` can accept
  that; if it can't, make the dot a tooltip only and **file the routing as a follow-up** rather than
  shipping a control that does nothing.
- **Filter field** pinned under the header, filtering the tree in place. Matching rows stay, ancestors
  of matches stay (dimmed), non-matching branches collapse. An empty result says so.

### Decisions the mock doesn't settle

- **What "kind" means.** The tree's data is components and folders; "popup" vs "page" vs "visual" is
  not a first-class property. Work out what is actually derivable (the component's root node type, its
  sheet, a `ComponentTemplates` marker) and use that. If only two or three kinds are reliably
  derivable, ship those and say so — three honest glyphs beat five guessed ones.
- **Filter vs. Search.** This filter is name-only and in-place. The Search panel searches parameter
  values and CSS. Do not duplicate Search here, and make sure the filter's emptiness doesn't look like
  "your project is empty".

## Scope

### In scope
- `ComponentsPanelNew/ComponentsPanel.module.scss` and the row components.
- The filter field and its hook.
- Warning dots, home treatment, indent guides, kind glyphs.

### Out of scope
- The header (PNL-005), the sheet selector's *behaviour* (only its placement changes).
- Drag-and-drop behaviour, context menus, rename (PNL-007 owns rename affordances elsewhere; the tree's
  inline `RenameInput` already works and stays).
- Component *creation* flows and templates.
- Virtualising the tree. Worth knowing whether a 200-component project scrolls acceptably — **measure it
  and record the number**; if it doesn't, file it rather than absorbing it.

## Acceptance

Live-verified via the `run-editor` skill, **both themes**, on a project with at least four levels of
nesting and a component carrying warnings (the reported "Shine" project qualifies):

1. The selected row is legible on light — label at full contrast, not accent-on-accent. Check with a
   contrast reading, not by eye: AA (4.5:1) against the actual selected background.
2. Four-level nesting is readable; indent guides connect children to parents.
3. Component kinds are visually distinct, and the colours match the same components' cards on the canvas.
4. The home component is identifiable without reading the label.
5. A component with warnings shows a dot; the tooltip gives the count; the click routes correctly (or
   the dot is inert and that is documented).
6. Type in the filter: matches appear, ancestors are visible, no-match says so, clearing restores the
   previous expansion state.
7. At 240px panel width, long component names ellipsise and the warning dot stays visible.
8. Screenshots before/after, both themes, under `screenshots/pnl-006/`.

Gates: editor `tsc` clean; `npm run test:ci` for `noodl-editor` green; hex ratchet unchanged.

## Notes for the executor

- **Do not introduce a second node-colour source.** UIX-005 and UIX-012 own that palette; consume it.
  A tree whose colours drift from the canvas is worse than a monochrome tree.
- The reported project is the test fixture. If it isn't available, build a project with four levels and
  a Markdown node (which generates the "unknown node type" warnings in the screenshots).
- Rows are the hot path when a project has hundreds of components — prefer CSS over per-row JS for the
  guides and states.
- Commit with a pathspec limited to your files.
