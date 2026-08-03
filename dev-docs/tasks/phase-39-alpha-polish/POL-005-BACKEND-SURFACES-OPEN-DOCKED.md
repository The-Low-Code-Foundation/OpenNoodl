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

## Outcome — verified live 2026-08-03

Driven in the running editor against a started local backend ("App backend", port 8580) with a
populated `Message` collection. All seven surfaces opened from the backend card, measured and
screenshotted in **both themes**.

| Criterion | Result |
|---|---|
| 1. Docked at 860px | ✅ **859px measured** on all seven (PNL-003's clamp, 1368px window) |
| 2. No X on that path | ✅ zero elements matching `Detached` in any of the seven. The X that *is* in the header belongs to each surface's own header and is criterion 3's close |
| 3. Close returns to Backend Services | ✅ panel returns to its own 559px |
| 4. Usable at 860 in both themes | ✅ — three findings below, **none of them width-caused** |
| 5. Full from `⋯`, Escape docks | ⚠️ **the premise was wrong — see below** |
| 6. WFA-005 `OPEN_TRIGGERS_SURFACE` | ✅ lands identically: Triggers, 859px, no detached bar |

### Slice 4's premise was wrong: a surface has no float/full route at all

The spec said "The header's float and full buttons still exist for these panels via `⋯`". They do
not. Counting buttons in the panel header: **Backend Services has 6, a surface has 1** (its own
close). The mode buttons go into `PanelHeader`'s slot for every `BasePanel`, and the surfaces render
their own header instead. `⋯` never appears because there is nothing to demote — the frame is 859px,
far above the 357px threshold. `Escape` on a docked surface correctly does nothing.

So this change removed the only route to full mode that these surfaces had, because that route was
`openFull()` firing unasked. Nothing was lost that anyone chose, all seven are usable at 860, and
Richard's report was that 860 is where they belong — but it is a real reduction and it is **Richard's
call** whether a surface should be able to reach full deliberately.

### Three findings from the layout pass — filed, not fixed

1. **[POL-014](POL-014-THE-DATA-BROWSER-READS-A-KEY-NOTHING-SENDS.md) — the Data Browser reads
   `record.id`; records carry `objectId`.** Blank id column, a React key warning on every load,
   one cell click opening editors in all eight rows, and a delete that silently does nothing.
   Its own task; it is not a layout defect and it is not width-dependent.
2. **"Save policy" on the Sign-in surface is invisible as a button.** It is a real `PrimaryButton`,
   90×30, `is-variant-muted`: computed background `rgb(247,249,251)` against a panel that is
   essentially the same colour, with `border-width: 0`. The only save control on that surface reads
   as plain text, in both themes. Every sibling surface uses a normal button for its action ("Add
   role", "Issue key", "Add provider"). One-line variant change; needs a decision about whether
   `muted` is wrong here or wrong generally.
3. **Schema's header is bespoke.** Six surfaces use icon + title + subtitle + X; Schema uses a plain
   title with a `+ New Table / Refresh / Close` group and no backend subtitle. Cosmetic,
   pre-existing, and the odd one out now that the surfaces are the only thing in the panel.

The Data grid **scrolls rather than clips** at 860 (row width 1550px, horizontal scrollbar present)
and shows five of twelve columns, of which two are `createdAt`/`updatedAt`. Usable; noted.

## Traps

- These panels are **transient** — `SidePanel` re-creates them on every activation, so a stale
  layout observed once may just be a re-mount. Check twice before filing.
- PNL-003 clamps a docked width against the window and always leaves 320px of canvas. On a small
  display 860 will be clamped; check at least one narrow-window case so "docked" does not become
  "unusable" on a laptop.
- The `⋯` overflow only appears under a 357px frame; do not conclude the float/full buttons are gone
  because you were looking at a wide panel.
