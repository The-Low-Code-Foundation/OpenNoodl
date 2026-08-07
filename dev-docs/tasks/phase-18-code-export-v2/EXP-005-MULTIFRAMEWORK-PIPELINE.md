# EXP-005: Multi-Framework Pipeline

## Metadata

| Field | Value |
|-------|-------|
| **ID** | EXP-005 |
| **Phase** | Phase 18 — Code Export v2 (Revival Track F) |
| **Priority** | 🟡 Medium |
| **Difficulty** | 🟡 Medium (given EXP-003's harness) |
| **Estimated Time** | 4–6 weeks |
| **Prerequisites** | EXP-002, EXP-003, EXP-004 |
| **Branch** | `task/exp-005-multiframework-pipeline` |
| **Recommended executor** | 🟠 **Opus 4.8** — the hard infrastructure (trace verification) already exists; this applies it to a new transformation. The main judgement is where to draw the line on supported frameworks and quality claims. |

## Objective

Offer a supported path from an exported React codebase to Svelte or Vue, produced by AI porting and verified with the same trace harness — rather than maintaining separate compiler backends per framework.

## Background

"You're locked into React" is one of the standing objections to Noodl, and the viability assessment treated it seriously. Its finding was that the lock-in is shallower than it appears: the runtime's node model is genuinely framework-neutral, with React confined to a binding layer and roughly 27 of about 100 node types. The graph describes state, data flow, and events — not React.

But that neutrality does not automatically produce multi-framework export. Building native Svelte and Vue backends would mean writing and maintaining a full generator per framework, each needing per-node-type mappings, its own companion library port, and permanent parity maintenance as node behaviour evolves. That is a large ongoing cost for a solo-to-small team, and the assessment explicitly declined to recommend it: option (a), full multi-framework export, was ranked as not realistic to promise.

The move that *is* available in 2026 is different. Once EXP-002 and EXP-003 produce a working, verified React codebase, porting that codebase to Svelte or Vue is an ordinary AI-assisted refactoring task — and, critically, the trace harness built in EXP-003 verifies the port exactly as it verified the original translation. The framework changes; the behavioural contract does not.

So the honest product claim becomes: **export to React, then port with a supported, verified pipeline.** One generator to maintain, one verification mechanism, and a genuine answer to the lock-in objection.

## Current State

- EXP-002 produces idiomatic React 19 + Vite output.
- EXP-003 provides trace recording, replay, and behavioural comparison — the machinery that makes any transformation verifiable.
- EXP-001's `@nodegx/core` provides React-bound reactive primitives; its ADR notes the primitives were chosen to allow other renderers later, which is relevant to how far the port has to go.
- No non-React output exists, and none is promised to users today.

## Desired State

- A documented, supported pipeline: exported React project → AI port → verified Svelte or Vue project.
- The trace harness verifies the ported result against the same recorded traces.
- An honest report (in EXP-004's style) of what ported cleanly and what needs review.
- Users understand this as a supported path with known limits, not a guaranteed one-click conversion.

## Scope

### In Scope
- [ ] Port pipeline for Svelte and Vue from EXP-002/003 output
- [ ] Decide and implement the reactive-primitive strategy for the target framework (port `@nodegx/core`, or map onto native reactivity)
- [ ] Reuse EXP-003's trace harness to verify ported output
- [ ] Iterative repair loop on verification mismatch
- [ ] Port report in EXP-004's format
- [ ] Documentation with clearly stated limits
- [ ] A worked end-to-end example for each target framework

### Out of Scope
- Native multi-framework generation from the graph (explicitly rejected — this is the alternative to it)
- Frameworks beyond Svelte and Vue initially
- Porting unverified React translations — if it was not verified in React, it cannot be verified after porting either; carry the caveat forward
- Round-trip back to Noodl

## Technical Approach

### The primitive question

The first decision: does the ported project keep a Svelte/Vue build of `@nodegx/core`, or map the primitives onto the target framework's native reactivity (Svelte stores/runes, Vue refs and computed)?

Mapping to native reactivity produces more idiomatic code that a Svelte or Vue developer would prefer to inherit — which is, after all, the point of porting. Keeping the library is simpler and preserves semantics more obviously. Investigate both early; the answer may differ per framework, since Svelte's and Vue's reactivity models differ meaningfully from each other.

### Verification carries over cleanly

This is the structural advantage of having built EXP-003. The recorded traces are behavioural facts about the original Noodl project — given these inputs, these outputs. They do not care what framework the implementation uses. The replay harness needs a framework-appropriate driver, but the traces, the comparator, and the equivalence rules are unchanged.

Be careful about one thing: verification of the *port* only demonstrates that the port matches the original traces. If a React translation was unverified going in, its Svelte descendant is equally unverified — the caveat must propagate through the report rather than being quietly dropped at the framework boundary.

## Implementation Steps

1. **Decide the primitive strategy** per framework; prototype a hand-port of one component each way and compare readability.
2. **Framework replay drivers** so the trace harness can execute Svelte and Vue output.
3. **Hand-port a small project** to each framework to establish the target style — the same "write the target output first" discipline used in EXP-001 and EXP-002.
4. **AI port pipeline** producing that style, with the repair loop on verification mismatch.
5. **Report generation** in EXP-004's format, propagating unverified status from the React stage.
6. **Documentation** with explicit limits and expectations.
7. **Worked examples** end to end for both frameworks.

## Testing Plan

- Ported projects build and run for both frameworks.
- Trace verification passes on ported output at rates comparable to the React original.
- Unverified-in-React items remain marked unverified after porting.
- Idiomatic review: a Svelte developer and a Vue developer each review the relevant output and say whether they would accept it.
- End-to-end on at least two real projects per framework.

## Success Criteria

- [ ] Primitive strategy decided and justified per framework
- [ ] Svelte and Vue ports build and run
- [ ] Trace harness verifies ported output; verification rates comparable to React
- [ ] Unverified status propagates correctly through the port
- [ ] Framework-native developers would accept the output as inheritable
- [ ] Report clearly communicates what ported cleanly and what needs review
- [ ] Documentation states limits honestly; worked examples published

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Ported code is technically working but unidiomatic, so nobody wants it | Hand-port to establish target style first; framework-native reviewers as an explicit success criterion |
| Users read this as "Noodl supports any framework" | Documentation and reporting frame it as a supported *pipeline* with known limits, not native export |
| Verification caveats get lost across the port | Propagate status explicitly through the report; test that unverified items stay unverified |
| Scope expands to more frameworks | Two frameworks only; further targets are a separate decision after demand is evident |
| Maintenance burden grows anyway | Only one generator (React) is maintained; the port pipeline is prompt-and-verify, not a second compiler |

## References

- [Viability report — §4.1, §4.3 (lock-in is shallower than it appears; rank the export options honestly)](../../reviews/NOODL-VIABILITY-REPORT.md)
- [Revival roadmap — Track F (F-05)](../../reviews/NOODL-REVIVAL-ROADMAP.md)
- `dev-docs/tasks/phase-7-code-export/` — ADR-001 on primitives enabling future renderers
- Depends on: EXP-002, EXP-003, EXP-004

## Checklist

- [ ] Branch `task/exp-005-multiframework-pipeline`
- [ ] Decide primitive strategy per framework via hand-ported prototypes
- [ ] Framework replay drivers for the trace harness
- [ ] Establish target style by hand-porting a small project
- [ ] AI port pipeline with verification repair loop
- [ ] Report generation propagating unverified status
- [ ] Framework-native reviewer sign-off; documentation and examples
- [ ] CHANGELOG; open PR
