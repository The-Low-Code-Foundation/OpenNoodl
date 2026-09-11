# LGC-010 — a window, not a pane

**Status:** ✅ **BUILT AND DRIVEN 2026-08-13.** Every claim below was measured in a running editor,
not inferred. Supersedes [LGC-008](LGC-008-A-PANE-NOT-A-TAKEOVER.md), whose implementation is
archived at [`dev-docs/archive/lgc-008-split-pane/`](../../archive/lgc-008-split-pane/).

> ⚠️ **This reverses ruling 1 of 2026-08-12** ("both panes on screen at once; the second splitter
> gets built"). Richard made the reversal on **2026-08-13**, after using the pane on a 13" MacBook.
> Do not re-litigate it back on the strength of the earlier ruling — the earlier ruling was made
> before anyone had used the thing, and the drive that "passed" it never measured the pane at a
> realistic width beside a preview.

## Why the pane lost

Not by argument. The pane met every acceptance criterion LGC-008 set for it, and it is still
unusable on the machine the product is built on:

| | |
|---|---|
| 13" editor window | 1368 px |
| node-graph frame under the default `horizontal` layout | 988 px |
| the pane's half of that | ~494 px |
| the two interface rails, which are not optional | **304 px** |
| Blockly's toolbox, before one block is visible | ~90 px |
| **what was left for blocks** | **~100–190 px** |

LGC-008's own drive filed this as an open finding — *"the pane has no minimum width; at 288 px
the rails are 304 and `.injectionDiv` measures **0 px**"* — and left the remedy to a later
decision, offering a clamp. A clamp cannot fix it. **A surface whose minimum usable width is most
of a small laptop's screen cannot be a column beside another column.** The number that decides
this is 304, and it was known before the splitter was built.

## What was built

A floating window over the **whole document**, the way the code editor popout already works for a
Function or Expression port, with one deliberate difference: **an outside click does not dismiss
it.** `PopupLayer` closes a popout when you click away, which would make "poke the running app,
then come back to the blocks" impossible — and that round trip is the thing the feature exists to
remove.

- `#canvas-tabs-root` is `position: fixed; inset: 0; pointer-events: none` — a viewport-sized
  layer that intercepts nothing.
- The window inside it is placed by four CSS custom properties on the shell root, written
  synchronously from `mousemove` by `LogicOverlay.ts`. No React state: a drag would otherwise
  re-render every mounted Blockly workspace at pointer frequency.
- Eight resize handles and a draggable title bar. Geometry is stored as **fractions** of the
  viewport, so a window sized on a 27" display reopens in proportion on the laptop.
- **The canvas is never resized.** Nothing about the node graph's geometry changes when a Visual
  Function opens, which is why there is no canvas re-measure on this path at all.

## The drive, 2026-08-13 — every number measured over CDP

Fixture: a throwaway copy of `lgc59-drive` (`lgc010-drive`), one `Logic Builder` node, `c6`.
Viewport 1368×781, dark theme, default `horizontal` layout with the preview live.

| Claim | Result |
|---|---|
| **`position: fixed` escapes the node-graph frame** — the whole premise | ✅ Frame starts at **x=380**; the window opened at **x=123, w=1122**, i.e. **257 px left of the frame**, over the preview. `FrameDivider`'s containers are `position: absolute; overflow: hidden` with no transform, so nothing establishes a containing block for fixed positioning. |
| **The blocks get real room** | ✅ `.injectionDiv` **816 px**, against the ~190 px the pane could give on this machine. **4.3×.** |
| **The canvas is not narrowed** | ✅ `#nodegraphcanvas` `display: block`, **988 px** — its full frame width, backing store 1976×712. The pane would have taken it to 494. |
| **An outside click does not dismiss it** | ✅ Clicked the preview webview at (1320, 400); the window was byte-identical before and after — same x, y, w, h, same injection size. `elementFromPoint` outside the window returns the component trail and the preview, never the layer. |
| **Dragging the title bar moves it** | ✅ (123,70) → (33,110) for a −90/+40 drag, exactly. And Blockly's stale `svgHeight` attribute reconciled **584 → 562** on the same drag, i.e. `resizeBlocklyWorkspaces()` fired synchronously. |
| **Resizing works and Blockly follows** | ✅ East edge dragged −300: window **1122 → 822**, `.injectionDiv` **816 → 516**, and `.blocklySvg`'s `width` attribute **tracked it to `516px`**. This is LGC-008's deferred verification §1, met. |
| 🔴 **The minimum width, LGC-008's open finding** | ✅ **Closed by construction.** Dragged 500 px past the floor, the window clamps at exactly **640 px** and `.injectionDiv` is **334 px** — a real workspace. The pane measured **0** at 288. |
| **Geometry survives a close and reopen** | ✅ Closed via *Done*, reopened at exactly (33, 110, 640, 640). Stored as viewport fractions. |
| 🔴 **L30 — one Delete meant two deletions** | ✅ **Fixed and proved with a control.** See below. |

### 🔴 L30, and how the first attempt at proving it passed vacuously — twice

L30 was filed by LGC-008 as *"blocks shipping, not merging"*. It is fixed: `getKeyboardFocusKind`
gained an `'own-surface'` kind, and any element inside `[data-keyboard-scope]` owns its keystrokes.

**Two vacuous passes were caught before the real one**, and both are the shape this repo keeps
producing:

1. `svg.focus()` from `eval` did nothing — `document.activeElement` was `BODY`. "No node was
   deleted" was true because focus was never in the overlay at all.
2. With focus correctly inside (a real click on a block; `activeElement` a Blockly `<g>`),
   **no node was selected on the canvas** — so `EditorClipboard.delete()` was a no-op regardless.

The measurement that actually says something needs a node selected *and* focus inside, *and* the
negative control:

| | selected | focus | Backspace + Delete | result |
|---|---|---|---|---|
| **A** | `c6`, 1 node | inside the overlay (`<g>`) | pressed | `nodes: 5`, `c6: true` — **survived** |
| **B** (control) | `c6`, 1 node | outside (`BODY`) | pressed | `nodes: 5 → 4`, `c6: false` — **deleted** |

B is what makes A mean anything. Without it the whole test is "nothing happened", which is also
what a broken instrument reports.

⚠️ The 200 ms `lastBlocklyTabCloseTime` guard in `EditorClipboard.delete()` is **left in place**.
It guards a different window — the moment after a tab closes, when focus has already left the
surface and the predicate correctly answers `'none'`.

### 🔴 One defect found by driving, which reading would not have caught

The eight resize handles were first written the conventional way: 6 px strips overhanging the
border by half, so the grab area is centred on the visible edge. **Half of every handle was
unreachable.** `.CanvasTabs` carries `overflow: hidden` for its border radius, and
`overflow: hidden` clips **hit-testing**, not only paint — the east handle's box was x 1151–1157
while `elementFromPoint` stopped answering it at 1154, so a drag beginning on the visible edge
landed on the canvas behind and the window did not move.

They are now 8 px **inside** the window, which is both correct and a larger target than 3 px of
reachable overhang.

## What was kept from LGC-008 rather than reverted

The pane was not a detour. Four things it built are load-bearing here:

- **F4 — an edit belongs to the tab that made it** (`tabWorkspaces.tsx`). The window mounts every
  open tab too, so this is as necessary as it ever was.
- **The blanket `display: none` on eight canvas layers stays gone**, with a stated behaviour per
  layer. A spec fails if one comes back.
- **L27 — the highlight overlay's `z-index: 7`.**
- **`resizeBlocklyWorkspaces()` and `remeasureNodeGraphCanvas()`.** Blockly re-measures on a
  `window` resize only; the canvas was re-measured only by a `ResizeObserver` an occluded renderer
  never fires. Both still called — Blockly's from the window's own drag, the canvas's from the
  outer preview/graph divider, where it was always a real defect.

## Still open

- **§2's A/B against the takeover on a real task.** Unchanged and still unrun; it needs humans.
  The IwC 38(1) 2026 warning ([LGC-008 §2](LGC-008-A-PANE-NOT-A-TAKEOVER.md)) applies to a
  floating window less than to a dual canvas — the blocks are not competing for the same visual
  field — but "less" is not "not", and this is still a preference until somebody times it.
- **`documentLayout: 'detachedPreview'` undriven.** The window is placed against the viewport, so
  it should be *more* correct there than the pane was, not less. Unverified.
- **Two zoom clusters.** Blockly draws its own bottom-right of its workspace, and the canvas HUD
  draws one bottom-right of the canvas. They no longer sit in adjacent rectangles — one is now
  over the other — which changes the question rather than answering it. Richard's call, per
  LGC-008 §5.

## Register

| # | Finding | State |
|---|---|---|
| L33 | **The pane's minimum width was knowable before it was built.** 152 + 152 px of interface rails is in `BlocklyWorkspace.module.scss`, and the default layout's frame width is arithmetic. The splitter was specced, ruled, built, driven and merged without anyone multiplying them | ✅ acted on — it is why LGC-010 is a window |
| L34 | 🔴 **`overflow: hidden` clips hit-testing, not only paint.** A resize handle overhanging its parent's border is half unreachable, and it looks and measures like a working handle right up until you drag from the visible edge | ✅ fixed 2026-08-13, handles moved inside; found by driving, invisible to review |
| L35 | 🔴 **A "nothing happened" test is indistinguishable from a broken instrument.** Two vacuous passes on L30 before the one that counted: focus that never landed, then a selection that never existed. Both reported the same green as the real fix | ✅ the negative control is now in the spec and in the drive |
| L36 | **`dev:stop` matches the MCP servers.** They run from this checkout's `packages/noodl-mcp/dist/`, so `dev:stop --list` reports them as "dev stack" and stopping the stack takes a live MCP connection down with it. Kill the launcher pid (`scripts/start.ts`) instead; its watchdog reaps the rest | ⚠️ standing — see [`icon-contrast.js`](../../../scripts/devtools/icon-contrast.js) sessions |
