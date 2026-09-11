# DSG-008 — the icons nobody could see

**Status:** ✅ **FIXED AND MEASURED 2026-08-13.** 12 panels × 2 themes, every visible glyph now
clears WCAG 1.4.11's 3:1. Instrument kept: [`scripts/devtools/icon-contrast.js`](../../../scripts/devtools/icon-contrast.js).

> Origin: Richard, 2026-08-13 — *"the corner anchor icon for dragging editor width is dark on a
> dark background in dark mode… and in fact there are still a tonne of icons in dark mode that are
> dark on dark backgrounds, this needs an audit."*
>
> He was right, and the count was **nine glyphs across six components**, one of them at **1.16:1**
> — black on `#12161b`.

## The mechanism, which is one mechanism nine times

`Icon.module.scss` already states the rule in its own header: a glyph paints with `currentColor`,
and the **host** sets `color`. Every defect here is a host that did not, and each one *looked*
correct in its own file:

| How it looked | What it did |
|---|---|
| `fill: var(--theme-color-fg-muted)` on the host | **Nothing.** The shipped glyphs declare their own `fill`/`stroke` presentation attribute, and an element's own attribute beats an inherited value. Half the set is *stroked*, where `fill` is the wrong property outright. |
| `path { fill: var(--theme-color-fg-default) }` | **Solid glyphs only.** A 1.5px `stroke="currentColor"` line glyph — the caret, the chevrons, most of the set — stays uncoloured. |
| `color: inherit` on a `<button>` | **As good as the thing above it, which set nothing.** The inherited value was the document initial: `rgb(0, 0, 0)`. |
| nothing at all | Same. |

⚠️ **None of this is visible by reading a stylesheet**, because the background is painted by an
ancestor several levels up and no single file contains both halves of the pair. That is why the
deliverable is an instrument and not a review.

## The nine, as measured

Dark theme, 1368×781, project open.

| Ratio | Component | Cause |
|---|---|---|
| **1.16** | `SearchInput` — the magnifier | `opacity: 0.6` and no `color`; computed black |
| **1.24** ×2 | `ThreadSwitcher` — thread glyph + caret | `color: inherit` with nothing above it. Only the icons showed it: the thread title is a `Text` carrying its own token |
| **1.24** ×4 | `ListItem` — every row's `.Prefix` | Coloured only by `is-variant-active`'s `path { fill }`; an *unselected* row's icon inherited black, and a *stroked* one stayed black even when selected |
| **1.24** | `Select` — the caret | `path { fill }` against a stroked glyph |
| **1.46** ×4 | `IconButton:disabled` (transparent + opaque-on-hover variants) | `color: var(--theme-color-bg-4)` — a **background** token used as a foreground |
| **ambient** | `ToolbarGrip` — the code editor's resize corner | `fill:` set, `color:` never. This is the one Richard named |

**The `IconButton` four are the ones that get seen most**: undo/redo in the topbar and
back/forward in the component trail are *disabled the moment you open a project*, so four of the
editor's most prominent glyphs were invisible on every fresh session. Disabled controls are exempt
from WCAG 1.4.11, which is why nothing caught it — but "exempt from a contrast requirement" is not
"may be the same colour as the panel it sits on".

## The repairs

Each host now sets `color`, which drives both eras of the icon set at once. Where a `path { fill }`
existed it was **replaced** rather than joined — two writers of one glyph's colour is how they
drift apart again.

Values were chosen against measurement, not by name:

- **`ToolbarGrip` → `fg-default-shy`** (5.57:1 on `bg-2`), not `fg-muted` (3.66:1). A 1px diagonal
  is the thinnest mark in the product and it is a control affordance.
- **`SearchInput` → `fg-default`** (3.73:1 *after* its own `opacity: 0.6` composites; 7.0:1 on
  focus). ⚠️ The opacity is part of the contrast sum, so this token cannot be quietly stepped
  down: `fg-muted` at 0.6 composites to **2.21:1**.
- **`IconButton:disabled` → `fg-disabled`** (= `fg-muted`, 3.93:1), deliberately *not* the base
  `:disabled` rule's `fg-default-shy`, which at #8b95a1 against an idle #a6b0bb is
  indistinguishable at 16px. A disabled state has to be legible **and** obviously disabled.

### And one backstop

`BasePanel` now sets `color: var(--theme-color-fg-default)` beside its `background-color`.

**A surface that declares a background and no foreground is stating half a pair**, and four of the
nine were leaf components inside a panel that had done exactly that. The backstop decides what
"said nothing at all" means; it does **not** retire the rule that a host colours its own glyphs —
hover, active, disabled and accent states still have to be said where they belong.

## The instrument

`node scripts/devtools/icon-contrast.js [--target=viewer] [--json]`

Reads every visible `<svg>`, resolves what its marks actually paint with (`stroke` first, then
`fill` — the set has two eras), composites the glyph's own opacity, walks up for the first opaque
background through any translucent layers, and divides. Names the **host**, skipping
`Icon-module__*` and the other generic wrappers: the first named ancestor of every glyph in this
app is `Icon` itself, which is the one answer that cannot help.

Everything comes from `getComputedStyle`, never from the stylesheets — **a rule that is present
and losing looks identical to a rule that is absent**, and this audit exists precisely because
several of them were present and losing.

## After

| | dark | light |
|---|---|---|
| panels swept | 12 | 5 |
| glyphs measured per panel | 42–56 | 46–56 |
| **below 3:1** | **0** | **0** |

## Register

| # | Finding | State |
|---|---|---|
| D41 | 🔴 **`fill` on an ancestor cannot colour a glyph that declares its own paint.** Inheritance loses to an element's own presentation attribute, and half the set is stroked anyway. Every `path { fill }` and host-level `fill` in the icon layer is either dead or partial | ✅ six hosts converted to `color` |
| D42 | 🔴 **`color: inherit` on a chrome button is only as good as the surface above it**, and several surfaces set a background and no foreground. The inherited value is then the document initial — black | ✅ fixed at the leaf and backstopped at `BasePanel` |
| D43 | 🔴 **A background token used as a foreground.** `IconButton:disabled` painted its glyph `--theme-color-bg-4`. It reads as a deliberate choice and measures 1.46:1 | ✅ `fg-disabled` |
| D44 | **Disabled is exempt from WCAG and that is why it was worst.** The four most-seen disabled glyphs in the editor were invisible on every fresh session, and no accessibility rule was being violated | ⚠️ standing — exemption is not permission |
| D45 | **This class cannot be found by reading.** Host and background live in different files; a losing rule looks like a correct one. The audit has to run against a rendered editor | ✅ `scripts/devtools/icon-contrast.js`, kept |
| D46 | ⚠️ **The sweep covers what is *rendered*.** 12 rail panels in dark, 5 in light, with one project open. Dialogs, menus, the node picker, the launcher's deeper routes and every hover/active state are **not** covered. Re-run the tool after any icon-host change rather than trusting this table | ⚠️ standing |
