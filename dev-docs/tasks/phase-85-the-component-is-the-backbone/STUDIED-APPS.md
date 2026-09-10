# Studied apps — the ledger

One row per cycle of the phase 85 loop. **Every pattern the playbook carries traces back to a row
here**, so a rule can always be answered with "which app earned this?".

Graded with `./measure-interfaces.py`. `out` = % of components publishing Component Outputs,
`flag` = % carrying a flag port, `St/c` = States nodes per component. CMP-001 floors: **50 / 20 / 0.15**.

`logic` = logic-only components (no visual node anywhere in the graph), from
`./measure-logic-components.py` — CMP-003 AC4. It answers the second question of the loop: did
this app give its small pieces of thinking names, or leave them as anonymous Function nodes
beside the visuals?

| date | app | who built it | comps | out | flag | St/c | logic | verdict | what it taught |
|---|---|---|---|---|---|---|---|---|---|
| 2026-09-09 | **Noodl prefabs** (42 entries) | original Noodl team | 124 | 84% | 21% | 0.23 | **80** of 197 | ✅ reference | P1–P9. The reference population the floors are calibrated to. 45 of the 80 are one or two working nodes |
| 2026-09-09 | **LearnBook v5.1** | Richard | 204 | 73% | 20% | 0.72 | **37** in two shared folders, **107** uses | ✅ reference | 🔴 **Logic components** — P10. The `Collapsable group` `pointerEventsEnabled` wire |
| 2026-09-09 | **Landing page template** (TPL-003) | the MCP | 14 | 14% | 0% | 0.00 | 🔴 **0** of 21 | 🔴 FAIL ×4 | The reverted arm. Content-only leaves, no outputs, no state machines, no named logic, 233 nodes of un-sectioned page |
| 2026-09-09 | **MCP corpus** (67 examples) | us | 30 | 10% | 3% | 0.03 | — | 🔴 FAIL ×3 | What the MCP is actually taught from. 29 of 30 components are content-only |
| — | *CMP-002 — a fresh MCP business landing page* | the MCP | | | | | | **pending** | |

## Reading a row

A row is not a score for the builder. The prefabs and LearnBook are references **because** they were
built by people solving real problems over years — the numbers describe what that produces, and the
floors exist to hold new work to it.

🔴 **A row is only worth adding if step 3 of the loop was actually run on it** — the six questions,
in the graph, by someone who read it. The numbers alone are three columns and no insight; every
pattern in the playbook came from the reading, not from the grading.

## Candidates not yet studied

- The other NodeGX test projects on this machine (`Puppy test 3`, and whatever the community files)
- Community apps, as and when Richard has one to show
- The `ui-landing-page` corpus example — 8 sections, the shape the template should have had; worth
  reading for **why** it did not transfer
