# PNL-002 test matrix

Written **before** the change, and run before it, so "which of these was already broken" is a fact
rather than a memory. Re-run it after. Every row is a manual gesture in a running editor with a
project open.

`↓` = mousedown, `↑` = mouseup.

## A. The reported gesture — a drag must not dismiss

| # | Gesture | Expected |
|---|---|---|
| A1 | ↓ inside a **panel text field**, drag right past the panel edge, ↑ over the canvas | the field keeps focus and its selection; nothing closes |
| A2 | ↓ inside a **popout's** text field (colour hex, text style), drag out, ↑ over the canvas | the popout stays open; the field keeps focus |
| A3 | ↓ inside an open **popup**, drag out, ↑ over the canvas | the popup stays open |
| A4 | ↓ inside an open **modal**, drag out, ↑ outside it | the modal stays open |
| A5 | ↓ inside a panel field, drag, ↑ **outside the Electron window** entirely | nothing closes, and nothing is left armed — the next click behaves normally |

## B. Dismissal must still work — a clean click outside closes

| # | Surface | Gesture | Expected |
|---|---|---|---|
| B1 | node context menu (right-click a node) | click cleanly on the canvas | closes |
| B2 | node picker | click cleanly outside | closes |
| B3 | `MenuDialog` (a rail button's kebab menu) | click cleanly outside | closes |
| B4 | property-editor popout (colour picker) | click cleanly on the canvas | closes |
| B5 | confirm modal | click cleanly outside | closes |
| B6 | tooltip | click cleanly outside | hides |

## C. Dismissal must not be over-eager

| # | Gesture | Expected |
|---|---|---|
| C1 | ↓ outside a popup, drag onto the popup, ↑ **on** it | does **not** close, and does not activate whatever is under the pointer |
| C2 | right-click to open a context menu | opens and stays open (the Windows `contextmenu`-after-`mousedown` guard) |

## D. Platform

| # | Check | Expected |
|---|---|---|
| D1 | Windows: right-click still opens context menus | the `ignoreContextMenuEvent` workaround still holds |

## Results

Filled in by [PNL-002-NOTES.md](./PNL-002-NOTES.md).
