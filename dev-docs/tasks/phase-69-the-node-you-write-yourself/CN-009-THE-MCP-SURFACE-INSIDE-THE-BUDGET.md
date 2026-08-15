# CN-009 — The MCP surface for kits, inside the budget

| Field | Value |
|---|---|
| **Tier** | 3 |
| **Effort** | M |
| **Surface** | `mcp` |
| **Rulings** | ✅ **D7** — this task serves "this project"; **the shelf stays P65 / LBR-008's** |
| **Depends on** | CN-003 |

## The job

`list_node_types`, `get_node_type` and `find_tools` answer from the catalog, so they answer about
built-ins only. After CN-003 the overlay exists; this task spends it — an agent working in a project
with kits should see those node types with the same fidelity as built-ins, per **P1**.

## 🔴 The constraint that dominates the design

🔴 **CORRECTED 2026-08-15 — this task was scoped against a bar that had already moved.** The numbers
below are re-read from [`toolDisclosure.test.ts`](../../../packages/noodl-mcp/tests/toolDisclosure.test.ts),
not from the phase-69 scoping session:

| | tokens |
|---|---|
| LEG-001's bar (what this task was written against) | 8,200 |
| measured with **P67 / UNI-010 entirely absent** | **8,198** — two under |
| + UNI-010's `lesson` group, its `find_tools` enum value and its one-line `purpose` | **8,223** |
| **the bar today** | **8,280** — 57 tokens of slack |

**So the "56 of 58 banked tokens are spent" sentence was true and is now history.** What spent them
was phase 67's lesson-authoring group, and the bar was renegotiated to put LEG-001's slack back
rather than to make room for anything new. **The headroom this task has is 57 tokens, not zero — and
it is the same 57 tokens CN-006's `create_node_kit` is competing for.**

🔴 **The renegotiation carries an explicit condition, and it is binding on this task.** The test's own
note reads: *"this is the second renegotiation and there should not be a third … the `$ref` fix is
still the honest answer for the next one."* **CN-009 is the next one.** A design here that ends in
"raise the bar to 8,400" is the outcome that note forbids; the sanctioned move is the `$ref`ed node
schema, which pays for itself because the node schema is currently **inlined three times**
(`create_component.nodes`, `update_component.set.nodes`, `add_node.node`) at ~45 tokens per declared
field per rendering.

⚠️ `a-one-sided-budget-gate-reports-the-crossing-not-the-approach`: the gate tells you when you have
crossed, never that you are about to — which is exactly how UNI-010 spent the slack without knowing
it existed. Measure **before** designing the surface, not after implementing it, and **record the
margin on a passing run** rather than only the verdict.

Two consequences, both binding:

1. **This task must state what it displaces**, not only what it adds. A design that assumes room is
   not a design.
2. **Prefer enriching existing tools over adding new ones.** Kit types flowing through
   `list_node_types` costs nothing at the surface — the tool already exists and its description need
   not grow. A `list_node_kits` tool costs a full entry. CN-006 is *also* competing for this headroom
   with `create_node_kit`; the two tasks must agree on the split rather than each assuming it.

## What to build

- **`list_node_types`** includes kit types, marked with their provenance so an agent can tell whose
  node it is (✅ D1 makes provenance a first-class fact, and an agent needs it for the same reason a
  human does).
- **`get_node_type`** resolves a kit type to its real ports — the same shape it returns for a
  built-in. **P1: no reduced-fidelity path for kit nodes.**
- **`find_tools`** matches kit node names and their `docs` text.
- **`validate_component` / `validate_project`** inherit CN-004's behaviour automatically. Confirm it
  rather than re-implement.

## Acceptance criteria

1. `list_node_types` in the cashflow project returns the five kit types, with provenance, and the
   built-ins unchanged.
2. `get_node_type('nodegx.cashflow.Pill')` returns the **same port detail** the editor's property
   panel shows. Compare against the measured counts (23 in / 14 out) rather than eyeballing.
3. **The surface still passes the token gate at its current bar of 8,280**, with the measurement
   recorded in the task notes — before and after, **as a margin, not as a pass**. Raising the bar a
   third time does not satisfy this criterion.
4. In a project with no kits, every tool's output is unchanged.
5. **Build the caller**: drive a real MCP session that discovers a kit node it was not told about and
   places it. Tool output changing shape is the mechanism; an agent successfully using an unfamiliar
   node is the consequence.

## Traps

- ⚠️ **The MCP `dist/` goes stale, and a fresh `dist/` can still mislead** — running servers load
  from `/Applications/…`, so reaching one needs a repackage. Check the **path and start time** of the
  server you are testing, or you will verify last week's build.
- ⚠️ Do not let kit types leak into a *different* project's answers. One server is bound to one
  project; CN-003's overlay must be scoped, and this is where a leak would first show.

## Out of scope

- Library/shelf discovery and `install_prefab` — ✅ **D7** leaves those with P65's rescoped LBR-008,
  which layers on CN-003 rather than duplicating it.
