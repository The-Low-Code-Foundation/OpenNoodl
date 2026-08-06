# AAQ-005 — One authoring substrate

**Findings:** #11 and Richard's directive on the contract question: *"Hooold the front door… Surely
we can do better than [one component per session]. Let's not cut corners here."*
**Status:** open — **slices 1 (one gate), 2 (one apply) and 3 (one vocabulary) are built and green**;
criteria 3 and 4 are not started, and the multi-component *tool set* is deliberately still two shapes

## ⚠️ Slice 3 landed: one vocabulary, and the field that decides a port exists was on one door only (2026-08-05)

Slices 1 and 2 made both clients judge a candidate identically and then do the same things to the
project. Slice 3 is about the surface an agent reads *before* it writes anything: **the schema of what
it may say about a node.** That lived in two hand-written places, in two schema languages —
`AiAssistant/authoring/tools.ts` (JSON Schema, `submit_component`) and `noodl-mcp/src/tools/author.ts`
(zod, `create_component`/`update_component`) — and it had drifted in both directions.

| field | editor, before | `noodl-mcp`, before |
|---|---|---|
| `children` | absent (derived from `parent`) | accepted and reconciled |
| `variant` | absent | accepted |
| `plug` on an instance port | declared, and required | **not declared at all** |
| `sample_data` | accepted | absent |
| `stateParameters` and friends | not expressible | reachable via `.passthrough()` |

Four of those are deliberate and are now declared with their reasons. **One had a consequence**, and it
is the slice's finding: a declared instance port with no `plug` is not merely under-specified, it is
**inert**. `NodeGraphNode.getPorts(filter)` selects with `p.plug && p.plug.indexOf(filter) !== -1`, and
`componentmodel` derives a component's interface from `getPorts('input')` / `getPorts('output')` on the
`haveComponentPorts` nodes — so a `Component Inputs` node carrying `ports: [{ name: 'Title' }]` lands in
neither map. The port is written, the structural schema passes (`nodes.schema.json` requires only
`name`), the canvas shows nothing, and the component silently has **no inputs**. The agent believes it
built a component interface and built nothing. MCP's schema never mentioned the field; the editor's
declared it required, but that schema is *instruction only* — `toSubmitPayload` casts unchecked — and no
rule checked it on either door.

### What was built

- **`validation/authoringVocabulary.ts`** — one table for four surfaces (node, instance port,
  connection, submission payload). Each field carries its kind, its one shared description, which
  clients expose it, where it is required, and — whenever any of those is partial — **why**.
  `undeclaredDivergences()` returns the offenders and a spec asserts that list is empty, so a divergence
  cannot be added quietly. `SURFACE_DIVERGENCES` does the same job for differences that are not about a
  field (the `operations` delta dialect, `if_revision`, the plan tools as tools, passthrough-vs-carry,
  and the enforcement asymmetry below).
- **Two renderers, one declaration.** The editor renders JSON Schema from the table
  (`jsonSchemasFor('editor')`); `noodl-mcp/src/vocabulary.ts` renders zod. The table cannot render zod
  itself — `noodl-editor` has no zod dependency and should not grow one to describe a surface it emits
  as JSON Schema.
- **`DiagnosticCode.PortWithoutPlug`**, an **error** in the shared precondition set — which is now five
  checks, not four. Both gates refuse a plug-less port; `gateParity.test.ts` asserts they refuse it
  identically.
- **`authoredNodes` converged.** It was a byte-identical twin in `authoring/validate.ts` and
  `noodl-mcp/src/validate.ts`, and it is the seam a new field travels through to reach the checks —
  adding `ports` to it would have meant editing two copies, and the forgotten one would have quietly
  stopped checking. That is precisely how `children` and `variant` drifted in the first place.

### ⚠️ Two traps worth keeping

1. **The two surfaces do not enforce alike.** On the MCP side these schemas are **enforcement**: zod
   rejects a tool call before the handler runs. On the editor side they are **instruction**:
   `toSubmitPayload` casts the model's arguments unchecked and `buildCandidate` re-derives the shape
   errors it needs. So `requiredIn: ['mcp']` hard-rejects external calls that work today, while
   `requiredIn: ['editor']` only changes a sentence a model reads. This is why `id` and `plug` are
   required on one door and merely described on the other — converging the *text* is free, converging
   the *enforcement* is a breaking change to a shipped API. Slice 2's lesson in a new dress.
2. **Deriving a zod shape from a table erases the types that make the write path safe.** A rendered
   `Record<string, ZodTypeAny>` makes zod infer every tool argument as `{ [x: string]: any }`, and every
   write handler in `author.ts` and `planTools.ts` takes its arguments from that inference. Caught by
   `tsc` on the one handler that still declared its parameter precisely — had that handler not existed,
   the whole authoring write path would have silently become `any`. The runtime values come from the
   table; the compile-time shapes are stated in `vocabulary.ts` and checked by the parity spec reading
   each registered schema back.

### Evidence

- `tests-unit/aaq-005/authoringVocabulary.test.ts` — 16 cases. Pins `submit_component` **byte-for-byte
  against a verbatim copy of the literal it replaced** (the in-editor loop's prompt surface is not a
  refactor's to change), the undeclared-divergence invariant, the explicit divergence list as a
  deliberate-edit gate, and that no node or port field is absent from `nodes.schema.json` — the phantom
  field class. **Verified non-vacuous: adding one undeclared, unstored field fails 7 of 16.**
- `noodl-mcp/tests/vocabularyParity.test.ts` — 23 cases reading **both renderings** back: field sets,
  optionality, descriptions, enum members, and the behaviours the renderer had to preserve (node and
  port passthrough, connection not, `path` required, `nodes` min 1). **Verified non-vacuous: reinstating
  the old hand-written schemas fails 8 of 23.**
- `tests-unit/aaq-005/instancePorts.test.ts` — 14 cases. `gateParity.test.ts` gained 2 (both gates
  refuse a plug-less port; both accept `input/output`); `tests/ai/authoring-validate.test.ts` gained 2.
- **Calibrated on all three populations before the check was made an error**, because a rule calibrated
  on the project corpus is not calibrated on the authored one: the 96 real projects declare **1483
  instance ports and 1483 carry a plug** — `input` 512, `output` 879, **`input/output` 92**. That third
  value is why the corpus had to be read rather than reasoned about: a check recognising only
  `input`/`output` would have flagged 92 legitimate ports. The AI specs and MCP fixtures declare none
  without a plug. Zero hits in all three.
- Editor suite **2202 specs, 0 failures**; `noodl-mcp` **161 tests / 15 suites**; runtime **2144
  passed**; `typecheck:editor` and `typecheck:editor-tests` clean.

Filed rather than fixed: **AAQ-011 F14** — `variant` and the visual-state fields are expressible only
through the external door, so an editor-authored *create* can never carry either. That is AAQ-010's
subject and needs the agent told which variants exist (the AIB-010 gap) before the field is worth
offering.

### What slice 3 leaves

The **tool set** is still two shapes, and the note below on criterion 2 stands: the editor exposes three
tools and `noodl-mcp` its own larger surface, with two divergences (`operations`, the plan tools) that
are deliberate. What is converged is the *vocabulary* they speak, which is the half that had drifted
without anyone deciding to. Criteria 3 and 4 are untouched.

## ⚠️ Slice 2 landed, and it found the gate was only half the substrate (2026-08-05)

Slice 1 made both clients *judge* an authored candidate identically. Slice 2 found that they still did
completely different things **after** judging it, and that the difference silently reintroduced two of
the four findings Layer 1 was written to close.

**Layer 1's three project-level effects lived in the editor's apply path and nowhere else.**

| Layer-1 effect | Editor | `noodl-mcp`, before slice 2 |
|---|---|---|
| Register the page in a Router (AAQ-001, finding #5) | `planPageRegistration` → `applyAuthoredPlan` | **absent** — read `nodegx.routes.json`, never wrote a router |
| `bodyScroll` (AAQ-003, finding #8) | `applyAuthoredPlan` `settings` | **absent** — `create_plan` could not express a project setting |
| Provision a backend (AAQ-002) | plan kind `'provision'` | **absent** — the kind was not in `create_plan`'s enum |

`provision` and `scroll` appeared **nowhere** in `packages/noodl-mcp` (grep, zero hits), while both
packages import `validatePlan`/`orderPlanOperations` from the *same* `authoring/plan` module — which
has handled `provision` since AIB-007. One plan model, two plan vocabularies.

**And slice 1 made the first one sharper, not safer.** `checkNavigation` resolves a Navigate target
against the project's **component names**, not against router registration. That is sound in the editor
*only because* the editor's apply registers the page a moment later. Bound to a client that never
registered anything, the check certified as correct exactly the button that would not work: Claude Code
could `create_component` a page, wire a `RouterNavigate` at it, pass the shared gate clean, and ship an
app with a blank screen. **Gate parity without apply parity is a gate that lies.**

### What was built

- **The registration decision is now one function with two bindings.** `readRouterPagesValue`,
  `findRoutersInComponents`, `isPlaceholderPageGraph` and `resolvePageRegistration` moved out of the
  editor's `staging.ts` into `pageRegistration.ts` (already pure, already AAQ-001's module), expressed
  over plain nodes. The editor's `staging.ts` supplies `ProjectModel` nodes; `noodl-mcp`'s new
  `project/pageRegistration.ts` supplies `ProjectStore` ones. Neither holds policy.
- **Registration fires on every door**: `create_component`, `update_component` (updates count, exactly
  as the editor's apply does — a page that exists but was never listed is the state the task is about)
  and `apply_plan`, in plan order, first page becomes home. Reported as `registeredPages` with the
  editor's own `describePageRegistration` sentence, because a tool that writes a component the caller
  did not name has to say so.
- **`create_plan` gained `scroll`**, applied at `apply_plan` as `bodyScroll` through a new
  `ProjectStore.writeProjectSettings` that **never overwrites a setting already present** — the
  editor's rule and its reasoning (a plan states what a *new* app needs).
- **`provision` is accepted and refused with a reason** — see AAQ-011 F13. One vocabulary, an honest
  capability.
- The MCP server instructions and `create_component`'s description now state the page contract. The
  word "Router" had appeared **nowhere** in anything a model driving this server could read, which is
  finding #5's root cause reproduced on the external door.

### Two traps worth keeping

1. **`graph.roots` is not `visualRoots`.** The placeholder start-page rule counts *parentless* nodes,
   visual and logic alike; `visualRoots` is the `allowAsChild` subset. Lifting the rule onto v2 files
   and reading `visualRoots` would have *widened* it — a page carrying a stray logic node would become
   a "placeholder", letting an apply take the start page away from a page somebody had begun building.
   Caught before it shipped, and it now has its own spec.
2. **The start-page lookup is exact, not `isSamePage`.** The editor resolved it through
   `getComponentWithName`, which compares verbatim. Widening it to the module's tolerant comparison
   would have been a real behaviour change smuggled in under a refactor.

### Evidence

- `packages/noodl-mcp/tests/pageRegistration.test.ts` — 8 cases. **Verified non-vacuous: 6 of 8 fail
  with registration neutralised**; the 2 that pass are the negative cases, which should.
- `packages/noodl-mcp/tests/planProjectEffects.test.ts` — 7 cases for the scroll setting and the
  provision refusal. **Verified non-vacuous: 3 of 7 fail** with both mechanisms reverted — precisely
  the three that assert a mechanism.
- `tests-unit/aaq-001/pageRegistration.test.ts` — 14 new cases over the lifted core, including the
  `visualRoots` trap above.
- Editor suite **2200 specs, 0 failures**; `noodl-mcp` **136 tests / 14 suites** (was 121/12); runtime
  **2144 passed**; both editor typechecks clean.

⚠️ **A ninth stale premise, and it is why nobody looked.** `pageRegistration.ts`'s own header said
*"`noodl-mcp` has no plan transaction at all"*. It has had one since AIX-011 — built on this very
package's `authoring/plan` module. What it lacked was not a transaction but the registration. Corrected
in the header.

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

*(Slice 2 then closed the apply gap — see the section above. Criterion 4 is now worth driving: before
slice 2 it would have produced an app with unreachable pages and no scrolling, and reported success.)*

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
- `set_design_tokens` — bulk token writes through the `applyPreset` seam. ✅ **DECIDED 2026-08-06
  (Richard): declared here, implemented in [AAQ-009](AAQ-009-A-BESPOKE-VISUAL-IDENTITY.md).** See
  *Decisions taken* below.
- `register_pages` — router registration if AAQ-001 lands it as a distinct verb rather than an
  `update_component` on App (decide there, honour it here).

Preview/verify (AAQ-007 consumes these): `render_preview`, `get_render_report`.

### Decisions taken

- **`set_design_tokens` is DECLARED here and IMPLEMENTED in AAQ-009** — Richard, 2026-08-06. The
  answer to *"AAQ-005 or AAQ-009?"* is **both**, and the split is the one this task exists to
  enforce: the **declaration** is a vocabulary question and the **behaviour** is a styling question.

  Concretely: AAQ-005 adds the tool to
  `packages/noodl-editor/src/editor/src/validation/authoringVocabulary.ts` — the one table rendered
  into **both** schema languages (the editor's zod and `noodl-mcp`'s JSON Schema) — so the two
  clients cannot diverge on it. AAQ-009 builds what it does, on the `applyPreset` seam
  (`StyleTokensModel.ts:263-268, 398-405`).

  ⚠️ **Why the order matters, and it is F15's lesson costing nothing this time.** The two
  `submit_component` / `create_component` schemas were hand-written twins and **`plug` was declared
  on one door only** — a declared instance port without `plug` is *inert*, so a component authored
  through the wrong door came out with no inputs, silently. `set_design_tokens` has exactly the same
  shape of exposure: a token field one client accepts and the other drops produces a project styled
  through one door and unstyled through the other, with no error anywhere. Declaring it in the table
  first means the parity spec (`tests-unit/aaq-005`, `noodl-mcp/tests/vocabularyParity.test.ts`)
  covers it from the day it exists rather than after the divergence is found.

  ⚠️ **Do not derive the token schema from the table by widening it to `any`.** Slice 3's recorded
  trap: deriving zod from the table turns the write path into `any` unless each field is declared
  with its type. A token set is the largest structured payload either door will carry.

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
   *(Slice 1 met the second clause for the gate. **Slice 3 met both clauses for the authoring
   vocabulary** — one table, two renderers, `vocabularyParity.test.ts` as the detector. What remains is
   the tool **set**: three tools here, a larger surface there, with `operations` and the plan tools
   deliberately MCP-only. A drift detector over the shared vocabulary now exists; forcing one tool list
   is a separate decision.)*
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
