# PAR-003 Notes — Editor Chrome Parity

Executor: worktree agent off `cline-dev` (base `eeea5c2`; stale-base trap HIT again —
fresh worktree was rooted at ancient `360cdc4`, fixed with `git reset --hard eeea5c2`
on a pristine tree).

## Files changed

| File | Change |
|---|---|
| `packages/noodl-editor/src/editor/src/views/EditorTopbar/EditorTopbar.tsx` | Accent add-node, route pill structure (glyph + project name + mono path), segmented Design/Preview replacing ToggleSwitch |
| `packages/noodl-editor/src/editor/src/views/EditorTopbar/EditorTopbar.module.scss` | Full toolbar restyle to mock metrics (52px/bg-1/0 16px, chip, selects, seg, deploy) |
| `packages/noodl-core-ui/src/components/app/SideNavigation/SideNavigation.module.scss` | Rail 52px/bg-1/border-default, 34×34 centered buttons, `--icon-button-idle-fg` set to fg-muted |
| `packages/noodl-core-ui/src/components/inputs/IconButton/IconButton.module.scss` | **Shared-primitive change (scoped):** transparent variant's idle glyph color now reads `var(--icon-button-idle-fg, fg-default)`. Only the rail sets the variable; hover/active states untouched |
| `packages/noodl-editor/src/editor/src/views/CanvasOverlays/CanvasHud/*` (new) | AI pill + zoom cluster React component + module.scss |
| `packages/noodl-editor/src/editor/src/views/nodegrapheditor/CanvasShell.ts` | New `canvasHudRoot` shell layer |
| `packages/noodl-editor/src/editor/src/views/nodegrapheditor/OverlayViews.ts` | `renderCanvasHud`/`updateCanvasHud`; HUD in `setCanvasVisibility`; trail gets `runtimeType`/`readOnly` props |
| `packages/noodl-editor/src/editor/src/views/nodegrapheditor/ViewportActions.ts` | `setPanAndScale` also updates the HUD (same cadence as highlight/execution overlays) |
| `packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts` | Mount HUD in `render()`; refresh on `setReadOnly` |
| `packages/noodl-editor/src/editor/src/styles/nodegrapheditor.css` | Trail root full-width; `.canvas-hud-root` pointer-events-none layer |
| `packages/noodl-editor/src/editor/src/constants/Keybindings.ts` | `OPEN_AI_PANEL = Cmd/Ctrl+J` (verified free — no prior KEY_J binding) |
| `packages/noodl-editor/src/editor/src/views/NodeGraphComponentTrail/NodeGraphComponentTrail.{tsx,module.scss}` | Bottom-bar rebuild: pill tabs, `+` new-component, Preview-live status |
| `packages/noodl-editor/src/editor/src/ViewerConnection.ts` | Emits `viewerClientsChanged` at the two existing `clientsToExportTo` mutation points; `hasConnectedViewer` getter. Pure notification — no tracking-semantics change |
| `packages/noodl-editor/src/editor/src/views/HelpCenter/HelpCenter.module.scss` | `?` button docks inside the bottom bar (30px, bottom 4/right 8) |
| `packages/noodl-editor/src/editor/src/views/VisualCanvas/VisualCanvas.{tsx,module.scss}` | Size tag: `1280 × 800 · 100%` format, plain mono top-right (chip bg/border removed) |
| `packages/noodl-core-ui/src/styles/custom-properties/colors.css` | **Not touched** — token-drift check done: every mock dark/light value already matches the canonical tokens exactly |

## Mock element → implementation map

| Mock | Implementation |
|---|---|
| Toolbar 52px bg-1 border-b, padding 0 16px, gap 8 | `EditorTopbar.module.scss .Root`; group separator borders removed |
| `.icon-btn.accent` add-node | `IconButton` `state={Active}` (UIX-004 accent-soft pill + accent glyph) — existing `onAddClicked` |
| Back/forward 15px chevrons | Existing CaretLeft/CaretRight IconButtons (plus the existing Refresh button, an extra vs the mock — kept, feature-keep rule) |
| `.route` pill (bg-2, border-1, r8, 6/12 padding, min-w 300, proj 600 fg-1, mono path, chevron right) | `.UrlBarWrapper` + `.RouteProjectName` (real `ProjectModel.instance.name`) + mono'd TextInput; same route handlers, route list, Cmd+L focus |
| Debug icon | Existing Bug IconButton |
| `.chip-warnings` (warning-bg/warning, r7→radius-md, 5/9 padding, 12px/600) | `.WarningsChip` restyle; amber (phase law), AA in both themes |
| Zoom dropdown 13px/500 fg-2, hover bg-3 | `.TopbarSelect` (applies to both preview-zoom and screen-size selects — the latter is an extra vs the mock, same treatment) |
| Split/rows toggles | Existing IconButtons, active = accent pill (shared primitive) |
| `.seg` Design/Preview (bg-2 r8 p2; active bg-1 + shadow-sm) | `.ModeSegmented`/`.ModeSegmentedButton` — same two states, same `onPreviewModeChanged` |
| `.btn-primary` Deploy w/ rocket | Existing PrimaryButton (azure tokens) + `.DeployButton` metric overrides; rocket icon already present |
| Rail 52px bg-1, 34px buttons, fg-3 idle / bg-3 hover / accent active, Settings pinned bottom | SideNavigation + IconButton scss; all real panels kept (more entries than the mock's six); bottom pinning was already flex-spacer'd in SidePanel |
| Device card (white, r10, border, shadow) on bg-0 | Verified — shipped in UIX-004, untouched (layout box untouched) |
| `.size-tag` mono 10.5 fg-3 top-right | `.ViewportInfo` — format + position per mock; still shows on resize only (existing behavior; an always-on tag would be new UI) |
| `.ai-pill` (bg-1, r99, shadow-pop, spark, kbd ⌘J) | `CanvasHud.AiPill` — see bindings below |
| `.zoom-cluster` (joined −/%/+/fit, bg-1 r8 shadow-sm) | `CanvasHud.ZoomCluster` — see bindings below. `%` is a passive display (mock's `.val` button has no defined action; inventing click behavior would be new UI) |
| Bottom bar 38px bg-1 border-t, `.comp-tab` pills, current = accent-soft+accent+600 w/ 11px glyph, `+`, `Preview live` | `NodeGraphComponentTrail` rebuild. Note: the trail is a **breadcrumb** (path to current component), not an open-tabs strip — the mock's tab *treatment* is applied to the existing navigation mechanism, behavior unchanged. Glyph renders on the current pill only, per mock |

## The three signal bindings

1. **AI pill → `SidebarModel.instance.switch('ai-authoring')`** — the AIX-002
   authoring loop UI ("Build" side panel, `AiAuthoringPanel_ID`). The panel is
   registered `experimental: true`, so the pill renders **only** while the panel is
   actually in the SidebarModel items (tracks `itemsChanged`), and never on
   read-only canvases (diff/review documents). `Cmd/Ctrl+J` registered as
   `Keybindings.OPEN_AI_PANEL` (verified unbound before); the kbd chip shows the
   platform label. Clippy (the other AI surface, top-left, gated on
   `AiConfigStore.isEnabled()`) is untouched — the spec named the AIX-002 authoring
   entry, and the Build panel is that entry.
2. **Zoom cluster → the real canvas viewport API.** −/+ call
   `ViewportActions.updateZoomLevel(cssCenter, ±4)` — the identical code path
   mouse-wheel zoom uses (±4 steps ≈ 23% per click; scale clamps at 100% max /
   fit-min, same as wheel). Fit calls the existing
   `centerToFit(CenterToFitMode.AllNodes)` (the API UIX-005 QA drove). The
   percentage is re-rendered from `ViewportActions.setPanAndScale` — the exact
   choke point the highlight/execution overlays already re-render from — so it
   stays live for wheel zoom, buttons, and programmatic changes.
3. **Preview live → viewer-client presence.** `ViewerConnection` had the state
   (`clientsToExportTo`, mutated on nodelibrary import / `disconnect`) but no
   event; added `notifyListeners('viewerClientsChanged')` at those two existing
   mutation points plus a `hasConnectedViewer` getter (ViewerConnection already
   extends the shared `Model` and emits e.g. `'select'` — this is the same
   mechanism, zero behavior change). The status renders only while ≥1 viewer
   client is connected and has delivered its node library.

## Scope decisions / deviations (all disclosed, none silent)

- **HelpCenter `?` button** collided with the mock's zoom-cluster corner
  (bottom-right 16px). It now docks inside the 38px bottom bar (right side, 30px
  circle); the bar reserves 44px right padding for it. The mock has no help
  button — this keeps the feature while giving the zoom cluster the mock's exact
  spot.
- **Radius 7px** (mock icon-btns/deploy/warnings chip): no `--radius-*` step at 7;
  used the nearest step `--radius-md` (6px) rather than minting a one-off token.
  Route pill/seg/zoom-cluster use `--radius-lg` (8) per mock.
- **Refresh button and screen-size dropdown** are toolbar extras vs the mock —
  kept (feature-keep rule) with the mock's treatment.
- **Trail extras vs mock:** graph history back/forward kept as compact icon
  buttons at the bar's left; folder segments and "(Read only)" state text kept as
  muted text.
- **kbd chip label** is the platform keybinding label ("⌘+J" / "Ctrl+J") rather
  than the mock's literal "⌘J" — real accelerator formatting, honest across OSes.
- **IconButton shared change** is exactly one line of indirection (idle color var
  with the previous value as fallback); sizing for the rail lives in
  SideNavigation's own module.

## Deferrals

- **Unified titlebar (traffic lights in the toolbar row):** the mock merges the
  OS titlebar into the 52px toolbar. Window chrome config is main-process
  territory (PAR-001 owns `main.js` titlebar work for the launcher; the editor
  window frame was not in any PAR-003 file family). Toolbar is mock-correct below
  the existing titlebar. Flagged for orchestrator follow-up if the frameless look
  is wanted.
- **Live QA** (orchestrator, from primary checkout): seg control + route pill in
  both themes, HUD zoom against wheel zoom, AI pill with the Build panel
  enabled/disabled, Preview-live on viewer connect/disconnect/reload, `+` create
  flow, help-button hit target inside the bar, `is-small` (<850px) toolbar.

## Verification

- `npx tsc --noEmit`: 18 errors, all pre-existing `@noodl-versioning`
  module-resolution baseline (worktree has no built noodl-versioning package);
  **zero new errors**. Core-ui changes are SCSS-only.
- `npm run colors`: `canvas-paint-ts 2/2 =, noodl-editor 16/16 =` — holding; no
  new hex anywhere (all values via `--theme-color-*` / `--radius-*` / `--shadow-*`
  / `--font-family*` tokens).
- All changed/new SCSS compiled standalone with `sass` (syntax check).
- Token-drift check vs mock `:root` values: exact match (dark + light), no
  `colors.css` edit needed.
- Electron editor NOT launched from the worktree (lerna trap) — static
  verification only, per task rules.
