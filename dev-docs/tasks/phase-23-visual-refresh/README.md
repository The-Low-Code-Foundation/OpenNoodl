# Phase 23: Visual Refresh (Revival Track I)

**Phase:** 23
**Track:** I — the NodeGX look: design tokens, control kit, canvas palette, launcher, light theme
**Source:** Design critique + mockups session 2026-07-26 (mocks in [./mocks/](./mocks/)); styling-architecture audit summarized in [UIX-001](./UIX-001-DESIGN-TOKENS-FOUNDATION.md)
**Status:** ✅ Complete — all 9 UIX tasks (2026-07-26). See [PROGRESS.md](./PROGRESS.md).
**Visual-QA corpus & before/after gallery:** [corpus/](./corpus/) — `corpus/gallery.html` (open in a browser), one-command re-run via `corpus/run.sh`, recipe in `corpus/README.md`.
**Starts:** Anytime. No dependency on backend tracks; UIX-001 is the only hard prerequisite inside the phase.

## Why this phase exists

REV-007 renamed the product to NodeGX, but the product still *looks* like Noodl 2.9.3: a near-black UI with no elevation hierarchy, one red hue doing five jobs (brand, CTA, active state, warning, error), unfinished-looking form controls, a node-graph palette from a different era that ignores the app's own token system, broken launcher thumbnails, and no light theme. For a tool whose pitch is "approachable AI-native app building," the first thirty seconds currently signal "abandoned dev tool." This phase is the visual half of the rebrand.

The work is unusually tractable because the styling architecture is already good: a two-tier CSS custom-property token system (`--base-color-*` → `--theme-color-*`) drives ~119 of the editor's stylesheets, the launcher is React in core-ui, and the Canvas2D node palette is data-driven from one object. The debt is bounded and enumerated (two duplicate token files, ~44 legacy stylesheets with ~397 hardcoded hex values, a canvas decoupled from tokens). Nothing here requires a framework change or layout redesign — this is a **reskin, not a re-architecture**.

**The mocks are the target.** [mocks/nodegx-launcher-mock.html](./mocks/nodegx-launcher-mock.html) and [mocks/nodegx-editor-mock.html](./mocks/nodegx-editor-mock.html) are self-contained, theme-aware HTML files (open them in a browser; flip OS dark/light to see both variants). Every task below references them. Where a spec and a mock disagree, the spec wins; where a spec is silent, the mock wins.

## Task Table

| Order | ID | Title | Tier | Priority | Estimate | Prerequisites | Executor |
|---|---|---|---|---|---|---|---|
| 1 | [UIX-001](./UIX-001-DESIGN-TOKENS-FOUNDATION.md) | Design tokens & typography foundation | 1 — foundation | 🔴 Critical | 3–5 days | none | 🔵 Fable 5 |
| 2 | [UIX-002](./UIX-002-LEGACY-HEX-MOPUP.md) | Legacy hex mop-up + ratchet gate | 1 — foundation | 🟠 High | ~1 wk | UIX-001 | 🟢 Sonnet 5 |
| 3 | [UIX-003](./UIX-003-CONTROL-KIT.md) | Control kit: forms, toasts, chips, box-model editor | 2 — surfaces | 🟠 High | 1–1.5 wks | UIX-001 | 🟠 Opus 4.8 |
| 4 | [UIX-004](./UIX-004-EDITOR-CHROME-AND-PANELS.md) | Editor chrome & panels | 2 — surfaces | 🟠 High | ~1 wk | UIX-001; UIX-003 for controls | 🟠 Opus 4.8 |
| 5 | [UIX-005](./UIX-005-CANVAS-REPALETTE.md) | Canvas re-palette & node card redesign | 2 — surfaces | 🔴 Critical | 1–2 wks | UIX-001 | 🔵 Fable 5 |
| 6 | [UIX-006](./UIX-006-LAUNCHER-FIRST-RUN.md) | Launcher & first-run experience | 2 — surfaces | 🟠 High | ~1 wk | UIX-001; UIX-003 for toast/cards | 🟠 Opus 4.8 |
| 7 | [UIX-007](./UIX-007-ICONOGRAPHY.md) | Iconography normalization | 2 — surfaces | 🟡 Medium | ~1 wk | UIX-001; pairs with UIX-004 | 🟢 Sonnet 5 |
| 8 | [UIX-008](./UIX-008-LIGHT-THEME.md) | Light theme + switching machinery | 3 — expansion | 🟠 High | 1–1.5 wks | UIX-001, UIX-002, UIX-005 | 🟠 Opus 4.8 |
| 9 | [UIX-009](./UIX-009-LONGTAIL-SWEEP-VISUAL-QA.md) | Long-tail sweep & visual QA harness | 3 — expansion | 🟡 Medium | 1–2 wks | everything above | 🟢 Sonnet 5 |

Serial worst case ~7–9 weeks; realistic with parallelism ~4–6. UIX-002, UIX-003, UIX-005 can run concurrently once UIX-001 lands (different file territories: legacy stylesheets / core-ui components / canvas paint code — but see the worktree traps note below).

## Sequencing notes

- **UIX-001 is the keystone.** Every other task consumes its token vocabulary. It is deliberately small — palette, semantic split, typography, the duplicate-file collapse — and must land first. Do not let it grow surface work.
- **Tiers are stopping points.** Tier 1 alone (tokens + mop-up) visibly modernizes the whole app and de-reds the semantics for a week's work. Tier 2 delivers the mocks. Tier 3 is what makes the product feel *finished* (light theme, no unstyled corners).
- **The de-red rule is phase law:** after UIX-001, `--theme-color-danger` (red) may appear only on destructive/error surfaces. Any task that finds red doing CTA/brand/active duty converts it. The heritage coral survives in exactly one place: the brand dot in the wordmark (UIX-006).
- **The canvas must become theme-aware in UIX-005**, not later — UIX-008's light theme needs the painter reading resolved theme values at init/theme-change, or light mode ships with a dark graph.
- **Do not break the diff/review surfaces.** SUB-007's conflict UI and AIX-003's annotated-diff canvas draw Created/Changed/Deleted annotation colors through the same painter; UIX-005 owns keeping them legible in both themes.
- **Contrast is an acceptance criterion, not an aspiration:** all text at WCAG AA (4.5:1 normal, 3:1 large/UI) against its actual surface, both themes. Each task's checklist carries it.
- **Parallel-agent hygiene:** per the parallel-worktree traps (memory 2026-07-25), verify worktree bases are cline-dev tip, and run editor live-verification from the primary checkout, not the worktree. Commit with pathspecs.
- **Screenshots before you start.** UIX-009 needs "before" images; capture the screenshot corpus (launcher, editor, each panel, popups) at phase start, not at the end.

## Exit criterion

A first-time user launches NodeGX and sees: a card-based launcher with intact thumbnails under a NodeGX wordmark; an editor whose panels, controls, and node graph share one coherent palette with visible elevation and finished controls; red appearing only where something is wrong; a light/dark theme toggle that restyles everything including the node canvas; and no screen anywhere in the app that still shows the old near-black/red-everything skin. A screenshot corpus proves it, and a hex-ratchet gate in CI prevents regression to hardcoded colors.

## What this phase deliberately parks

- **Layout redesign** — panel arrangement, docking, and the editor's information architecture stay as-is. The mocks deliberately reproduce today's layout. (Phase 3 history covers UX overhaul; this is skin.)
- **ReactFlow / canvas framework migration** — permanently, per the re-validated 2026-07-23 decision. The Canvas2D painter is the implementation target.
- **Onboarding/tutorial redesign** — LEARN-001 owns the Learn tab; UIX-009 only ensures lesson UI inherits tokens.
- **Marketing site / docs re-skin** — out of repo scope. UIX-009 notes which docs screenshots go stale.
- **Motion/animation system** — micro-transitions only (hover, focus, toast enter/exit), all behind `prefers-reduced-motion`. No choreographed animation work.
- **New app icon / OS-level branding** — REV-007 territory (signing/publish is human-gated anyway).
- **User-selectable accent colors / arbitrary theming** — two themes, one accent. Revisit post-G2 if ever.

## References

- [mocks/](./mocks/) — the two target mockups (self-contained HTML, theme-aware)
- `packages/noodl-core-ui/src/styles/custom-properties/colors.css` — the canonical token file (and its editor duplicate, to be collapsed by UIX-001)
- `packages/noodl-runtime/src/nodelibraryexport.js` (~lines 161–220) — the canvas palette object
- [PLAT-001](../phase-14-editor-platform-health/) — the canvas decomposition that makes UIX-005 tractable (stateless painter)
- [PLAT-004](../phase-14-editor-platform-health/) — the ratchet pattern UIX-002 copies
- NOODL-VIABILITY-REPORT (dev-docs/reviews/) — adoption context for why first impressions matter
