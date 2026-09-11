# Archived — LGC-008's split pane

**Parked 2026-08-13, superseded by LGC-010 (the floating block-editor window). Kept at Richard's
request, not because it was wrong.**

The files here are the working, driven implementation of a **second splitter inside the node
graph frame**: canvas left, Blockly right, one CSS custom property holding the split, both
surfaces explicitly re-measured on every `mousemove` of a drag. They carry a `.txt` suffix so
that `tsc`, jest and webpack do not pick them up.

| File | Was |
|---|---|
| `LogicPane.ts.txt` | `views/nodegrapheditor/LogicPane.ts` — open/close, drag, both re-measures |
| `logicPaneSplit.ts.txt` | `views/nodegrapheditor/logicPaneSplit.ts` — the clamp arithmetic |
| `PaneSplitter.tsx.txt` | `views/CanvasTabs/PaneSplitter.tsx` — the `mousemove` contract |
| `logic-pane.test.ts.txt` | `tests-unit/lgc-008/logic-pane.test.ts` — 14 specs over the above |

The split CSS it needed lived at the end of `src/editor/src/styles/nodegrapheditor.css` under a
`LGC-008 — split mode` banner, and is in this repo's history at the commit that replaced it.

## Why it was replaced

Not by argument — by use. On a 13" MacBook, with the default `horizontal` document layout, the
app preview already owns half the document; splitting what is left again gives the block editor a
column narrower than its own furniture. The two interface rails are **152 px each** and Blockly's
toolbox is ~90 px before a single block is visible, so 394 px is spent before anything is shown.
The pane's own drive measured `.injectionDiv` at **0 px** with the pane at 288 px, and filed
"no minimum width" as an open finding. A clamp does not fix that: a surface whose minimum usable
width is most of a small laptop's screen cannot be a column beside another column.

⚠️ This reverses **ruling 1 of 2026-08-12** ("both panes on screen at once; the second splitter
gets built"). The reversal is deliberate and Richard made it on 2026-08-13 after using the pane.
Do not re-litigate it back on the strength of the earlier ruling — the earlier ruling was made
before anyone had used the thing.

## What was kept rather than parked, and why it is worth knowing

The pane was not a detour. Four things it built are load-bearing in the overlay and stayed:

- **F4 — an edit belongs to the tab that made it** (`tabWorkspaces.tsx`). `handleWorkspaceChange`
  used to write to the *render's* `activeTab`, which is only safe while exactly one workspace is
  mounted. The overlay mounts every open tab too, so this fix is as necessary as it ever was.
- **The blanket `display: none` on eight canvas layers is gone**, with a stated behaviour per
  layer. The overlay keeps all eight visible for the same reason the pane did.
- **L27 — the highlight overlay's `z-index: 7`.** Its wrapper was the only one without one, so
  999/1000/1001 escaped to the body-level stacking context.
- **`resizeBlocklyWorkspaces()` / `remeasureNodeGraphCanvas()`.** Blockly re-measures on a
  `window` resize only, and the node graph canvas was re-measured only by a `ResizeObserver` that
  an occluded Electron renderer never fires. Both are still called — Blockly's from the window's
  own drag, the canvas's from the outer preview/graph divider, where it was always a real defect.

## When you would want this back

A **multiple node-canvas** layout — two graphs side by side, or a graph beside a component bench —
is the case this code was actually the right shape for: two peers of comparable minimum width,
neither floating over the other. If that is what you are building, start here rather than from
scratch; the arithmetic, the clamp-collapses-to-the-middle behaviour and the synchronous
re-measure ordering are all already right and all already specced.
