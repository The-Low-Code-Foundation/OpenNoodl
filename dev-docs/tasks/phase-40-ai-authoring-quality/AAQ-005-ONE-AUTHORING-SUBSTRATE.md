# AAQ-005 — One authoring substrate

**Findings:** #11 and Richard's directive on the contract question: *"Hooold the front door… Surely
we can do better than [one component per session]. Let's not cut corners here."*
**Status:** open — **slice 1 (one gate) is built and green**; the toolset and the multi-component
contract are not started

## ⚠️ Slice 1 landed, and it corrected this file's §5 (2026-08-05)

Read this before the rest of the document, because §5 below is the premise it falsifies and the
sentence *"noodl-mcp shares the validation rules via `editor-deps.ts` but gates on `severity ===
'error'` only"* is wrong in a way that changes what the task is.

**`noodl-mcp` did not share the rules. It shared the semantic validator and nothing else.**
`checkParameterValues`, `checkBackendRequirements`, `checkNavigation` and `checkPageShape` appeared
**nowhere** in `packages/noodl-mcp` (grep: zero hits), and `editor-deps.ts` never re-exported one of
them. So the gate was not applying a laxer policy to those diagnostics — it never computed them. Its
`severity === 'error'` filter was correctly implemented and had nothing to filter.

That makes the consequence bigger than the file claimed. It was never only a bare `width: 228`
slipping through as a blocking *warning*. `checkParameterValues` emits roughly **fifteen distinct
error-severity diagnostics**, `ConnectionOnlyParameter` among them — the diagnostic *this phase*
created, for the mechanism that silently discarded a whole build's styling. Every one of them
rejected a submission in the editor and shipped clean through Claude Code.

**And there were three gates, not two.** `noodl-mcp/src/validate.ts` (the write tools) and
`noodl-mcp/src/tools/planTools.ts::validateStaged` (the plan tools) were separate implementations,
each carrying its own copy of `diagnosticKey` and its own baseline logic — one of them with a comment
observing that keeping them identical was deliberate. BCN-003's three twins of one semantics, already
realised, inside the task written to prevent them.

### What was built

`validation/authoredCandidate.ts` — the gate's **policy and preconditions** as pure functions over
plain data, in the layer both packages already import, which is what makes "defined once" a fact
rather than an intention. It exports `authoredPreconditionDiagnostics` (the four checks, in the order
the editor has always composed them), `AUTHORED_BLOCKING_WARNINGS`, `isBlockingForAuthoredOutput`,
`diagnosticKey` and `declaredUrlPaths`. `looksLikePageComponent` moved to `validation/navigation.ts`
beside `checkPageShape` (re-exported from `pageRegistration`, so no caller changed) because three
bindings must answer "is this a page" identically.

All three call sites now compose it: the editor's `validateCandidateComponent`, the MCP write gate,
and the MCP plan gate.

**What it deliberately does *not* converge:** project normalization and the validator instance. The
two clients legitimately differ — the editor validates against an `ExplainGraph`, the MCP server
against its `ProjectStore`, and the MCP validator is built over the *enriched* catalog index so its
catalog tools and its gate can never disagree about a type. Converging those too would have changed
MCP's semantic results as a side effect of closing a gap in what it checks at all: a regression bought
with a refactor.

### The second defect, found by binding it

The baseline exemption covered `severity === 'error'` only, so **a pre-existing blocking *warning* was
always charged to the agent**. That reinstates on warnings the exact treadmill the exemption exists to
prevent, and the corpus is full of the population it bites: imported nodes carrying `UnknownParameter`
settings the catalog cannot see. An agent told never to argue with a diagnostic can satisfy it only by
deleting the parameter.

Proven on `noodl-mcp`'s own fixture, which ships a `RouterNavigate` with no target in `/Pages/Home`:
adding one unrelated `Text` node to that component was rejected for a dead button the agent had never
touched. The exemption now covers blocking diagnostics, over all four preconditions. Baselining the
project-relative checks is safe because the baseline is validated against *today's* project — a link
broken by someone else's deletion is already in the set and forgiven; one the candidate breaks itself
is not, and still blocks.

### Evidence

- `packages/noodl-mcp/tests/gateParity.test.ts` — six cases run through **both** bindings and assert
  the same verdict and the same blocking codes. **Verified non-vacuous: 4 of 6 fail against the old
  behaviour.** The two deliberate differences (catalog source, backend facts) are documented in the
  spec rather than asserted away.
- `tests/ai/authoring-update-baseline.test.ts` — two cases for the widened exemption. **Verified
  non-vacuous: the forgiveness case fails against the old errors-only filter, and reverting it broke
  nothing else in 2200 specs.**
- Editor suite **2200 specs, 0 failures**; `noodl-mcp` **121 tests, 12 suites, all passing** (it had
  been red since `7fd3e053` — see AAQ-011 F12); runtime **2144 passed**; both typecheck gates clean.

Three MCP fixtures were corrected, and all three were true positives: two authored a button wired to a
`RouterNavigate` with no target, and one reused node ids the fixture's own `/Pages/Home` already had.

### What slice 1 leaves for the rest of the task

Acceptance criteria 1, 2 and 5 are met **for the gate**. Criterion 2's "same tool schemas from the same
source of truth" is untouched — the editor still exposes three tools and `noodl-mcp` exposes its own
surface, and that convergence is the toolset work below. Criteria 3 (a scripted multi-component
session) and 4 (Claude Code driven live) are not started.

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
5. ~~**One gate policy** (verified 2026-08-04): the twin already exists. `noodl-mcp` shares the
   validation *rules* via `editor-deps.ts` but gates on `severity === 'error'` only
   (`packages/noodl-mcp/src/validate.ts:72`) — the editor's `BLOCKING_WARNINGS` policy has no MCP
   counterpart, so a bare `width: 228` blocks the embedded agent and ships through Claude Code
   today. The blocking policy moves into the substrate so both clients get one gate.~~
   **Wrong mechanism, and CLOSED — see the slice-1 section at the top.** The rules were not shared,
   the gate never computed those diagnostics, and there were three implementations rather than two.
   One gate now, in `validation/authoredCandidate.ts`, with a parity spec that fails if the two
   bindings disagree.
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
