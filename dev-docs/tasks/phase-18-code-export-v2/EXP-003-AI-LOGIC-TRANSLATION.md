# EXP-003: AI Logic Translation with Trace Verification

## Metadata

| Field | Value |
|-------|-------|
| **ID** | EXP-003 |
| **Phase** | Phase 18 — Code Export v2 (Revival Track F) |
| **Priority** | 🔴 Critical — **this is what makes export more than a partial aid** |
| **Difficulty** | 🔴 Hard |
| **Estimated Time** | 6–8 weeks |
| **Prerequisites** | EXP-001, EXP-002; AIX-001 (AI client); SUB-005 (semantics) |
| **Branch** | `task/exp-003-ai-logic-translation` |
| **Recommended executor** | 🔵 **Fable 5** — the verification harness design is the intellectual core of the entire phase: deciding what "behaviourally equivalent" means for a reactive graph, how to record and replay traces fairly, and when to trust a translation. Get this wrong and the phase ships confident, broken exports. |

## Objective

Translate the node types that resist static analysis — Function, Expression, and dynamic-port nodes — into `@nodegx/core` code using an LLM, and **verify every translation mechanically** by replaying recorded execution traces against both the interpreted original and the exported result.

## Background

Every previous analysis of code export in this project stopped at the same wall. `CODE-EXPORT-STUDY.md` concluded that Function nodes, containing arbitrary user JavaScript written against Noodl's runtime APIs, and Expression nodes, compiled from strings at runtime, could not be reliably translated — and proposed generating TODO comments and placeholder stubs instead. Phase 7's design made the same concession. Both were right at the time.

Two things changed. First, LLMs are now genuinely good at exactly this shape of task: "rewrite this twenty-line snippet against this documented API." A Function node's body is small, self-contained, and accompanied by a clear specification of its inputs and outputs. Second, and more importantly, **the correctness of a translation is now checkable by machine.**

That second point is what this task rests on, and it is why it is not simply "ask an AI to convert the code and hope." The interpreted runtime can be instrumented to record what actually flows through a node: given these inputs in this order, these outputs were produced in this order. The translated code can be replayed against the same recorded inputs and its outputs compared. A translation either reproduces the observed behaviour or it does not, and humans only need to review the ones that do not.

This converts an unbounded correctness problem into a bounded review problem, and it is the difference between the viability assessment's option (c) — "export stays a partial handoff aid" — and option (b), "React-only export is realistic and is enough."

Honesty about the limits: trace verification proves behaviour matched *on the traces you recorded*. It does not prove equivalence for all possible inputs. Coverage of the recorded traces is therefore the real measure of confidence, and EXP-004 must report it rather than implying certainty.

## Current State

The resistant node types, verified in the runtime:

- **Function nodes** — user JavaScript compiled at runtime via `new AsyncFunction`, with **output ports discovered dynamically through a proxy** on the outputs object. The set of outputs is not knowable without executing the code.
- **JavaScript node parser** — compiles user scripts that themselves declare ports through a `define`/`script` DSL.
- **Expression nodes and expression parameters** — expression strings compiled with `new Function`, with dependencies detected at runtime by parsing the expression text. Any input can carry an expression parameter evaluated live.
- **Dynamic ports generally** — several nodes generate ports from configuration; `dev-docs/reference/LEARNINGS.md` records a prior feature that failed because it assumed static port knowledge.

Available to this task: EXP-002's deterministic generators and IR, EXP-001's primitives and their documented behaviour contract, AIX-001's AI client, and SUB-005's node semantics.

## Desired State

- Function and Expression node bodies translated into `@nodegx/core` code within the exported project.
- Dynamic ports resolved from recorded execution where they cannot be determined statically.
- Every translation verified by trace replay, with a machine verdict: verified, mismatched, or unverified (no trace coverage).
- Mismatched and unverified translations flagged for human review, with the original node body preserved alongside so a developer can finish the job.
- Overall export confidence reported per project.

## Scope

### In Scope
- [ ] Trace recording in the interpreted runtime: inputs, outputs, ordering, timing where relevant
- [ ] Trace replay harness executing exported code against recorded inputs
- [ ] Behavioural comparison with well-defined equivalence rules
- [ ] LLM translation of Function node bodies against the `@nodegx/core` API
- [ ] LLM translation of Expression nodes
- [ ] Dynamic-port resolution from traces
- [ ] Iterative repair: mismatch → feed the difference back → retranslate, bounded
- [ ] Per-translation verdicts and per-project confidence reporting
- [ ] Preservation of original node source in comments for unverified translations
- [ ] Trace-coverage measurement and reporting

### Out of Scope
- Formal verification or proof of equivalence (traces are evidence, not proof — say so)
- Translating database/cloud node internals (stubs, per EXP-002)
- Automatic acceptance of unverified translations — never silently ship code that failed or lacked verification
- Recording traces from production deployments (development/preview only, for privacy and practicality)

## Technical Approach

### Trace recording

Instrument the runtime to record, per node instance: input values and signals with ordering, resulting output values and signals with ordering, and enough context to replay deterministically. Traces come from running the project in preview — ideally exercised by the user, since real usage produces the most representative coverage.

**Non-determinism is the hard case**: nodes using time, randomness, or network calls cannot be replayed naively. Classify these, and either stub their sources during replay or mark them unverifiable and route them to human review. Pretending a time-dependent node verified cleanly would be exactly the kind of false confidence this task exists to eliminate.

### Equivalence rules

Define precisely what counts as matching before building the comparator. Value equality is obvious; signal *count and ordering* matter (a signal fired twice where the original fired once is a real bug); floating-point comparison needs tolerance; asynchronous ordering may need normalisation. Write these rules down and review them — they encode what "correct export" means for the whole phase.

### Translation loop

Provide the model with: the node's original source, its documented inputs and outputs from the catalog, `@nodegx/core`'s API documentation, and the surrounding component context. Translate, then verify by replay. On mismatch, feed the specific behavioural difference back and retry, bounded to a small number of attempts before escalating to human review. This mirrors the validator-driven repair loop in AIX-002 — feedback-driven iteration against a mechanical check, rather than one-shot generation.

## Implementation Steps

1. **Define equivalence rules** and review them; everything downstream depends on this definition.
2. **Trace recording** in the interpreted runtime, with a serialisable trace format.
3. **Replay harness** for exported code against recorded traces.
4. **Comparator** implementing the equivalence rules, with clear difference reporting.
5. **Validate the harness on EXP-002's deterministic output** — where translation is not involved, replay should verify cleanly. If it does not, the harness is wrong, and finding that out here is much cheaper than later.
6. **Expression node translation** first (smaller, more constrained than Function nodes).
7. **Function node translation** with the repair loop.
8. **Dynamic-port resolution** from traces.
9. **Non-determinism classification** and handling.
10. **Confidence and coverage reporting** for EXP-004.

## Testing Plan

- Harness self-validation on deterministic generated output (step 5) — this is the critical test of the *tester*.
- Known-good translations: hand-translate a set of Function nodes correctly and confirm the harness verifies them.
- **Known-bad translations**: deliberately introduce subtle behavioural errors (off-by-one, wrong signal count, inverted condition) and confirm the harness catches every one. A verifier that never fails is worthless.
- Coverage measurement accuracy: a node exercised by no trace must report as unverified, never as verified.
- End-to-end on real projects with substantial Function-node usage.

## Success Criteria

- [ ] Equivalence rules documented and reviewed
- [ ] Trace recording and replay working end to end
- [ ] Harness verifies EXP-002's deterministic output cleanly
- [ ] Harness catches every deliberately-introduced behavioural error in testing
- [ ] Function and Expression nodes translated, with measured verification rates on real projects
- [ ] Dynamic ports resolved from traces where statically unknowable
- [ ] Unverified and mismatched translations flagged, never silently accepted
- [ ] Original node source preserved for anything not verified
- [ ] Trace coverage reported honestly per project

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Trace verification gives false confidence (passed on traces, wrong in general) | Report coverage prominently, never claim proof; EXP-004 communicates this to users in plain language |
| The harness itself is buggy and verifies wrong code | Step 5 self-validation plus deliberate known-bad tests — the verifier must be shown to fail correctly |
| Non-deterministic nodes are wrongly marked verified | Explicit classification; unverifiable is a legitimate and safe outcome |
| Translation quality is poor and most nodes need human review | Still a substantial improvement on the TODO-stub baseline; report honestly; iterate on prompting with the repair loop |
| Users assume 100% fidelity because AI was involved | EXP-004's honesty UX exists for this; never present unverified code as verified |

## References

- [`dev-docs/future-projects/CODE-EXPORT-STUDY.md`](../../future-projects/CODE-EXPORT-STUDY.md) — the original argument this task answers
- [Viability report — §4.3 (what has aged and what has not)](../../reviews/NOODL-VIABILITY-REPORT.md)
- [Revival roadmap — Track F (F-03)](../../reviews/NOODL-REVIVAL-ROADMAP.md)
- Depends on: EXP-001, EXP-002, AIX-001, SUB-005. Feeds: EXP-004, EXP-005 (reuses the harness)

## Checklist

- [ ] Branch `task/exp-003-ai-logic-translation`
- [ ] Define and review equivalence rules first
- [ ] Trace recording, replay harness, comparator
- [ ] **Self-validate the harness on deterministic output and on known-bad translations**
- [ ] Expression translation, then Function translation with the repair loop
- [ ] Dynamic-port resolution; non-determinism classification
- [ ] Coverage and confidence reporting; CHANGELOG; open PR
