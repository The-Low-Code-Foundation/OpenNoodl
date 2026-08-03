# POL-003 — The left rail: legible glyphs, and the right ones

Covers reported items **3** (dark-mode contrast; the hide-panel icon's size and centring), **4**
(three glyph swaps) and **6** (narrow/widen → fold/unfold).

## What was reported

> The icons and font in dark mode sometimes are black on black. Also, the 'hide panel' icon on the
> top of the left menu needs to have its size increased and vertically centred. Actually looking
> around there are nearly all the left menu icons that are black in dark mode on a grey background.

> Change the 'provenance' icon from a magnifying glass to `spline-pointer`, build to `hammer`,
> explain to `message-circle-question-mark`.

> Change the 'narrow panel' icon to `fold-horizontal` and expand panel to `unfold-horizontal`.

## The mechanism

### A. Contrast — measured, not eyeballed

Not black on black. The rail sets
`--icon-button-idle-fg: var(--theme-color-fg-muted)` at
[`SideNavigation.module.scss:23`](../../../packages/noodl-core-ui/src/components/app/SideNavigation/SideNavigation.module.scss#L23),
which `IconButton`'s transparent variant reads at
[`IconButton.module.scss:68`](../../../packages/noodl-core-ui/src/components/inputs/IconButton/IconButton.module.scss#L68).

In dark: `--theme-color-fg-muted` = `--base-color-neutral-600` = **`#6b7682`**, on
`--theme-color-bg-1` = `--base-color-neutral-100` = **`#12161b`**.

That is **≈3.8:1** — under the 4.5:1 floor, and delivered through a 1.5px stroke, which is why it
reads worse than the number suggests. `--theme-color-fg-default` (`#a6b0bb`) on the same background
is ≈7.5:1.

The glyphs themselves are innocent: **all 164 SVGs under `assets/icons/icon-component` use
`currentColor` and none carries a hardcoded hex** — checked, not assumed. This is a token choice,
one line, in one file.

The PAR-003 comment claims fg-3/muted comes "from the mock". The mock is not the authority on a
ratio it did not measure; raise it and record the number.

### B. Size — `IconSize` is inert, confirmed at the CSS level

`IconButton` *does* pass `size` down (`IconButton.tsx:93` →
`<Icon icon={icon} size={size} …>`), and `Icon` *does* apply it as `css[size]`
(`Icon.tsx:225`). But
[`Icon.module.scss`](../../../packages/noodl-core-ui/src/components/common/Icon/Icon.module.scss)
**declares no `is-size-*` rule at all** — `is-size-large`, `is-size-small` and `is-size-tiny` are
class names with no declarations.

So `size={IconSize.Large}` is a no-op at every call site in the codebase (this confirms UIX-010 at
the mechanism level). `Icon`'s box comes entirely from its parent: `.Root { display: block }` plus
`svg { width: 100%; height: 100% }`.

**You cannot make the hide-panel glyph bigger by passing a size prop.** That is the trap this task
exists to record.

### C. The glyphs

Five swaps, all in existing registrations:

| Where | Now | Wanted |
|---|---|---|
| `router.setup.ts:316` — Provenance | `IconName.Search` (magnifier) | `spline-pointer` |
| `router.setup.ts:184` — Build | `IconName.BuildAi` | `hammer` |
| `router.setup.ts:169` — Explain | `IconName.Explain` | `message-circle-question-mark` |
| `SidePanel.tsx:204` — narrow (wide mode) | `IconName.ArrowsInLineHorizontal` | `fold-horizontal` |
| `SidePanel.tsx:204` — widen | `IconName.ViewportHorizontalArrow` | `unfold-horizontal` |

All four names are Lucide glyphs. Note this puts Lucide in the editor chrome as well as in the
project icon set POL-006 ships — worth landing the two together so we pick one Lucide source.

## What to build

**Slice 1 — contrast.** Raise the rail idle glyph to `--theme-color-fg-default` and record the
computed ratio for **both** themes in the task notes. Then sweep the rest of the chrome the report
gestures at ("nearly all the left menu icons"): the panel header's mode buttons, `PanelHeader`
titles, and anything else on `bg-1` using `fg-muted` as a *primary* colour rather than for genuinely
secondary text. `fg-muted` is legitimate for large or secondary text; it is not legitimate for an
interactive glyph.

**Slice 2 — make `IconSize` real.** Add the four `is-size-*` rules to `Icon.module.scss` with
explicit `width`/`height`. This is a **130-call-site change in effect** — every existing
`size={IconSize.Large}` starts doing something the moment the rules exist.

Do not ship this blind. Land the rules, then screenshot-sweep the editor in both themes against the
UIX-009 screenshot corpus and fix what moved. If the blast radius turns out to be too wide for this
phase, the fallback is to size the hide-panel button from its own container in
`SidePanel`/`PanelHeader` CSS and file the `IconSize` rules as their own task — but **say which you
did**, because "increased the icon size" via a prop that does nothing is precisely how UIX-010 got
recorded in the first place.

**Slice 3 — hide-panel button.** Larger glyph plus true vertical centring against the header's
other controls. The button is the last child of `modeSlot`
([`SidePanel.tsx:248-255`](../../../packages/noodl-editor/src/editor/src/views/SidePanel/SidePanel.tsx#L248-L255));
`IconButton` is `display: inline-flex; align-items: center` with `padding: 4px`, so check whether
the misalignment is the button or the `Tooltip` wrapper div between it and the row.

**Slice 4 — the five glyphs.** Add the five Lucide SVGs to
`packages/noodl-core-ui/src/assets/icons/icon-component/` as `spline_pointer.svg`, `hammer.svg`,
`message_circle_question.svg`, `fold_horizontal.svg`, `unfold_horizontal.svg`; add the matching
`IconName` entries; update the five call sites.

Every new SVG must use `currentColor` for fill **and** stroke, and carry no `width`/`height`
attributes (the component sizes it). Match the existing 1.5px stroke weight — a heavier Lucide
default beside the current set is immediately visible.

## Criteria

1. Rail idle glyphs measure ≥4.5:1 against `bg-1` in **both** themes, with the numbers written down.
2. The hide-panel glyph is visibly larger and optically centred with the other header controls.
3. The five icons render the five Lucide glyphs, in both themes, at the same stroke weight as their
   neighbours.
4. If slice 2 landed: a both-theme screenshot sweep shows no icon that got unintentionally larger.
5. Verified in the running editor with screenshots, both themes — not from CSS alone.

## Traps

- **`size={IconSize.Large}` does nothing today.** Any fix that consists of passing a size prop has
  changed no pixels. Check the computed box in devtools.
- `.SideNavigationButton:hover path { fill: … }` at
  `SideNavigation.module.scss:191-195` is a legacy `fill`-based rule sitting beside the
  `color`/`currentColor` mechanism UIX-007 moved everything to. It happens to agree today. If a
  glyph's hover colour goes wrong after this task, that rule is why.
- HMR will not re-apply a changed effect to an already-mounted panel, and the sidebar keeps panels
  hidden-but-mounted. Restart the editor before believing a rail change did nothing.
