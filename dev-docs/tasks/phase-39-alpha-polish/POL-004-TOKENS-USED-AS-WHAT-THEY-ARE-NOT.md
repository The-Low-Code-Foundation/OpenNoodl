# POL-004 — Tokens used as things they are not

Covers reported item **9b** (the code-diff modal's white background) and item **12a** (the
Provenance panel's black-on-dark values). One class, two symptoms.

## What was reported

> The code editor that comes up to show code changes has a white background on its modal, make it
> dark mode / light mode compatible please.

> The 'provenance' tab data values are all black font on a dark background in dark mode.

## The mechanism — two variants, both confirmed

### A. A colour that exists, used for the wrong role

[`PlanDocReviewDialog.tsx:42`](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/PlanDocReviewDialog.tsx#L42)
opens with `background={DialogBackground.Secondary}`. `BaseDialog` maps that to
`--theme-color-secondary`
([`BaseDialog.tsx:261`](../../../packages/noodl-core-ui/src/components/layout/BaseDialog/BaseDialog.tsx#L261)):

| Theme | `--theme-color-secondary` |
|---|---|
| dark | `#eef2f6` — near-white |
| light | `#18212b` — near-black |

`secondary` is the **neutral action colour** — the fill of a neutral button, the counterpart of
`primary`. It is not a surface, and it is inverted relative to one by construction. Used as a dialog
background it produces a white sheet in dark mode and a black sheet in light mode. It is theme-aware
and wrong in both.

`ProvenancePanel.module.scss:126` makes the same mistake for text:
`.Value { color: var(--theme-color-secondary, …) }`.

### B. A token that does not exist at all

`ProvenancePanel.module.scss` paints with `--theme-color-fg-subtle`, `--theme-color-notice-bg`,
`--theme-color-notice-bg-hover` and `--font-family-mono`. **None of these are defined anywhere in
the repo.** Every one silently falls through to its hardcoded fallback (`#7c7c7c`, `monospace`, …),
which is the same grey in both themes.

Swept across `packages/noodl-editor/src` and `packages/noodl-core-ui/src`, six undefined names are
in use:

| Token | Files using it |
|---|---|
| `--font-size-default` | 9 |
| `--font-family-mono` | 7 |
| `--font-mono` | 4 |
| `--theme-color-notice-bg` | 4 |
| `--theme-color-fg-subtle` | 3 |
| `--theme-color-notice-bg-hover` | 3 |

And `.DetailValue` (`ProvenancePanel.module.scss:205`) declares **no colour at all** — it inherits
from whatever ancestor last set one. That is the black-on-dark Richard photographed: the keys beside
it get `#7c7c7c` from a fallback, the values get an inherited legacy colour.

## Why this matters beyond two panels

`var(--theme-color-fg-subtle, #7c7c7c)` *reads* as theming. It passes review, it renders, and CSS
has no undefined-custom-property error — so nothing anywhere fails. It is the most reviewable way to
ship a hardcoded colour.

That is the design position in the [README](README.md): a `var()` in editor chrome must name a token
that exists, and the fallback argument is for genuinely optional tokens only.

## What to build

**Slice 1 — the dialog.** Give `PlanDocReviewDialog` a real surface (`DialogBackground.Bg2` or
`Bg1` — pick against the panel it opens over, in both themes). Then check every other
`DialogBackground.Secondary` call site: if any of them also mean "a surface", they are the same
defect. If none legitimately mean "the neutral action colour", **delete the enum member** rather
than leave a loaded gun in the API.

**Slice 2 — the Provenance panel.** `.Value` → a foreground token. `.DetailValue` → an explicit
foreground token, not inheritance. Every `--theme-color-fg-subtle` → `--theme-color-fg-muted`, which
exists and is what it meant. `--font-family-mono` → whatever the real mono token is (find it; if
there genuinely is none, add one to `custom-properties/` rather than keep the fallback).

`--theme-color-notice-bg` / `-hover` need a decision: either define them next to the other notice
tokens in `colors.css`, or replace the uses with a `color-mix` over `--theme-color-notice`. Define
them — four files want them and the concept is real.

**Slice 3 — the check that stops it recurring.**

A script that greps `packages/noodl-editor/src` and `packages/noodl-core-ui/src` for
`var(--…)`, resolves each name against the definitions in
`packages/noodl-core-ui/src/styles/custom-properties/`, and fails on any name that is never defined.
Wire it into the same gate the other `*:check` scripts run in.

Two notes on scoping it:
- **Allow an explicit opt-out list** for tokens that are deliberately host-supplied — e.g.
  `--icon-button-idle-fg`, which `SideNavigation` sets on context and `IconButton` reads with a
  fallback. That pattern is correct and the check must not punish it. The list must be short and
  each entry commented.
- **Exclude `index.bundle.js`** and anything else that is a build artifact.

Fix every existing violation the check finds — the six above are what a first pass found, not
necessarily all of them.

## Criteria

1. The doc-review diff modal is readable in both themes, with a surface-toned background.
2. Provenance rows, values and detail rows are readable in both themes — no inherited colour.
3. The six undefined tokens are either defined or replaced; zero remain in use.
4. `catalog`-style check script exists, fails on an undefined token, and is in the gate.
5. Screenshots of both surfaces in both themes.

## Traps

- Adding the check *after* fixing only the six known names will green a gate that was never run
  broad. Run the check first, read its full output, then decide the fix list.
- `--theme-color-error` **is** defined (an alias of `danger`) — do not lump it in with the six.
- The Provenance panel is one of the surfaces POL-010 also touches. Land POL-004 first: reading the
  walk's output is a prerequisite for diagnosing the walk.
