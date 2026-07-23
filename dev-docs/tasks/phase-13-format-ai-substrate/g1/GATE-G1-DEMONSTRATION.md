# Gate G1 Demonstration — External Agent Authors a Page via MCP

**Date:** 2026-07-23
**Gate:** *An external AI agent, via MCP + catalog, authors a valid new page into a
real project without ingesting the whole project, and the semantic validator +
editor both accept it.*
**Result:** ✅ **Passed** — and, as SUB-008 intended, the exercise doubled as design
feedback: it surfaced one real server bug (fixed the same day, regression-tested)
and three smaller surface improvements.

## Setup

- **Project:** `big-merge-test-mine` from the real-project corpus ("Ferell-main",
  an e-commerce app) — **176 components, 2,933 nodes, 2,321 connections** —
  exported to the v2 decomposed format with `ProjectExporter`. Baseline
  validation: 0 errors, 12 warnings (pre-existing unknown module types).
- **Agent:** a general-purpose Claude agent with **no access to the NodeGX
  codebase or the project files** — its only interface was
  `packages/noodl-mcp/examples/call-tool.mjs`, a minimal MCP stdio client
  calling one tool per invocation against `dist/noodl-mcp.cjs`
  (`--allow-writes`).
- **Task:** discover the app's page conventions, add an "About" page following
  them, wire navigation if the mechanism is imitable, validate.
- **Recording:** every MCP call and result in [`transcript.jsonl`](./transcript.jsonl)
  (results truncated at 800 chars; 30 calls total).

## What the agent did (compressed from its report)

1. **Orientation (calls 1–3):** `get_project_info`, then `list_components
   {type: "page"}` → empty (this legacy-exported project types everything
   "visual"; pages are named "X Page"), then the full listing.
2. **Convention discovery (calls 5–11):** read ONE page (`Account/Account Page`)
   and `explain_component` on five architecture pieces (`Main`,
   `Orders/Edit Order Page`, `UI Components/Navigate To Page Stack`,
   `UI Components/Base Layer`, `UI Components/Page`, `UI Components/Select Tab`).
   From those it correctly reverse-engineered the whole navigation model:
   States-node-driven Page Stacks, `/UI Components/Page` wrappers with
   Show/Back/To Right ports, tab switching via a global "Select Tab" event.
3. **Catalog (calls 12–13):** exact typeNames + port names for `Text`, `Group`,
   `Component Inputs`, `Component Outputs` via `get_node_type`.
4. **Authoring (call 14):** `create_component "Account/About"` — a
   convention-faithful sub-page (Page wrapper instance, scroll/content Groups,
   heading, body, "Back to Home" Design System button wired to the app's
   Select Tab event, Component Inputs/Outputs relaying Show/Back). **Accepted
   first try: 0 errors, 0 warnings.**
5. **Wiring attempt (calls 15–27):** updates to the *pre-existing* Account Page
   were rejected with internal schema errors (see finding below). The agent
   isolated the bug with disciplined probes (fresh component updates worked;
   every legacy component failed), prepared the full wiring payload anyway, and
   stopped rather than force a destructive workaround (its delete+recreate
   attempt was denied by the permission system and it respected the denial).
6. **Final validation (call 28):** 0 errors, 12 warnings — byte-identical to
   baseline; the new page introduced zero diagnostics.

The essential property held: the agent read **one page, five explains, four
catalog entries** — never the project (176 components).

## Finding: update_component failed on all legacy-exported components

**Bug.** Legacy projects may carry id-less components; `ProjectExporter` then
emits `component.json` without `id` and nodes/connections without
`componentId`. The MCP write gate's structural check rejected every update to
such components with diagnostics about the *server's own* files — unactionable
for the caller, and `create_component`'s "already exists → use
update_component" advice became circular.

**Fix (same day):** the update path now backfills missing
`id`/`componentId` before validation (`backfillIds` in
`packages/noodl-mcp/src/tools/author.ts`), with a regression test that strips
ids from a fixture component and updates it. Also from the agent's feedback:
`list_components` with a type filter that matches nothing now explains the
project's actual type distribution instead of returning a bare `[]`.

**Fix verified against the blocked step (calls 29–30):** the agent's own
prepared payload — an `update_component` full-graph `set` adding the About
state, list row, page instance and 6 connections to `Account/Account Page` —
was replayed against the fixed server: **accepted, 0 errors**, and the whole
project still validates at 0 errors / 12 baseline warnings. The About page is
created *and* reachable.

## Editor acceptance

`tests/roundtrip.test.ts` reconstructs MCP-authored components through
`ProjectImporter.reconstructLegacyComponent` — the exact code path the editor's
ComponentLoader uses (SUB-001) — asserting well-formed legacy graphs (root
nesting, child order, connections).

## Remaining surface feedback (noted, not yet acted on)

- The single-call example client hides MCP's native `tools/list`; real MCP
  hosts (Claude Code, Desktop) show all tool schemas up front, so the agent's
  "no way to discover tools" friction is an artifact of the demo driver, not
  the server.
- `get_node_type` takes `type_names[]` while component tools take `path` — one
  round-trip lost to naming inconsistency; acceptable, documented in README.
