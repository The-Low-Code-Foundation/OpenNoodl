# FH-005 — The JSON/code popout opens with its top at the button's Y

Covers reported item **4**. Same defect as phase-40's AAQ-011 row **F2** (logged, open, unowned —
this doc supersedes it; nothing in phase 40 actually fixed it).

## What was reported

> When you click a button in the left node props panel to open up an editor, like the JSON editor
> or the code editor, the top edge of the editor is fixed at the Y position of the button you
> clicked … rather than responsively opening above the button Y position.

## The mechanism — two stacked causes, and the primary one is a measurement race

All popouts go through `PopupLayer.showPopout` → `_positionPopout`
([popuplayer.ts:701-831](../../../packages/noodl-editor/src/editor/src/views/popuplayer.ts#L701-L831)).

**(a) Primary — the popout is positioned against a 0×0 content box.** `showPopout` measures
immediately (`:810-811`), but the code editor (`CodeEditorType.ts:206-223`) and the JSON/list
editor (`ListValueEditor.tsx:142-151`) render their content with React-18 `createRoot().render()`
— asynchronous — **without `flushSync`**. With `contentHeight === 0`, `y = anchor.top + h/2 - 0/2`
= the button's Y, and every viewport clamp at `:745-748` is a no-op against height 0. Both editors
also pass `disableDynamicPositioning: true` (`CodeEditorType.ts:230`, `ListValueEditor.tsx:157`),
so the ResizeObserver that would re-position after the commit is switched off — the box just grows
downward from a never-re-evaluated top edge.

The codebase already knows this failure mode: `TextStylePicker.jsx:46-47` wraps its render in
`flushSync` with the comment *"Synchronous so showPopout can measure real content (DEBT-010)"* —
as do `Pages.tsx:249`, `ComponentTemplates.ts:238`, `StringInputPopup.tsx:204`,
`propertyeditors.jsx:175`. These two editors are the ones that were missed.

**(b) Secondary — `_positionPopout` has no flip logic at all.** Only clamps; the only flip in the
file is the tooltip's (`:1142-1147`). With (a) fixed, the clamp keeps the editor on screen, but a
`position: 'bottom'` anchor near the window floor still deserves a real flip.

## What to build

1. `flushSync` around the two `root.render` calls (match the DEBT-010 pattern verbatim).
2. Remove `disableDynamicPositioning: true` from both, or keep it and rely on (1) — decide by
   testing whether CodeMirror's own late layout shifts the measured height; if it does, dynamic
   positioning stays on.
3. Add flip-to-fit to `_positionPopout`: if the chosen side would clamp by more than N px, prefer
   the opposite side; clamp remains as the last resort. This fixes every popout, not just these
   two.

## Criteria

1. Scroll the props panel so the JSON-editor button is at the bottom of the window → the editor
   opens fully visible (above or clamped), never below the fold.
2. Same for the code editor's popout, and for the custom-CSS row F2 named.
3. Popouts opened from the top of the panel are unchanged.
4. Verified in the running editor at a small window size — jasmine can't measure layout.

## Traps

- `outerSize` (`popuplayer.ts:693-698`) measures the DOM node — any fix that "works" by hardcoding
  a height will lie the moment the editor's persisted size (`localStorage
  codeeditor_size_percentage`) differs.
- The popup layer is legacy code shared by everything; verify a couple of unrelated popouts
  (TextStylePicker, component templates) after touching `_positionPopout`.
