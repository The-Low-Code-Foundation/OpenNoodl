# AAQ-005 — One authoring substrate

**Findings:** #11 and Richard's directive on the contract question: *"Hooold the front door… Surely
we can do better than [one component per session]. Let's not cut corners here."*
**Status:** open — the risk-bearing task of the phase

## The problem

The editor's authoring contract is one component per operation per model session
(`submit_component`, whole-candidate). Components-by-default multiplies components; under the
current contract that multiplies serial sessions, and each section of a page is authored blind to
its siblings' internals. Meanwhile `noodl-mcp` (SUB-008) already exposes a multi-component substrate
to external agents — which means the editor and the MCP server speak **two dialects of the same
semantics**. BCN-003 taught us exactly where that road goes (three twins of the filter dialect).

## The shape

One tool contract, defined once, bound twice:

```
packages/…/authoring-substrate (name TBD; likely grows out of the existing
                                authoring/ tool layer + noodl-mcp's tools)
  ├─ tools: the contract (schemas + semantics), MCP-shaped
  ├─ editor binding: tools over ProjectModel + ChangeSet/staging (transactional)
  └─ mcp binding: noodl-mcp re-exports the same contract
```

### The toolset (draft — converge with what noodl-mcp already has, don't invent beside it)

Read: `list_components`, `get_component`, `get_node_types`, `get_project_doc`,
`get_style_vocabulary`, `get_backend_schema` (AAQ-002 slice 4), `list_project_assets` (closes the
AIB-010 gap: styles, components, images by *name*).

Write — all staged into one changeset, nothing touches the project until apply:
- `create_component` / `update_component` — per-component, validated on submit exactly as today
  (the AIX-002 compiler-loop property is the crown jewel; keep it per component).
- `delete_component` — the planner currently can't even plan deletion; decide scope with Richard.
- `set_project_setting` — allowlisted keys (`bodyScroll` first — AAQ-003).
- `set_design_tokens` — bulk token writes through the `applyPreset` seam (AAQ-009).
- `register_pages` — router registration if AAQ-001 lands it as a distinct verb rather than an
  `update_component` on App (decide there, honour it here).

Preview/verify (AAQ-007 consumes these): `render_preview`, `get_render_report`.

### Semantics that must hold

1. **Transactional**: the changeset applies all-or-nothing; repair is incremental (the AIB-001
   recovery shape). A multi-component build that fails validation on component 4 keeps 1–3 staged
   and repairs 4 — never re-authors the world.
2. **Whole-candidate per component** stays: `update_component` takes the full component, kept ids
   preserved. The diff-review UX and the staging model survive unchanged above the substrate.
3. **Validation runs per submit**, cheap and inside the loop — diagnostics return as tool results,
   the compiler-loop conversation shape unchanged.
4. **One dialect**: `noodl-mcp`'s existing tools either become re-exports of this contract or are
   migrated to it with deprecation shims. Grep for drift the way BCN-003b did; a snapshot test pins
   the two surfaces to one schema source.
5. **One gate policy** (verified 2026-08-04): the twin already exists. `noodl-mcp` shares the
   validation *rules* via `editor-deps.ts` but gates on `severity === 'error'` only
   (`packages/noodl-mcp/src/validate.ts:72`) — the editor's `BLOCKING_WARNINGS` policy has no MCP
   counterpart, so a bare `width: 228` blocks the embedded agent and ships through Claude Code
   today. The blocking policy moves into the substrate so both clients get one gate.
6. **The guidance surface**: the internal system prompt has no external twin — Claude Code sees
   only tool descriptions, `get_node_types`, and diagnostics. Doctrine (AAQ-008/009/010) that must
   reach external authors lands in catalog enrichment, tool descriptions, and an MCP
   server-instructions block or shippable NodeGX authoring skill — not only in
   `prompts/authoring.ts`. This is what the README's parity exit criterion actually tests.

## What this replaces

`AuthoringSession`'s tool plumbing and `PlanRun`'s one-op-one-session orchestration become
consumers of the substrate. They keep working through this task (AAQ-006 retires the orchestration);
this task's deliverable is the substrate plus the editor binding plus the MCP convergence, proven by
the existing loop running on top of it with zero behaviour change (the aib-001 suites and the
scripted drivers in `scripts/aib38-live/` are the regression harness).

## Acceptance criteria

1. The editor's existing single-component loop runs entirely through the substrate; `npx jest
   tests-unit/aib-001` green; scripted plan driver green.
2. `noodl-mcp` serves the same tool schemas from the same source of truth; a test fails if the two
   surfaces diverge.
3. A scripted multi-component session (no model) creates a page + two section components + a token
   write in one changeset, applies atomically, and undoes as one group.
4. Claude Code, pointed at `noodl-mcp` against a scratch project, builds a multi-component page
   through the converged tools — driven once, live, and the transcript kept as a fixture.
5. Parameter-value validation (AIB-001), connection-only, units, and blocking-warning behaviour are
   byte-identical before/after (replay the 31-finding fixture from the diagnosis session).

## Traps

- MCP runs against viewer clients for the node library in cloud-function contexts (WFA-001) — the
  substrate must not assume the editor's catalog is the only catalog source.
- `applyOperations`-style incremental mutation was rejected in AIX-002 for good reasons; do not let
  "multi-component" quietly reintroduce it. The unit is still the whole component.
- The editor specs under `tests/` are jasmine, not jest (`tests-unit/` is jest); only the `Jasmine:`
  line counts.
- Never `git add -A`; shared checkout.
