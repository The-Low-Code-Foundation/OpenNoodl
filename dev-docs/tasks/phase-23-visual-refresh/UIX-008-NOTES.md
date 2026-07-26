# UIX-008 Notes — Light Theme + Switching Machinery

Date: 2026-07-26. Executor: Opus 4.8, worktree branched from `cline-dev` (tip `e2cace6`).

Hit the stale-base trap: fresh worktree was rooted at `360cdc4`; `git reset --hard e2cace6` before starting.

## Default-mode decision: `system`

`ThemeManager` defaults to **`system`** (follows the OS `prefers-color-scheme`).

Reasoning:
- It is the spec's stated default and the least-surprising, most welcoming behavior for new users — the whole point of the task ("the biggest not-scary lever for new users"). A user on a light OS gets a light editor with no action.
- It is safe to default to system here because NodeGX is **pre-release (v0.1.0)** with no installed base accustomed to a forced-dark editor, so there is no jarring upgrade surprise.
- It is the only way to demonstrate the "system mode follows a live OS theme change without restart" success criterion by default.

Fallback: if the orchestrator's live both-themes pass finds light mode too rough to ship as an out-of-box default, flip `DEFAULT_MODE` to `'dark'` in `models/ThemeManager.ts` — a one-line change. Light + system remain fully available via the selector either way.

## Token structure

`colors.css` restructured per spec:
- `:root` = **dark** defaults (compat; pre-boot flash, headless, tests are dark).
- `:root[data-theme='light']` = light overrides (the former inert `.theme-light` block, renamed to the attribute selector and activated). `data-theme='dark'` inherits `:root` — no separate dark block.
- Added **`--theme-color-syntax-*`** tokens (dark = VSCode Dark+ lineage in `:root`; light = VSCode Light+ lineage in the light block) so the CodeMirror theme flips via `var()`.
- Added **light overrides for the legacy `--theme-color-node-*` scales** (data/visual/custom/logic/component 1/2/3/dim). Their dark values are deep desaturated node hues that smear on a light panel; DOM consumers (CommentLayer, NodePickerNode, ConnectionBar, NodeReferencesPanel) now get light-appropriate node hues. Canvas paint reads the category tokens (already light-overridden by UIX-001), not these.

`spacing.css`: added `:root[data-theme='light']` overrides for `--shadow-*` (ink-tinted rgba 23,32,43 shadows, matching the mock). On light, elevation reads from shadow, not the bg ladder — this keeps panels/cards/popups from disappearing into the page. Dark shadows unchanged.

## Window-creation-site enumeration + where the attribute is applied

The editor has **one** renderer window for chrome (launcher + editor + all in-DOM popouts share it):
- `main/main.js` `createWindow()` — the main BrowserWindow. Attribute applied in the renderer at `src/editor/index.ts`: `ThemeManager.applyProvisional()` at module scope (before first paint, OS preference) then `ThemeManager.init()` in `DOMContentLoaded` (reconciles to saved choice). Stamping `document.documentElement` covers the launcher route, the editor, and `PopupLayer` popouts (they render into this window's DOM).
- `main/src/floating-window.js` `FloatingWindow` — used for the **preview/viewer** window (renders the user's running app — OUT of scope per spec) and a legacy `floating-window-open` popout path (no live emitter found). Left as-is; its `backgroundColor` stays `#131313`. If it is ever surfaced as editor chrome, it needs the same treatment — noted.
- No `BrowserView`. The preview `<webview>` and sign-in `<webview>` host user/external content — untouched.

Electron chrome (main process, `main/main.js`):
- Main window `backgroundColor` is now per-theme (`resolveStartupTheme()` reads `<userData>/editorSettings.json` synchronously for `editor.theme`, resolves `system` via `nativeTheme.shouldUseDarkColors`, picks `#0b0e12` dark / `#eef1f5` light) — prevents flash-of-dark on launch under a light theme.
- `nativeTheme.themeSource` is set at startup from the saved mode and updated live via a new `set-native-theme` IPC that `ThemeManager` sends on every change — aligns native scrollbars/menus/dialogs.
- Titlebar: the window is `frame: false` + `titleBarStyle: 'hidden'` — the custom titlebar is DOM chrome (`TitleBar.module.scss`) and follows the tokens. No native titlebar to theme; `nativeTheme.themeSource` covers what the platform does expose. So "titlebar variant" is satisfied without deep work.

## Canvas integration

`CanvasTheme` (UIX-005) already re-resolves + repaints on the `nodegx:themechanged` window event, which `ThemeManager` fires on every change. Additionally extended its `MutationObserver` attributeFilter from `['class']` to `['data-theme', 'class']` so the attribute flip is also a safety-net trigger. Painter caches (grid pattern, `gridPatternCache`) invalidate on `refresh()` via the `generation` counter — this must be re-confirmed live (offscreen/thumbnail caches must not serve stale dark tiles). Category/wire/annotation tokens all have light values (UIX-001 + this task).

## CodeMirror integration

`codemirror-theme.ts` rewritten to derive **every** colour from `var(--theme-color-*)`:
- Syntax colours → `--theme-color-syntax-*` (one mapping object `C`, not free-hand hex).
- White-overlay UI bits that were invisible on light (active line, gutter, fold placeholder, selection-match, bracket match, indent guide) → theme-aware tokens (`--theme-color-bg-hover`, `--theme-color-fg-transparent`, `--theme-color-primary-*`, `--theme-color-border-*`).
- Selection/search-match/lint-marker colours → primary/warning/danger tokens.
- Shadows → `--shadow-*`.
Because the values are CSS variables, the editor flips with the app's `data-theme` — **no re-instantiation** of the extension is needed. Consumers: `codemirror-extensions.ts`, `CodeDiffView.tsx` (both get it for free).
- Left as-is (acceptable on both grounds, cannot use `var()`): the two lint-squiggle SVG data-URIs (`%23ef4444` red, `%23f59e0b` amber) baked into `background-image`, and the static `{ dark: true }` flag on `EditorView.theme` (we override every visible colour, so its effect is negligible). Noted for a future pass.

## Persistence

Mode persists through `EditorSettings.instance` (`@noodl-utils/editorsettings`), key **`editor.theme`**, landing in `<userData>/editorSettings.json` — the same store as every other editor-wide preference. Added a `ready: Promise<void>` to `EditorSettings` so `ThemeManager.init()` can await the on-disk load and apply the saved choice without a flash.

## Settings UI

`AppearanceSettingsSection.tsx` — a quiet tri-state (`System | Light | Dark`) `PropertyPanelSelectInput`, added at the top of `EditorSettingsPanel`. No toggle in the main toolbar (per spec). Reads/writes `ThemeManager`, re-renders on its `changed` event.

## Smoke-test dark-island list (static scan — live devtools walk deferred to orchestrator)

Per the verification note, the live editor was NOT launched from this worktree. In place of the devtools attribute-walk, a **static scan** for light-hostile hardcoded colours (bare `rgba(255,255,255,…)` not behind a `var(--token, fallback)`, and near-white/black hardcoded backgrounds) was run over both packages' `.scss`/`.css`. Most `rgba(255,255,255)` matches are `var(--token, rgba(255,255,255,…))` fallbacks — SAFE (the token always wins).

Genuine candidates and disposition:

FIXED (clear breaks or exact-token overlays; ratchet-neutral because rgba isn't hex-counted):
- `styles/propertyeditor/visualstates.css` (3): white **text** on `bg-4`/`bg-3` labels/buttons → `fg-default` / `fg-muted` / `fg-default-shy`. (Was invisible on light.)
- `noodl-core-ui/.../app/TitleBar/TitleBar.module.scss`: window-control hover `rgba(255,255,255,.1)` → `--theme-color-bg-hover`.
- `noodl-core-ui/.../code-editor/CodeHistory/CodeHistoryDiffModal.module.scss` (2): diff-row hover + empty-line bg → `--theme-color-bg-hover` (code-editor family, coupled to the CodeMirror light theme).

DEFERRED to the orchestrator's live pass (degrade gracefully — subtle overlays/borders that go faint on light, not hard breaks; some are canvas-popup chrome (UIX-004/009) where the exact shade needs a live eye):
- `assets/css/style.css` (2 bare white bgs), `noodl-core-ui/styles/global.css` (scrollbar bg 0.25).
- `views/ConnectionPopup/ConnectionPopup.module.scss` (5: white text + bg on the connection popup — canvas chrome).
- `views/panels/propertyeditor/GeneratedCodeModal` + `ExpressionEditorModal` bare `var(--bg-3, rgba(255,255,255,…))` — these are fallbacks so actually SAFE; listed for completeness.
- `TopologyMapPanel/.../TopologyNode.module.scss` (white drop-shadow glow — cosmetic), `migration/AIConfigPanel.module.scss` (shimmer gradient — cosmetic).
- `StylePresets/PresetCard.module.scss`, `inputs/TokenPicker/TokenPicker.module.scss`, `layout/ConditionalContainer/ConditionalContainer.module.scss` (faint white bg/border overlays).
- Hardcoded hexes already in the ratchet `byFile` baseline (json-editor EasyMode/AdvancedMode, JavaScriptEditor, SuggestionBanner, style.css, etc.) — UIX-002/009 long-tail; several are code-editor content colours now partly superseded by the syntax tokens.

## Contrast matrix re-verification (light, against implementation)

The implemented light tokens equal UIX-001's recorded values (verified against `colors.css`), so UIX-001's recorded light matrix stands:
- fg × bg-0/1/2/3: `fg-highlight` 14.4/16.3/15.4/14.2, `fg-default-contrast` 10.4/11.8/11.1/10.3, `fg-default` 6.6/7.5/7.1/6.5 — all AA normal. `fg-default-shy` 4.7/5.3/5.1/4.7 — AA normal. `fg-muted` 3.2/3.6/3.4/3.2 — AA-large only (documented decorative role).
- Status on white: primary 4.6, danger 4.8, warning 5.4 — AA normal. success `#12915B` 4.0 — **AA-large only** as text; used for badges/icons/status dots (its role), and `--theme-color-success-dim` `#027a48` (≈5.9) is available for body-size success text. `on-primary` white on `#1570EF` 4.6. Focus ring 4.6 on white / 4.0 on bg-3.
- Syntax light values are VSCode Light+ lineage, all comfortably AA on `bg-1`(#fff)/`bg-2`(#f7f9fb).
All documented pairings meet AA for their documented role.

## Hex-ratchet delta

**No baseline change.** Counts held at canvas-paint-ts 2 / noodl-core-ui 100 / noodl-editor 16 before and after. `colors.css` is the ratchet's excluded definition file (the new syntax + light-node hexes live there). `spacing.css` shadow additions and all dark-island fixes use `rgba()`/`var()`, which the ratchet does not count as hex. `.hex-color-baseline.json` untouched.

## LIVE-verification checklist for the orchestrator (both themes, from the primary checkout)

1. **Persistence:** set Light, restart → still Light. Set Dark, restart → still Dark. Set System, restart → follows OS.
2. **System follow (no restart):** in System mode, toggle the OS light/dark → editor + canvas + code editor flip live.
3. **No flash-of-wrong-theme:** launch under a light saved theme (and under System on a light OS) → window opens light, no dark flash. Repeat dark.
4. **No dark/light islands:** walk launcher (+ empty / project-load-error states), editor chrome (titlebar, toolbar, sidebars, tabs, splitters), all panels, dialogs/popups/context menus, settings (Appearance section), Learn tab — on BOTH themes. Pay attention to the DEFERRED list above (ConnectionPopup, style.css/global.css overlays, StylePresets/TokenPicker borders, json-editor content colours).
5. **Canvas:** node cards/wires/grid/annotations legible on light; selection ring + glow; diff canvas (Created/Changed/Deleted) legible on light. Confirm **painter-cache invalidation**: open a thumbnail/offscreen-cached graph, flip theme, confirm no stale dark tiles.
6. **Severity colours on light:** toasts + chips (success/warning/danger) legible; error toast red, warning amber.
7. **Code editor:** JS/JSON editor + CodeDiffView + CodeHistory diff modal — syntax + UI legible on light; active line, brackets, search match, lint squiggles visible.
8. **Screenshot corpus:** capture every surface above in BOTH themes for the UIX-009 set.
9. **Contrast:** spot-check the AA matrix above against the live render, especially light `success` used as text and `fg-muted`.

## Files touched

- Token / theme values: `noodl-core-ui/src/styles/custom-properties/colors.css` (data-theme restructure, syntax tokens, light node scales), `.../spacing.css` (light shadows).
- CodeMirror: `noodl-core-ui/src/components/code-editor/codemirror-theme.ts`.
- ThemeManager + persistence: `noodl-editor/src/editor/src/models/ThemeManager.ts` (new), `.../utils/editorsettings.ts` (`ready` promise).
- Bootstrap: `noodl-editor/src/editor/index.ts`.
- Settings UI: `.../views/panels/EditorSettingsPanel/AppearanceSettingsSection.tsx` (new) + `EditorSettingsPanel.tsx`.
- Canvas hook: `.../views/nodegrapheditor/canvas/CanvasTheme.ts` (observe `data-theme`).
- Electron: `noodl-editor/src/main/main.js` (per-theme backgroundColor, `nativeTheme` + `set-native-theme` IPC).
- Dark-island fixes: `styles/propertyeditor/visualstates.css`, `noodl-core-ui/.../TitleBar.module.scss`, `.../CodeHistoryDiffModal.module.scss`.
- Docs: `dev-docs/guidelines/DESIGN-TOKENS.md` (theming section rewritten).
