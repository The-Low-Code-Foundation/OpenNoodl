# Design Tokens

Canonical source: `packages/noodl-core-ui/src/styles/custom-properties/` (`colors.css`, `fonts.css`, `spacing.css`, `animations.css`). **There is exactly one copy.** The editor and viewer-frame import these via `@noodl-core-ui/styles/custom-properties/*`. Do not create package-local copies of token files — that duplication was collapsed in UIX-001 and must not come back.

## Color roles

### The one rule that matters

**Danger is never a CTA.** `--theme-color-primary` (azure) is the *action* accent: primary buttons, active tabs, selection highlights, links, focus, progress. `--theme-color-danger` (red) is for destructive actions and error states, and nothing else. If a surface is both "the main button" and "destructive" (e.g. a delete-confirmation dialog's confirm button), it is danger, not primary. No other red appears in chrome; the coral `--theme-color-brand` exists solely for the wordmark dot.

### Elevation (dark theme)

| Token | Value | Use |
|---|---|---|
| `--theme-color-bg-page` | `#07090C` | behind everything (window ground) |
| `--theme-color-bg-0` | `#0B0E12` | canvas ground |
| `--theme-color-bg-1` | `#12161B` | panels |
| `--theme-color-bg-2` | `#181D24` | cards, inputs |
| `--theme-color-bg-3` | `#222933` | hover / active fills |
| `--theme-color-bg-4` / `-5` | `#2C3540` / `#37424F` | raised extremes (menus, tooltips) |

Each step is visibly lighter than the one below — pick the step by *elevation*, not by taste. Borders: `--theme-color-border-subtle` (`#1A2029`, hairlines inside a surface), `-default` (`#232A33`, between surfaces), `-strong` (`#37404C`, interactive outlines).

### Text

- `--theme-color-fg-highlight` (`#EEF2F6`) — headings, emphasized values.
- `--theme-color-fg-default` (`#A6B0BB`) — body text. (`-contrast` and `-shy` sit either side of it.)
- `--theme-color-fg-muted` (`#6B7682`) — **large or secondary text only.** It passes AA only for large text (see matrix); never use it for body-size copy that must be read.

### Status

`--theme-color-success` / `-warning` / `-danger`, each with a `-bg` soft fill (12% alpha) and a `-dim` darker variant. `--theme-color-notice` is the legacy name for warning and aliases onto it — use `warning` in new code. In-progress/running states conventionally use warning amber.

### Node categories & wires

`--theme-color-node-category-{visual,data,logic,function,component}` and `--theme-color-wire-{signal,data}` are defined (dark + light) for UIX-005's canvas repalette. They are inert until UIX-005 lands; do not point new UI at the old `--base-color-node-*` scales.

### Compat aliases

A block of previously-referenced-but-never-defined names (`--theme-color-accent`, `-primary-hover`, `-error`, `-notice-shade`, `--theme-color-primary-rgb`, …) is defined at the bottom of `colors.css` so old call sites resolve. Prefer canonical names in new code; UIX-002 migrates call sites off these.

## Typography

- `--font-family` — native system stack. The UI face; Inter is no longer the UI font.
- `--font-family-code` — system monospace (`ui-monospace`, SF Mono, Menlo…) for values, ports, versions, code.
- `--font-family-display` — **Bricolage Grotesque 600** (bundled 40KB woff2, OFL), wordmark and large headings only. Falls back to the system stack. The `@font-face` lives in the statically-linked stylesheets (`noodl-editor/src/assets/css/style.css`, `noodl-core-ui/src/styles/global.css`) because webpack's css-loader runs with `url: false`.
- Sizes: use `--font-size-{xs,sm,base,md,lg,xl,2xl,3xl}` (10 / 11 / 12.5 / 13 / 14.5 / 17 / 18 / 24 px). Do not hardcode px sizes.
- Weights via `--font-weight-*`; the per-weight family vars (`--font-family-bold` etc.) are gone — set `font-weight` instead.

## Contrast matrix (WCAG, computed 2026-07-26)

AA normal = 4.5:1, AA large = 3.0:1.

**Dark** (fg × bg-0/1/2/3): `fg-highlight` 17.2/16.1/15.1/13.0 · `fg-default-contrast` 12.8/12.0/11.2/9.7 · `fg-default` 8.8/8.3/7.7/6.7 · `fg-default-shy` 6.4/6.0/5.6/4.8 · `fg-muted` 4.2/3.9/3.7/3.2 *(AA-large only — documented restriction above)*.
Status on bg-1/bg-2: primary 6.9/6.5 · danger 6.5/6.1 · warning 9.9/9.2 · success 8.7/8.1. `on-primary` on primary: 6.9. Focus ring azure: 7.4 on bg-0, 5.6 on bg-3.

**Light** (fg × bg-0/1/2/3): `fg-highlight` 14.4/16.3/15.4/14.2 · `fg-default-contrast` 10.4/11.8/11.1/10.3 · `fg-default` 6.6/7.5/7.1/6.5 · `fg-default-shy` 4.7/5.3/5.1/4.7 · `fg-muted` 3.2/3.6/3.4/3.2 *(AA-large only)*.
Status on white: primary 4.6 · danger 4.8 · warning 5.4 · success 4.0 *(success is AA-large as text; fine for icons/badges — UIX-008 may darken for body-text use)*. `on-primary` white on `#1570EF`: 4.6. Focus ring: 4.6 on white, 4.0 on bg-3.

Every documented pairing meets AA for its documented role.

## Theming (light + dark) — UIX-008

The editor ships a light and a dark theme. Both render from **one token set**.

### How it is wired

- **`:root`** in `colors.css` carries the **dark** values — the compat default. Any surface with no theme applied (pre-boot flash, headless render, tests) is dark.
- **`:root[data-theme='light']`** overrides the `--theme-color-*` semantic tokens with the light palette. `data-theme='dark'` (or no attribute) inherits the `:root` defaults, so there is no separate dark override block.
- Theme-dependent **shadows** live the same way in `spacing.css` (`:root[data-theme='light']` strengthens `--shadow-*`, because light elevation reads from shadow, not the bg ladder).
- The **`ThemeManager`** (`packages/noodl-editor/src/editor/src/models/ThemeManager.ts`) owns the mode (`system | light | dark`, default `system`), stamps `data-theme` on the document root, persists the choice in `EditorSettings` (`editor.theme`), follows `prefers-color-scheme` live in system mode, and fires the `nodegx:themechanged` window event. It is applied in `src/editor/index.ts` before first paint. Launcher and editor share one window, so stamping the root themes both.

### How to add a theme-dependent value

1. Define the **dark** value in `:root` and the **light** value in the `[data-theme='light']` block. Same token name in both.
2. Consume it as `var(--theme-color-…)` in your SCSS/CSS. It flips for free.
3. **Never hardcode a colour a light surface would need to override.** If you catch yourself writing `rgba(255,255,255,.1)` for a hover, use a theme-aware token (`--theme-color-bg-hover`, `--theme-color-fg-transparent`) instead — a white overlay vanishes on white.
4. Raw `--base-color-*` scales **do not flip** — only `--theme-color-*` tokens do. Never use base scales directly in components.
5. Imperative canvas painting reads tokens through `CanvasTheme` (which re-resolves on `nodegx:themechanged`); the CodeMirror theme reads `--theme-color-syntax-*` via `var()` so it flips with no re-instantiation. Follow those patterns rather than reading colours another way.

### Scope

"Theme" means the editor **chrome** only. The preview webview renders the user's running app; its appearance is the user's business and is deliberately untouched.

### Future

The `[data-theme]` structure generalises: a high-contrast or custom theme is another attribute value plus another override block. Parked for now (out of UIX-008 scope) but the structure supports it.
