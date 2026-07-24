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

### Not yet done (later slices)

1. **Live provider runs** (spec step 2) — prompt/context iteration measuring validity
   rate, rounds, context size against real models. Needs keys; also the first live
   exercise of AIX-001's adapters.
2. Staging into the live project + accept/refine/reject + undo (spec step 3).
3. Conversation UI with streaming (step 4) — `AuthoringSession` publishes no state yet;
   add an `onChange` like `ExplainSession` when the panel lands.
4. Live canvas rendering during authoring (step 5).
5. Refinement flow against the just-authored component (step 6) — needs an
   update-shaped submit (MCP's `applyOperations` is the substrate to share).
6. Opt-in Gate-G2 telemetry (step 7).
