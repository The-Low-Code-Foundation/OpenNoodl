# Phase 84 — next session

**Phase:** 84, *the defects the field report found*. **Prefix `FLD`.** Scoped 2026-09-09; **nothing
built.** Read [README.md](./README.md) first — §2 carries six rulings and three of them gate tasks.

## 1. The board — re-derived from the task FILES, 2026-09-09

Every task is `⬜ never built`. That is not a copied status; there are seventeen files in this
directory and none of them has been started.

**Track A — it went wrong and said nothing** (outranks track B in every ordering decision)

| id | task | issue | state | depends on |
|---|---|---|---|---|
| FLD-001 | The Columns node measures itself | #21 | ⬜ never built | — 🔴 **blocker** |
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

## 2. The next task to build — FLD-001

**[FLD-001 — The Columns node measures itself](./FLD-001-THE-COLUMNS-NODE-MEASURES-ITSELF.md).**
It is the only issue on this board whose reporter said *"Blocks me — I cannot work around it"*, and
the reporter is Richard. Nothing gates it.

**First concrete step:** open
`packages/noodl-viewer-react/src/components/visual/Columns/Columns.tsx` and read `:352-372` beside
`:431`. Confirm for yourself that the `useEffect([])` reads `containerRef.current` at a mount where
`if (!props.children) return null` has rendered nothing. Then write the failing spec (AC2) **before**
the fix: mount with `children={null}`, re-render **with** children without remounting, assert the
measured width becomes a number. It must be red at HEAD.

🔴 **Do not delete the `:431` early return** — its comment says it is load-bearing against a
hooks-count crash on live deletion. Hoist the ref-carrying div above it instead.

🔴 **The drive must create the node and then add children, in that order.** Opening a saved project
builds the graph with children already present, which is the arm where the bug does not reproduce.

**After FLD-001**, the cheapest real wins are FLD-007 (one line, unblocks every route-keyed lesson
step, reported in 2024) and FLD-009 (silent data loss, and the drive is the deliverable). Do not
start FLD-002 or FLD-003 before FLD-001 lands — their outputs would read `Default` forever.

## 3. The end condition

This phase closes when the fifteen issues are each **fixed and closed, or answered on the thread with
the measurement that changed our mind** — not when the tasks go green. §5 of the
[register](./DEFECTS-THE-FIELD-REPORT-FOUND.md) is a table of fourteen replies owed, all `⬜`. Two of
these reporters have waited since 2024 and 2025.

Distance: **0 of 17 tasks built. 0 of 14 replies sent.**

## 4. 🔴 Rulings needed before session 2 — do not guess

R1 which release · R2 charts as a kit or core nodes · R3 the Advanced Columns prefab · R4 does the
units-port fix ship in a patch · R5 is minification in scope · R6 does FLD-010 include the lock.
Full wording in [README.md](./README.md) §2. **R2, R3, R5 and R6 gate tasks; R1 and R4 gate
sequencing.**

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
