# Phase 28 — Canvas Legibility & Authoring Intent (Track M): Progress

**Status:** ✅ Complete for this phase — 4 / 4 built, live-verified 2026-07-29. CAN-005 is specced here
and **executes in Phase 18**, where it is now [EXP-006](../phase-18-code-export-v2/EXP-006-EXPORT-AUTHORING-INTENT.md)
**Specced:** 2026-07-28, from Richard using the WFA-004 workflow canvas and asking why the main canvas
cannot do what it does
**Phase overview:** [README.md](./README.md)

## Status vocabulary

Not started · In progress · **Built–not wired** · Complete · Superseded

## Task status

| ID | Title | Tier | Status | Landed | Notes |
|---|---|---|---|---|---|
| [CAN-004](./CAN-004-COMMENT-DISCOVERABILITY.md) | Node comments you can find | 1 | ✅ Complete | `729ff46` | Stripe, hover-to-read, right-click to edit; F50/F51/F52 all closed by the placement rather than traded against. `commentIconBounds` gone |
| [CAN-003](./CAN-003-ENDPOINT-DETACH-REWIRE.md) | Detach an endpoint to rewire or delete | 2 | ✅ Complete | `ef659e4` | **Built second, not third** — its own trap says to do it before CAN-001 when both are in flight, because it removes the arm-then-confirm/chip-drag conflict permanently rather than working around it |
| [CAN-001](./CAN-001-CONNECTOR-LABELS.md) | Connector labels on every canvas | 1 | ✅ Complete | `5549292` | Hover default kept; setting lives in Settings → Editor → Appearance. Needed `connectionUpdated` in the autosave allowlist or a moved label never reached disk |
| [CAN-002](./CAN-002-CUSTOM-CONNECTOR-TEXT.md) | Author-written connector text | 2 | ✅ Complete | `0caa055` | Editor + the whole F53 diff/merge half. The no-loss property found a case the spec did not name — see the register below |
| [CAN-005](./CAN-005-EXPORT-AUTHORING-INTENT.md) | Export carries authoring intent | 3 | 📋 Handed over | `—` | Bookkeeping done: opened as [EXP-006](../phase-18-code-export-v2/EXP-006-EXPORT-AUTHORING-INTENT.md) in phase 18, so CODE-008 is no longer orphaned (F57 closed). The generator work waits on EXP-002 |

## Live QA, 2026-07-29

Driven over CDP against the NodeGX QA fixture, editor restarted after the paint changes. All green:

- a commented node paints `#4da3ff` at x+1 on the titlebar and an uncommented one paints card body —
  the stripe is presence-only, no hover, no highlight state;
- a wire shows its port name on hover and nothing at rest; the always-on checkbox flips both ways and
  the canvas follows;
- an author label wraps to two lines mid-wire and shows with no hover and the setting off;
- grab an end → drop on empty canvas deletes, one undo restores both ports; drop on a node opens a
  single-step "Select input" picker with the other end pinned, and one undo restores the original wire;
- right-click offers Add label / Delete connection; select + Delete deletes; both undoable;
- clearing a label removes the key, and a project whose labels were never touched gains no `labelT`;
- no renderer exceptions across the whole pass.

## Findings register

The register lives in [README.md](./README.md#findings-register) — F50…F59. F50–F58 were established
2026-07-28 by reading the canvas painter and measuring the card geometry; every one of them held up
when built against, and F50/F51/F52/F53/F54/F55/F56/F58 are now closed by the four landed tasks. F57
is closed by opening EXP-006 in phase 18. **F59 is new**, and it came from the SUB-007 no-loss property
rather than from reading code.

Two of the nine are corrections to things that were misremembered in conversation, and both are worth
re-reading before touching the wire code:

- **F55** — the wire delete gesture is arm-then-confirm on mouse-*up*, not a `dblclick` handler. The red X
  is never visible on hover alone, and a double-click deletes only as a side effect of two clicks.
- **F56** — wires have no draggable endpoints at all. The 3px dots are paint, not hit regions, and
  connection drags start from a *node*, resolving ports by popup afterwards.

## Cross-phase dependencies

| This phase | Depends on / affects | |
|---|---|---|
| CAN-002 | **SUB-007** graph diff & merge engine | Adds a `connection-relabelled` change kind and merge-driver handling. Touching the merge driver is where a mistake loses user data quietly |
| CAN-002 | **AIX-003** annotation rendering | `Connection.annotation` sits on the same object as the new `label`; it is transient and must stay in `CONNECTION_TRANSIENT_KEYS` while `label` must not |
| CAN-001 | **WFA-004** workflow canvas | Un-gates that task's label. Workflow captures shift sub-pixel when placement moves to `pointOnCurve(0.5)`; expected, and the reason to re-capture rather than assume |
| CAN-001, CAN-004 | **UIX-009** screenshot-corpus harness | Both change what every canvas capture looks like. Review the diffs; do not re-baseline blind |
| CAN-004 | **UIX-005** canvas theme + `nodegx:themechanged` | New `commentIndicator` token must resolve in both themes and repaint on theme change |
| CAN-005 | **Phase 18** EXP-002 / EXP-004 | Executes there. Also the owner of the F57 rescue |
| CAN-005 | **phase-7 CODE-008** | Adopts its formatters and placement heuristic; disagrees with it on comment boxes, deliberately, and says why |

## Decisions already made, so they are not re-argued

| Question | Decision | Where |
|---|---|---|
| Label every wire by default? | **No** — hover by default, always-on as a setting, author labels always | [CAN-001 §2](./CAN-001-CONNECTOR-LABELS.md) |
| Where does the comment indicator go? | **Left-edge gutter stripe**, 3px, titlebar height. The titlebar has no free width; every glyph placement either overlaps the title or reflows it | [CAN-004 §Background](./CAN-004-COMMENT-DISCOVERABILITY.md) |
| Is the wire label `metadata.comment` or a flat key? | **Flat `label`**, matching the four existing connection keys | [CAN-002 §1](./CAN-002-CUSTOM-CONNECTOR-TEXT.md) |
| Does moving a label show up in version control? | **No** — `label` is semantic, `labelT` is presentation. That asymmetry is why they are separate keys | [CAN-002 §3](./CAN-002-CUSTOM-CONNECTOR-TEXT.md) |
| Do comment boxes reach the export? | **Yes** — reversing CODE-008's deprioritisation, because regions are what a new reader needs first | [CAN-005 §Background](./CAN-005-EXPORT-AUTHORING-INTENT.md) |

## Open questions for Richard

Both were built the way the specs recommended, and both are still one line to flip:

1. **CAN-004's stripe vs. glyph.** Built as the stripe. It reads clearly on the QA fixture at 100% and
   costs the title nothing, which the glyph could not do at a fixed 150px card. Worth your eye on a
   dense real graph before calling it settled — the reserve-width glyph alternative is still recorded in
   CAN-004 §Background.
2. **CAN-001's default.** Built as hover. The live pass was on a graph with one wire, which cannot
   settle the argument the default exists to answer — a 50–100 wire browser graph is what would. The
   setting is shipped, so trying always-on for a day is free, and flipping the default afterwards is one
   line in `shouldShowPortLabel`.
3. **The wire delete gesture changed.** Arm-then-confirm is gone (CAN-003). If you had muscle memory for
   click-click-to-delete, it is now drag-an-end-to-empty-canvas, right-click → Delete, or select +
   Delete. This is the one change in the phase that takes something away.
