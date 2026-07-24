# AIX-002 — As-Built Notes

_Executor: Fable 5. Committed to `cline-dev`. In progress — this file grows per slice._

## Slice 1 (2026-07-24): the headless loop

Spec step 1: prompt → context → author → validate → repair, no UI. Lives in
`packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/`.

### What exists

| File | Role |
|------|------|
| `types.ts` | Plain-data contracts: request, submitted payload, budget, log, metrics, outcome |
| `candidate.ts` | Agent payload → three v2 files; shape errors (dup ids, orphan parents, cycles) caught pre-validator |
| `validate.ts` | The gate: Ajv structural → SUB-006 semantic **strict**, same policy as the MCP write-gate |
| `ContextBuilder.ts` | Every handout charged against a hard budget and logged; no method returns >1 component |
| `tools.ts` | `get_node_types` (batched), `get_component` (bounded), `submit_component` |
| `prompts/authoring.ts` | System prompt (the authoring contract) + opening turn; no repair template — diagnostics return as tool results |
| `AuthoringSession.ts` | The loop: bounded turns (12) and submissions (4); outcome carries staged files + full metrics + transcript |

### Decisions worth keeping

- **One project representation.** The session holds AIX-004's `ExplainGraph` — it feeds
  both context assembly (`assembleContext`/`renderContext`, reused as-is for
  `get_component`) and the semantic validator (`GraphComponent` ≅ `NormComponent`,
  a 15-line pure conversion in `validate.ts`). No second model, no adapters to drift.
- **The no-whole-project rule is structural.** Context is *pulled* by the agent through
  tools; `AuthoringContextBuilder` has no method that returns more than one component,
  charges every handout against `maxChars` (default 120k), caps full component reads
  (default 6), and logs refusals. The spec's "an assertion that the whole project was
  never sent" is a passing spec, not a promise.
- **Parent-only hierarchy contract.** The agent sends `parent` fields; children arrays
  are derived from submission order. MCP's `reconcileHierarchy` exists because external
  agents send both; for our own prompt we removed the double-bookkeeping instead of
  reconciling it. This is a *different contract*, not duplicated code.
- **`normalizeV2Component` moved** from `validation/loadV2Project.ts` (Node-only, `fs`)
  to `validation/normalize.ts` (pure) and is now in the validation barrel; loadV2Project
  re-exports it so the MCP server's `editor-deps` and the CLI are untouched. This is the
  substrate-sharing move that lets the renderer validate in-memory candidates the exact
  way the MCP write-gate does.
- **`chat` is injected** (`AuthoringChatFn`). Editor binds `AiClient.chat`, specs bind a
  script, and a future measurement harness can bind a directly-constructed provider with
  env keys — no electron, no safeStorage.
- **Repair is conversational, not templated.** `submit_component` rejection returns
  `formatDiagnosticLine` output (which already carries `did you mean` + `available:`) as
  the tool result. The fix sits adjacent to the mistake in one conversation; specs show
  the diagnostic driving a correct repair.

### Traps hit

- `Component Inputs` declares its interface via instance `ports` with **plug
  `"output"`** (values flow out of the node into the graph); `Component Outputs` the
  inverse. Prompt states this explicitly — it is exactly the kind of thing a model
  inverts.
- Strict mode + the corpus: dynamic-port nodes (89 of 135 types) skip port checks, so a
  minimal valid component is easiest built from `Component Inputs`/`Outputs`; port-name
  errors only fire on static-port nodes. Validity in tests ≠ port-perfect graphs —
  the live-provider measurement still matters.

### Verified

- `npm run test:ci`: **1129 specs, 0 failures** (+22 new in `tests/ai/authoring-*.test.ts`) —
  candidate shaping, gate behaviour against the real corpus (typo→suggestion,
  dangling connection, component-ref resolution, structural-vs-semantic ordering),
  loop mechanics (repair round, budget refusals, exhaustion, nudge, error outcome,
  null-cost propagation), and the never-whole-project accounting.
- `npx tsc --noEmit` clean (editor + noodl-mcp); `noodl-mcp` jest 31/31 and bundle build
  green after the normalize move; `npm run catalog:check` green.

## Slice 2 (2026-07-24): staging + accept/refine/reject + undo

Spec step 3. Two additions: `staging.ts` (the only code that touches the live
project, crossed only on accept) and a conversational `refine()` on the session
(pre-accept refinement, before the post-accept update-shaped flow of step 6).

### What changed

| File | Change |
|------|--------|
| `staging.ts` | New: `acceptAuthoredComponent(project, files)` — staged v2 files → `reconstructLegacyComponent` → `ComponentModel.fromJSON` → `addComponent({ undo: true })`; `StagingError` on name collision |
| `AuthoringSession.ts` | Conversation state promoted to the instance; `refine(instruction)` opens a fresh round (own turn/submit budget) in the same transcript; `stagedFiles` getter keeps the last good candidate; `AuthoringStateError` for out-of-order calls |
| `prompts/authoring.ts` | `refineMessage()` — feedback + "resubmit the FULL component" |

### Decisions worth keeping

- **Reject is the absence of a call.** Staging is the only module that touches
  `ProjectModel`, and only `acceptAuthoredComponent` crosses. The spec's "reject
  leaves the project byte-identical" is asserted by running a full authoring
  session against a real `ProjectModel` corpus and comparing `toJSON()` strings.
- **Accept reuses the loader's own path.** `reconstructLegacyComponent` (the
  exact function `ComponentLoader`/`ProjectImporter` use to read v2 files from
  disk) converts the staged trio in memory — no disk round-trip, no second
  converter to drift. `candidate.ts` sets `component.path`, so `toLegacyName`
  round-trips the name perfectly.
- **Undo comes free from `addComponent({ undo: true })`** — the same mechanism
  the components panel uses, so an accepted AI component undoes/redoes exactly
  like a hand-made one. A spec asserts undo restores the project byte-identically.
- **Refinement keeps the whole-candidate contract.** `refine()` continues the
  same conversation (system prompt and fetched documentation stay in force) and
  requires a full resubmission — the gate always validates a complete component
  and staging stays a simple swap. Per-round budgets reset; metrics and rounds
  are cumulative. An exhausted refinement round does not lose the previous good
  candidate: `stagedFiles` still holds it.
- **`reloadComponentFromDisk` was deliberately not used.** It exists as a
  file-watch seam but has no callers; in-memory `addComponent` is the live-apply
  path — it fires `componentAdded`/`typeAdded`, so the canvas and node picker
  see the component immediately.

### Verified

- `npx tsc --noEmit` clean; `npm run test:ci` **1136 specs, 0 failures** (+7:
  4 staging in `authoring-staging.test.ts`, 3 refine in
  `authoring-session.test.ts`). Staging specs run against the real corpus
  loaded into a real `ProjectModel` with the real `UndoQueue`, and assert
  undo-restores-byte-identical and reject-leaves-byte-identical.

### Not yet done (later slices)

1. **Live provider runs** (spec step 2) — prompt/context iteration measuring validity
   rate, rounds, context size against real models. Needs keys; also the first live
   exercise of AIX-001's adapters.
2. Conversation UI with streaming (step 4) — `AuthoringSession` publishes no state yet;
   add an `onChange` like `ExplainSession` when the panel lands.
3. Live canvas rendering during authoring (step 5).
4. Post-accept refinement of an existing component (step 6) — needs an
   update-shaped submit (MCP's `applyOperations` is the substrate to share);
   pre-accept refinement shipped in slice 2.
5. Opt-in Gate-G2 telemetry (step 7).
