# LEARN-007: The Pattern Kit

## Metadata

| Field | Value |
|-------|-------|
| **ID** | LEARN-007 |
| **Phase** | Phase 17 — Noodl Learn (Revival Track E) |
| **Arc** | [Generated Lessons](./EXPERIMENT-GENERATED-LESSONS.md) — task 1 of 4 |
| **Priority** | 🔴 Critical — everything downstream fills what this defines |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 1 week (inside the arc's 4-week box) |
| **Prerequisites** | LEARN-001 (format + evaluator, both shipped) |
| **Branch** | `task/learn-007-pattern-kit` |
| **Recommended executor** | 🟠 **Opus 5** — the work is small but the addressing decisions are subtle and every downstream task inherits them |

## Objective

Build the fixed set of **graph patterns** a generated lesson is assembled from: a starter graph, a
solution graph, pre-written completion conditions, and declared data bindings — such that a language
model can produce a working lesson by choosing a pattern and filling its slots, without ever writing
a completion condition.

**This task ships no generation and calls no model.** It ships the artefact the generator fills.

## Background

The arc's binding rule ([§3.1](./EXPERIMENT-GENERATED-LESSONS.md)) is that the model fills slots and
never authors predicates. A generated `completeWhen` is a generated assertion about a graph nobody
has inspected; get it subtly wrong and a learner who did the task correctly is told they failed.

A pattern is the unit that makes that rule enforceable. It is the visual-programming analogue of
Anchor's closed section palette: the model selects and parameterises a trusted thing, and a
validator rejects anything else.

## Current State

Verified 2026-08-02:

- `lesson.json` is a manifest of ordered steps with Markdown prose and first-class
  `completeWhen` arrays ([lessonformat.ts:67-97](../../../packages/noodl-editor/src/editor/src/models/lessonformat.ts#L67-L97)).
- The condition vocabulary is **eleven closed verbs**
  ([lessonformat.ts:48-59](../../../packages/noodl-editor/src/editor/src/models/lessonformat.ts#L48-L59)):
  `hasType`, `hasLabel`, `hasPort`, `exists`, `isVisualRoot`, `hasParams`, `paramsEqual`,
  `connection`, `metadata`/`equals`, `previewRouteEquals`, `activeComponentEquals`.
- Steps also carry `actions` (`selectNode`, `navigatePreview`, `selectComponent`),
  `suggestedNodes`, and `disableIcons` — all of which a pattern can pre-set.
- Node paths use the grammar `Component:#label:%type:idx`, resolved against `component.graph.roots`
  and `node.children`, **first match wins**
  ([lessonevalconditions.ts:222-255](../../../packages/noodl-editor/src/editor/src/views/lessons/lessonevalconditions.ts#L222-L255)).
- The node catalog carries every node type with its ports and port types
  ([node-catalog.json](../../../packages/noodl-types/src/node-catalog.json)).
- LEARN-001's open remainder stands: **the format has never been validated with a non-programmer
  author.** This task is not that validation, but it is the first heavy use of the format since it
  shipped and should report anything the format cannot express.

## Desired State

Three patterns, in-repo as fixtures, each a directory containing:

| File | What |
|---|---|
| `pattern.json` | Metadata: id, the concept it teaches, the slots the generator may fill, the declared binding keys |
| `starter/` | A NodeGX project the lesson clones — contains everything the learner is *not* asked to build |
| `solution/` | The same project with the steps performed — the ground truth LEARN-009 evaluates against |
| `decoy/` | The solution plus plausible learner clutter — extra nodes of the same types, for F3 |
| `steps.json` | The ordered steps with `completeWhen` **written by hand**, plus the slot markers the generator substitutes into |

### The three patterns

Chosen to cover the concept the arc tests (lists/repeaters, per arc §8 Q1) at three difficulties:

1. **`static-list`** — an Array of objects feeding a Repeater whose item template binds two fields.
   The core pattern; the one whose empty-preview failure (F4) is the sharpest test of the binding
   rule.
2. **`list-with-detail`** — the above plus a click on an item setting a Variable, and a detail area
   bound to it. Adds an event and a piece of state, so it exercises addressing across two components.
3. **`growing-list`** — an Array plus an input and an Insert, so the list changes at runtime.
   Exercises `paramsEqual` against runtime-mutated state, which is where the evaluator is least
   exercised by the existing tests.

Three is the minimum that says anything about whether the *approach* generalises rather than whether
one pattern happens to work.

## Scope

### In Scope

- [ ] `pattern.json` schema — slots, binding keys, the concept id, and which fields the generator
      may write. Slots are typed (`prose`, `label`, `themeWord`, `dataValues`), never freeform.
- [ ] The three patterns above, each with starter / solution / decoy / steps
- [ ] **All `completeWhen` written by hand and reviewed**, addressing by `#label` per arc §3.2
- [ ] Every step's prose slot must instruct the learner to set the label its conditions address —
      a pattern whose conditions reference a label no step asks for is broken by construction
- [ ] Declared binding keys per pattern, and the item-template bindings that consume them
- [ ] A pattern-lint script: conditions reference only declared labels; every condition verb is in
      the eleven; every node type and port exists in the node catalog; no condition addresses by
      `%type` unless the pattern declares that type is unique in the starter
- [ ] Unit tests: for each pattern, conditions **fail** on the starter and **pass** on the solution
      (this is the §3.5 ghostwriting check and the F2 floor, and it belongs here rather than in 009
      because a pattern that fails it is not a pattern)

### Out of Scope

- Any model call, prompt, or generation — LEARN-008
- Scoring, reporting, or the decoy evaluation itself — LEARN-009 (this task *ships* the decoy
  graphs; 009 is what runs against them)
- More than one concept — arc §3.8
- Hosting the patterns anywhere, or surfacing them in the Learn tab — arc §3.7
- Changing `lesson.json`, the compiler, or the evaluator. If a pattern cannot be expressed in the
  eleven verbs, **record it as a finding**; do not extend the vocabulary inside this arc.

## Acceptance

- [ ] Three patterns exist, each with starter, solution, decoy, steps and metadata
- [ ] The lint script passes on all three and is wired into the repo's test command
- [ ] For every pattern: conditions evaluate **false** against its starter (nothing pre-completed)
      and **true** against its solution, as a test, not as a claim
- [ ] No pattern addresses a node by `%type` unless its metadata declares that type unique
- [ ] Binding keys are declared, and the solution's item template demonstrably consumes exactly them
- [ ] A short findings note: anything the `lesson.json` format could not express, and anything about
      the format that a non-programmer author would have tripped on — LEARN-001's open remainder,
      partially discharged

## Notes

**The decoy graph is the point of this task that is easy to skip.** F3 — a condition resolving
against the wrong node because `findNodeWithPath` returns the first match — is invisible in every
authored lesson NodeGX has ever shipped, because authored lessons control the whole project. It is
the failure that a personalised lesson makes routine, and building the decoy fixture *now*, while
the pattern's addressing is fresh, is what makes it measurable later. A decoy is not a hostile
graph: it is one extra Group and one extra Text, of the sort any learner adds while poking around.

**Expect the second and third patterns to be much cheaper than the first.** Most of the week is
deciding the slot vocabulary and the addressing discipline; the patterns themselves are small.
