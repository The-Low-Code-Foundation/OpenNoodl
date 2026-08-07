# UIX-004 Notes — Editor Chrome & Panels

Executor: Opus 4.8, worktree off `cline-dev`.

## Stale-base trap: HIT and fixed
Fresh worktree was rooted at `360cdc4` (ancient — no phase-23 files). Ran
`git reset --hard 7cbf665` (safe: pristine worktree). Now rooted at the cline-dev tip.

## Token mapping (mock local names → canonical codebase tokens)
Same convention as UIX-003. The mock uses short `--bg-*` names; the codebase uses
`--theme-color-*` (UIX-001). No raw hex — the `npm run colors` per-package ratchet
(noodl-editor ≤16, noodl-core-ui ≤100) must hold.

| Mock | Codebase |
|---|---|
| `--bg-0/1/2/3` | `--theme-color-bg-0/1/2/3` |
| `--border-1` / `--border-2` | `--theme-color-border-default` / `--theme-color-border-strong` |
| `--fg-1/2/3` | `--theme-color-fg-highlight` / `-fg-default` / `-fg-muted` |
| `--accent` / `--accent-hover` / `--accent-fg` / `--accent-soft` | `--theme-color-primary` / `-primary-highlight` / `-on-primary` / `-primary-bg` |
| `--warning` / `--warning-bg` | `--theme-color-warning` / `-warning-bg` |
| `--error` | `--theme-color-danger` |
| `--success` | `--theme-color-success` |
| `--shadow-card` / `--shadow-pop` | `--shadow-sm` / `--shadow-popup` |
| radii 6–10px | `--radius-md` (6) / `--radius-lg` (8) |
| node categories | `--theme-color-node-category-{visual,data,logic,function,component}` |

## OWNERSHIP MAP — which file owns each chrome surface

Legend: **core-ui** = shared React primitive (`packages/noodl-core-ui/src`);
**editor-react** = React view in `packages/noodl-editor/src/editor/src`;
**legacy** = imperative `View` subclass + plain `.css`.

### 1. Toolbar (route pill, warnings, Deploy, zoom, mode toggle)
- DOM: `packages/noodl-editor/src/editor/src/views/EditorTopbar/EditorTopbar.tsx` (editor-react)
- CSS: `.../EditorTopbar/EditorTopbar.module.scss`
- Buttons are core-ui `IconButton` / `PrimaryButton` / `ToggleSwitch`. Deploy is
  already `PrimaryButton` (azure) — no change needed. Warnings counter was
  `FeedbackType.Danger` (RED — phase-law violation); fixed to `Notice` (amber) + chip.

### 2. Icon rail (panel switcher, Settings pinned)
- Rail primitive: `packages/noodl-core-ui/src/components/app/SideNavigation/SideNavigation.{tsx,module.scss}` (core-ui)
- Editor host: `packages/noodl-editor/src/editor/src/views/SidePanel/SidePanel.tsx`
- Active/hover state lives on core-ui **`IconButton`** (rail sets `IconButtonState.Active`).
  Restyled `IconButton.module.scss` transparent variant: active → accent-soft pill +
  accent icon; hover → bg-3 pill. This is the shared primitive, so the same fix gives the
  toolbar split-layout toggles a consistent active affordance. Tooltips already present
  (core-ui `Tooltip`).

### 3. Properties panel (node inspector)
- DOM (legacy shell + injected React fields):
  `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/propertyeditor.ts`
- Field renderers: `.../reactcomponents/propertyeditors.{jsx,css}`
- CSS (legacy plain): `.../editor/src/styles/propertyeditor/propertyeditor.css` + the
  `.sidebar-*` chrome in `packages/noodl-editor/src/assets/css/style.css`
- Restyled: section-title typography (uppercase 10.5/600/+7% tracking, fg-muted),
  section dividers → border-default, header name → 14.5 semibold, field-row label
  column 150px→62px left-aligned. **The 62px grid is the single change most needing a
  live multi-node-type pass** (see residuals).

### 4. Preview pane
- Ground + size tag: `packages/noodl-editor/src/editor/src/views/VisualCanvas/VisualCanvas.module.scss`
- Viewer itself is a separate Electron frame (`frames/viewer-frame/`) — NOT touched.
- Restyled `.ViewportInfo` size tag to muted mono per mock, and added a card
  box-shadow + radius to `.Webview` (box-shadow/radius never change layout box, so
  **sizing/fit math is untouched** — the spec's key risk). Checkerboard ground left as-is
  (it signals transparency; replacing it would lose that meaning).

### 5. Bottom bar / component tabs
- Component navigation is the breadcrumb trail (there is no classic bottom status bar):
  `packages/noodl-editor/src/editor/src/views/NodeGraphComponentTrail/NodeGraphComponentTrail.module.scss`
- Restyled `.Item.is-current` → accent-soft fill + accent label/icon (the "active tab =
  accent-soft" convention). **Status area OMITTED** — there is no honest persistent
  "preview live" signal here, and the phase rule is bind-a-real-signal-or-omit.

### 6. Popup layer / dialogs
- Legacy frame: `packages/noodl-editor/src/editor/src/styles/popuplayer.css` (already
  tokenized by UIX-002)
- React dialogs: `.../views/PopupLayer/ConfirmModal.tsx`, `.../views/DialogLayer/...`
- Fixed dialog button convention (primary right) in `.confirm-modal .confirm-buttons`
  and corrected on-primary text tokens; added popup-frame corner radius.

### 7. Panel splitters
- `packages/noodl-core-ui/src/components/layout/FrameDivider/FrameDivider.module.scss` (core-ui)
- Tokenized the raw `black`/`white` divider colors → border-default hairline with an
  accent hover affordance.

## OUT OF SCOPE — deliberately not touched
- Canvas node contents / wires / node cards (UIX-005).
- Control internals — checkbox/toggle/slider/box-model/chips (UIX-003).
- Launcher / `ProjectsPage.tsx` / `core-ui/src/preview/launcher` (UIX-006 — parallel agent).
- Icon glyph redraws (UIX-007) — only restyled states around existing glyphs.

## Documented scope decisions / deferrals
- **Properties header type-chip**: the mock shows a node-category type-chip in the panel
  header. Injecting it requires markup surgery in the legacy imperative header render
  path (`Ports.ts` / `propertyeditor.ts`), which cannot be safely validated without a
  live multi-node-type pass. Header typography was restyled; the category chip element is
  left as a live-verified follow-up rather than shipped blind. Flagged in the report.
- **Design/Preview control**: left as the existing toggle+labels (works, tokenized). The
  mock's segmented control is a UIX-003 control; rebuilding it here would be a behavior
  change, not a reskin.
