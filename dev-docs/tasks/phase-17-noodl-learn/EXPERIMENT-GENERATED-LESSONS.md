# Experiment — Generated Lessons (LEARN-007…010)

**Status:** SPECCED 2026-08-02. Nothing built.
**Phase:** 17 (Track E — Pedagogy as a product line)
**Tasks:** LEARN-007, LEARN-008, LEARN-009, LEARN-010
**Time-box:** 4 weeks, hard, on the LEARN-004 precedent
**Deliverable:** a number and a decision, not a product surface

---

## 1. Why this arc exists

[LEARN-002](./LEARN-002-CURRICULUM-V1.md) is blocked awaiting learning-designer review, and its
design ([CURRICULUM-DESIGN.md](./CURRICULUM-DESIGN.md)) commits to twelve authored lessons building
one cumulative app — a virtual pet. Richard's objection, 2026-08-02:

> *Getting someone to learn how repeaters work by building a tutorial shopping app doesn't make any
> sense to someone who wants to build the next great social media app or blog.*

The proposal is to generate the lessons instead: hold a **spine of concepts** any beginner needs,
and project each concept onto the learner's own stated goal — the modal text, the sample data, and
what appears in the preview all fitting what they actually came to build. The engine for this exists
and is in production in a sibling product (Anchor, `~/vscode_projects/loom`), where per-learner
lesson generation from a canonical concept spine has been running for twenty-six sprints.

**This arc does not build that.** It answers the one question that decides whether it is buildable:

> When a lesson is generated rather than authored, how often does a learner who did everything right
> get told they failed?

That failure is uniquely expensive here. A beginner told "not yet" when they are in fact done has no
way to tell whether it is them or the tool, and the whole product thesis is a lowered affective
filter. One such lesson in twelve is a defect; three is a dead idea.

## 2. The surprising finding from the design pass

**Almost nothing is missing.** LEARN-001 built the substrate for this without meaning to.

| Fact | Where |
|---|---|
| Lessons are a **declarative JSON manifest** — an ordered list of steps, Markdown prose, first-class completion conditions | [lessonformat.ts:89-97](../../../packages/noodl-editor/src/editor/src/models/lessonformat.ts#L89-L97) |
| The condition vocabulary is **eleven closed verbs**, not code | [lessonformat.ts:48-59](../../../packages/noodl-editor/src/editor/src/models/lessonformat.ts#L48-L59) |
| Completion is a **pure function of (conditions, context)** — `eval()` was removed, 33 unit tests | [lessonevalconditions.ts](../../../packages/noodl-editor/src/editor/src/views/lessons/lessonevalconditions.ts) |
| Conditions address nodes **semantically** — by component, label, type name — never by node id or DOM | [lessonevalconditions.ts:222-224](../../../packages/noodl-editor/src/editor/src/views/lessons/lessonevalconditions.ts#L222-L224) |
| The compiler lowers a manifest into the legacy per-step HTML shape, so **the entire runtime is reused unchanged** | [lessonformat.ts:23-33](../../../packages/noodl-editor/src/editor/src/models/lessonformat.ts#L23-L33) |
| A machine-readable **node catalog** with port names and types ships in-repo | [node-catalog.json](../../../packages/noodl-types/src/node-catalog.json) |
| A **semantic validator** already hard-fails unknown types and unknown ports | [validate.ts](../../../packages/noodl-mcp/src/validate.ts) |
| The MCP server can **author project graphs** from outside the editor | [packages/noodl-mcp](../../../packages/noodl-mcp/) |

A closed palette the model parameterises rather than authors, a validator that rejects anything
outside it, and a deterministic evaluator over real project state: that is precisely the safety
shape Anchor's architecture requires, arrived at independently for unrelated reasons.

**The consequence that makes this arc cheap:** the generation target already exists and is already
validated. Nothing in LEARN-007…010 changes the lessons engine, the format, or the editor.

## 3. Arc-level decisions (binding on all four tasks)

### 3.1 The model fills slots. It never authors predicates.

A generated `completeWhen` is a generated assertion about a graph the generator has never seen. Get
it subtly wrong and the learner is told they failed for doing it right — failure class F5 below, and
the reason this arc exists.

**So the conditions are not generated.** They ship pre-written on the **pattern** (LEARN-007), and
the model chooses *which pattern* and fills its *slots*. The model writes prose, a theme, sample
data values, and node labels. It never writes a condition verb, a port name, or a node type.

A task in this arc that has the model emitting `completeWhen` directly has misread this section.

### 3.2 Address by label, not by type — and this is a verified finding, not a preference

`findNodeWithPath` walks a path grammar of `Component:#label:%type:idx` and, at each segment,
returns the **first** node that matches
([lessonevalconditions.ts:238-255](../../../packages/noodl-editor/src/editor/src/views/lessons/lessonevalconditions.ts#L238-L255)).

In an authored lesson that is safe: the lesson clones a fixed template, so `%Group` means the one
Group that exists. **In a generated lesson on a learner's own project it is a lottery.** A learner
who added a second Group before the step — or whose generated starter had two — gets a condition
silently resolving against the wrong node, and no error anywhere.

**Binding:** patterns address by `#label`, and the step's prose instructs the learner to set that
label. Type-only addressing (`%Type`) is permitted **only** where the pattern's own starter graph
guarantees exactly one node of that type and the step cannot add another.

The cost, recorded rather than discovered: label addressing moves the failure from ambiguity to
typos. `eqi` matching is case-insensitive
([lessonevalconditions.ts:152](../../../packages/noodl-editor/src/editor/src/views/lessons/lessonevalconditions.ts#L152)),
which absorbs some of it; spelling and whitespace it does not. LEARN-009 measures both.

### 3.3 Binding keys come from the pattern. Only values come from the theme.

The strongest part of the proposal is sample data that fits what the learner is building. It is also
the largest predicted defect source.

A pattern binding a Repeater item template to `title` and `author` needs objects with `title` and
`author`. Let the model invent recipe data with `name` and `chef` — sensible data, wrong keys — and
the preview renders **nothing**. The learner did everything right and sees an empty box.

**Binding:** the pattern declares its binding keys; the model supplies values and a theme, never
field names. LEARN-009 checks this mechanically (F4).

### 3.4 The experiment produces a regenerable number, not an impression

A one-shot read of twelve lessons yields a feeling that expires the moment the prompt changes.
Four of the six failure classes are machine-detectable (§4), so the scoring harness is the arc's
highest-value deliverable and outlives the experiment: it becomes the gate any future generated
lesson passes before a learner sees it.

**Binding:** LEARN-009 ships before LEARN-010 runs, and LEARN-010's verdict cites its output.

### 3.5 The tutor boundary is untouched — and here is exactly where the line sits

[TUTOR-BOUNDARY.md](./TUTOR-BOUNDARY.md) and the phase README are unambiguous: *"the AI's role in
Noodl Learn is tutor, never ghostwriter"*, and AIX-004 (explain, read-only) is the prerequisite
precisely because AIX-002 (authoring) is not.

This arc does not touch that. The distinction is **who the AI builds for**:

| | Who authors | Who builds the learner's app | Boundary |
|---|---|---|---|
| Tutor (LEARN-002) | — | **the learner** | AIX-004 read-only, enforced structurally |
| Generated lesson (this arc) | the AI authors **the curriculum** | **the learner** | unchanged |

A generated lesson is a lesson plan, not a solution. The learner still places every node.

**But there is one real edge and it must not be blurred:** a generated lesson ships a **starter
graph** and **sample data**, which is partly-built app. The line: the starter contains only what the
step's prose does not ask the learner to build. Anything the `completeWhen` checks for must be
absent from the starter, or the step completes on arrival and the lesson has ghostwritten the step.
LEARN-009 checks this mechanically (F2's inverse) — a step whose conditions already hold against its
own starter is a hard fail.

### 3.6 The motivation chain is a known casualty, and it is out of scope here

[CURRICULUM-DESIGN.md](./CURRICULUM-DESIGN.md) §4–§5 argues that continuity *is* the pedagogical
mechanism — lesson N+1 solves the problem lesson N made the learner feel, implemented as template
chaining where lesson N's template is lesson N−1's solution. Personalisation dissolves all three:
no shared template, no chain, no known-good restart for classroom triage.

**This arc does not resolve that.** It measures mechanical trustworthiness only. If the number comes
back good, the chain-versus-graph question is the *next* decision and it is a learning-design call,
not an engineering one. Recorded here so that a good number is not mistaken for a settled curriculum.

### 3.7 Nothing here ships to a learner

No hosting, no UI, no Learn-tab change, no editor change, no `lesson.json` format change. The
experiment runs from a script against fixtures. If the verdict is go, productionising is a separate
phase with its own doc.

### 3.8 What is deliberately NOT in this arc

- **A spine.** Writing the concept corpus is the expensive, high-judgement work and it is Richard's.
  This arc uses **one** concept, hand-written, so that the failure rate is attributable to
  projection rather than to corpus quality.
- **Per-learner project generation.** The starter graph comes from the pattern, not from the model.
- **BYO API key, billing, or any product plumbing.** Generation runs on Richard's key, from a script.
- **The classroom/13–17 audience question.** A BYO-key product cannot serve it; that is a real
  consequence and it is LEARN-002's to weigh, not this arc's.
- **NodeGX↔Anchor integration.** No code moves between the repos. The prompt design borrows Anchor's
  projection technique; nothing imports anything.

## 4. The failure taxonomy the whole arc is built on

Six classes. Four are machine-detectable, and separating them matters because they have different
causes and wildly different costs.

| | Class | What it is | Detection | Cost |
|---|---|---|---|---|
| **F1** | Unreachable | A condition names a node type or port that does not exist | **Static** — node catalog | Should be zero |
| **F2** | Dead on solution | Conditions never fire against the pattern's own solution graph | **Deterministic** — build solution, evaluate | Fatal |
| **F3** | Ambiguous address | A condition resolves to the wrong node when more than one candidate exists (§3.2) | **Deterministic** — decoy graph | Fatal, and invisible |
| **F4** | Empty preview | Sample-data keys do not match the pattern's bindings (§3.3) | **Deterministic** — render, assert non-empty | Fatal |
| **F5** | Variant-blind | Conditions fail a legitimate *alternative* correct solution | **Humans** | The real risk |
| **F6** | Text–graph divergence | The prose asks for something the conditions do not check, or vice versa | **Human read** | Erodes trust slowly |

F1–F4 become a permanent pre-flight gate. F5 and F6 are what the twelve human runs are for — which
means the human testers should be people who **deviate**, not people who follow instructions exactly.

## 5. The four tasks

| Task | | Deliverable |
|---|---|---|
| **[LEARN-007](./LEARN-007-PATTERN-KIT.md)** | The pattern kit | 3 graph patterns: starter, solution, pre-written conditions, declared bindings |
| **[LEARN-008](./LEARN-008-LESSON-GENERATOR.md)** | The generator | Prompt + structured-output schema: (concept, pattern, goal) → `LessonManifest` + data |
| **[LEARN-009](./LEARN-009-SCORING-HARNESS.md)** | The scoring harness | F1–F4 automated, per-lesson scorecard, regenerable |
| **[LEARN-010](./LEARN-010-THE-RUN-AND-VERDICT.md)** | The run and the verdict | 12 goals × 1 concept, scored, plus a go/no-go decision document |

Strictly sequential. 007 defines the artefact 008 fills, 009 grades what 008 emits, 010 runs it.

## 6. Cost

- **Four weeks, hard time-boxed**, on the LEARN-004 precedent: the deliverable is a decision that
  could redirect LEARN-002's 8–10 weeks, so it is worth four and not worth twelve.
- **Model spend is trivial** — twelve generations of one concept, plus prompt iteration. Two figures,
  not four.
- **No new dependencies, no new infrastructure, no editor change.**
- The scoring harness (LEARN-009) is the piece that survives a no-go verdict: it is the gate for any
  generated lesson, and a useful regression harness for authored ones.

## 7. The prediction this arc is scored against

Stated up front so the experiment can falsify it:

> **F1 and F2 come in low — one or two of twelve, mostly port-name slips the catalog check catches
> for free. F4 (empty preview) is the top defect. F3 is the one nobody expects to see and is worst
> when it appears. The deciding factor is not the pass rate but the quality of the modal prose.**

If F2 comes in above a quarter, the patterns are not as predictable as they look, and that — not the
prose — is the finding.

## 8. Open questions for Richard

1. **Which concept?** The arc uses exactly one, and it should be the one where personalisation
   plausibly matters most and the graph pattern is most templatable. **Recommendation: lists /
   repeaters** (CURRICULUM-DESIGN L7) — it is the concept Richard named, it is the most theme-bound,
   and its "empty preview" failure is the sharpest test of §3.3.
2. **Twelve goals — chosen or sampled?** Hand-picking twelve goals risks picking twelve easy ones.
   **Recommendation:** six Richard picks, six drawn from real stated goals (Anchor onboarding, alpha
   signups) if any exist by then.
3. **Who are the F5/F6 human testers?** The automated classes need nobody; F5 and F6 need people who
   deviate from instructions. If the answer is "Richard, twelve times", say so — it is a weaker
   result and worth naming as such in the verdict.
4. **Does a no-go on generation still mean a go on the spine?** The spine is worth authoring
   regardless — [ALPHA-006](../phase-33-alpha-launch/ALPHA-006-DOCS-PLATFORM.md) reports 35% of
   nodes have no docs page, and one concept corpus serves docs *and* lessons. Confirm that reading,
   because it changes what a no-go costs.
