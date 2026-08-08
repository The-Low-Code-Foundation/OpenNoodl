# Phase 55 — the handover prompt for session 2

Paste the block below into a fresh session. Written to be read cold, by a model that has seen
neither phase 54 nor session 1.

---

You are continuing **Phase 55 — Any LLM can build in NodeGX**. Read
`dev-docs/tasks/phase-55-llm-authoring-support/README.md` and `TASKS.md` first, then
`dev-docs/best-practices/` — especially `05-WORKED-EXAMPLE-STOREFRONT.md`, which is Richard's own
architecture for the app this phase is calibrated against.

**Your session is (2) of the six in TASKS.md §Order: LAS-001 + LAS-004 — the validator pair, one
corpus calibration run.** LAS-001 is starred as the highest-value task in the phase.

## The phase's rule, which has now paid for itself four times

**Read the mechanism in source before trusting any stated fact — including facts stated by this
phase's own task documents.** Phase 54 was opened on three wrong premises. The HANDOVER for session
1 said "assume a fourth exists". There was a fourth, and session 1 then found two more:

1. **`DESIGN_AUTHORING` still taught the deprecated wrapped-row pattern** (the predicted fourth) —
   fixed in `57895017`.
2. **LAS-003 stated the `layoutString` grammar wrong, and so do the shipped `ui-*` recipes.** Both
   say "integers and spaces". `readLayoutToken` is `Number`, not `parseInt`, deliberately —
   **decimals are legal**. A gate built to the task text would have rejected `"1 2.5 1"`: a
   validator inventing a constraint the runtime does not have. That is the expensive kind of false
   positive here, because diagnostics feed an automated repair round and the agent is told never to
   argue with one.
3. **Half of LAS-002 was already built.** `create_component`/`update_component` and the editor's
   refine loop were already returning full diagnostics; only the MCP plan path whispered.

So: assume a seventh exists, and note that the failure mode cuts both ways — LAS-003 also told me
"add these checks to the value layer, NOT as new standalone rules", I second-guessed it, and the
compiler proved the doc right. Verify, then follow.

## What session 1 closed — do not rebuild it

| Task | Commit | What landed |
|---|---|---|
| **LAS-008** | `57895017` | `DESIGN_AUTHORING` rewritten from Richard's §7 (697 chars); paragraph-scoped tripwire spec over the exported prompt constants |
| **LAS-002** | `69257e87` | `stage_plan_operation` + `apply_plan` return diagnostic **objects**; phase-54 F6 and phase-55 F6 both closed |
| **LAS-003/1** | `5a35a1f8` | `layoutString` grammar — authored-blocking error, mirrors `readLayoutToken` |
| **LAS-003/2+3** | `631ae6bc` | unsized decorated absolute box → warning; raw colour literal → warning |

Audit register rows **F1, F3, F6, F7 are closed**. F2 (the interface gate) is your LAS-001.

## Facts session 1 established that you will need

- **`NormNode` has NO `parameters` field.** The normalized model every rule in `validation/rules/`
  sees is deliberately structural; values live in `validation/parameterValues.ts` with its own
  `ParameterizedNode` shape. **This matters directly for LAS-001**: an instance-parameter check
  reads parameters, so decide early whether your rule can live in `rules/` at all. If it needs both
  the interface index (structural, cross-component) *and* parameter names, you may need the rule in
  `rules/` reading a parameter map threaded through `RuleContext` — settle that against the type
  system before writing the file, not after. Session 1 wrote a whole rule file that could not
  compile.
- **The authored-blocking policy is `AUTHORED_BLOCKING_WARNINGS`**
  ([authoredCandidate.ts:149](../../../packages/noodl-editor/src/editor/src/validation/authoredCandidate.ts#L149)),
  currently `UnknownParameter`, `UnitlessDimension`, `UnresolvedNavigation`, `PageWithoutPageNode`.
  Its own doc-comment records that **`validate:project` never applies the authored policy**, so
  promoting a code cannot turn corpus warnings into corpus errors. That is the whole reason LAS-004
  §1 is safe.
- **A corpus scan beats a hand inspection.** The session-1 audit recorded haiku emitting the CSS
  Grid dialect once; a scripted scan found it **twice** (`FeaturedProducts` *and*
  `BrowseCategories`). Assume the audit's counts are floors, not totals. Scan, then read.
- **The two corpora are different shapes.** Legacy content is `project.json` with a nested
  `components[].graph.roots` tree; v2 projects are `components/*/nodes.json` with a flat `nodes`
  array. A scan that only walks one of them silently reports zero — session 1's first
  `layoutString` scan found 0 violations because it only read legacy, and the real hits were all in
  v2. Walk both.
- **Corpus sizes, measured 2026-08-08:** 91 legacy `project.json` / 5,509 nodes; 67 v2
  `nodes.json`. `net.noodl.visual.columns` appears in **0** of the legacy corpus.
- **Calibration is not a formality — it changed two designs in session 1.** LAS-003's stated
  predicate for the unsized absolute box hit **151** nodes, of which 122 were legitimate overlays;
  narrowing to *decorated* boxes cut it to 29 (21 of those editor test fixtures). Run the numbers
  before you choose a severity, and record them in the task's register.
- **A concrete precedent for NOT promoting:** `library/prefabs/popup-modal` is a decorated
  full-bleed absolute scrim — a legitimate instance of the shape LAS-003/2 warns about. That single
  shipped example is why that check is a warning. Look for the equivalent before you promote
  anything in LAS-004.
- **LAS-002's response shape is where LAS-007 will hang its examples.** The `validation` block is
  typed as the same `WriteValidationSummary` the author doors return (`{ summary, diagnostics }`,
  structured entries keyed by `code`), and is omitted entirely when empty. Do not add a second
  dialect.

## What your two tasks depend on

- **LAS-004 §1 is now unblocked and should stay in this order.** Its own text says to sequence it
  after LAS-002 "so a newly-blocking gate arrives speaking" — LAS-002 has landed, so
  `repeated-sibling-subtree`'s message now actually reaches a staging agent. Promote it only after
  the fixture sweep.
- **The `PageWithoutPageNode` lesson governs both tasks:** fixtures teaching the refused shape get
  **corrected, not the gate weakened**. Expect hits in the AI-suite fixtures for both the trio
  sweep (LAS-004) and instance-parameters-without-an-interface (LAS-001). A suite that would fail a
  correct gate was asserting the wrong thing.
- **LAS-001 must see the plan overlay.** A component staged in the same plan counts as existing
  with its staged interface — `overlayProject` in
  [planTools.ts](../../../packages/noodl-mcp/src/tools/planTools.ts) already builds that view. A
  rule that reads interfaces from disk will reject every correct multi-component plan.
- **The update-baseline contract.** `validateStaged` subtracts pre-existing blocking diagnostics on
  `update` operations, so a component that already violates a new rule stays editable. Your specs
  must cover this or you will make real components permanently unrevisable.

## Gates for this session

`npm run catalog:examples`, `catalog:check`, `catalog:merge:check`, `typecheck:editor`, `npx jest`
in `packages/noodl-editor`, plus `npx jest` in `packages/noodl-mcp` (its suite is a gate).

**Compare the passing COUNT, not the colour.** At session-1 close:

- editor: **74 suites / 1001 specs** (was 71/973 at phase-54 close)
- noodl-mcp: **19 suites / 200 specs**

`Tests: 0` is a compile failure, not a pass. ⚠️ `pr.yml` runs on push to `cline-dev` and `Lint` and
`Test (editor)` are RED for pre-existing reasons — check WHICH job before reading a red run as
yours.

## Working habits that are not optional here

- **Write the check before the fix.** Session 1 did this three times; each tripwire failed on the
  shipped code first, and the failure count is recorded in the commit message. The check is the
  deliverable that outlives the fix.
- **Commit per slice**, and add the register rows in the same commit. Registers outlive their
  fixes.
- **Do not write to a project while a human has the editor open.** The editor holds the project in
  memory and pushes that to its preview; an MCP write reaches disk and is invisible to it, and
  quitting the editor can flush its stale copy back over your work.
- Serialise register edits across parallel sessions — a pathspec commit can sweep a sibling's edit.

## Also live, in parallel

**LAS-010's model decision is settled** (recorded in the task file, 2026-08-08): hosted
open-weight via **DeepInfra**, not a local ollama pull. Richard's machine is a 16 GB M1 MacBook Air
whose Metal working set caps around 10.7 GB, and `qwen2.5-coder:32b` is ~20 GB at Q4. Richard
supplies the API key when that task runs — **do not ask for it before then, never commit it, read it
from the environment.** The matrix row must say "open weights, hosted (DeepInfra)"; the weights are
open, the run was not local.

## The bar

Richard's, unchanged since phase 40: *"legendary creations rivaling the best Opus landing page
artifacts."* Phase 55 adds the harder half — **the same architecture from a model that is not
Opus.** If a weak model produces a well-architected app with mediocre spacing, this phase succeeded.
If a strong model produces a beautiful 66-node page, it did not.

**LAS-001 is the single task that separates "architecturally right" from "renders as built".** Haiku
already got the architecture right and shipped a page of dead placeholder chrome, with a clean
validation report, because nothing checks an instance's parameters against its component's actual
interface. That is your session.
