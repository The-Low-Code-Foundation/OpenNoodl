# LEARN-009: The Scoring Harness

## Metadata

| Field | Value |
|-------|-------|
| **ID** | LEARN-009 |
| **Phase** | Phase 17 — Noodl Learn (Revival Track E) |
| **Arc** | [Generated Lessons](./EXPERIMENT-GENERATED-LESSONS.md) — task 3 of 4 |
| **Priority** | 🔴 Critical — the arc's most durable deliverable |
| **Difficulty** | 🟠 High — F4 needs a real render |
| **Estimated Time** | 1.5 weeks (inside the arc's 4-week box) |
| **Prerequisites** | LEARN-007 (patterns + decoys), LEARN-008 (generated output to score) |
| **Branch** | `task/learn-009-scoring-harness` |
| **Recommended executor** | 🟠 **Opus 5** — mostly deterministic plumbing over the shipped evaluator, with one genuinely awkward piece (headless render) |

## Objective

Turn "how many generated lessons contain a bug that makes a learner feel they failed" from a
judgement into a **regenerable number**, by detecting failure classes F1–F4 automatically and
producing a per-lesson scorecard.

**This task outlives the experiment.** Whatever LEARN-010 concludes, this is the pre-flight gate any
generated lesson passes before a learner sees it, and a useful regression harness for authored ones.

## Background

The arc's taxonomy ([§4](./EXPERIMENT-GENERATED-LESSONS.md)) splits six failure classes; four are
machine-detectable. Detecting them without a human is what makes the experiment repeatable on every
prompt change, and what stops a good result from expiring the moment LEARN-008's prompt is edited.

The reason this is cheap: completion detection is already a **pure function of (conditions, context)**
with `eval()` removed and 33 unit tests
([lessonevalconditions.ts](../../../packages/noodl-editor/src/editor/src/views/lessons/lessonevalconditions.ts)).
`evalConditionsWithContext(conditions, ctx)` can be called from a test process against any project
fixture, with no editor and no DOM. The harness is mostly assembling the right `LessonEvalContext`.

## Current State

- `evalConditionsWithContext(conditions, ctx)` is exported and pure
  ([lessonevalconditions.ts:386](../../../packages/noodl-editor/src/editor/src/views/lessons/lessonevalconditions.ts#L386));
  `liveLessonEvalContext()` is the editor-bound variant and is **not** what this harness uses.
- `compileLessonManifest` lowers a manifest to the runtime shape and hard-fails on malformed
  conditions via `LessonFormatError`
  ([lessonformat.ts](../../../packages/noodl-editor/src/editor/src/models/lessonformat.ts)).
- The node catalog carries every type's ports and port types
  ([node-catalog.json](../../../packages/noodl-types/src/node-catalog.json)); the semantic validator
  already hard-fails unknown types and unknown ports
  ([validate.ts](../../../packages/noodl-mcp/src/validate.ts)).
- LEARN-007 ships `starter/`, `solution/` and `decoy/` per pattern — the three fixtures F2 and F3
  are evaluated against.
- The viewer can be run headlessly; the export/preview recipe used by the MCP and preview work is
  the closest prior art for F4.

## Desired State

One command scores a directory of generated lessons and writes a scorecard:

```
pnpm lesson:score out/            # or the repo's equivalent
→ out/SCORECARD.md  +  out/scorecard.json
```

Per lesson, per step, a verdict on each of F1–F4, plus a run-level summary: the count and rate of
each class, and the list of lessons that would have shown a learner a false failure.

### The four checks

| | Check | Method | Passes when |
|---|---|---|---|
| **F1** | Unreachable | Compile the manifest, then resolve every condition's node type and port against the node catalog | Every referenced type and port exists |
| **F2** | Dead on solution | `evalConditionsWithContext(step.completeWhen, ctx(solution))` | Every step's conditions are **true** on the solution — and **false** on the starter |
| **F3** | Ambiguous address | The same evaluation against `decoy/` — the solution plus plausible learner clutter | Verdicts on the decoy match the verdicts on the solution, step for step |
| **F4** | Empty preview | Render the generated project headlessly and inspect the repeated region | The item template rendered ≥ 1 instance carrying a generated data value |

### The two halves of F2, and both are load-bearing

- **True on the solution** — the learner can finish. A step that fails here is a guaranteed false
  failure.
- **False on the starter** — the learner has something to do. A step that is already satisfied when
  the lesson opens has been ghostwritten (arc §3.5), and it is the failure mode the phase README
  names as the whole thing to design against: *"the AI's role is tutor, never ghostwriter."*

Reporting only the first half would pass a lesson that completes itself.

## Scope

### In Scope

- [ ] A `LessonEvalContext` builder from a project fixture on disk — components, roots, children,
      labels, types, parameters — with no editor and no DOM
- [ ] F1: catalog resolution of every type and port named by every condition, reusing the existing
      catalog index rather than re-parsing
- [ ] F2: evaluate every step against `solution/` and `starter/`, both directions asserted
- [ ] F3: evaluate every step against `decoy/` and diff the verdicts against the solution run
- [ ] F4: headless render of the generated project; assert the repeated region produced ≥ 1 instance
      and that at least one generated data **value** appears in the output
- [ ] `scorecard.json` (machine) and `SCORECARD.md` (human), both per-lesson and per-step
- [ ] A non-zero exit code when any lesson fails F1, F2 or F3 — so this can be a gate, not just a
      report
- [ ] Self-tests: a deliberately broken lesson per class, asserting the harness catches it. **A
      harness that has never caught anything is indistinguishable from a harness that cannot.**

### Out of Scope

- F5 (variant-blind) and F6 (text–graph divergence) — these need people, and they are LEARN-010's
- Judging prose quality by model. A model scoring another model's teaching is a second experiment
  with its own validity problem; LEARN-010 uses a human read.
- Fixing anything the harness finds — the arc measures, it does not tune
- Any editor integration or UI. The harness is a script.
- Scoring authored lessons in this arc (it will work on them; that is a bonus, not a deliverable)

## Acceptance

- [ ] One command scores a directory of LEARN-008 output and writes both scorecards
- [ ] Each of F1–F4 is demonstrated to fire, by a deliberately broken fixture per class committed
      alongside the harness
- [ ] F2 asserts **both** directions and the scorecard reports them separately
- [ ] F3's decoy diff is per-step, and a divergence names the step and the condition
- [ ] The harness runs offline — no model call anywhere in the scoring path
- [ ] Exit code is non-zero on any F1/F2/F3 failure
- [ ] Re-running on unchanged input produces byte-identical `scorecard.json` — the number must be
      stable, or it cannot be compared across prompt versions

## Notes

**F4 is the one that will eat the schedule.** F1–F3 are pure functions over JSON and should take
days. F4 needs the viewer running with a real project, and "the repeater rendered nothing" has to be
distinguished from "the render harness failed" — otherwise every F4 is unattributable. Build F4
last, and if it slips, **ship F1–F3 and report F4 by hand for twelve lessons.** Twelve manual preview
checks is an afternoon; a half-working render harness is a week and a false number.

**Do not reimplement the evaluator.** The temptation is to write a small condition checker inside the
harness rather than assemble a `LessonEvalContext`. Two implementations of the completion rules will
drift, both will keep working, and the harness will grade lessons against semantics the editor does
not use — which is the worst possible outcome for an instrument whose only job is to be trusted.

**The decoy diff (F3) is the check most likely to be quietly dropped**, because it will almost always
pass and it is the fiddliest to wire. It is also the only detector for the failure that
personalisation *introduces* — first-match ambiguity in a graph richer than a template
([arc §3.2](./EXPERIMENT-GENERATED-LESSONS.md)). If something has to go, it is not this.
