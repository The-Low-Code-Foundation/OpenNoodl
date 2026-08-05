# FH-009 — The selected list item is unreadable (Docs panel + Version Control rows)

Covers reported item **8** and the row half of item **9**. One shared-component fix closes both.

## What was reported

> The 'docs' panel in light mode still has the selected doc as dark background and dark font.
> …clicking on one of the 'changes components' in the list [version control] in light mode had a
> black background and black font again.

## The mechanism — POL-004's class of bug, one more instance

Both panels pass `ListItemVariant.Active` for the selected row, and the shared component paints it
with the wrong kind of token:

[`ListItem.module.scss:50-60`](../../../packages/noodl-core-ui/src/components/layout/ListItem/ListItem.module.scss#L50-L60)
— `.is-variant-active { background-color: var(--theme-color-secondary) !important; }`.
`--theme-color-secondary` is the neutral **action** colour — inverted relative to the surface by
construction (`#18212b` near-black in light, `#eef2f6` near-white in dark). Used as a row surface
it's broken in *both* themes: light = near-black bg with the default `#4a5663` label (~**1.9:1**);
dark = near-white bg with the light-grey label. The icon got `--theme-color-on-secondary`
(`:54`) — a half-correction — but the label kept `TextType.Default` (`ListItem.tsx:104-113`), and
no `on-secondary` text type even exists to reach for.

This is POL-004's rule verbatim: `secondary` is an action colour, not a surface. Exactly three
`ListItemVariant.Active` call sites exist: `DocsPanel.tsx:277`, `DiffList.tsx:141` and `:165` —
one fix covers all three.

## What to build

1. `ListItem.module.scss:50-60`: the active row becomes a real surface pair — recommend
   `--theme-color-primary-bg` + `--theme-color-fg-highlight` (matches how other selected rows in
   the editor read), or `bg-3`/`bg-4` for a quieter treatment. Drop the `!important`s if the
   `.is-active` interplay allows (`.is-active` at `:18-20` currently loses to them).
2. Contrast is measured, not eyeballed (phase-39 rule): computed ratios for label-on-active-bg in
   both themes go in the task notes; ≥4.5:1.
3. Nothing in `DocsPanel/` or `VersionControlPanel/` changes — which also keeps this clear of the
   concurrent session's uncommitted edits to `DiffList.tsx`.

## Criteria

1. Light mode: selected doc row and selected changed-component row are legible; ratios recorded.
2. Dark mode: same rows re-checked (they're broken there too, just less loudly).
3. All three call sites eyeballed in the running editor, both themes.

## Traps

- `noodl-core-ui` shared chrome — don't parallel with other core-ui tasks (FH-013/FH-014 also
  touch core-ui; run them in sequence, not worktrees).
- `DiffList.tsx` has uncommitted concurrent-session changes — this task must not touch that file.
