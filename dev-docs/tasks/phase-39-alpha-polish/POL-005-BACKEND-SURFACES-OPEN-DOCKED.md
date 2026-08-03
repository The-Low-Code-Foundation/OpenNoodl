# POL-005 — Backend surfaces open at the size that works

Covers reported item **7**.

## What was reported

> There's an extra X icon in the top right of every built-in backend page that just collapses the
> view a bit but doesn't close it. Remove it. Also the layout isn't right for the backend stuff.
> Actually when you click that X, the collapsed version which takes up only half the editor looks
> perfect in terms of layout. So maybe just make that the default and take away that weird
> collapsing X.

## The mechanism — confirmed

It is not an extra button, and the diagnosis in the report is better than it sounds.

The seven surfaces (Schema, Data, Access, Triggers, Email, Sign-in providers, Search) are registered
transient panels with `defaultWidth: SURFACE_DEFAULT_WIDTH = 860`
([`backendSurfaces.tsx:122`](../../../packages/noodl-editor/src/editor/src/views/panels/BackendServicesPanel/LocalBackendCard/backendSurfaces.tsx#L122)).
That 860 is the designed width, and the file says so — these layouts came from a 900px modal.

But `LocalBackendCard.openSurface` then calls `layout?.openFull()`
([`LocalBackendCard.tsx:105`](../../../packages/noodl-editor/src/editor/src/views/panels/BackendServicesPanel/LocalBackendCard/LocalBackendCard.tsx#L105)),
which stretches the panel across the whole editor area. An 860px-designed layout in a 1400px panel
is the "layout isn't right" half of the complaint.

The X is PNL-009's detached-panel bar
([`SidePanel.tsx:377-392`](../../../packages/noodl-editor/src/editor/src/views/SidePanel/SidePanel.tsx#L377-L392)) —
it renders only when `isDetached`, and it calls `layout.dock()`. So clicking it returns the panel to
its remembered 860px docked width, which is exactly what the surfaces were built for. Richard found
the right layout by accident and correctly identified it as the one we should have shipped.

**Dropping `openFull()` fixes both halves at once**: the surfaces open at 860px, and the X stops
existing because `isDetached` is never true.

## What to build

**Slice 1.** Delete the `openFull()` call in `openSurface`. Keep the `opened` guard's intent — the
comment above it exists because going full-screen on the wrong panel was a real failure — but the
guard's *reason* disappears with the call, so simplify honestly rather than leaving a dangling
conditional.

**Slice 2.** `onClose` currently does `switch(BACKEND_SERVICES_PANEL_ID)` **and** `dock()`. The
`dock()` becomes a no-op; remove it and the `layout?.dock` capture with it, unless a surface can
still be detached by the user (float/full are still available from the panel header's `⋯` — see
below).

**Slice 3 — check the layouts at 860.** Full mode is what all seven have been reviewed at since
PNL-009. Open each one docked and confirm it is genuinely the "perfect" Richard saw:

- Data browser: does the grid have enough columns to be usable, and does it scroll rather than clip?
- Schema: field rows and the type pickers.
- Triggers: the add/edit form — WFA-008's edit path lands here.
- Access, Email, Sign-in providers, Search.

Record anything that is *not* fine at 860 as its own finding rather than reaching for full mode
again. If one surface genuinely needs more, give that surface a larger `defaultWidth` — the model
supports per-panel widths and remembers what the user drags to.

**Slice 4.** The header's float and full buttons still exist for these panels via `⋯`. That is fine
and is not what was reported — a user who *chooses* full gets the detached bar and its X, which is
coherent. Confirm that path still works and that `Escape` still docks.

## Criteria

1. Clicking any of the seven surfaces from a backend card opens it docked at 860px.
2. No X appears in the panel's top-right on that path.
3. Closing via the panel header returns to Backend Services.
4. All seven are usable at 860px in both themes — screenshots, per surface.
5. Choosing full from `⋯` still works, still shows the detached bar, and `Escape` still docks.
6. WFA-005's `OPEN_TRIGGERS_SURFACE` route from the workflow canvas lands the same way.

## Traps

- These panels are **transient** — `SidePanel` re-creates them on every activation, so a stale
  layout observed once may just be a re-mount. Check twice before filing.
- PNL-003 clamps a docked width against the window and always leaves 320px of canvas. On a small
  display 860 will be clamped; check at least one narrow-window case so "docked" does not become
  "unusable" on a laptop.
- The `⋯` overflow only appears under a 357px frame; do not conclude the float/full buttons are gone
  because you were looking at a wide panel.
