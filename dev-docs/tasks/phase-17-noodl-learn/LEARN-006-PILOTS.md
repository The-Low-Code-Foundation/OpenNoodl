# LEARN-006: Real-World Pilots

## Metadata

| Field | Value |
|-------|-------|
| **ID** | LEARN-006 |
| **Phase** | Phase 17 — Noodl Learn (Revival Track E) |
| **Priority** | 🔴 Critical — **this task produces Gate G2's evidence** |
| **Difficulty** | 🟡 Medium (logistical and interpretive, not technical) |
| **Estimated Time** | Ongoing (a term or equivalent, minimum) |
| **Prerequisites** | LEARN-002 (curriculum) at minimum; REV-007 (installable builds) |
| **Branch** | n/a — this task produces findings, not code |
| **Recommended executor** | 🔵 **Fable 5** — with the same caveat as LEARN-002: **this requires humans doing real fieldwork.** The model's role is designing the study, instrumenting honestly, and interpreting results without motivated reasoning — which is exactly where the danger lies. |

## Objective

Run two instrumented pilots — a school programme and a code club or bootcamp — and produce honest evidence about whether learners engage with, learn from, and return to Noodl Learn.

**The deliverable is a finding, and the finding is allowed to be negative.**

## Background

Everything else in this revival plan can be validated internally. Code either compiles or does not; a format either round-trips or does not; a validator either catches errors or does not. This task validates the only thing that cannot be checked from inside the repository: whether anyone wants this.

The viability assessment was explicit about the limits of its own conclusions. It found that the codebase can carry the vision and that the strategy is coherent — and stated plainly that it "cannot validate demand." It then set Gate G2 at roughly month nine: after the AI authoring demo has shipped in a signed build for a quarter and two pilots have run, the question is whether learners and legibility-motivated builders **return unprompted**. If they do not, the recommended action is to wind down to maintenance, ship export so nobody is trapped, open-source everything, and stop.

That makes this task unusual and uncomfortable: its job is to generate evidence that might end the project. It should be designed accordingly — instrumented before it starts, with success criteria written down in advance, and interpreted by someone willing to report a negative result.

## Current State

- No pilots have been run; no external users have used the curriculum.
- LEARN-002 provides the curriculum; LEARN-001 provides progress persistence; REV-007 provides installable builds.
- LEARN-005 (classroom mode) may or may not have landed — pilots can run without it, and running without it is arguably better, because the friction encountered *is* the finding that shapes LEARN-005.
- AIX-002's telemetry (opt-in, privacy-respecting) provides return-usage data for the builder side of Gate G2; this task covers the learner side.

## Desired State

Two pilots run to completion with:

- Pre-registered success criteria, written before the pilots begin
- Instrumentation capturing progression, stall points, and return usage
- Qualitative data: interviews with learners and instructors
- Comprehension evidence, not just completion counts
- A written finding with a clear verdict, presented whichever way it falls

## Scope

### In Scope
- [ ] Recruit two pilot sites: one school programme, one code club or bootcamp
- [ ] Pre-register success criteria and the interpretation rules **before** starting
- [ ] Ethics and consent, especially for minors — non-negotiable and handled properly
- [ ] Privacy-respecting instrumentation (progression, stalls, returns — never project content)
- [ ] Instructor onboarding and support during the pilots
- [ ] Learner and instructor interviews
- [ ] Comprehension assessment (can they explain what they built?)
- [ ] Written findings report with a verdict
- [ ] Feed findings into LEARN-005 and the Gate G2 decision

### Out of Scope
- Building features discovered during the pilots (log them; LEARN-005 and later work implement them)
- Scaling beyond two sites (two is enough for a signal; more is a distraction at this stage)
- Marketing or recruitment beyond the pilots themselves
- Publishing academic research (a possible later output, not the goal)

## Approach

### Pre-register the criteria

Write down, before the first session, what would count as success, as ambiguity, and as failure. Doing this afterwards guarantees motivated interpretation — the natural instinct after months of work is to read any engagement as validation, and a pre-registered criterion is the only real defence against it.

Suggested shape, for the team to sharpen:

- **Success**: a majority of learners complete the core lessons; a meaningful proportion return to build something of their own unprompted; instructors say they would run it again; learners can explain their applications.
- **Ambiguous**: learners complete lessons but build nothing independently; instructors are positive but non-committal.
- **Failure**: high drop-off in early lessons; no unprompted return usage; instructors would not repeat it.

**Unprompted return is the key metric**, and it is the one Gate G2 names. Completion during a scheduled class measures compliance; coming back afterwards measures interest.

### Measure comprehension, not just completion

The pedagogy thesis claims learners end up *understanding* what they built. Test that: ask learners to explain their application, identify where state lives, or predict what changes if a connection is removed. A cohort that finishes every lesson and cannot explain anything is evidence against the thesis, however good the completion numbers look.

### Ethics

Working with minors requires informed consent from guardians, institutional approval, minimal data collection, and the ability to withdraw. Handle this properly and early — it is both an obligation and a practical prerequisite, since no school will participate otherwise.

## Implementation Steps

1. **Design the study**: pre-registered criteria, metrics, interview protocols, consent materials.
2. **Secure ethics and institutional approval.**
3. **Recruit the two sites.**
4. **Instrument** — privacy-respecting progression and return telemetry, with content explicitly excluded.
5. **Onboard instructors**; note every friction point encountered (this is data for LEARN-005).
6. **Run the pilots**, supporting without steering — resist the urge to rescue struggling learners in ways a real deployment could not.
7. **Collect qualitative data**: interviews with learners and instructors.
8. **Comprehension assessment.**
9. **Write the findings report** with an explicit verdict against the pre-registered criteria.
10. **Present to the Gate G2 decision**, including the negative case if that is what the data shows.

## Success Criteria

Note: "success" here means *the pilot was well run*, not *the product succeeded*. Those are different things, and conflating them is the failure mode this task must avoid.

- [ ] Success criteria pre-registered before the pilots began
- [ ] Ethics and consent handled properly for all participants
- [ ] Two pilots run to completion
- [ ] Instrumentation captured progression, stalls, and return usage without collecting content
- [ ] Learner and instructor interviews conducted
- [ ] Comprehension assessed, not only completion
- [ ] Findings report written with an explicit verdict against the pre-registered criteria
- [ ] Findings fed into LEARN-005 and the Gate G2 decision

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Motivated interpretation reads weak signals as validation | Pre-registered criteria; ideally have someone outside the project interpret the data |
| The team over-supports pilots, masking real friction | Support at the level a real deployment could sustain; log every intervention as a finding |
| Two sites are too small a sample to conclude anything | Treat as directional evidence, and say so; strong negative signals are more conclusive than weak positive ones |
| Ethics or consent problems halt a pilot | Handle approval early and properly; budget time for institutional processes |
| A negative finding is buried or softened | The task's stated purpose is an honest verdict; the roadmap's Gate G2 pre-commits to the action if the answer is no |

## References

- [Revival roadmap — Track E (E-06) and Gate G2](../../reviews/NOODL-REVIVAL-ROADMAP.md)
- [Viability report — §6 "What would have to be true" (the demand gate)](../../reviews/NOODL-VIABILITY-REPORT.md)
- Depends on: LEARN-002, REV-007. Feeds: LEARN-005, Gate G2

## Checklist

- [ ] **Pre-register success criteria before anything else**
- [ ] Ethics approval and consent materials for minors
- [ ] Recruit two sites (school + club/bootcamp)
- [ ] Instrument progression/return without collecting content
- [ ] Onboard instructors; log every friction point
- [ ] Run pilots; interview learners and instructors
- [ ] Assess comprehension, not just completion
- [ ] Write the findings report with an explicit verdict; present to Gate G2
