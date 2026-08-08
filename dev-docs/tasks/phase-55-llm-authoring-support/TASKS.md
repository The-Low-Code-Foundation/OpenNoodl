# Phase 55 — the tasks (LAS: LLM Authoring Support)

**Created:** 2026-08-08, out of [AUDIT-SESSION-1.md](AUDIT-SESSION-1.md). Every task here traces to
a failure that was **measured**, not assumed — the audit's rule ("read the mechanism in source
before trusting any stated fact") stays in force for these documents too.

**The bar, restated as an exit test:** LAS-011 replays the storefront brief cold on a mid-tier
hosted model AND a mid-tier open-weight model, and both produce an app that is *architecturally*
correct — components with real interfaces, repeaters over data, signals, responsive, nothing dead
in the render report. Haiku already gets the architecture right; the tasks close the gap between
"architecturally right" and "renders as built". If that lands, the phase is done. "Perfect" means
the exit test, not a feeling.

**Standing constraints (settled, from the README):** primitive-only; one authoring substrate, two
clients (every change reaches the editor loop and `noodl-mcp` from one module — the
`decomposition.ts` shape); structure > gate > example > prose; doctrine text is Richard's.

**Working habits that already paid off:** write the check before the fix (phase 39); calibrate
every new rule against the ~95-project corpus before deciding severity (the
`repeated-sibling-subtree` precedent: 17 hits/95 projects → warning, authored-blocking is a
separate decision); a graph is a claim, a render is evidence.

**Each task has its own file — the files carry the mechanism detail, acceptance criteria and a
register; the sections below are the summary and the dependency map:**

| Task | File | One line |
|---|---|---|
| LAS-001 ⭐ ✅ | [LAS-001-INTERFACE-GATE.md](LAS-001-INTERFACE-GATE.md) | instance parameters must match `Component Inputs` (F2) — **done**, 3 codes; found F8, the reference build's dead interface |
| LAS-002 ✅ | [LAS-002-STAGING-SPEAKS.md](LAS-002-STAGING-SPEAKS.md) | authoring doors return diagnostics, not counts (F6) |
| LAS-003 ✅ | [LAS-003-VALUE-FORMAT-GATES.md](LAS-003-VALUE-FORMAT-GATES.md) | layoutString grammar, unsized absolute Group, raw hex (F3, F7) |
| LAS-004 ✅ | [LAS-004-PROMOTE-ARCHITECTURE-WARNINGS.md](LAS-004-PROMOTE-ARCHITECTURE-WARNINGS.md) | sibling rule blocks authored output; page-size info at **40** nodes, not the doctrine's 25 |
| LAS-005 ⭐ ✅ | [LAS-005-RENDER-REPORT.md](LAS-005-RENDER-REPORT.md) | the measure loop as an MCP tool with screenshots (F5) — **done**; §5 (editor client) descoped with its blocker named (F22) |
| LAS-006 ✅ | [LAS-006-STRUCTURED-PLANS.md](LAS-006-STRUCTURED-PLANS.md) | plans carry interfaces/repeats; the plan becomes a contract — **done**; the corpus killed the path-prefix predicate (F25) |
| LAS-007 ⭐ ✅ | [LAS-007-PUSH-RETRIEVAL.md](LAS-007-PUSH-RETRIEVAL.md) | recipes attached inside rejections; the traps preamble — **done**; found F23/F24, the recipes taught the refused shape |
| LAS-008 ✅ | [LAS-008-PROMPT-DRIFT.md](LAS-008-PROMPT-DRIFT.md) | fix `DESIGN_AUTHORING` + a tripwire spec (F1) |
| LAS-009 ✅ | [LAS-009-PER-ROLE-MODELS.md](LAS-009-PER-ROLE-MODELS.md) | design/plan/act model selection (Richard's request) |
| LAS-010 ✅ | [LAS-010-OPEN-WEIGHT-LEG.md](LAS-010-OPEN-WEIGHT-LEG.md) | the open-weight rig — **done**; the settled model could not tool-call (F36) and our surface did not fit its context (F37) |
| LAS-011 ✅ | [LAS-011-ACCEPTANCE-MATRIX.md](LAS-011-ACCEPTANCE-MATRIX.md) | the exit matrix — **complete**; the phase misses its own bar, two successors filed |
| LAS-012 ✅ | [LAS-012-REPEATER-CONTRACT.md](LAS-012-REPEATER-CONTRACT.md) | the repeater contract gate (F38 + F41) — **done**, session 7. Three codes off `authoredPreconditionDiagnostics`, `empty-list` in the render report, and the skeleton create absorbed. Found F38's own attribution wrong: haiku nested its item content too (F42) |
| LAS-013 📋 | [LAS-013-SMALL-MODEL-HEADROOM.md](LAS-013-SMALL-MODEL-HEADROOM.md) | the refactor cliff (F40) and the 89-tool door (F37) |

---

## Track 1 — Gates. The failures that shipped are the gates that don't exist.

The audit's central measurement: every hard rejection with a suggestion was self-corrected, even
by the mid-tier model (7/42 turns of encoding rejections, all recovered). Prose was dropped;
rejections were obeyed. So the cheapest capability upgrade available is turning known silent
failures into speaking ones.

### LAS-001 — The interface gate ⭐ highest value in the phase (audit F2)

**The defect:** a component instantiated with per-instance parameters (`name`, `price`, `image`)
that its graph exposes no `Component Inputs` for validates with **0 errors** and renders every
instance as dead placeholder chrome. This single gap is what separated haiku's replay from a
shippable page.

**Build:** one new validator rule (`validation/rules/`), two halves sharing one index of component
interfaces:

1. **Unknown instance parameter.** A parameter set on a component-instance node must name a port
   the target component's `Component Inputs` node exposes (plus the built-ins every instance
   carries — `mounted` etc.; enumerate them from source, not memory). Diagnostic names the sent
   parameter, the component, and its actual input list — the "did you mean" shape that measured
   well.
2. **Interface-less variance.** Two or more instances of the same component whose parameter sets
   differ, where the component exposes no inputs at all → one diagnostic on the component ("N
   instances vary but nothing can receive the variance — add Component Inputs whose names match").

**Severity:** calibrate on the corpus first. Expected: legitimately rare project-wide → promote to
`AUTHORED_BLOCKING_WARNINGS`
([authoredCandidate.ts:149](../../../packages/noodl-editor/src/editor/src/validation/authoredCandidate.ts#L149)),
the `PageWithoutPageNode` precedent — including correcting any fixtures that were teaching the
broken shape (that precedent too).

**Acceptance:** re-stage haiku's exact `Components/ProductCard` + `Sections/FeaturedProducts`
candidates (preserved in `phase55-replay-haiku`) → rejected with the interface diagnostic. Jest
specs both halves; corpus run documented in the task's register row.

### LAS-002 — Staging speaks (audit F6, phase-54 F6)

`stage_plan_operation` returns `warnings: 1` and no way to read the text
([planTools.ts:504](../../../packages/noodl-mcp/src/tools/planTools.ts#L504)) — the decomposition
warning whispered through all three measured builds at exactly the moment the agent could act.

**Build:** every authoring door (`stage_plan_operation`, `create_component`, `update_component`,
`apply_plan`) returns the warning **diagnostics themselves** (code, message, location), not a
count. Same formatting module the rejection path uses — no second dialect. Editor loop gets the
same payload through the shared validate module.

**Acceptance:** stage a trio-of-siblings candidate → response contains the
`repeated-sibling-subtree` text verbatim. Spec pins the response shape.

### LAS-003 — Value-format gates (audit F3, F7, + the hex rule)

Three checks, one task, all in the semantic validator's value layer (phase 38's "nothing validates
parameter VALUES" — closing the measured holes, not boiling the ocean):

1. **`layoutString` grammar** (F3): integers and spaces (`"1 1 2"`), same for
   `mediumLayout`/`smallLayout`. `"1fr 1fr"` → error with the corrected string in the message.
   This is authored-blocking from day one — no legitimate corpus population can exist for a string
   the runtime cannot parse.
2. **Unsized absolute Group** (F7): `position: absolute` with neither `width` nor `height` →
   warning ("dimensions default to %, this fills its parent — the badge-pill trap"). Corpus-
   calibrate before deciding authored-blocking.
3. **Raw hex/px on token-typed ports:** colour parameters matching `#…`/`rgb(` and
   spacing/radius carrying bare px where the style vocabulary offers tokens → warning. The server
   instructions already say "never raw hex"; this makes it checkable. Corpus-calibrate (imported
   projects will hit — likely stays authored-blocking only).

**Acceptance:** haiku's `"1fr 1fr 1fr 1fr"` candidate rejects with the fix in the message;
sonnet's Badge group draws the warning; specs for all three.

### LAS-004 — Promote the architecture warning + the page-size rule

`repeated-sibling-subtree` fired correctly on every measured build and blocked nothing.

1. Promote it to `AUTHORED_BLOCKING_WARNINGS`. Corpus stays untouched (the authored policy never
   applies to `validate:project`) — but sweep the AI-suite fixtures first for hand-laid trios, the
   `PageWithoutPageNode` lesson: fixtures teaching the refused shape get corrected, not the gate
   weakened.
2. New info-severity rule: a **page** component whose own graph exceeds ~25 nodes ("this page
   wanted to be several components"). Info, not warning — the audit showed cold models already
   decompose; this is the backstop, and it must not nag a legitimate dense page into
   over-factoring. Threshold from the corpus, not from the doctrine's prose.

**Acceptance:** the ecommerce-example Home (66 nodes, 3 trios) rejects as authored output; the
two cold-replay Homes (7 and 8 nodes) pass untouched.

---

## Track 2 — The surface. Give agents eyes and make the right order the easy order.

### LAS-005 ✅ — `render_report`: the feedback loop as a tool ⭐ (audit F5)

The loop that found every real defect in two phases is unreachable from the surface agents use;
doctrine §11 is unfollowable. Sonnet improvised 80% of it through sandboxed Bash and still shipped
a motorcycle; haiku improvised nothing. Meanwhile the whole loop costs **7.5 s** headless
(promoted to [scripts/devtools/measure-from-disk.js](../../../scripts/devtools/measure-from-disk.js)).

**Build:**

1. Promote `measure-project.js` into `scripts/devtools/` — parameterise ports, free-port
   allocation, `--json`.
2. New MCP tool **`render_report`** (read tools, registered unconditionally): renders the project
   from disk exactly as the script does, returns the numeric report (per-viewport overflow +
   minimum layout width, font-weight/size sets, broken images, empty decorated boxes, dead-
   placeholder texts) **and the screenshots as MCP image content** — a multimodal agent can then
   *look*, which is the only fix wrong-subject images can ever have. Requires the built viewer
   bundle; report its absence as an actionable error, not a crash.
3. `apply_plan` gains `render: true` (default **on** when the plan touches any visual component):
   the response appends the report summary. The agent that just applied a plan is told, in the
   same turn, "your grid is one column and five images are broken".
4. Editor client: the same report module behind the AIX-008 sandbox preview, so the in-editor
   agent gets machine-readable render feedback too — one substrate, two clients.

**Acceptance:** replay-haiku's project through `render_report` → the report itself flags the dead
"Text" placeholders, the one-column grid and the 5 broken images (the three defects the audit
found by hand). Jest for the report module; live QA per the run-editor recipe for the tool.

### LAS-006 ✅ — Structured plans: the tree as a form, not an essay

The plan step worked cold on both models — but its operations are prose intents, and what the
intents never said (interfaces, repeats), no downstream turn built. Weak models fill forms better
than they follow essays (audit §D3).

**Build:**

1. `create_plan` operations gain optional structured fields: `inputs`/`outputs` (name + type),
   `repeats` (data source kind + row fields) and `instantiates` (component targets). Optional at
   the schema so old callers don't break —
2. — but plan validation gains teeth: a `create` under `Components/`|`Cards/`|`Sections/` with no
   `inputs`/`outputs` and no declared reason → warning in the create_plan response ("an interface
   stated vaguely is an interface that will not line up"); a plan whose only operation is one page
   → the static critic's one-liner ("plan the sections as create operations").
3. Staged-candidate cross-check: a staged component whose plan operation declared `inputs` must
   expose exactly those Component Inputs — the plan becomes a contract, LAS-001 does the checking.
4. Rewrite the server `instructions` authoring paragraph to lead with the order: *decide the
   component tree (create_plan with interfaces and repeats) → leaves → sections → page* — and name
   `Static Data` and `Component Inputs` by name in it (the two primitives nobody finds). The
   bag-of-nodes door stays open (primitive-only, no ceremony for a two-node fix) but
   `create_component` of a **page**-typed component when no plan exists gets one advisory line in
   its response pointing at the plan door.

**Acceptance:** replay transcript comparison — a cold haiku run with the new schema produces plan
operations carrying interfaces, and the ProductCard staged against it either exposes them or is
rejected by the LAS-001 contract check.

### LAS-007 ✅ — Push, not pull (retrieval into the failure moment)

Haiku never called `list_examples`/`get_example`/docs once — the recipes existed and were never
retrieved (audit §D1). Retrieval advice does nothing; attachment does.

**Build:**

1. Rejection responses attach the fix's example: LAS-001 interface rejections inline the
   Component-Inputs pattern fragment (from the existing `comp-*`/`ui-*` recipes, rendered small);
   `layoutString` rejections inline the two Columns modes; sizeMode/encoding rejections cite their
   recipe id. One mapping table, in the shared validate module, from DiagnosticCode → example id.
2. `get_node_type` for the nine page-drawing types already cross-references `ui-*` recipes —
   verify it actually inlines enough to act on (the audit verified the citation exists, not its
   sufficiency), and add the "conditional ports" style hints where thin.
3. `get_project_info` doctrine payload gains a 10-line **"the traps"** preamble (Component Inputs
   are the interface; Static Data is the inline-JSON array; Columns is the only reflow; unsized
   absolute Groups fill their parent; verify images by looking) — the audit shows the doctrine
   that is pushed gets read.

**Acceptance:** a cold mid-tier replay's transcript shows the recipe text arriving inside a
rejection and the following attempt using it (this is measurable: haiku's F2/F3 failures become
one-retry recoveries).

---

## Track 3 — Drift. The doctrine must not disagree with itself.

### LAS-008 — Fix `DESIGN_AUTHORING` and pin the pattern (audit F1)

The 556-char per-turn preamble still teaches the wrapped-row percentage-width pattern and never
says `Columns`
([design.ts:246](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/prompts/design.ts#L246)) —
shipped into every in-editor authoring turn, contradicting §7/§8 of the very doctrine it fronts.

**Build:** rewrite the paragraph (Richard's voice — derive from his §7, do not invent taste);
sweep every prompt string for the deprecated advice; add a small spec that greps the exported
prompt constants for the known-bad phrasing so the drift cannot silently return (a unit test as a
tripwire, the "write the check before the fix" habit).

---

## Track 4 — Models. Choice at the top, proof at the bottom.

### LAS-009 — design / plan / act per-role model selection ✅ **DONE** 2026-08-08

Richard's request, 2026-08-08, extended mid-session to *provider* **and** model per role
("mix DeepInfra with Anthropic"). See
[LAS-009-PER-ROLE-MODELS.md](LAS-009-PER-ROLE-MODELS.md).

⚠️ The premise below was **half wrong** (F33) and is kept only so the correction is legible:
per-request `model` was real, but `getProvider()` took **no arguments** — the cited
`(providerId, override)` signature belongs to `verify()`. Cross-provider was new plumbing, and
LAS-009 built it. Driven live: `[ai] plan: anthropic/claude-haiku-4-5` beside
`[ai] act: ollama/llama3.2:latest` in one plan→author run.

**Build:**

1. Settings: `ai.role.design`, `ai.role.plan`, `ai.role.act` — each an optional
   `{provider, model}` falling back to the global pair. Design = scoping + token/identity turns;
   plan = `PlanningSession`; act = `AuthoringSession` + apply/refine turns. Map each session to
   its role in one table, not scattered conditionals.
2. Sessions pass their role's model (and provider override where it differs) on every request.
   Cost log already records per-model usage — surface per-role spend in the session cost line.
3. Settings UI: one row in the AI settings panel — three dropdowns defaulting to "Same as main
   model", reusing the existing provider/model picker components. Local/OpenAI-compatible
   providers appear exactly as they do in the main picker (they already work — phase-15
   provider layer).
4. Default mapping ships **unset** (everything = global). The audit's caution stands: the data so
   far says planning is the *cheap* step and acting the hard one — LAS-011's matrix decides any
   recommended preset, not intuition.

**Acceptance:** ✅ met — 12 jest specs (`tests-unit/phase-55/roleModels.test.ts`), plus a live
editor run logging plan=haiku beside act=sonnet, and a second run logging plan=anthropic beside
act=ollama. Two findings filed: **F34** (the cost line §3 named reads nothing from the usage log,
and planning cost reaches no line at all) and **F35** (the registry has **zero**
`openai-compatible` models, so a picker cannot configure a DeepInfra role).

### LAS-010 — The open-weight leg (audit's honest gap)

**Build:**

1. **Human gate first:** `ollama pull qwen2.5-coder:32b` (~20 GB) — Richard says yes/no, or names
   the machine/model he prefers. Nothing else in this task starts until a real mid-tier
   open-weight model is reachable.
2. An MCP-capable driver for local models: ~200 lines — ollama `/api/chat` (tool calling) bridged
   to the `noodl-mcp` stdio server, transcript to JSONL, same shape as the claude-CLI rig in
   STOREFRONT-BRIEF.md. (Repairing phase-15 `aix15-live` is the *editor-loop* alternative; the MCP
   driver is the one that tests the same surface as the other replays — prefer it, keep the repair
   as a fallback note.)
3. Replay the brief cold; score with the standard fixture.

**Acceptance:** an open-weight row in the scoring table with the same columns as haiku/sonnet.

### LAS-011 — The exit: the acceptance matrix

After Tracks 1–3 land (LAS-009 optional for the matrix, LAS-010 required):

1. Re-replay the storefront brief **cold** on: mid-tier hosted (haiku), strong hosted (sonnet),
   mid-tier open-weight — same protocol, one run each, no rescues.
2. Score every run with the STOREFRONT-BRIEF.md table + `render_report`. Publish the
   before/after table against the session-1 numbers (haiku: dead cards, 1-col grid, 5 broken
   images; sonnet: blobs, motorcycle).
3. **Richard judges** the rendered pages side-by-side against a Claude artifact of the same brief
   (the phase-40 bench, unchanged). The phase's own success line: the mid-tier and open-weight
   runs are architecturally correct and nothing in their render reports is dead — even where the
   taste is weaker than Opus's.

Failures found here get classified (knowledge/ordering/capability/seam) and either spawn LAS-012+
or are accepted with a written reason. **The phase does not close on green gates; it closes on
this matrix.**

---

## Order and dependencies

```
LAS-001 (interface gate) ──┐
LAS-002 (staging speaks) ──┤
LAS-003 (value gates)    ──┼──► LAS-007 ✅ (attach examples to the new rejections)
LAS-004 (promote+page)   ──┘            │
LAS-005 ✅ (render_report) ─ independent ┤
LAS-006 ✅ (structured plans; §3 needed LAS-001)
LAS-008 (prompt drift) ── independent, small, do first or between
LAS-009 ✅ (per-role models; provider AND model, cross-provider proven live)
LAS-010 (open-weight rig) ── needs Richard's pull decision; parallel to everything
LAS-011 (exit matrix) ── last; needs 001–008 + 010
```

Suggested sessions: ✅ **(1)** LAS-008 + LAS-002 + LAS-003 (small, sharp, all spec-pinned) ·
✅ **(2)** LAS-001 + LAS-004 (the validator pair, one corpus calibration run) · ✅ **(3)** LAS-005 · ✅ **(4)**
LAS-006 + LAS-007 · ✅ **(5)** LAS-009 · ✅ **(6)** LAS-010 + LAS-011. Registers per task; serialise
register edits (pathspec-commit trap); commit per slice.

**All eleven are done. The matrix they exist for is complete and does not clear the bar**, so the
phase ends with two filed successors rather than a tick:

```
LAS-012 (repeater contract, F38+F41) ── ✅ DONE, session 7
LAS-013 (small-model headroom, F40+F37) ── the refactor cliff, and the 89-tool door
```

~~Do **LAS-012 first**~~ — **done, session 7** (`ebfa578d`, `85a39388`, `00c59ceb`). It was one
precondition check of a shape already built five times, its fixture was on disk, and it was the
difference between "architecturally correct" and "a page with its lists drawn". It produced three
errors on that fixture as predicted — but `repeater-with-visual-children`, not
`repeater-without-template`, because haiku had nested its item content as well (F42). **LAS-013 is
what remains.**

## Gates for every session

`npm run catalog:examples`, `catalog:check`, `catalog:merge:check`, `typecheck:editor`, `npx jest`
in `packages/noodl-editor` (**80 suites / 1085 specs** at session-7 close; 79/1068 at session 6,
77/1048 at session-4 close; 76/1029 at sessions 2–3,
74/1001 at session 1, 71/973 at phase-54 close — compare the passing COUNT and
`Tests: 0` is a compile failure), plus `packages/noodl-mcp` jest (its suite is a gate —
**26 suites / 271 specs** at session-7 close; 24/250 at sessions 4–6, 22/230 at session 3,
20/208 at session 2).

⚠️ **Two runners, and they are not the same gate.** `npx jest` in `noodl-editor` is
`tests-main/` + `tests-unit/` — plain Node, the counts above, green. `npm run test:ci` is the
jasmine/Electron suite (`tests/`) — 2418 assertions, and **4 of them have been failing since before
session 4** (F32, `AIX-006 style vocabulary`). Measured both ways at `b550b750`. Only the
`Jasmine:` line counts there, and an OOM kill is not a verdict.

`pr.yml`'s `Lint` and `Test (editor)` are red on push for pre-existing reasons — check WHICH job
before reading a red run as yours.
