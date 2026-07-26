# Phase 24: Mock Parity (Track I follow-through)

**Phase:** 24
**Status:** 🚧 In progress (created 2026-07-26)
**Source:** Richard's directive 2026-07-26: "get it as close to the mockups as possible, down to the last detail." Phase 23 delivered tokens/theme/palette but restyled legacy markup in place; the visible gap between the shipped app and the mocks is structure and density, not color.

## The contract

The two mocks are the **pixel-level spec**, not inspiration:

- [../phase-23-visual-refresh/mocks/nodegx-launcher-mock.html](../phase-23-visual-refresh/mocks/nodegx-launcher-mock.html)
- [../phase-23-visual-refresh/mocks/nodegx-editor-mock.html](../phase-23-visual-refresh/mocks/nodegx-editor-mock.html)

Every size, weight, radius, spacing, and shadow in the mock CSS is normative. Where phase 23's "restyle in place" rule conflicted with the mock, **the mock now wins** — markup surgery and component rebuilds are in scope. What stays out of scope: feature removal (keep every panel/behavior; apply the mock's *treatment* to it), canvas painter internals (UIX-005 already matches), and dishonest UI (a status indicator binds to a real signal or is omitted — but hunt hard for the real signal before omitting).

## Mock-token → codebase-token mapping (from UIX-004, verified)

| Mock | Codebase (`--theme-color-*` unless noted) |
|---|---|
| `--bg-0/1/2/3` | `bg-0/1/2/3` |
| `--border-1` / `--border-2` | `border-default` / `border-strong` |
| `--fg-1/2/3` | `fg-highlight` / `fg-default` / `fg-muted` |
| `--accent` / `--accent-hover` / `--accent-fg` / `--accent-soft` | `primary` / `primary-highlight` / `on-primary` / `primary-bg` |
| `--warning` / `--warning-bg`, `--error`, `--success` | `warning` / `warning-bg`, `danger`, `success` |
| `--brand` | brand-dot coral (UIX-006's sanctioned coral) |
| `--node-visual/data/logic/function/component` | `node-category-{visual,data,logic,function,component}` |
| `--wire-signal` / `--wire-data` | wire tokens (UIX-001) |
| `--shadow-card` / `--shadow-pop` / `--shadow-toast` | `--shadow-sm` / `--shadow-popup` / (add toast if missing) |
| radii 5/6/7/8/9/10px | use nearest `--radius-*`; add steps to the token file if a needed step is missing |

**Token-value drift check (every task):** the mock's dark values (bg-0 `#0B0E12`, bg-1 `#12161B`, bg-2 `#181D24`, bg-3 `#222933`, border `#232A33`/`#37404C`, fg `#EEF2F6`/`#A6B0BB`/`#6B7682`, accent `#4DA3FF`) and light values (see mock `:root`) are normative. If the canonical token file's values differ, fix them **in the token definition file** (`packages/noodl-core-ui/src/styles/custom-properties/colors.css`, ratchet-excluded), never with local hex.

**Typography:** body/UI text is 13px system stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui`); Bricolage Grotesque 600 (bundled since UIX-001) is used ONLY for the wordmark (17px), launcher h1 (24px), and card ghost initials (96px). Mono is `ui-monospace, 'SF Mono', monospace` for paths, sizes, versions, numeric inputs.

## Task table

| ID | Title | Territory (files) | Executor |
|---|---|---|---|
| [PAR-001](./PAR-001-LAUNCHER-PARITY.md) | Launcher parity | core-ui launcher subtree + `ProjectsPage` + launcher window chrome (main.js titlebar config) | agent, worktree |
| [PAR-002](./PAR-002-PROPERTIES-PANEL-PARITY.md) | Properties panel rebuild | `propertyeditor/*` (legacy shell + React field renderers + its CSS) | agent, worktree |
| [PAR-003](./PAR-003-EDITOR-CHROME-PARITY.md) | Editor chrome parity | `EditorTopbar`, `SideNavigation`/`SidePanel`, `VisualCanvas` overlays, `NodeGraphComponentTrail`, bottom bar | agent, worktree |

Territories are disjoint by design (three different file families). Rules carried from phase 23: hex ratchet must hold (`npm run colors`) — new colors go through tokens; `comm -12` preflight if territories look close; worktree agents verify base = cline-dev tip (stale-base trap); live editor verification happens from the primary checkout (orchestrator).

## Acceptance

Side-by-side screenshot vs. the rendered mock (same theme), surface by surface. "Reads identical at a glance; any difference is explainable (real data, real icons, honest signals)." The UIX-009 corpus harness (`../phase-23-visual-refresh/corpus/`) is the instrument; mocks rendered at fixed size become gallery reference columns.
