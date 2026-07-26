# UIX-008: Light Theme + Switching Machinery

## Metadata

| Field | Value |
|-------|-------|
| **ID** | UIX-008 |
| **Phase** | Phase 23 — Visual Refresh (Track I) |
| **Tier** | 3 — expansion |
| **Priority** | 🟠 High (arguably the single biggest "not scary" lever for new users) |
| **Difficulty** | 🟡 Medium (mechanism is small; QA is the real cost) |
| **Estimated Time** | 1–1.5 weeks |
| **Prerequisites** | UIX-001 (light values recorded), UIX-002 (no hardcoded dark patches), UIX-005 (theme-aware canvas hook) — the dependency order is strict |
| **Branch** | `task/uix-008-light-theme` |
| **Recommended executor** | 🟠 **Opus 4.8** |

## Objective

Ship a working light theme: activate the light token set, build the switching machinery (system-follow + manual override, persisted), make the canvas and code editor follow it, and QA every surface on the light ground.

## Background

The token file has carried a commented-out `.theme-light` block ("FUTURE: LIGHT THEME") for years; UIX-001 filled it with the mock's light values but left it inert. **No switching machinery exists anywhere** — no theme class application, no persistence, no `prefers-color-scheme` listener (audit confirmed: zero matches outside built bundles). This task builds it. It is deliberately *last among the visual tasks* because a light theme is only as good as its worst surface: UIX-002 must have eliminated hardcoded dark hexes, and UIX-005 must have made the canvas re-resolve its colors on theme change, or light mode ships with dark patches and a dark graph. The mocks are living proof of the target — they render both themes from the same token structure.

## Current State

- Light values recorded but inert in the canonical `colors.css` (UIX-001).
- No mechanism applies a theme class; dark is structurally assumed (`:root` values are dark).
- Canvas repaints on a theme hook (UIX-005) but nothing fires it.
- CodeMirror theme (`noodl-core-ui/src/components/code-editor/codemirror-theme.ts`) is single-theme.
- The preview webview renders user apps — user content, NOT themed (an app's own background is the user's business).

## Desired State

- **Mechanism:** a `data-theme="light" | "dark"` attribute (or class — match whatever's cheapest with the existing root markup) on the document root of **every window** (launcher/editor share one window; check for aux windows/popouts). Token file structured as: `:root` = dark defaults (compat), overridden by the light block under the attribute selector. A small ThemeManager in the editor model layer: modes `system | light | dark`, default **system** (decide: if telemetry-free data suggests most users expect dark for now, `dark` default is acceptable — record the decision); listens to `prefers-color-scheme` in system mode; persists the choice (same store as other editor settings); notifies (`themechanged`) for canvas + CodeMirror + anything imperative.
- **Control surface:** a theme selector in editor settings and/or the launcher header (system/light/dark tri-state). Keep it discoverable but quiet — no theme toggle in the main toolbar.
- **Canvas:** flipping theme re-resolves CanvasTheme and repaints; node categories, wires, grid, annotations all legible on light (UIX-001's light-variant node tokens).
- **CodeMirror:** a light syntax theme paired to the tokens; switches with the app. (This is the one place UIX-009's long-tail could otherwise strand a dark island inside a light app — it's in scope *here*.)
- **Shadows/elevation:** light theme relies more on shadow than border-luminance; verify the shadow tokens (UIX-001 defined both sets) read correctly — panels must not disappear into the page.
- **QA sweep:** every surface the phase touched, on light: launcher (+ empty/failure states), editor chrome, all panels, dialogs/popups, canvas (+ diff canvas), toasts/chips (severity colors legible on light), Learn tab, settings. Screenshot both themes for the UIX-009 corpus. Contrast matrix re-verified for light (UIX-001 recorded it; verify against implementation).
- **Electron chrome:** window `backgroundColor` (flash-of-dark on launch), native menus/titlebar variant if the platform exposes it — set per theme where Electron allows without deep work.
- The preview webview and user-app content are explicitly untouched; document that "theme" means editor chrome.

## Scope

### In Scope
- [ ] Token file restructure (dark default + light override block active)
- [ ] ThemeManager: system/light/dark, persistence, `prefers-color-scheme` listener, `themechanged` notification
- [ ] Settings UI (tri-state selector)
- [ ] Canvas + CodeMirror integration
- [ ] Electron window background/titlebar alignment
- [ ] Full light-mode QA sweep with screenshots (both themes, all phase surfaces)
- [ ] Light contrast verification
- [ ] Docs: theming section in DESIGN-TOKENS.md (how to add theme-dependent values correctly)

### Out of Scope
- User-app/preview theming (user content)
- Custom/user-defined themes, accent customization (parked)
- Per-window mixed themes
- High-contrast/accessibility themes (note as future; the token structure now supports it)

## Implementation Steps

1. Token restructure + hardcoded-attribute smoke test (set `data-theme="light"` manually in devtools; walk the app; log every broken surface — this list sizes the real work and catches UIX-002 escapees).
2. ThemeManager + persistence + system-follow; settings UI.
3. Canvas + CodeMirror hooks.
4. Electron chrome details.
5. Fix the smoke-test list; QA sweep + screenshots + contrast pass.

## Success Criteria

- [ ] Tri-state theme setting works, persists across restarts, and system mode follows a live OS theme change without restart
- [ ] Toggling theme restyles launcher, editor chrome, canvas, and code editor with no dark/light islands
- [ ] Diff canvas + severity colors legible on light
- [ ] No flash-of-wrong-theme on window open
- [ ] Screenshot corpus contains both themes for every phase surface
- [ ] Light contrast matrix passes AA

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Stray hardcoded colors surface as dark patches on light | Step 1's manual smoke test finds them before machinery work; escapees go back through UIX-002's ratchet |
| Canvas repaint on theme change misses cached surfaces (offscreen caches, thumbnails) | Inventory painter caches during UIX-005; `themechanged` contract requires cache invalidation — test it |
| Shadow-based elevation reads flat on light | UIX-001 defined light shadow tokens; QA sweep explicitly checks panel separation |
| Aux windows / popouts miss the attribute | Enumerate window creation sites; ThemeManager applies at window creation, tested per window type |
| CodeMirror light theme drifts from token palette | Derive its colors from the token values in one mapping file, not free-hand |

## References

- [UIX-001](./UIX-001-DESIGN-TOKENS-FOUNDATION.md) — light values + contrast matrix
- [UIX-005](./UIX-005-CANVAS-REPALETTE.md) — the theme hook contract
- [mocks/](./mocks/) — both themes working from one token set
- `codemirror-theme.ts` — the code-editor theme to pair

## Checklist

- [ ] Smoke test list → fixes
- [ ] ThemeManager + settings + persistence
- [ ] Canvas/CodeMirror/Electron integration
- [ ] Both-themes screenshot sweep + AA; docs; CHANGELOG
