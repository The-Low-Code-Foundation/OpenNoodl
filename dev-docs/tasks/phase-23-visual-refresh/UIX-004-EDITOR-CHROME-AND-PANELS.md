# UIX-004: Editor Chrome & Panels

## Metadata

| Field | Value |
|-------|-------|
| **ID** | UIX-004 |
| **Phase** | Phase 23 — Visual Refresh (Track I) |
| **Tier** | 2 — surfaces |
| **Priority** | 🟠 High |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | ~1 week |
| **Prerequisites** | UIX-001; UIX-003 (consumes its controls; can start on chrome while 003 finishes) |
| **Branch** | `task/uix-004-editor-chrome` |
| **Recommended executor** | 🟠 **Opus 4.8** |

## Objective

Restyle the editor's frame to the mock: unified toolbar with the route pill and azure Deploy, an icon rail with a real active state, restructured properties-panel typography and sections, a framed preview pane, component tabs in the bottom bar, and amber (not red) warnings — same layout, new skin.

## Background

The editor's chrome is where the elevation and hierarchy failures compound: toolbar, rail, panels, and canvas are indistinguishable near-blacks; the rail has no visible active state; panel section headers barely separate from body text; the white preview slams against black chrome; and the warnings counter and Deploy button are both red, so the most important action and the "something's wrong" signal look identical. The mock keeps today's layout *exactly* (per the phase's reskin-not-redesign rule) and fixes only presentation. All of this is DOM/CSS on token-consuming stylesheets — no canvas work.

## Current State

- Toolbar: dark strip; red Deploy; red warning triangle counter; route/home control in old style.
- Icon rail: low-contrast gray icons, no active-state affordance, no labels/tooltips consistency.
- Properties panel: cramped all-caps gray section headers, uneven field rows, mixed control heights (UIX-003 fixes controls; this task fixes the panel structure around them).
- Preview pane: raw white iframe against near-black canvas; size/zoom indicators scattered.
- Bottom: component navigation in old tab style; no status affordance.
- Popup layer / dialogs styled by legacy `popuplayer.css` (tokenized by UIX-002; restyled here if still visually stale).

## Desired State

Per [mocks/nodegx-editor-mock.html](./mocks/nodegx-editor-mock.html):
- **Toolbar** (bg-1, border-b border-1): add-node button as accent-soft icon button; back/forward; **route pill** (bg-2 bordered: home icon, project name in semibold, path in mono, chevron); debug icon button; **warnings chip** in warning-soft/amber with count — clicking behavior unchanged; right side: zoom control, panel-layout toggles, Design/Preview segmented control (UIX-003), **Deploy = primary azure button** with icon.
- **Icon rail** (bg-1, border-r): 34px icon buttons, fg-3 default → fg-1 hover with bg-3 pill, **accent-soft pill + accent icon for the active panel**; settings pinned at bottom; tooltips on hover (existing tooltip component).
- **Properties panel**: header block = node name (14.5 semibold) + **category type-chip** (node-category color at soft opacity — consumes UIX-001's node tokens) + docs/delete icon buttons; sections separated by border-1 with 10.5px/600/+7% letter-spacing uppercase fg-3 titles; consistent field-row grid (62px label column); UIX-003 controls inside.
- **Preview pane**: preview surface sits on bg-0 ground as a **framed device card** (rounded 10, border-1, shadow-card) rather than edge-to-edge white; size/zoom tag top-right in muted mono. Verify this is presentation-only around the existing preview webview — the webview itself and its sizing logic must not change semantics (canvas-fit modes still work).
- **Bottom bar**: component tabs as pills (active = accent-soft), new-component +, right side status area (e.g. "Preview live" with success dot — bind to whatever real signal exists; if none cleanly exists, omit rather than fake).
- **Dialogs/popups**: bg-1 + shadow-pop + consistent header/footer button placement (primary right, using UIX-001 semantics). Restyle the popup layer frame; individual popup contents beyond buttons/headers can ride to UIX-009.
- Panel splitters/resize handles: hairline border-1 with hover affordance.

## Scope

### In Scope
- [ ] Toolbar restyle incl. route pill, warnings→amber, Deploy→azure
- [ ] Icon rail active/hover states + tooltips
- [ ] Properties panel structure: header + type-chip, section rhythm, field-row grid
- [ ] Preview device-card framing (presentation only)
- [ ] Bottom bar component tabs + honest status area
- [ ] Popup layer frame + dialog button conventions
- [ ] Panel splitter styling
- [ ] Live-verify the full editor loop: open project, navigate components, select nodes, toggle Design/Preview, open a dialog (run-editor)

### Out of Scope
- Canvas contents (UIX-005) — the graph will still look old inside the new chrome until 005 lands
- Control internals (UIX-003)
- Launcher (UIX-006)
- Icon glyph redraws (UIX-007) — restyle states around existing glyphs
- Moving/removing/adding any panel or feature; keyboard shortcuts; layout persistence

## Implementation Steps

1. Map the chrome's actual component/stylesheet ownership (which parts are core-ui vs. legacy views) in NOTES.md.
2. Toolbar + rail (one PR-sized slice; live-verify).
3. Properties panel structure (against several node types — visual node, data node, one with many sections — not just Text).
4. Preview framing + bottom bar.
5. Popup layer + dialogs.
6. Full live pass + screenshots (these become UIX-009 corpus entries).

## Success Criteria

- [ ] Side-by-side screenshot vs. mock: toolbar, rail, panel, preview framing, bottom bar all read as the same design (pixel-perfection not required; hierarchy and tokens are)
- [ ] Active rail item identifiable in a screenshot by someone who's never used the app
- [ ] No red anywhere in default chrome; warnings amber; Deploy azure
- [ ] Properties panel legible for at least 5 different node types without layout breakage
- [ ] Preview modes/resizing still function identically
- [ ] Dialogs share one button-placement convention

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Preview framing breaks viewport-size math (canvas-fit, zoom-to-fit) | Frame is padding/border around the existing mount point; verify all preview size modes before/after |
| Properties panel structure assumes Text-node shape and breaks on complex nodes | Slice 3 explicitly tests diverse node types incl. dynamic-port nodes |
| Chrome components turn out to be legacy jQuery-era views | PLAT-002 already retired jQuery; if a view is still pre-React legacy, restyle its CSS in place — do not port views in this task |
| Status area shows a fake signal | Bind to a real event or omit — phase rule: no dishonest UI |

## References

- [mocks/nodegx-editor-mock.html](./mocks/nodegx-editor-mock.html)
- [UIX-003](./UIX-003-CONTROL-KIT.md) — the controls this chrome hosts
- [PLAT-001](../phase-14-editor-platform-health/) — canvas/coordinator boundaries (what is DOM vs painted)

## Checklist

- [ ] Ownership map in NOTES.md
- [ ] Toolbar + rail; properties structure; preview frame; bottom bar; popups
- [ ] Multi-node-type panel verification
- [ ] Live pass + screenshots; CHANGELOG
