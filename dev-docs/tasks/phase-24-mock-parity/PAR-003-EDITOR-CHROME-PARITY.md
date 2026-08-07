# PAR-003: Editor Chrome Parity

**Spec:** [nodegx-editor-mock.html](../phase-23-visual-refresh/mocks/nodegx-editor-mock.html) — toolbar, rail, canvas overlays, bottom bar. UIX-004 tokenized these surfaces; this task adopts the mock's structure and density.

## Ownership (from UIX-004 notes)

- Toolbar: `packages/noodl-editor/src/editor/src/views/EditorTopbar/EditorTopbar.{tsx,module.scss}`
- Rail: core-ui `SideNavigation` + `IconButton`; editor host `views/SidePanel/SidePanel.tsx`
- Preview ground/size tag: `views/VisualCanvas/VisualCanvas.module.scss`
- Component tabs: `views/NodeGraphComponentTrail/*`
- Canvas overlays (AI pill, zoom cluster) mount over the node-graph canvas area — find the canvas host view; overlays are DOM, not painter work.

## Normative details (from mock CSS)

**Toolbar** (52px, bg-1, border-b, padding 0 16px, gap 8px):
- Icon buttons 30×30 radius 7, fg-2, hover bg-3/fg-1; add-node button = accent-soft bg + accent icon.
- Back/forward 15px chevrons.
- **Route pill**: bg-2, border-1, radius 8, padding 6px 12px, min-width 300px, gap 8: home glyph 14px, project name 600 fg-1, path mono 12px fg-2, chevron pushed right. (UIX-004 shipped a version — verify against these exact values.)
- Debug icon button; **warnings chip**: warning-bg/warning, radius 7, padding 5px 9px, 12px/600, 12px triangle glyph.
- Right: zoom dropdown (13px/500 fg-2, chevron, hover bg-3), split/rows layout toggles (15px glyphs), **Design/Preview segmented control** replacing the toggle-switch: container bg-2 border-1 radius 8 padding 2px gap 2px; buttons radius 6 padding 5px 13px 12.5px/500 fg-3; active = bg-1 + fg-1 + shadow-sm. Same two states, same handler — presentation swap only.
- **Deploy**: primary azure, 13px/600, padding 7px 14px, radius 7, with the 13px rocket glyph from the mock.

**Icon rail** (52px wide, bg-1, border-r, padding 10px 0, gap 4px):
- Buttons 34×34, glyphs 17px stroke-1.5, fg-3; hover bg-3 pill + fg-1; active = accent-soft pill + accent glyph (UIX-004 shipped this — verify sizes: current IconSize enum may render larger than 17px; match the mock).
- Keep ALL existing panels (real rail has more entries than the mock's six — apply the treatment, don't remove panels). Settings pinned bottom via flex spacer.

**Preview pane**: device card (bg white, radius 10, border-1, shadow-sm) on bg-0 ground — shipped in UIX-004; verify. Size tag top-right mono 10.5px fg-3 (`1280 × 800 · 100%`).

**Canvas overlays** (over the dot-grid graph area):
- **AI pill** bottom-left (left 16 / bottom 14): bg-1, border-1, radius 99px, padding 8px 14px, shadow-popup, 12.5px fg-3, accent 14px spark glyph, `Ask AI…` + `⌘J` kbd chip (mono 10px, bg-3, border-1, radius 4). **Bind to the real AI entry point** (AIX-002 authoring loop UI) and register ⌘J if free. If no invokable AI surface exists in this build, omit the pill and flag it in NOTES — no dead UI.
  > ⚠️ **Wording superseded 2026-07-28.** The mock, and this spec as originally
  > written, said `Ask NodeGX AI…`. Richard's call: it now reads **`Ask AI…`**.
  > Same reasoning that renamed the retired canvas palette — AIX-001 made the
  > client provider-agnostic, and the panel names the configured provider itself,
  > so naming the product here claims a first-party service that does not exist.
  > The mock HTML and the 2026-07-26 PROGRESS entry still say the old string;
  > both are historical records and are deliberately left as-is.
- **Zoom cluster** bottom-right (right 14 / bottom 14): bg-1, border-1, radius 8, shadow-sm, joined buttons padding 6px 10px (−, mono 11px %, +, fit-view 13px glyphs), hover bg-3. Bind to the real canvas zoom API (the painter exposes zoom; UIX-005 QA drove 25/50/200%). Fit-view binds to the existing zoom-to-fit if present, else omit that button.

**Bottom bar** (38px, bg-1, border-t, gap 6, padding 0 12px):
- Component tabs as pills: 12.5px/500 fg-3, radius 6, padding 5px 12px, hover bg-3/fg-1; **current = accent-soft + accent + 600**, with an 11px component glyph on the current tab. This restyles the existing component-trail/tab mechanism — navigation behavior unchanged. `+` new-component button (padding 5px 8px) bound to the existing new-component action.
- Right: `Preview live` status — 7px success dot + 11.5px fg-3 — **bound to the real viewer-connection signal** (ViewerConnection client connect/disconnect; WF-007 made client tracking first-class). Show only while a preview client is connected; omit entirely if no clean signal is reachable (phase rule: bind or omit).

## Constraints

- No behavior/feature changes anywhere — presentation swap over existing handlers.
- Hex ratchet holds; both themes; AA contrast on toolbar chips.
- Don't touch propertyeditor files (PAR-002's territory) or launcher files (PAR-001's).

## Checklist

- [ ] Toolbar per mock incl. segmented Design/Preview + rocket Deploy
- [ ] Rail sizing/active treatment per mock, all panels kept
- [ ] Size tag + device card verified
- [ ] AI pill bound to real AI entry (or documented omission)
- [ ] Zoom cluster bound to real zoom API
- [ ] Bottom-bar pill tabs + honest Preview-live signal
- [ ] Ratchet + typecheck green, both themes
