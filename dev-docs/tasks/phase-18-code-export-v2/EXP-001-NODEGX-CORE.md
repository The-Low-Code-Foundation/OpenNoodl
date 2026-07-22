# EXP-001: The `@nodegx/core` Companion Library

## Metadata

| Field | Value |
|-------|-------|
| **ID** | EXP-001 |
| **Phase** | Phase 18 — Code Export v2 (Revival Track F) |
| **Priority** | 🔴 Critical (foundation for the whole phase) |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 3 weeks |
| **Prerequisites** | SUB-004 (catalog); RUN-001 (React 19 runtime) |
| **Branch** | `task/exp-001-nodegx-core` |
| **Recommended executor** | 🔵 **Fable 5** — a small library whose API design determines the readability of every line of exported code anyone will ever inherit. The primitives are the product here; implementing them afterwards is straightforward. |

## Objective

Build the small runtime library that exported projects depend on: reactive primitives that preserve Noodl's push-signal semantics in idiomatic React, so generated code is readable rather than a wall of `useEffect` chains.

## Background

The question "can I export my Noodl project as a normal React codebase?" has an awkward answer, and the project has documented it honestly. Noodl applications are node graphs interpreted at runtime: signals propagate through connections, values flow between ports, and a scheduler batches updates. React thinks differently — it pulls, re-renders, and reconciles.

The earlier `CODE-EXPORT-STUDY.md` laid out the consequence with an example worth remembering: a button incrementing a counter that updates a text label is three connected nodes in Noodl, and in generated React it becomes either a chain of `useEffect` hooks simulating signals (correct, unreadable, and unmaintainable) or a complete restructuring into an idiomatic handler (readable, but requiring the compiler to understand *intent* rather than mechanics). At fifty nodes with branching, the first option produces code nobody would accept inheriting.

The design that resolved this — recorded in the Phase 7 overview — is a **companion library**. Rather than compiling signal semantics away into hooks, export code that uses a small set of primitives which model those semantics directly. The generated code then reads as an ordinary React application that happens to use a reactive state library, which is a completely normal thing for a React application to do.

The trade-off is explicit and worth stating to users: exported projects carry a small dependency. In exchange, the code is readable, the semantics are preserved exactly, and — per the original design's ADR-001 — the same primitives can later back other frameworks, which is what makes EXP-005 possible.

## Current State

- Phase 7 designed this library (CODE-001) and estimated it at roughly 8 KB; **nothing is implemented**. There is no `@nodegx/core` package anywhere in the repository, and no code-generation code of any kind.
- The semantics to preserve live in `packages/noodl-runtime`: a push model where outputs are flagged dirty, signals are sent explicitly and de-duplicated per frame, inputs are queued, and a scheduler drains dirty nodes.
- SUB-004's node catalog enumerates what the generators will need to express.
- The runtime is framework-neutral and React-free, which is what makes a clean primitive set possible in the first place.

## Desired State

A small, well-tested, well-documented npm package providing:

- **Values** — reactive state with subscription, mapping to Noodl's value outputs
- **Signals** — discrete events distinct from values, matching Noodl's signal semantics including per-frame de-duplication
- **Derived values** — computed from other values, matching Expression/logic node behaviour
- **Stores** — the exported equivalent of Noodl Variables, Objects, and Arrays
- **Event bus** — Send/Receive Event node equivalents
- **React bindings** — hooks connecting all of the above to components idiomatically

With semantics verifiably matching the interpreted runtime, since EXP-003's trace harness will compare them directly.

## Scope

### In Scope
- [ ] Package scaffolding, build, and publishing setup
- [ ] Value primitive with subscription and update semantics
- [ ] Signal primitive with Noodl's per-frame de-duplication behaviour
- [ ] Derived/computed values
- [ ] Store primitives (variable, object, array/collection)
- [ ] Event bus
- [ ] React hooks binding primitives to components
- [ ] Scheduling semantics matching the runtime's batching model
- [ ] TypeScript types throughout
- [ ] Bundle-size budget and measurement in CI
- [ ] API documentation aimed at a developer who has never used Noodl

### Out of Scope
- Code generation (EXP-002)
- Non-React bindings (EXP-005 assesses whether they are needed)
- Database/cloud primitives — exported projects call their own APIs; the library stays about reactivity
- Backwards compatibility with the interpreted runtime's internal APIs

## Technical Approach

### Design principles

**The generated code is the user interface of this library.** Every API decision should be judged by how the resulting exported code reads to a React developer who has never heard of Noodl. If a primitive produces code that needs explaining, the primitive is wrong.

**Semantics must match the runtime exactly**, particularly around signals. Noodl's runtime de-duplicates signals within an update cycle and batches value changes per frame; an exported app that fires a signal twice where the original fired once is subtly and painfully broken. Read the runtime's signal and dirty-flag implementation carefully and mirror its behaviour — EXP-003's trace harness will check this mechanically, so any divergence surfaces later at higher cost.

**Small and dependency-free.** The 8 KB target from the original design is a reasonable discipline: a heavyweight companion library undermines the "you own normal code now" proposition.

## Implementation Steps

1. **Study the runtime's semantics** — signals, dirty flagging, input queueing, per-frame batching — and write down the behaviour contract the library must satisfy.
2. **Design the API by writing exported code by hand.** Take three real Noodl components and hand-write what you would *want* the exported output to look like. The primitives fall out of that exercise, and this is the step that determines the phase's quality.
3. **Implement values, signals, and derived values**, with tests asserting the documented contract.
4. **Implement stores and the event bus.**
5. **React bindings** as hooks.
6. **Verify semantic parity** against the interpreted runtime on equivalent small graphs (a precursor to EXP-003's harness).
7. **Document** for a Noodl-unaware React developer.
8. **Bundle-size budget** enforced in CI.

## Testing Plan

- Unit tests per primitive against the written behaviour contract.
- **Parity tests**: build a small graph in Noodl and its hand-written equivalent using the library; assert identical output sequences for identical input sequences — especially signal counts and ordering.
- React binding tests: re-render behaviour, cleanup on unmount, no leaked subscriptions.
- Bundle size within budget.
- A React developer unfamiliar with Noodl reads the docs and builds something small with it.

## Success Criteria

- [ ] All primitives implemented with TypeScript types
- [ ] Behaviour contract documented and enforced by tests
- [ ] Signal semantics (including per-frame de-duplication) match the runtime, verified by parity tests
- [ ] React hooks bind idiomatically; no leaked subscriptions
- [ ] Bundle size within budget, enforced in CI
- [ ] Documentation comprehensible to a developer who has never used Noodl
- [ ] Hand-written "target output" examples from step 2 read well and are achievable with the final API

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Semantics diverge subtly from the runtime, breaking exported apps in ways users cannot diagnose | Written behaviour contract first; parity tests from the start; EXP-003's harness as the backstop |
| API produces awkward generated code | Step 2 (hand-write the target output first) exists precisely to prevent this — do not skip it |
| Library grows into a second runtime | Bundle budget in CI; scope excludes data/cloud concerns |
| Users object to any dependency at all | Document the trade-off honestly in EXP-004's report; the alternative (inlined `useEffect` chains) is measurably worse |

## References

- [`dev-docs/tasks/phase-7-code-export/`](../phase-7-code-export/) — CODE-001 design and ADR-001
- [`dev-docs/future-projects/CODE-EXPORT-STUDY.md`](../../future-projects/CODE-EXPORT-STUDY.md) — why naive export produces unreadable code
- [Viability report — §4.3](../../reviews/NOODL-VIABILITY-REPORT.md)
- Consumers: EXP-002, EXP-003, EXP-005

## Checklist

- [ ] Branch `task/exp-001-nodegx-core`
- [ ] Document the runtime's behaviour contract
- [ ] Hand-write target exported code for three real components; derive the API
- [ ] Implement values, signals, derived, stores, event bus, React bindings
- [ ] Parity tests against the interpreted runtime
- [ ] Docs for a Noodl-unaware developer; bundle budget in CI
- [ ] CHANGELOG; open PR
