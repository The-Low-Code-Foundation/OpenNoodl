# Phase 84 — next session

**Phase:** 84, *the defects the field report found*. **Prefix `FLD`.** Scoped 2026-09-09;
**FLD-001 built and driven the same day (`3c13818d`).** Read [README.md](./README.md) first — §2
carries six rulings and three of them gate tasks.

## 1. The board — re-derived from the task FILES, 2026-09-09 (session 1)

Seventeen files. **One built.** Sixteen `⬜ never built` — that is the file count, not a copied
status.

**Track A — it went wrong and said nothing** (outranks track B in every ordering decision)

| id | task | issue | state | depends on |
|---|---|---|---|---|
| FLD-001 | The Columns node measures itself | #21 | 🟢 **BUILT** `3c13818d` | — |
| FLD-004 | A wire into a dimension port is honoured, or refused out loud | #26 | ⬜ never built | R4 |
| FLD-005 | A column of Groups does not multiply out | #35 | ⬜ never built | — |
| FLD-006 | Fit view fits | #33 | ⬜ never built | — |
| FLD-007 | A lesson step that can be completed | #5 | ⬜ never built | — |
| FLD-008 | An aggregation that cannot answer says so | #14 | ⬜ never built | — |
| FLD-009 | The editor does not overwrite what an agent wrote | #41 | ⬜ never built | — |
| FLD-012 | The empty-box warning stops crying wolf | #32 | ⬜ never built | — |

**Track B — it costs too much to install and to drive**

| id | task | issue | state | depends on |
|---|---|---|---|---|
| FLD-002 | The Columns node says which breakpoint it is at | #22 | ⬜ never built | FLD-001 |
| FLD-003 | Advanced Columns, as a prefab | #22 | ⬜ never built | FLD-002, FLD-004, R3 |
| FLD-010 | An agent can ask whether a human has the project open | #41 | ⬜ never built | FLD-009, R6 |
| FLD-011 | The render report writes to disk and stops sleeping | #40 | ⬜ never built | — |
| FLD-013 | An agent learns what will not translate before it designs | #37 | ⬜ never built | — |
| FLD-014 | The MCP surface stops costing a round trip | #43 | ⬜ never built | — |
| FLD-015 | Charts that export | #39 | ⬜ never built | R2 |
| FLD-016 | The Linux install works on a current distribution | #29 | ⬜ never built | — |
| FLD-017 | The release stops shipping what it never runs | #42 | ⬜ never built | R5 (minify only) |

## 2. The next task to build — FLD-007, then FLD-009

**FLD-001 is done** — see its §4b for what was built, both reverted arms, and the editor drive. It
unblocks **FLD-002** and **FLD-003**, whose outputs would have read `Default` forever without it.

Take the cheapest real wins next, in this order:

1. **[FLD-007 — a lesson step that can be completed](./FLD-007-A-LESSON-STEP-THAT-CAN-BE-COMPLETED.md)**
   (#5). One line; unblocks every route-keyed lesson step; reported in 2024. Nothing gates it.
2. **[FLD-009 — the editor does not overwrite what an agent wrote](./FLD-009-THE-EDITOR-DOES-NOT-OVERWRITE-WHAT-AN-AGENT-WROTE.md)**
   (#41). Silent data loss, and **the drive is the deliverable**. 🔴 Read register row **N1** first:
   it is marked as blocking FLD-009 AC1 and was read from source, never driven — so
   **re-measure it before inheriting it.**

🔴 **Before either, read [§6 of the register](./DEFECTS-THE-FIELD-REPORT-FOUND.md).** FLD-001's drive
put three new rows there, all owned by **NONE**, and **P14 and P15 will cost you the same twenty
minutes they cost session 1** if you try to make a project through the launcher:

- **P14 — "New project → Quick Start" hangs.** No directory, no error, nothing in the log.
- **P15 — there is no "Make Home" in the component context menu**, while the viewer's error page
  tells the user to click exactly that.

✅ **The workaround that does work, if you need a live editor on a project you control.** It never
touches Richard's launcher config or his 79 projects:

```bash
# 1. copy a small project ("test" is one component + a Router) into the scratchpad
# 2. write <scratchpad>/userdata/recently_opened_project.json:
#      {"recentProjects":[{"retainedProjectDirectory":"<copy>","latestAccessed":<ms>,
#        "id":"<uuid>","name":"<name>"}]}
# 3. set "rootNodeId" in the copy's project.json to the id of the component root node you want
#    rendered — `rootComponent` is read at load but is NOT what the serialiser writes back, so it
#    is silently dropped on the first save
NOODL_USER_DATA_DIR=<scratchpad>/userdata npm run dev:debug -- --quiet
```

🔴 **The canvas is a `<canvas>`.** No DOM selectors reach a node. What worked:

- **right-click empty canvas** opens the node picker (`InteractionController.ts:908`); the picker
  itself is DOM, so `cdp type` into `input[placeholder='Search nodes and components…']` and click
  the result card. The node lands at the click point **as a sibling root**, not as a child.
- **drag one node onto another to re-parent it** — press, move in ~14 steps (a single jump skips the
  hit test), release. ⚠️ **Grab the node body, not its edge**: starting the drag near a port draws a
  *connection* instead and leaves two `ConnectionPopup` dialogs that Escape does not dismiss (click
  empty canvas twice).
- ⚠️ **Stay inside the canvas rect.** It is only the lower part of the window
  (`y 425–784` at 1368×784); a right-click below it silently does nothing.
- Property-panel fields carry **`data-identifier`** (`mediumBreakpoint`, `minWidth`, `width`) — but
  the groups are collapsed and their inputs measure `0×0`. Expand with `button.property-group-label`
  `.click()`; a real mouse click on it did not toggle. `cdp type` **appends** rather than replaces —
  use the native value setter plus an `input` event for a field that already has a value.
- `Emulation.setDeviceMetricsOverride` on the `viewer` target is how you narrow the preview, and it
  **dies with the CDP session**, so resize and measure on one connection. There is a ready-made
  driver at `scripts/devtools/` scale in the session scratchpad; rewrite it, it is 200 lines.

## 3. The end condition

This phase closes when the fifteen issues are each **fixed and closed, or answered on the thread with
the measurement that changed our mind** — not when the tasks go green. §5 of the
[register](./DEFECTS-THE-FIELD-REPORT-FOUND.md) is a table of fourteen replies owed, all `⬜`. Two of
these reporters have waited since 2024 and 2025.

Distance: **1 of 17 tasks built. 0 of 14 replies sent.** 🔴 The replies are still the
end condition, and #21's reporter is Richard — FLD-001 is now answerable with a measurement.

## 4. 🔴 Rulings needed before session 2 — do not guess

R1 which release · R2 charts as a kit or core nodes · R3 the Advanced Columns prefab · R4 does the
units-port fix ship in a patch · R5 is minification in scope · R6 does FLD-010 include the lock.
Full wording in [README.md](./README.md) §2. **R2, R3, R5 and R6 gate tasks; R1 and R4 gate
sequencing.** ⚠️ **R1 got sharper:** FLD-001 changes the behaviour of every existing Columns node
by one gutter, so whichever release carries it owes a release note, not a footnote.

## 5. What this phase is NOT

- **Not phase 83.** Seven issues (#11, #23, #24, #28, #31, #36, #38) belong to
  [phase 83](../phase-83-behind-a-click/README.md). Do not scope them here.
- 🔴 **Two collisions are already known**, both in the register:
  **P9** — `WIRED_STYLE_SINKS` (`emit/style.ts:270-274`) is owned by phase 83's HLS-005 and is also
  the cheap half of FLD-015. **P13** — FLD-005 is the same defect as phase 81's **VIB-005**, which
  owns register rows V1/V2/V14/V17/V21/V38 and has never been built.
  **Agree ownership before building either. Do not build both sides of a collision.**
- **Not a defect-farming phase.** Per [PHASE-EXECUTION.md](../../guidelines/PHASE-EXECUTION.md), a
  defect found while building goes in the register with an owner and the session builds the next
  task, unless it blocks an acceptance criterion.

## 6. The register, as an appendix

[DEFECTS-THE-FIELD-REPORT-FOUND.md](./DEFECTS-THE-FIELD-REPORT-FOUND.md) — six rows found while
scoping that are in **no** GitHub issue, five reframed issues, four ready to close, twelve passing
findings, and the replies table.

🔴 **N3 is the one to read first.** An agent re-sending its own graph reverts every server-added
creation default. It is the real defect behind #25, it is owned by **NONE**, and it deserves a task
that this phase did not give it because #25 is not one of the fifteen.
