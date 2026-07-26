# UIX-003 Notes — Control Kit

Executor: Opus 4.8, worktree off `cline-dev` (fast-forwarded from a stale base — the
worktree branched 376 commits behind; verify base before trusting a UIX worktree).

## Token mapping (mock local names → canonical codebase tokens)

The mocks use short local names; core-ui uses `--theme-color-*` (UIX-001). Mapping used:

| Mock | Codebase |
|---|---|
| `--bg-0/1/2/3` | `--theme-color-bg-0/1/2/3` |
| `--border-1` / `--border-2` | `--theme-color-border-default` / `--theme-color-border-strong` |
| `--fg-1/2/3` | `--theme-color-fg-highlight` / `-fg-default` / `-fg-muted` |
| `--accent` / `--accent-hover` / `--accent-fg` / `--accent-soft` | `--theme-color-primary` / `-primary-highlight` / `-on-primary` / `-primary-bg` |
| `--error` / `--error-bg` | `--theme-color-danger` / `-danger-bg` |
| `--warning` / `--warning-bg` | `--theme-color-warning` / `-warning-bg` |
| `--success` | `--theme-color-success` (+ `-success-bg`) |
| focus ring | `--theme-color-focus-ring` |
| `--shadow-card` / `--shadow-pop` / `--shadow-toast` | `--shadow-sm` / `--shadow-popup` (no separate toast token — reused `--shadow-popup`) |

Radii: `--radius-sm/default/md/lg/full`. Motion: `--speed-turbo`, `--easing-base`; every
transition is wrapped by a `prefers-reduced-motion: reduce` off-switch.

## Control inventory + which render path each restyle went through

Two parallel control systems exist. The **live properties panel uses the legacy
`propertyeditor/` path for the box-model editor** but core-ui `property-panel/*` and
`inputs/*` components elsewhere.

| Control | Component restyled | Render path |
|---|---|---|
| Checkbox (general) | `inputs/Checkbox` | core-ui |
| Checkbox (panel) | `property-panel/PropertyPanelCheckbox` | core-ui |
| Toggle switch | `inputs/ToggleSwitch` | core-ui |
| Text/number input | `inputs/TextInput` (fixed red focus glow → accent) + `property-panel/PropertyPanelBaseInput` (already token-clean) | core-ui |
| Slider | `property-panel/PropertyPanelSliderInput` | core-ui |
| Segmented (icon) | `property-panel/PropertyPanelIconRadioInput` | core-ui |
| Box-model editor | `propertyeditor/components/MarginPaddingInput.tsx` + `assets/css/style.css` (`.marginpadding-*`) | **legacy (noodl-editor)** — this is what actually renders; the core-ui `PropertyPanelMarginPadding` is NOT wired live (lightly aligned for its story) |
| Chip (NEW) | `common/Chip` | core-ui (new) |
| Binding chip (NEW) | `property-panel/BindingChip` + wired into `PropertyPanelInput` | core-ui (new) |
| Toast | `ToastLayer` + `ToastCard` | noodl-editor |

## Box-model editor — property write-path wired to (NEEDS LIVE UNDO/RELOAD CHECK)

The box-model editor's data bridge is `propertyeditor/DataTypes/MarginPaddingType.ts` →
`NodeGraphNode`. I only restyled the presentation (`MarginPaddingInput.tsx` markup + the
`.marginpadding-*` CSS in `assets/css/style.css`); the read/write path is UNCHANGED:

- READ: `this.parent.model.parameters[p.name]` (bare number wrapped as `{value, unit}`).
- WRITE: `this.parent.model.setParameter(this.ports[comp].name, value, undoArgs)` where
  `value = {value:number, unit:string} | undefined` (undefined = reset to default).
- Param keys: `marginLeft/Right/Top/Bottom`, `paddingLeft/Right/Top/Bottom`.
- Undo: `setParameter(..., {undo:true, label:'margin or padding changed', oldValue})`; drag
  frames write with `{drag:true}` (no undo entry) then re-commit once on mouseup.
- Linked values: **NOT implemented** in the old editor — left as-is (per-side), per spec
  "match existing behavior, don't invent."

Presentation changes: removed the `"- px"` wireframe (undefined now reads muted `0`, only a
non-px unit is surfaced inline); added an outer dashed `Margin` ring + inner `Padding` box
with MARGIN/PADDING tags; labels are mono, muted, accent border on hover. **Live check
needed:** set a margin/padding, confirm it round-trips, undo returns the prior value, drag
produces one undo entry, and the preview live-updates. Also eyeball the 8 label positions —
I nudged nothing in `LABEL_POSITIONS`, but added two absolute `Padding`/`Margin` tags that
could overlap a label at narrow panel widths.

## Toast — call sites migrated + old banner

There is only ONE toast system: `ToastLayer` (react-hot-toast) → `ToastCard`. There is no
separate "old banner" component to delete; the fixed red slab WAS `ToastCard` in its old
form, so it was replaced in place:

- `ToastCard` rewritten to the mock: severity icon-chip (danger/warning/success/info),
  title + body (body supports `<code>`), optional action buttons, close ×.
- `ToastLayer.showError` is now **sticky (Infinity) but always dismissable** (renders a
  working close ×) — this migrates ALL ~150 `showError` call sites at once, since they all
  route through this one API (signature kept backward compatible: `showError(msg, durationOrOptions?)`).
  Added `showWarning`, `showInfo`; `showSuccess`/`showInfo`/`showWarning` auto-dismiss (6s),
  errors stay. New optional `{title, actions, duration, id}` options; a quiet "Dismiss"
  action is auto-appended when custom actions are supplied.
- Representative richer migration (matches the launcher mock): the two "Could not load
  project" load-failure sites in `ProjectsPage.tsx` now pass a `title` + explanatory body.
- Removed the container's heavy `drop-shadow` filter (the card carries its own border +
  `--shadow-popup`).

Because the system is unified, the "delete the old banner so stragglers fail loudly" step is
N/A — there are no stragglers on a second system. `ToastType.Neutral/Danger/Success/Pending`
are preserved so `useActivityQueue.ts` (the only external `ToastType` consumer) is unaffected.

## Binding chip

`BindingChip` (accent-soft, mono source, chain icon) is wired into `PropertyPanelInput`:
when `isConnected` and not a button/checkbox, the input is replaced by the chip. Added
`connectionLabel` + `onConnectionClick` props so the editor can name the source and
(optionally) navigate. **Residual:** the legacy `propertyeditor` connected-state does not
yet pass a source label into this path — feeding the real connection source string (e.g.
"CallCF · Result") into `connectionLabel` is editor-side wiring left for a live pass.

## Gallery / review surface

Storybook (v8) is already set up in `noodl-core-ui`. Added stories (no new tooling):
- `common/Chip/Chip.stories.tsx` (all variants)
- `property-panel/BindingChip/BindingChip.stories.tsx`
- `preview/control-kit/ControlKit.stories.tsx` — a single **UIX-003/Control Kit** gallery
  showing checkbox/toggle/slider/chip/binding-chip/box-model states together.
The `ToastCard` lives in noodl-editor (outside the core-ui stories glob) so it has no story;
verify it via the live editor.

## Verification done

- `tsc --noEmit` on both `noodl-core-ui` and `noodl-editor`: **0 errors in touched files**
  (remaining errors are pre-existing `Cannot find module @noodl-versioning/@noodl-store/…`
  from unbuilt workspace deps — not introduced here).
- SCSS uses only defined tokens.
- NOT run: live Electron editor (worktree lerna-exec targets the main checkout — unreliable);
  Storybook build. Orchestrator runs live screenshots post-merge.
