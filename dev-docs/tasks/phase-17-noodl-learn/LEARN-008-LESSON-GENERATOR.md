# LEARN-008: The Lesson Generator

## Metadata

| Field | Value |
|-------|-------|
| **ID** | LEARN-008 |
| **Phase** | Phase 17 — Noodl Learn (Revival Track E) |
| **Arc** | [Generated Lessons](./EXPERIMENT-GENERATED-LESSONS.md) — task 2 of 4 |
| **Priority** | 🔴 Critical |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 1 week (inside the arc's 4-week box) |
| **Prerequisites** | LEARN-007 (patterns), AIX-001 (model client) |
| **Branch** | `task/learn-008-lesson-generator` |
| **Recommended executor** | 🔵 **Fable 5** — the deliverable is largely a prompt, and its quality is the experiment's independent variable |

## Objective

Turn `(concept, pattern, learner goal)` into a runnable `lesson.json` plus its sample data, by
**filling the slots** a LEARN-007 pattern declares — never by authoring completion conditions, node
types, port names, or data field names.

## Background

This is the arc's independent variable. LEARN-007 fixes what can vary; LEARN-009 measures what came
out; this task is the only place a model is called, and every failure the experiment reports is
either this prompt's or the pattern's.

The technique is Anchor's contextual projection, and it is worth stating plainly because it is what
the experiment is actually testing: a generic concept plus a specific learner context produces
teaching that is *about their thing*. Anchor's version has run in production for twenty-six sprints
against prose projects. This is the first attempt at projecting onto a **structure** — a graph the
learner will build — and structure is less forgiving than prose, because it either runs or it
doesn't.

## Current State

- LEARN-007 ships three patterns with typed slots, declared binding keys, hand-written conditions,
  and starter/solution/decoy graphs.
- The editor has a provider-agnostic AI client (AIX-001) with structured-output support; explain
  mode (AIX-004) has landed. **Neither is modified by this task** — the generator runs from a script,
  not from the editor (arc §3.7).
- The node catalog ([node-catalog.json](../../../packages/noodl-types/src/node-catalog.json))
  supplies node types, ports and port types for prompt context and for validation.

## Desired State

A script — `scripts/lesson-gen/` or equivalent — taking a goal string and emitting a directory:

```
out/<goal-slug>/
  lesson.json      # a LessonManifest, runnable by the shipped engine unchanged
  project/         # the pattern's starter, with the generated sample data substituted
  meta.json        # which pattern, which concept, the goal, model + prompt version, token counts
```

### What the model may and may not write

This table is the task. It is enforced by the output schema, not by the prompt alone.

| Field | Source | Why |
|---|---|---|
| Step `title`, `body` (Markdown) | **model** | The whole point — teaching pitched at their goal |
| Lesson `title`, `description` | **model** | — |
| Node **labels** the learner is told to set | **model**, from a slot | Themed (`Post List`, not `Repeater 1`) — but see Notes |
| Sample data **values** | **model** | Their theme, their words |
| Sample data **field names** | **pattern** | Arc §3.3 — mismatched keys render an empty preview |
| `completeWhen` conditions | **pattern** | Arc §3.1 |
| Node **types** and **port names** | **pattern** | Never invented; the catalog is not a menu the model orders from |
| `suggestedNodes`, `actions`, `disableIcons` | **pattern** | Pre-set |
| The starter graph | **pattern** | Arc §3.8 |

### Structured output, not parsing

The model is given a JSON schema covering **only** the writable fields above and returns an object
against it. The script then merges that object into the pattern's `steps.json` to produce the
manifest. **The model never emits a `LessonManifest`** — it emits the slots, and the assembler
builds the manifest. That single decision is what makes F1 (unreachable conditions) structurally
impossible rather than merely unlikely.

## Scope

### In Scope

- [ ] The projection prompt: concept body + pattern description + learner goal → slot values.
      Written and versioned as a file, not inlined, so LEARN-010 can cite the exact version scored.
- [ ] The output schema for writable slots, with a **description on every field** — an optional
      field with no description tells the model omission is legal but not whether it is correct,
      and the failure mode is quietly invented content
- [ ] The assembler: slots + pattern → `lesson.json` + `project/`, with an assert that no writable
      slot reached a non-writable field
- [ ] Sample-data generation constrained to the pattern's declared keys, with count and value-length
      bounds
- [ ] Label generation with a **fallback**: if a themed label collides with an existing label in the
      starter, or contains characters the path grammar splits on, fall back to the pattern's default
      label. See Notes — this is a real defect class, not defensive coding.
- [ ] Prompt-version and model-id recorded in `meta.json` for every run
- [ ] A `--goal` CLI so LEARN-010 can run twelve goals unattended

### Out of Scope

- Choosing which pattern to use. **For this arc the pattern is passed in**, not selected by the
  model — pattern selection is a second variable and the experiment can only afford one.
- Generating the starter graph, the concept, or the spine
- Any editor UI, Learn-tab surface, or hosting
- Retry/repair loops on invalid output. **Record the failure; do not repair it** — a repaired failure
  is a failure the experiment did not count, and the failure rate is the deliverable.
- BYO API key, billing, credit accounting

## Acceptance

- [ ] Given a goal and a pattern id, the script emits a `lesson.json` that the **shipped** lessons
      engine loads and runs, with no format change
- [ ] The output schema structurally prevents the model from writing any pattern-owned field —
      demonstrated by a test that feeds hostile model output and asserts the assembler rejects it
- [ ] Sample data uses exactly the pattern's declared keys, asserted by the assembler, not by the
      prompt
- [ ] `meta.json` records prompt version, model id, pattern id, goal and token counts on every run
- [ ] Three goals of visibly different character (e.g. a blog, a gig tracker, a recipe collection)
      produce three lessons whose prose is genuinely about that thing and not a find-and-replace of
      a noun
- [ ] The prompt file is versioned and its version appears in every `meta.json`

## Notes

**Themed labels are a slot with teeth.** Labels are how conditions address nodes (arc §3.2), so a
model-written label is the one generated string that a `completeWhen` depends on. Two hazards, both
verified against the resolver:

- The path grammar splits on `:`
  ([lessonevalconditions.ts:227](../../../packages/noodl-editor/src/editor/src/views/lessons/lessonevalconditions.ts#L227)),
  so a label containing a colon breaks addressing outright.
- Matching is case-insensitive
  ([lessonevalconditions.ts:152](../../../packages/noodl-editor/src/editor/src/views/lessons/lessonevalconditions.ts#L152)),
  which absorbs capitalisation drift between the prose and the condition but nothing else — a label
  the prose renders as "Post list" and the condition expects as "Posts list" fails silently.

The assembler must therefore generate the label **once** and substitute it into both the prose and
the condition from the same value. A prompt that asks the model to state the label in the body text
*and* separately in a slot has already created the divergence.

**Do not let the model be helpful.** The most likely prompt failure is a model that notices the
pattern is missing something and adds a step — producing a lesson whose extra step has no completion
condition and can never be passed. Say so explicitly in the prompt, and assert step count against the
pattern in the assembler.
