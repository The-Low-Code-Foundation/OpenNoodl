# PNL-009 — Floating & full panel modes: notes

**Status:** 🚧 **Half complete** — the mode system is built and validated; the `LocalBackendCard`
portal consolidation is **not started**.
**Spec:** [PNL-009-FLOAT-AND-FULL-MODES.md](./PNL-009-FLOAT-AND-FULL-MODES.md)

## The "validate before building" gate

The spec made this task conditional: *"Before implementing, confirm the need."* **Richard answered
"build it"** on 2026-07-27, having seen Tier 1 land. That is the decision this work proceeds on;
recorded here so the next reader knows it was asked and answered rather than assumed.

## What is done

### The modes are CSS-only, and that is load-bearing

`SideNavigation .Panel` gets `position: fixed` plus insets in the detached modes. **The panel element
never changes parent.** That is the whole design: `propertyeditor`, `ProjectSettingsPanel` and
`componentports` host legacy imperative views through `Frame`, and those bind listeners in `render()`
and hold direct DOM references — re-parenting their subtree would remount them with no guarantee they
survive.

The one assumption this rests on is that no ancestor establishes a containing block for fixed
positioning (a `transform`, `filter`, `perspective`, `contain: paint` or `will-change` anywhere up the
tree defeats `position: fixed`). **Verified live, not assumed** — full mode measures
`position: fixed`, x 52, width 1349 inside a 1400px window, i.e. it escapes both `SideNavigation
.Root`'s and the frame divider's `overflow: hidden`.

### The legacy-view test the spec insists on

Put the property editor into a mode and back, then use it:

- **Same DOM node.** `window.__legacyEl === document.querySelector('.property-header-name')` after the
  mode change: **true**. Nothing remounted.
- **Listeners intact.** A legacy property input in a floating panel still accepts typing — its value
  went `"chat"` → `"chatZ"`. That is the legacy `View`'s own change path, not React's.

So no panel needs the exemption. `LEGACY_HOSTING_PANELS` in `SidePanel.tsx` is the empty list the
escape hatch lives in if that ever changes: the float/full buttons go disabled with a reason rather
than breaking the panel.

### Behaviour, measured

```
✓ full: the panel is fixed and fills the editor area right of the rail  {"pos":"fixed","x":52,"w":1349}
✓ full: the rail is still there and 52px wide
✓ full: switching panels from the rail stays in full mode               bar="APP SETUP"
✓ full: Escape returns to docked
✓ floating: the panel is a fixed card over the canvas                   {"x":96,"y":94,"w":422,"h":522}
✓ floating: dragging the bar moves the card                            96,94 -> 276,166
✓ floating: the grip resizes the card                                  422x522 -> 542x582
✓ floating: position and size come back per panel                      after a switch away and back
✓ floating: the canvas takes the full width underneath                 1348px
```

Position and size persist per panel per project, in `'editor-sidebar-float-rects'` beside PNL-003's
widths, under the same project key. A floating card is constrained so it can never cover the rail and
always leaves 120px of its header grabbable — a card you cannot reach is a card you cannot close.

A detached panel also gets its own bar: the thing you grab to move a floating card, the panel's name,
and a close button. That is the header and escape route the spec wants for the full-screen surfaces.

Screenshots: `screenshots/pnl-009/{full,floating}--{dark,light}.png`.

## What is NOT done

**The `LocalBackendCard` portal consolidation — the half with independent justification.** Seven
surfaces (Schema, Data, Permissions, Triggers, Email, Auth, Search — the spec says six; it is seven)
still render through `createPortal(…, document.body)` into a `position: fixed` overlay with a
hardcoded `rgba(0, 0, 0, 0.85)` scrim that predates the light theme. None of that is touched. The
acceptance items 2 and 3 are therefore **not met**, and `grep` will still find both.

The mode system this work delivers is the thing that migration needs to land on, so the ordering is
not wasted — but the spec's own advice was to do the consolidation *first*, and this did not.

**Also not verified:** item 6's "a floating panel does not trap focus", and the popup-positioning
check in the executor notes (a colour picker opened from a floating panel appearing in the right
place, and PNL-002's dismissal behaving when the panel is not where popups assume it is). Both want
doing before this is called finished.

## Findings

- **The mode buttons only exist on `BasePanel` panels.** They ride in `PanelHeader`'s mode slot, and
  15 panels have no `BasePanel` header — Components and Search among them. So today you can only
  detach the panels that already have a header. **PNL-005 is what fixes this**, and it is the reason
  that task is listed as a prerequisite.
- **The property editor cannot be put into full mode from the UI at all.** It has no header (so no
  mode buttons), and full mode covers the canvas — so you cannot select a node to reach it while in
  full. Floating is reachable, which is why the legacy test above uses it.
- **Every mounted panel renders its own copy of the mode buttons**, so `data-test` ids for them are
  not unique — all the hidden panels have one too. Anything scripted must filter on
  `getBoundingClientRect().width > 0`. Cost three false failures here.

## Gates

Editor `tsc` clean. `npm run colors` 16/16. PNL-001's panel-geometry gate 11/11 at 1280×720.

`npm run test:ci` reports **1 failure**: *"Project import and export unit tests re-keys imported node
ids while reusing the target component id (characterization) — Expected 8 to be 5"*. **It is not from
this work**: with every PNL-009 change stashed the same spec fails identically, with the same numbers.
The tip moved during this session (a concurrent session merged DEP-008 and a PLAT-003 slice, and the
spec count went 1441 → 1481), so it arrived with one of those. Flagged, not adopted.
