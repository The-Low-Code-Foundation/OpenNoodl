# PNL-003 — Panel width: notes

**Status:** ✅ Complete — 2026-07-27
**Spec:** [PNL-003-PANEL-WIDTH-BEHAVIOUR.md](./PNL-003-PANEL-WIDTH-BEHAVIOUR.md)

## The reset, reproduced

`EditorPage.tsx:83-95` reset the divider to 380px on `SidebarModelEvent.activeChanged` **and** on
`window.resize`, and `useState(undefined)` never loaded or saved anything. Confirmed live before the
change: drag the panel wide, click another rail icon, watch it snap back. It is not a missing
feature, it is a reset loop, and it is the whole of the reported complaint.

## The width has one owner now

[`useSidePanelLayout.tsx`](../../../packages/noodl-editor/src/editor/src/pages/EditorPage/useSidePanelLayout.tsx)
owns it. It was previously split three ways — `EditorPage`'s `useState`, `SideNavigation`'s CSS
`min-width: 380px`, and the divider's own props — which is how the reset survived. The CSS now just
fills what the divider gives it, and the divider's props are derived.

| Concern | Decision |
|---|---|
| Storage | `EditorSettings.setMerge(ProjectModel.instance.id, { 'editor-sidebar-widths': { [panelId]: px } })` — the same per-project key `useSetupSettings` uses for the active panel. **Widths are per project**, which is deliberate: different projects lean on different panels. |
| Units | `defaultWidth` on a `SidebarItem` and everything stored is the **panel's** width, excluding the 52px rail. The divider's size is `rail + panel`. A panel author reasons about their own panel, not about the rail. |
| Wide | `min(760px, 55vw)`, generalising the `55vw` the shelved topology panel prototyped. **Not persisted** — toggling off returns you to the width you set. |
| Wide across a switch | Cleared, as the mock has it. **Recorded as a decision to revisit**, not an accident: if wide turns out to be a mode people stay in, it should follow the panel. |
| Collapse | `⌘B`, the header button, or dragging below 160px. The remembered width is left alone, so revealing restores it. |
| Floor | 240px, the mock's compact breakpoint. Reachable now that `min-width: 380px` is gone (F5). |
| Resize | Clamps against `viewportWidth − 52 − 320` so a canvas is always left, and **never writes**. Restoring the window restores the width. |

Per-panel defaults live at the `register()` call, not in a table in `EditorPage`: Components 280,
Search 340, Explain/Build 400, Problems 420, App Setup / Project Settings / Editor Settings 460,
Backend Services 560. Everything else 328 — today's 380 minus the rail, so unlisted panels do not
move.

## Two defects found while building it

### The renderer deadlocked — a storage write inside a `setState` updater

The first version called `writeStoredWidths()` *inside* `setWidths(prev => ...)`. `EditorSettings`
notifies its listeners on write, and panels subscribe to it through `useModel`, so a write during
render re-entered React's render phase. The editor hung hard — `Runtime.evaluate` stopped answering
over CDP, which is how it was found rather than reasoned about. The setter is pure now and the write
happens beside it, off a ref that tracks the current widths.

### A focused `<button>` disabled every shortcut in the editor

`⌘\` worked, then didn't, depending on what had been clicked. `KeyboardHandler.getFocusedElement()`
treats **anything focusable** as "something else has focus" and declines to run any command — and in
Chromium a `<button>` takes focus when you click it. So clicking a rail icon and then pressing a
shortcut did nothing, for **every** shortcut the editor has (⌘F, ⌘D, ⌘R, ⌘⇧X, ⌘⇧E), not just the new
ones. The handler's own comment says the guard is about "a text input or similar".

Fixed narrowly rather than globally: a command may set `worksWhenFocused: true` and then runs while a
*non-text* element holds focus. Text entry still always wins — an `input`, `textarea`, `select` or
`contenteditable` swallows the keystroke as before, which is acceptance item 9 and is verified. Only
`⌘\` and `⌘B` opt in; every existing shortcut behaves exactly as it did.

**This is worth a task of its own.** The other five shortcuts still die after a button click. Filed as
F21 in PROGRESS.md.

## Acceptance — all 11 checks, driven live

Scripted over CDP against the real editor at 1400×900 with the Agent Chat Example project open, with
real `Input.dispatchMouseEvent` drags and `Input.dispatchKeyEvent` keystrokes.

```
✓ 1. width survives a panel switch — dragged 600, back 600
✓ 2. per-panel widths, both directions — components 600, search 300
✓ 3. resize does not change the remembered width — 600 → grow 600 → small 428 (clamped) → restored 600
✓ 4. widths survive a project close and reopen — components 520 → 520, problems 380 → 380
✓ 5a. ⌘\ widens and returns — 600 → 760 → 600
✓ 5b. double-clicking the divider widens — 600 → 760
✓ 6a. ⌘B hides the panel, rail remains — panel 0, rail 52
✓ 6b. a rail click restores the last width — 600 → hidden → 600
✓ 7. dragging past the floor collapses — panel 0
✓ 8. the panel can be 240px — panel 240
✓ 9. ⌘\ / ⌘B inert while a panel field has focus — width unchanged
✓ 10. the document divider is still mounted and unaffected
```

Item 4 ran as its own pass because it closes and reopens the project. Items 6a/7 measure 1px because
`SideNavigation .Panel` keeps its 1px left border at zero content width; the border coincides with the
rail's own right border, so there is no visible sliver — see `screenshots/pnl-003/hidden--dark.png`.

Also re-ran **PNL-001's panel-geometry gate**: 11/11 clean at 1280×720 after these changes.

Gates: editor `tsc` clean; `npm run test:ci` 1441 specs / 0 failures; `npm run colors` 16/16 unchanged.

Screenshots: `screenshots/pnl-003/{docked,wide,hidden}--{dark,light}.png` plus
`header-mode-controls--dark.png`.

## Shared components touched, and why

- **`PanelHeader` gains a `modeSlot`**, filled from a new `PanelModeSlotContext` that `BasePanel`
  reads. The spec forbade a second header component; a context is how the side panel's own controls
  reach every `BasePanel` header without a panel having to know about them. `preview/property-panel/Group`
  also uses `PanelHeader` and is untouched, because the slot is passed by `BasePanel`, not read by
  `PanelHeader` itself. **PNL-005 should absorb this seam.**
- **`FrameDivider` gains `onDividerDoubleClick`** (additive) and a 12px `::after` grab target. The
  visual handle stays 6px because `FrameDivider.tsx` positions it against a hard-coded half-width;
  widening the element itself would have put it a pixel off-centre. Hover now paints a 2px accent
  line rather than a 40%-opacity wash over the whole handle. `EditorDocument`'s canvas/preview split
  shares this component and was verified still working and still persisting.
- **`SideNavigation` loses `isExpanded`** and the `55vw` rule it drove. Both were unreachable: the
  only caller compared against `'topology'`, whose registration has been commented out since the
  feature was shelved (F6).

## Traps

- **`FrameDivider.onSizeChanged` is not "the user dragged".** It also fires from an effect whenever
  the `size` prop changes, so the divider echoes every programmatic size back at you. Persisting that
  would write the *wide* width in as the panel's remembered width the moment you pressed `⌘\`. The
  hook gates on `onDragStart`/`onDragEnd` and ignores everything else.
- **Do not do side effects inside a `setState` updater** in this codebase specifically — `EditorSettings`
  writes notify listeners, and several panels subscribe. It deadlocks the renderer rather than
  warning.
- **A stateful CDP driver lies about state it did not set.** One run recorded the search panel clamped
  to the 1028px maximum after a same-position drag. It is not reproducible in isolation (a clean
  drag, a zero-movement click on the divider, a stray `mouseup`, and a press-then-release-with-no-move
  were all checked and all correct) and the value was written during the deadlocked session, before
  the fix above. Flagged rather than buried.
- **HMR drops you back at the launcher.** Editing `EditorPage.tsx` while the editor is open closes the
  project. Re-open the fixture before measuring anything.

## Recorded, not fixed

- **F21 — every other editor shortcut is still disabled by a focused button.** ⌘F, ⌘D, ⌘R, ⌘⇧X, ⌘⇧E
  should almost certainly get `worksWhenFocused` too, or the guard should be text-entry-only outright.
  Out of PNL-003's scope; a one-line-per-command change once someone decides.
- **The Components panel's header is clipped by the window title bar.** Visible in the PNL-001
  *before* screenshots, so it predates this phase entirely. It is one of the panels that rolls its own
  header — PNL-005/PNL-006 territory.
