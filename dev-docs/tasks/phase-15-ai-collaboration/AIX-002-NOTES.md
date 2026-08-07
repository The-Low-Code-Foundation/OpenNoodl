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

## Slice 3 (2026-07-24): the conversation UI

Spec step 4. The session becomes observable and streaming; a new sidebar panel
("Build", id `ai-authoring`, registered after Explain) renders what it publishes.

### What changed

| File | Change |
|------|--------|
| `AuthoringSession.ts` | Publishes `AuthoringSessionState` via `onChange` (ExplainSession's pattern): an activity feed (`user` / `assistant` / `tool` / `submit`), a phase, and a `StagedSummary`. `AuthoringChatFn` gained an optional `AiStreamCallbacks` arg; the default binding moved `AiClient.chat` → `AiClient.chatStream`, so prose streams into the feed. `cancel()`/`dispose()` added; the session owns an AbortController per round |
| `types.ts` | `AuthoringStatus` gained `'cancelled'` — a cancelled round is not an error, and a candidate staged earlier survives it |
| `views/panels/AiAuthoringPanel/` | New: form (component path + description) → streaming activity feed → staged bar with Accept / Refine / Reject. Accept calls `acceptAuthoredComponent` then `switchToComponent` so the graph is on canvas immediately; reject disposes the session and nothing else |
| `router.setup.ts` | Panel registered, experimental, order 4.7 (next to Explain) |

### Decisions worth keeping

- **The panel owns no conversation state.** Same split as Explain: the session
  publishes, the panel renders. Scripted (non-streaming) chat functions still
  work unchanged — streaming is a progressive rendering of the same response,
  so every existing spec binds the same seam.
- **Empty assistant bubbles are dropped.** A model that goes straight to tools
  produces `text: ''`; feeding that to the feed reads as a stutter. The feed
  shows prose only when there is prose.
- **Cancelled ≠ error, and cancel keeps the last good candidate.** `cancel()`
  aborts the in-flight round; `stagedFiles` (and the published `staged`
  summary) still hold the pre-cancel candidate, so Accept remains available
  after stopping a refinement you regret asking for.
- **Accept navigates.** `switchToComponent(component, { pushHistory: true })`
  right after `acceptAuthoredComponent` — the component appearing on canvas is
  the payoff moment; until step 5 lands live rendering, this is the reveal.
- **A stopped run with nothing staged offers "Start over"**, which is the same
  code path as Reject — the absence of an accept call — with the form values
  retained for a rewording.

### Verified

- `npx tsc --noEmit` clean; `npm run test:ci` **1139 specs, 0 failures** (+3:
  feed ordering + phase progression, streamed prose deltas publishing, cancel
  keeps the staged candidate); `npm run catalog:check` green.
- Live smoke (CDP-driven editor, Shine Phase 2 project): "Enable Build" appears
  under Experimental panels with its description; toggling it adds the pencil
  icon; the panel renders the form, the disabled Build button, and the
  no-provider notice (this environment has no AI provider configured — a live
  authoring run through the panel is still pending, same gap as spec step 2).
  No renderer exceptions.
- Trap for the next smoke: with a project open, `cdp.js`'s default `editor`
  target can resolve to the "Noodl Editor Cloud Runtime" page — pass
  `--target=NodeGX` explicitly.

### Not yet done (later slices)

1. ~~Live provider runs (spec step 2)~~ — shipped in slice 5 (Anthropic measured;
   OpenAI blocked on account quota, not code).
2. ~~Live canvas rendering during authoring (step 5)~~ — shipped in slice 4.
3. ~~Post-accept refinement of an existing component (step 6)~~ — shipped in
   slice 6 as update mode (whole-candidate + diff review, NOT `applyOperations`;
   see the slice-6 design note); pre-accept refinement shipped in slice 2.
4. ~~Opt-in Gate-G2 telemetry (step 7)~~ — shipped in slice 6, local-first.

## Slice 4 (2026-07-25): live canvas rendering

Spec step 5 — "the single most legible thing this product can do." The graph now
assembles on a canvas *while* the agent writes it, not on accept.

### What changed

| File | Change |
|------|--------|
| `client/types.ts` | `AiStreamCallbacks.onToolCallPartial({index, name, argsText})` — the tool-call analogue of `onText`: accumulated (incomplete) argument JSON per fragment. `onToolCall` stays the source of truth |
| `client/providers/anthropic.ts` | Emitted from the `input_json_delta` accumulation point |
| `client/providers/openai.ts` | Emitted from the function-arg fragment accumulation point (only once the name has arrived). Ollama hands arguments over whole — no partials, by design |
| `authoring/partial.ts` | New: `PartialPayloadScanner` — resumable char-level scanner over the streaming `submit_component` JSON; yields each element of the root `nodes`/`connections` arrays the moment its brace closes. String/escape-aware (a `"nodes": [` inside a label cannot fool it), skips malformed elements, never throws, O(n) total across any fragmentation |
| `authoring/preview.ts` | New: `PreviewGraphBuilder` — one **detached** `ComponentModel` (never in any project), mutated incrementally via `addRoot`/`addChild`/`addConnection` with `disableSelect`; holds children whose parent hasn't arrived, wires connections when both endpoints exist, `flushOrphans()` roots the rest when the stream ends; fallback grid for coordinate-less nodes. Plus `RevealQueue` — caller-timed pacing, one item per tick, `flush()` drains |
| `AuthoringSession.ts` | Publishes `building: BuildingPreview` (`submission`, nodes/connections so far, `complete`). Partials feed it live via a per-turn scanner map; `completeBuilding()` publishes the authoritative payload on every submit — so providers without partials produce the same state, just all at once. `submission` increments per attempt: a repair round reads as a rebuild |
| `views/documents/AuthoringPreviewDocument/` | New document (registered in `router.setup.ts`): read-only `NodeGraphEditor` bound **once** to the builder's component — model events re-render each node, viewport never resets (`switchToComponent` clears `panAndScale`, so it is called only on submission reset). 90 ms reveal timer; topbar shows phase + Stop (busy) / Review-Accept-Reject (staged) / Close |
| `AiAuthoringPanel.tsx` | Opens the preview document before `run()` (the canvas is the stage before the first token); accept/reject exit back to `EditorDocument` when the preview is current; a `handlersRef` keeps the document's callbacks pointed at live closures |

### Decisions worth keeping

- **True streaming and the spec's "staged reveal" fallback are one code path.**
  The session publishes whatever granularity the provider gives (per-fragment or
  whole); the `RevealQueue` paces application either way. A provider without
  partial callbacks just means the queue fills at once and drains at 90 ms/item.
- **The preview mutates, it does not rebuild.** `bindModel` happens once per
  submission; every node arrives through `nodeAdded`/`connectionAdded` like a
  human edit, so the canvas animates incrementally with a stable viewport.
  Rebuild-and-switch per node would reset `panAndScale` on every update.
- **A repair round resets the canvas.** `submission` increments; the document
  rebuilds the preview from empty. Attempt two *is* a different graph — showing
  it as one reads truer than morphing the failed attempt in place.
- **The preview component is detached and stays detached** — same invariant as
  staging: reject is still the absence of a call. Detached rendering is the
  proven ChangeReviewDocument pattern; node types resolve via the `NodeLibrary`
  singleton, warnings/health simply don't compute (which is what a preview wants).
- **The scanner is resumable, not re-parsing.** It consumes only the appended
  tail per fragment, so char-by-char fragmentation costs one pass total — and a
  spec asserts char-by-char ≡ one-shot.

### Traps hit

- `switchToComponent` resets `viewport.panAndScale` on *every* call, even for the
  same component — hence bind-once-then-mutate, never switch-per-update.
- OpenAI streams the function *name* only in the first fragment; emitting a
  partial before the name arrived would give consumers nothing to route on.
- `ModelBindings` selects newly added nodes on next tick unless the mutation
  passes `disableSelect` — a paced reveal without it would fight the user's
  selection 11 times a second.

### Verified

- `npx tsc --noEmit` clean; `npm run test:ci` **1248 specs, 0 failures** (+17:
  7 scanner in `authoring-partial.test.ts`, 8 builder + 1 queue in
  `authoring-preview.test.ts`, 3 building-state in `authoring-session.test.ts`,
  minus none); `npm run catalog:check` green; `noodl-mcp` build + jest 31/31
  unaffected by the barrel additions.
- Live smoke (CDP, Shine Phase 2, scripted streaming chat driven through the
  real registered document): watched the canvas render "Building — 2 nodes so
  far…" mid-stream with Stop, then the full 5-node graph with the staged bar
  (Review changes / Accept / Reject). Building states published exactly
  0→1→2→3→4→5 nodes → +connection → complete, submission 1, outcome authored.
  No renderer exceptions. (Webpack-cache module access — `webpackChunknoodl_editor.push`
  — is the way to drive editor internals from CDP when nothing is on `window`.)

## Slice 5 (2026-07-25): live provider measurement (spec step 2)

Richard supplied real API keys (repo-root `.env`, see `.env.example`), unblocking
the one AIX-002 item that needed them: the first live exercise of the loop — and
of AIX-001's adapters — against real models.

### What exists

`packages/noodl-editor/scripts/aix002-measure/` — the terminal measurement
harness the spec's step 2 asks for. `build.mjs` esbuild-bundles `harness.ts`
into a self-contained CJS binary (same recipe as noodl-preview, but this import
graph is pure enough that exactly **one** shim is needed: `AiAssistantStore`,
pulled in via the client barrel, stubbed with a noop proxy since the harness
injects its own chat function). `prompts.ts` is an 8-prompt corpus against the
real 44-component git-repo-utf8 project — signals, component inputs, a
repeater, reuse of an existing project component, pure logic, conditional
visibility. Every session appends a full JSONL record (outcome + metrics +
transcript) to `dev-docs/tasks/phase-15-ai-collaboration/measurements/`.

```
node packages/noodl-editor/scripts/aix002-measure/build.mjs
node packages/noodl-editor/scripts/aix002-measure/dist/aix002-harness.cjs \
  --provider=anthropic --model=claude-sonnet-5   # --only=slug,… --model=… --project=…
```

### Results (2026-07-25)

**claude-sonnet-5, full corpus:** 8/8 valid on the **first attempt** — zero
repair rounds. Mean 2.6 turns, 1.0 submits, 26.4k context chars (~22% of the
120k budget; peak 57.8k), $1.18 total, 7–50s per component (one 266s outlier).
**claude-opus-4-8** (registry default; hello-cta, toggle-section, login-form
spot check): 3/3 first-attempt, 2.0 turns, $0.35. **OpenAI:** blocked — the
key authenticates but the account has `insufficient_quota`; the adapter's
error path handled it correctly (clean `error` outcomes, no crash). Rerun is
one command once billing is added.

Quality (human review of all 8 sonnet graphs, per the spec's
valid-but-poor risk): 7/8 architecturally sound. Highlights: `pill-row` read
the existing Pill component first and discovered its real input port names
before wiring `For Each` (`template: /Visual Components/Pills/Pill`, Static
Data → items); `login-form` gated the button with an Expression node;
`toggle-section` used the idiomatic Boolean+Inverter feedback toggle;
`counter-logic` is textbook. The context system behaved as designed
throughout: overview → targeted `get_node_types` → at most one full component
read, never a refusal, never the whole project.

### Findings for prompt/context iteration

- **The one real miss is altitude, not validity.** `article-list` (asked for a
  page repeating over articles) authored an *item*-shaped component instead:
  Component Inputs id/title/summary + an Event Sender broadcast. Root cause is
  structural: `For Each` needs a template *component*, and the loop authors
  exactly one component — with no suitable item template in the project the
  agent slid down to the item. Options when iterating: prompt guidance for
  this case (inline content, or say so), or a future multi-component authoring
  decision (currently out of scope by spec).
- **Empty-node tic:** 2/8 graphs carried an unused empty `Component Inputs`
  node. Validator-clean, cosmetically wrong; a system-prompt line should fix it.
- First-attempt validity at 100% means **repair-round improvement is currently
  unmeasurable** on this corpus with frontier models — the gate's value shows
  up in specs (scripted failures) and presumably with weaker models; harder
  prompts or `--model=claude-haiku-4-5` would exercise it live.

### Traps hit

- The bundle runs from `dist/` one level below the source, so `__dirname`-
  relative repo-root resolution off the *source* layout breaks silently after
  bundling — the harness finds the root by marker (`packages/noodl-editor`).
- A feed-narration cursor over `state.activities` **must track object
  identity, not indices**: the session splices empty assistant bubbles out of
  the feed mid-round, shifting indices under the cursor (this silently ate all
  tool/submit narration until reproduced offline with a scripted chat).
- `AuthoringSession` → client barrel → `AiClient` → `AiAssistantStore` is the
  only Electron-tainted edge in the authoring graph; everything else (loop,
  gate, explain graph, providers) bundles headlessly as-is.

## Slice 6 (2026-07-25): update mode + opt-in telemetry (spec steps 6 & 7)

The last two open steps. Step 6 — refinement of an *existing* component — and
step 7 — telemetry that can answer Gate G2's "do users return?".

### Update mode: the design decision

The slice-3 note guessed step 6 would share MCP's `applyOperations`. Scouting
killed that: `applyOperations` lives only in noodl-mcp, its op vocabulary
cannot express state-parameters/transitions, and by now AIX-003 had built the
better substrate. So update mode **keeps the whole-candidate contract** — the
one slice 5 measured at 8/8 first-attempt validity — and reuses the diff-review
machinery that already handled an existing-component base:

- `AuthoringSession.createUpdate(graph, request, baseFiles)` — same loop, same
  gate (the gate already validated updates: it swaps the same-named component
  out of the project before validating the candidate in its place). The opening
  turn carries the current component **in submit shape** (a new charged
  `ContextBuilder.currentComponentSource` handout), and a component whose
  source alone blows the budget fails loudly at run start instead of opening
  with a refusal string.
- **The id rule is the legibility mechanism.** The update framing instructs:
  keep existing node ids for kept nodes — a kept id diffs as a modification, a
  new id as delete-and-recreate. This is what makes "review the AI's revision
  as a diff" readable.
- **Inexpressible fields are carried, not lost.** A full resubmission would
  silently eat what the submit schema can't say: `variant`, `stateParameters`,
  `stateTransitions`, `defaultStateTransitions`, `dynamicports`, node
  `metadata`. `buildCandidate(..., base)` carries these over for nodes whose id
  AND type match the base (plus canvas comments and the component's identity —
  id, created, metadata — verbatim). Deliberately NOT carried: `parameters` and
  `ports`, which the agent can express and therefore owns. The user message
  says hidden tuning survives on kept ids and dies on recreated ones.
- `updateAuthoredComponent` — the net-new primitive nothing else provided:
  replace-by-remove+add inside ONE `UndoActionGroup` (both ProjectModel
  mutations accept a shared group), with two fidelity details: the replacement
  is spliced back to the original array position (an update must not shuffle
  project.json), and the project root is restored **by node, not via
  `setRootComponent`** — that helper filters on `type.allowAsExportRoot` and
  silently no-ops when the NodeLibrary is not loaded (the new-project-no-Home
  failure mode; it bit again in the spec environment). Undo restores the exact
  captured root node; do/redo prefers the candidate's `visualRoots[0]`. The
  undo half sits FIRST in the group so in both directions the root settles
  only after its component is back in the project. One undo is byte-identical,
  spec-asserted against the real corpus.
- **Panel**: typing an existing component's path flips the form to "Update it"
  with an explicit notice (a typo'd "new" name cannot silently revise — the
  button label announces the mode). Accept branches on the SESSION's mode,
  decided at creation — never re-inferred at accept time, so a component
  created mid-authoring still fails create-accept loudly. Post-accept, the
  component path is retained and the form is already in update mode: "make
  more changes" IS step 6's post-accept refinement, with zero new machinery.
  Review-diff + partial accept work for updates through AIX-003's existing
  `buildChangeSet`/`materializeSelection` unchanged.

### Telemetry: local-first, opt-in, no server

The editor's legacy tracker is a permanent no-op (`DummyTracker`; `setTracker`
never called; the Mixpanel comment is dead) and no analytics endpoint exists.
Step 7 does not add one. `models/AiAssistant/telemetry.ts`:

- Off by default; while off, **nothing is written and no install id exists**.
  Opt-in checkbox in Editor Settings → AI ("Usage log"), with the log path
  shown when enabled.
- One JSONL line per event to `<userData>/telemetry/authoring-telemetry.jsonl`:
  `authoring-round` (mode, initial|refine, status, cumulative turns/submits/
  cost, duration), `authoring-accept` (mode, partial, counts),
  `authoring-reject` (mode). Envelope: v, ts, anonymous install id (minted on
  first write), app version. **A spec mechanically asserts no field carries
  free text** — every string must be a known enum. Never a prompt, name, or
  any project content.
- G2's retention question = distinct days with an `authoring-round`, keyed by
  install id, computable from the file alone; pilots share the file
  consciously or not at all.
- The module is fs/Electron-tainted BY DESIGN and lives outside `authoring/`;
  the panel wires it around the session, so the authoring graph stays
  headless-bundleable (the measurement harness is unaffected). Reject is
  recorded only when a staged candidate existed — "Start over" after a failed
  run is not a decision against work.

### Registration bug found in passing

`tests/index.ts` builds the spec bundle from hand-written barrels;
`authoring-partial.test.ts` and `authoring-preview.test.ts` (slice 4) were
never added to `tests/ai/index.ts` — those 16 specs had not been running in
`test:ci` at all. Registered now, together with `authoring-telemetry.test.ts`.

### Traps hit

- The system-prompt template literal hard-wraps mid-phrase; a spec asserting
  `toContain('KEEP THE EXISTING NODE IDS')` failed on the embedded newline.
  Assert on fragments that cannot straddle a wrap.
- `setRootComponent` is a no-op with an empty NodeLibrary (again). Any
  root-restoration logic that must work headlessly has to restore by node id.
- `removeComponent` + `addComponent` with a shared `UndoActionGroup`: group
  undo runs in reverse, so order-sensitive settling (root, array position)
  needs its undo half pushed BEFORE the mutations and its do half after.

### Verified

- `npx tsc --noEmit` clean; `npm run test:ci` **1283 specs, 0 failures**
  (randomized; +14 new — 4 candidate-update, 3 session-update, 4
  staging-update, 3 telemetry — plus the 16 resurrected slice-4 specs);
  `npm run catalog:check` green; noodl-mcp build + jest 32/32.
- Live smoke (CDP, Shine Phase 2 — the real 45-component project):
  - Scripted update session against the live `/Pages/Article` (25 nodes, 27
    connections): `createUpdate` → authored first-attempt through the strict
    gate, identity kept, `current-component:10812` chars charged and logged.
  - `updateAuthoredComponent` on the live project: replaced in place (same
    name, same array position), added node present; **one undo →
    byte-identical `project.toJSON()`**, redo reapplies. Project restored to
    pristine afterwards.
  - Telemetry: opt-in → JSONL record written to the real
    `~/Library/Application Support/NodeGX/telemetry/authoring-telemetry.jsonl`
    with correct envelope; opt-out blocks writes. Smoke residue (file +
    minted install id) deleted after.
  - Panel: typing `Pages/Article` flips the form live to "Update it" + the
    exists-notice + "What should change?"; a fresh path flips back to
    "Build it". Editor Settings → AI renders the "Usage log" row and the
    nothing-is-sent blurb. Zero renderer exceptions.

### Remaining (task-level)

- Live provider run of update mode (one command in the measurement harness
  once an update-prompt is added to the corpus; create-mode was measured in
  slice 5). OpenAI still quota-blocked account-side.
- No telemetry collection endpoint — deliberate; G2 analysis collects opted-in
  pilots' local files.

## Note from DEBT-003 (2026-07-24) — expression semantics the loop can rely on

The feared "expressions cannot see Variables" defect was **not real** — the evaluator always
resolved `Variables` from the global model store; only the tests were mis-wired. Two real
defects that *did* affect authored expressions are now fixed: bracket-notation
(`Variables["my var"]`) and template-literal (`${Variables.x}`) dependencies were invisible to
dependency detection, so expressions using them evaluated correctly once but never re-evaluated
when the variable changed; and expression errors were swallowed before reaching the editor's
warning channel, so a broken authored expression failed silently. Both now behave: all three
reference forms subscribe correctly, runtime errors surface as node warnings
(`expression-error-<port>`), and compile failures warn with the syntax error. Policy the loop
can assume: `Objects.X` auto-creates (never undefined); a null/undefined expression result
yields the port's fallback.

## Note from DEBT-009 (2026-07-25) — onboarding papercuts closed (3 of 4)

- `get_node_type` can no longer blow the host's tool-result cap: a
  `detail: "summary"` mode exists for breadth, and full responses enforce a
  ~60 KB in-band budget — the tail degrades to summaries with a `summarized`
  list + hint instead of the host's useless "saved to file" pointer.
- A v2 hand-off with `formatV2.enabled` off now fails **loudly**: opening a
  directory with `nodegx.project.json` while the flag is off produces a toast +
  console error naming the setting, instead of the silent blank failure SUB-010
  hit. The default-flip itself still needs human sign-off (and SUB-001's
  large-project checks, still open in DEBT-002).
- Preview/deploy token parity: already unified by REV-009 — both paths generate
  `:root` from the same `buildEffectiveTokens`, and the `noodl-design-tokens`
  stamp is confirmed present in real exports. Bounded residual: the preview
  injector reads the *live* StyleTokensModel (unsaved token edits included),
  deploy reads persisted metadata — they diverge only while token edits are
  unsaved, which is expected editor semantics.
- **Still open:** first-editor-save normalization noise (zero-diff round trip).
  Recommended path stands: make the MCP/export emit the editor-normalized shape
  and add an export → headless open/save → empty-diff CI check. Deliberately
  not rushed in at the tail of the debt pass — it is fidelity-critical and sits
  on surfaces this task is actively changing.
