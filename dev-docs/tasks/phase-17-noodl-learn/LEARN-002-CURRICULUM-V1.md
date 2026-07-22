# LEARN-002: Curriculum v1

## Metadata

| Field | Value |
|-------|-------|
| **ID** | LEARN-002 |
| **Phase** | Phase 17 — Noodl Learn (Revival Track E) |
| **Priority** | 🔴 Critical — the core deliverable of the phase |
| **Difficulty** | 🔴 Hard (pedagogical, not technical) |
| **Estimated Time** | 8–10 weeks |
| **Prerequisites** | LEARN-001 (engine + content format); AIX-004 (explain mode) |
| **Branch** | `task/learn-002-curriculum-v1` |
| **Recommended executor** | 🔵 **Fable 5** — with a critical caveat: **this task needs a human learning designer.** No model should author a curriculum unsupervised. Fable's role is to draft, structure, and pressure-test against pedagogical goals under that person's direction. |

## Objective

Produce 10–15 interactive lessons that teach real engineering concepts — state, data flow, events, componentisation — through building actual applications, with the AI acting as tutor rather than author.

## Background

This is the task the pedagogy thesis lives or dies by, and it is not primarily an engineering task. LEARN-001 delivers the machinery; this delivers the reason anyone would use it.

The thesis is specific. The claim is not "Noodl is an easy way to make apps" — that market is gone, and prompting is easier. The claim is that a learner who builds a working application in a visual graph ends up understanding *state*, *data flow*, *events*, and *composition* as real concepts they can name and reason about, and that this understanding transfers to programming generally. A learner who prompts an AI to build the same application ends up with the same artifact and none of the understanding.

That is a strong claim and this curriculum has to earn it. A tutorial series that teaches "click here, drag this" produces users who can operate Noodl and have learned nothing transferable — which would be the honest failure of the thesis. The lessons must name concepts explicitly, build them cumulatively, and connect them to what those concepts are called in the wider world of programming.

The AI's role is the delicate part, and it is why AIX-004 (explain mode — read-only) is a prerequisite while AIX-002 (authoring) deliberately is not. The tutor answers "what does this do?" and "why isn't this working?". It does not answer "build this for me." A curriculum that lets learners prompt their way through defeats its own purpose.

## Current State

- LEARN-001 provides a working lessons engine and a documented content format.
- AIX-004 provides explain mode: select a node or subgraph, get an explanation of what it does and how data flows.
- No curriculum exists. Whatever lesson content classic Noodl shipped is either absent from this repository or stale; LEARN-001's assessment will have established which.
- No learning designer is engaged — **hiring or contracting one is the first action of this task**, not an optional extra.

## Desired State

A learner with no programming background can work through a sequence of 10–15 lessons and finish able to:

- Explain what state is, where it lives in their application, and why that matters
- Trace how data flows from a source to what the user sees
- Distinguish an event from a value, and explain what triggers what
- Break an application into components and say why they drew the boundaries there
- Build a small application independently, from an idea rather than from instructions
- Recognise these concepts when they encounter them in written code

## Scope

### In Scope
- [ ] Engage a learning designer (first action)
- [ ] Define learning outcomes and the concept progression before writing any lesson
- [ ] 10–15 lessons, cumulative, each producing something the learner can show
- [ ] Explicit concept naming, connected to general programming vocabulary
- [ ] AI-tutor integration using explain mode, with clear boundaries on what it will and will not do
- [ ] A capstone in which the learner builds independently
- [ ] Assessment: how does a learner (or teacher) know they have understood?
- [ ] Learner testing with real beginners, iterating on the results

### Out of Scope
- The lessons engine (LEARN-001)
- Teacher-facing dashboards and classroom management (LEARN-005)
- Advanced or professional-track content — this is the first-contact curriculum
- Translation and localisation (later, if there is demand)
- Certification

## Approach

### Design before content

Write the learning outcomes and concept progression first, as a document, and review it before authoring a single lesson. The sequence matters more than any individual lesson: each concept must be motivated by a problem the learner has actually encountered in the previous lesson. State is boring until something needs to remember; events are abstract until something must happen *when*.

A plausible spine — for the designer to accept, revise, or reject:

1. Something on screen; the anatomy of a component
2. Making it respond — events and signals
3. Remembering things — state, and why globals hurt
4. Data flow — where values come from and where they go
5. Conditions and branching — logic made visible
6. Lists and repetition — one design, many items
7. Bringing in real data — queries and asynchrony
8. Multiple pages — navigation and routing
9. Componentisation — building your own reusable parts
10. Capstone — build something of your own

### The tutor boundary

Define explicitly, in the curriculum and in the tutor's prompting, what the AI will do: explain what a node does, explain why something behaves as it does, help diagnose a stuck learner, and connect a concept to its general programming name. And what it will not do: build the lesson's solution, write the graph, or tell the learner the answer before they have tried. This boundary is the pedagogy.

### Testing with actual learners

Curriculum quality cannot be assessed from the inside. Test each lesson with real beginners — ideally teenagers, since that is the target — and watch where they stall, what they skip, and whether they can explain what they built afterwards. That last question is the real measure: not "did they finish" but "can they tell you how it works."

## Implementation Steps

1. **Engage a learning designer.**
2. **Write learning outcomes and the concept progression**; review before authoring.
3. **Author lessons 1–3**, test with real beginners, and revise the *approach* based on what happens — expect the first version to be wrong in instructive ways.
4. **Author the remaining lessons** in the validated style.
5. **Integrate and tune the AI tutor**, including the explicit boundary.
6. **Design the capstone** as an open build with support rather than instructions.
7. **Build assessment**: self-check questions, or an explain-what-you-built exercise using the tutor.
8. **Full-cohort test** — a group works through the entire curriculum end to end.

## Testing Plan

- Per-lesson beginner testing: completion, stall points, time taken.
- **Comprehension testing**: after each concept lesson, can the learner explain the concept in their own words and identify it elsewhere?
- Capstone: can learners build something unaided?
- Tutor-boundary testing: attempt to get the tutor to do the work; confirm it declines helpfully.
- Full cohort run before declaring done.

## Success Criteria

- [ ] Learning designer engaged; outcomes and progression documented and reviewed
- [ ] 10–15 lessons authored, cumulative, each producing something showable
- [ ] Concepts named explicitly and linked to general programming vocabulary
- [ ] AI tutor helps without doing the work; boundary verified by testing
- [ ] Capstone completed unaided by test learners
- [ ] Comprehension (not just completion) demonstrated in beginner testing
- [ ] Full cohort has run the curriculum end to end with results recorded

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| The curriculum teaches Noodl operation rather than transferable concepts | Concept-first progression; comprehension testing asks learners to explain, not to repeat; explicit mapping to general programming vocabulary |
| Engineers write it and it is pedagogically poor | Learning designer engaged as step 1 — this is not negotiable, and the estimate assumes it |
| Learners use the tutor to shortcut the learning | Explicit tutor boundary, tested adversarially; AIX-004 is read-only by design |
| Lessons break as the editor evolves | LEARN-001's model-state-based completion detection is the mitigation; run the curriculum as a regression suite in CI where feasible |
| Written for an imagined learner rather than a real one | Test with real beginners from lesson 3 onward, not at the end |

## References

- [Viability report — §2.2 (pedagogy: strongest thesis, least served)](../../reviews/NOODL-VIABILITY-REPORT.md)
- [Revival roadmap — Track E](../../reviews/NOODL-REVIVAL-ROADMAP.md)
- Depends on: LEARN-001 (engine + format), AIX-004 (tutor). Feeds: LEARN-005, LEARN-006

## Checklist

- [ ] Engage a learning designer **before** anything else
- [ ] Branch `task/learn-002-curriculum-v1`
- [ ] Document learning outcomes and concept progression; review
- [ ] Author and beginner-test lessons 1–3; revise the approach
- [ ] Author remaining lessons; integrate the AI tutor with its boundary
- [ ] Capstone and assessment design
- [ ] Full cohort run; record results; CHANGELOG; open PR
