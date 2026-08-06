# LEARN-010: The Run and the Verdict

## Metadata

| Field | Value |
|-------|-------|
| **ID** | LEARN-010 |
| **Phase** | Phase 17 — Noodl Learn (Revival Track E) |
| **Arc** | [Generated Lessons](./EXPERIMENT-GENERATED-LESSONS.md) — task 4 of 4 |
| **Priority** | 🔴 Critical — the arc's reason for existing |
| **Difficulty** | 🟡 Medium (as a spike) |
| **Estimated Time** | 3 days, plus human-testing elapsed time |
| **Prerequisites** | LEARN-007, LEARN-008, LEARN-009 — all three |
| **Branch** | `task/learn-010-run-and-verdict` |
| **Recommended executor** | 🔵 **Fable 5** — the deliverable is a recommendation that could redirect LEARN-002's 8–10 weeks; its value is the honesty of the judgement, not the code |

## Objective

Run twelve generated lessons, score them, read them, and produce an explicit **go / no-go /
go-with-reduced-scope** recommendation on personalised generated lessons — with the number that
supports it.

**The deliverable of this task is a decision document, not a curriculum.**

## Background

Richard's framing, 2026-08-02:

> *I'd be interested in testing out a dozen lessons to see how many end up containing bugs that would
> make the learner feel they've failed when they did everything right.*

That is the right experiment and this task runs it. What LEARN-007–009 add is that most of the answer
arrives without a human, and the part that needs humans is precisely identified rather than
conflated with the part that doesn't.

The decision this feeds is real and expensive: [LEARN-002](./LEARN-002-CURRICULUM-V1.md) is 8–10
weeks of authored curriculum, currently blocked awaiting learning-designer review. A go here
redirects it; a no-go releases it to proceed as designed.

## Current State

- LEARN-007 ships three patterns for one concept.
- LEARN-008 generates a lesson from `(concept, pattern, goal)`, with a versioned prompt.
- LEARN-009 scores F1–F4 automatically and exits non-zero on F1/F2/F3.
- F5 (variant-blind) and F6 (text–graph divergence) have no automated detector by design.

## Desired State

A written recommendation in this directory containing:

- The **number**: F1–F6 counts and rates over twelve lessons, per class, with the failing lessons
  named
- An honest verdict: **go / no-go / go-with-reduced-scope**
- What the failures were *caused by* — the pattern, the prompt, or the format
- What would change the answer
- The consequences for LEARN-002 either way, stated plainly enough to act on

Plus the twelve generated lessons and their scorecards, committed as evidence.

## Scope

### In Scope

- [ ] **Fix the variables.** One concept, three patterns, twelve goals, one prompt version. If the
      prompt is edited mid-run, the run restarts — a mixed-prompt scorecard is not a number.
- [ ] Choose twelve goals per arc §8 Q2 and record them before generating, so the set cannot drift
      toward ones that worked
- [ ] Generate, score with LEARN-009, and commit both outputs
- [ ] **F6 by human read** — for every lesson, does the prose ask for exactly what the conditions
      check? A rubric, applied to all twelve, not a vibe on a sample.
- [ ] **F5 by human run** — testers work through lessons *deviating* where a beginner plausibly
      would: different node order, a different-but-correct wiring, extra nodes left lying around.
      Record every case where the lesson said "not yet" to correct work.
- [ ] The verdict document

### Out of Scope

- Fixing what the run finds. A defect found is a result; a defect fixed mid-run is a number
  destroyed. Fixes are the *next* piece of work and are scoped by the verdict.
- Any second concept, second prompt strategy, or A/B of prompts — that is a bigger experiment and
  this one has to report first
- Productionising anything, hosting anything, or touching the Learn tab
- The chain-versus-graph curriculum question ([arc §3.6](./EXPERIMENT-GENERATED-LESSONS.md)) — a good
  number here does not settle it, and the verdict must say so

## Acceptance

- [ ] Twelve lessons generated from one prompt version, scored, and committed with their scorecards
- [ ] F1–F4 rates reported from LEARN-009's `scorecard.json`, not from a reading of it
- [ ] F5 and F6 reported from human runs, with the number of testers and their deviation behaviour
      stated — including if the answer is "Richard, twelve times" (arc §8 Q3)
- [ ] Every false failure is attributed to pattern, prompt, or format
- [ ] An explicit verdict, with what would change it
- [ ] The verdict states what happens to LEARN-002 in both branches
- [ ] [PROGRESS.md](./PROGRESS.md) and the phase [README](./README.md) updated with the outcome

## Interpreting the result — agreed before the run, so it cannot be motivated afterwards

The temptation at the end of a spike is to read whatever came back as encouraging. These thresholds
are set now.

| Result | Reading |
|---|---|
| **F1+F2+F3 = 0**, F4 ≤ 1, F5 ≤ 1 | **Go.** The slot-filling discipline works. Next question is the spine and the chain. |
| **F1+F2+F3 = 0**, but F4 or F5 ≥ 3 | **Go with reduced scope.** The structure is sound and the *content* is not; likely a data-binding or prose fix, not an architectural one. |
| **F2 or F3 ≥ 3 of 12** | **No-go as designed.** The patterns are not as predictable as they look, which is the finding — and it is a finding about visual-graph lessons generally, not about this prompt. |
| **Any class ≥ 6** | **No-go.** Report what broke and return to authored lessons. |

**F5 is weighted harder than its count suggests.** A learner who was told they failed for a correct
alternative solution is the exact experience the product exists to prevent, and unlike F1–F4 it
cannot be gated away before shipping — there is no fixture for "a correct solution nobody thought
of."

## Notes

**A no-go is a cheap, useful answer, and the arc should not be run in a way that makes it hard to
say.** Four weeks to avoid mis-spending 8–10 on the wrong curriculum shape is a good trade at any
outcome. The failure to guard against is a marginal result read as a go because the machinery was
fun to build.

**Whatever the verdict, LEARN-009 survives it** — a pre-flight gate for generated lessons and a
regression harness for authored ones. And the spine question is separate from the generation
question: authoring a concept corpus is worth doing on the docs argument alone
([ALPHA-006](../phase-33-alpha-launch/ALPHA-006-DOCS-PLATFORM.md) reports 35% of nodes with no page),
which is arc §8 Q4 and should be answered before this task reports, not after.

**Say plainly who the testers were.** Twelve runs by the person who wrote the prompt is a much weaker
result than twelve runs by beginners, and a verdict that does not distinguish them is not evidence.
