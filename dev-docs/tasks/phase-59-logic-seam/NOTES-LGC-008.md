# LGC-008 — build notes, 2026-08-12

Written by the lane that built F3, F4 and §1 on branch `lgc008-pane`, in build order. Anything
cross-cutting that other lanes need is here rather than in the task file.

## What is built

| Step | What | Held by |
|---|---|---|
| F3 | A canvas that cannot be measured is not measured as zero; a reveal and a splitter drag re-measure it **synchronously** | `tests-unit/lgc-008/canvas-remeasure.test.ts` (9) |
| F4 | An edit belongs to the tab that produced it, bound at the call site | `tests-unit/lgc-008/tab-workspaces.test.tsx` (6) |
| §1 | The pane: a second splitter, both surfaces on screen, no layer hidden, L27 closed | `tests-unit/lgc-008/logic-pane.test.ts` (11) |

Nothing was seen in an editor. Live verification is the primary checkout's, after merge.

## Three things in the task file that were wrong or incomplete about our code

1. **§7 says "there is no React test runner in reach", and concludes the no-remount property
   "cannot be gated here".** Half right. There is no *renderer* — no jsdom, no
   `@testing-library/react` — but a React **element tree is plain objects**, and key, type and
   sibling position are exactly what React remounts on. Lifting the tree into a pure builder
   (`buildTabWorkspaces`) put the largest decidable part of the property behind a spec. What
   still needs a drive is whether React and Blockly then behave as the tree implies.

2. **The task file has no entry for the fact that `Frame.onResize` is a `ResizeObserver`.** F3
   says nothing re-binds "on reveal", which is true, but the same sentence should have been said
   about *drags*: `useTrackBounds` is a `ResizeObserver`, and the registers already say an
   occluded Electron renderer fires zero of those. So the canvas's re-measure had the same defect
   `blocklyResize.ts` was written for, by the same mechanism, and the fix has the same shape —
   `remeasureNodeGraphCanvas(editor)` called synchronously from whatever moved the geometry.

3. **§5's canvas row asks for "an explicit `editor.resize(currentLayout)` on every reveal".**
   `currentLayout` is the *frame's* bounds (`Frame` passes them straight through), and in split
   mode the frame is wider than the canvas — feeding it back would centre nodes behind the other
   pane, because `centerOnNode` reads `currentLayout.width`. The re-measure passes the canvas's
   **own** measured size instead.

## Open, and the first one blocks shipping

- 🔴 **L30 keystroke ownership is now the live hazard.** `KeyboardHandler` has no scope and a
  focused Blockly `<svg>` reads as `'none'` under `getKeyboardFocusKind`, so Backspace, Delete,
  ⌘Z and ⌘C/⌘X/⌘V all reach the node graph. With one surface on screen that was survivable. With
  a node selected on one pane and a block selected on the other — which is now the normal
  arrangement — one Delete can mean two deletions. The 200 ms `lastBlocklyTabCloseTime` guard
  protects a tab *close* and does nothing here. **Not fixed, and not fixable inside this task:**
  it is a keyboard-scope change (commands registered by a surface run only while focus is inside
  that surface's pane) that the pane forces rather than contains.
- ⚠️ **Two zoom clusters.** Blockly draws its own controls and trashcan bottom-right of its
  workspace; the canvas HUD draws the editor's bottom-right of the canvas pane. Adjacent
  rectangles, same corner, different surfaces. §5 calls this Richard's design call. Left as is —
  patching it would be answering a question nobody asked yet.
- ⚠️ **The split is not persisted.** It survives closing and reopening the pane within a session
  (the custom property stays on the shell root), but not a restart. The outer divider persists
  through `EditorSettings.frameDividerSize`; this one could take the same route. Deliberately not
  done: it is a settings key and a migration question, and the pane has not been driven yet.
- ⚠️ **`documentLayout: 'detachedPreview'`.** F1 notes the takeover only really took over in that
  layout. The pane works there identically — it splits the node graph frame, which in that layout
  is the whole document — but it has not been driven, and it is the configuration where the
  canvas pane is widest and the argument for the split is weakest.

## For whoever drives it

Run the task file's *Deferred verification* in order. Two things to watch that the specs cannot
see:

1. **The DOM layer's wrapper changed shape.** It was `position: relative` with zero height; it is
   now a full-size clipping wrapper like every other layer. It carries `pointer-events: none`
   with `auto` restored on `#nodegraph-dom-layer` itself, because otherwise a full-size box above
   the canvas in document order would swallow every canvas mouse event. **If clicking the canvas
   stops working, that is the line.**
2. **The canvas and the tabs root are sized by the stylesheet now**, not by inline styles. If
   either renders at zero size, look for a stylesheet that is not loaded rather than for a
   JavaScript bug.
