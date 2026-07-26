# UIX-003: Control Kit — Forms, Toasts, Chips, Box-Model Editor

## Metadata

| Field | Value |
|-------|-------|
| **ID** | UIX-003 |
| **Phase** | Phase 23 — Visual Refresh (Track I) |
| **Tier** | 2 — surfaces |
| **Priority** | 🟠 High ("does this look maintained" is decided by controls) |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 1–1.5 weeks |
| **Prerequisites** | UIX-001 (tokens) |
| **Branch** | `task/uix-003-control-kit` |
| **Recommended executor** | 🟠 **Opus 4.8** — component engineering against a fixed visual target, with one new component (box-model editor) needing property-model integration care. |

## Objective

Bring every interactive control in core-ui up to the mock standard — visible checkboxes/toggles, consistent inputs/selects/sliders, segmented controls, severity-aware chips, a dismissable toast system — and build the one net-new component: the box-model margin/padding editor.

## Background

The critique's most damning finding wasn't the palette — it was that controls look unfinished: checkboxes render as empty dark squares invisible against the panel, the margin/padding editor shows literal `- px` wireframe placeholders, input heights and dropdown styles vary between panels, and the error toast is an undismissable red slab. Users read this as "abandoned" in seconds, independent of theme. Nearly all of these controls live in core-ui components already consuming tokens, so this is restyling + a few behavioral upgrades, not new architecture. The editor mock ([mocks/nodegx-editor-mock.html](./mocks/nodegx-editor-mock.html)) is the visual contract: its properties panel shows the target checkbox/toggle, segmented control, select, slider, box-model editor, and binding chip; the launcher mock shows the target toast.

## Current State

- core-ui has the component inventory (121 `.scss` modules) — inputs, selects, checkboxes, sliders, dialogs — styled to the old flat-dark look, several with near-invisible states.
- Margin/padding editing in the properties panel renders placeholder `- px` boxes.
- Toast/error surfaces: persistent red banner bottom-right, no dismiss, no action, same visual weight as a CTA.
- Multiple ad-hoc chip/badge styles across panels.
- Focus states inconsistent; keyboard focus sometimes invisible.

## Desired State

Per the mocks, one control kit where every control has: default / hover / active / focused / disabled states, AA contrast in all of them, token-only colors, `prefers-reduced-motion`-respecting transitions, and a visible `:focus-visible` ring (UIX-001's focus token).

Specific components (names = whatever core-ui already calls them; extend, don't fork):
- **Checkbox / Toggle-switch:** the mock's 32×19 switch with accent-filled on-state; checkbox with visible border-2 box + accent check. No more invisible squares.
- **Text input / number input:** bg-2 fill, border-1 → border-2 on hover, accent ring on focus; mono face + centered text for numeric; unit suffixes as muted mono.
- **Select / dropdown:** consistent height with inputs, chevron affordance, popover panel on bg-1 with shadow-pop token.
- **Segmented control:** container bg-2 + inset active segment (bg-1 + shadow-card for text segments; accent-soft + accent icon for icon segments), used by Design/Preview and the alignment rows.
- **Slider:** 4px track, accent fill, bordered knob (mock style).
- **Chips:** one component, variants `neutral` / `warning` / `danger` / `accent` (soft-bg + strong-fg pattern) — replaces ad-hoc badges; the React-17 legacy-runtime warning and "Local only" markers are the reference uses.
- **Toast system:** severity icon-chip (danger/warning/success/info), title + body, optional action button + quiet dismiss, close ×, stacking, auto-dismiss for success/info but **sticky for errors until dismissed**; body supports `code` spans. Replaces the fixed red banner everywhere it's used (grep for the "Could not load project"-style surfaces).
- **Box-model editor (NEW):** the mock's nested margin/padding widget — outer dashed margin ring with 4 numeric inputs, inner padding box with 4, mono values, muted zeros, labels MARGIN/PADDING; wired to the same property-model paths the current `- px` editor writes; supports linked-values entry if the current editor does (match existing behavior, don't invent).
- **Binding chip:** the "Bound to `CallCF · Result`" affordance — when a property's value comes from a connection, the panel shows an accent-soft chip naming the source instead of a disabled empty input. Read-only this task (clicking-to-navigate is a nice-to-have, note if cheap).

Also: a gallery/storybook surface. If core-ui has any component playground, add the kit's states there; if not, a simple dev-only HTML page or spec-rendered snapshot per component is enough for review. (Check what exists first — do not build a Storybook install just for this.)

## Scope

### In Scope
- [ ] Restyle: checkbox, toggle, text/number input, select, segmented control, slider, chips, buttons (primary/secondary/ghost/danger variants per UIX-001 semantics)
- [ ] Toast system with severity + dismiss + action; migrate existing error-banner call sites
- [ ] Box-model margin/padding editor replacing the placeholder widget, wired to the property model
- [ ] Binding chip for connection-driven properties
- [ ] All states (hover/focus/disabled) + `:focus-visible` + reduced-motion
- [ ] Component gallery or equivalent review surface
- [ ] Live-verify each control in the real properties panel (run-editor)

### Out of Scope
- Panel *layout* / section restructure (UIX-004)
- Launcher-specific components — cards, search bar (UIX-006), though they consume this kit
- Canvas-drawn UI (UIX-005)
- New property *types* or property-model changes beyond wiring the box-model editor
- Icon redraws (UIX-007) — consume existing icons, swap later

## Implementation Steps

1. Inventory pass: enumerate core-ui's actual control components + every place the properties panel renders margin/padding and error banners; write the mapping in NOTES.md.
2. Restyle the primitive controls (checkbox → slider), gallery as you go.
3. Chips + buttons variant consolidation (grep ad-hoc badge styles; replace).
4. Toast system + call-site migration.
5. Box-model editor: build against the mock, wire to property model, verify undo/live-preview behave like the old editor did.
6. Binding chip.
7. Full live pass in the editor: select nodes of several types, exercise every control, screenshots.

## Success Criteria

- [ ] Every control in the properties panel is visibly interactive and state-legible in screenshots (no invisible checkboxes, no `- px` placeholders anywhere)
- [ ] Error toast is dismissable, actionable, and red is confined to it and danger buttons
- [ ] Margin/padding edits through the new box-model editor round-trip correctly (set, undo, reload) and live-update the preview
- [ ] Connection-driven properties show the binding chip instead of a dead input
- [ ] Keyboard: tab order reaches every control with a visible focus ring
- [ ] Gallery/review surface exists showing all states

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| The properties panel renders controls through legacy non-core-ui paths (old `propertyeditor/` styles) | Inventory step finds this first; restyle through whichever path actually renders — don't assume core-ui coverage |
| Box-model editor breaks margin/padding semantics (units, linked values, per-side) | Match current editor's data behavior exactly; property write-path tests + manual undo/reload check in scope |
| Toast migration misses a call site and two systems coexist | Grep-driven call-site list in NOTES.md; old banner component deleted at the end, so stragglers fail loudly at build |
| Restyle collides with UIX-002's file edits | Territory rule: UIX-002 never edits files this spec claims (core-ui component modules it restyles); coordinate in PROGRESS.md |

## References

- [mocks/nodegx-editor-mock.html](./mocks/nodegx-editor-mock.html) — properties panel = the contract
- [mocks/nodegx-launcher-mock.html](./mocks/nodegx-launcher-mock.html) — toast target
- [UIX-001](./UIX-001-DESIGN-TOKENS-FOUNDATION.md) — tokens + button semantics
- core-ui component tree (`packages/noodl-core-ui/src/components/`)

## Checklist

- [ ] Inventory in NOTES.md
- [ ] Primitives restyled with full states
- [ ] Chips/buttons consolidated; toast system live, old banner deleted
- [ ] Box-model editor shipped + round-trip verified
- [ ] Binding chip
- [ ] Gallery; live pass; CHANGELOG
