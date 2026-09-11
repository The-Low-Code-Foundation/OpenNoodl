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

## Outcome (2026-08-07) — built, gated, not yet consumed

`packages/nodegx-core` exists. What it produced, and the two places this task doc turned out to be
wrong about the runtime it was describing:

- **[`CONTRACT.md`](../../../packages/nodegx-core/CONTRACT.md)** — the behaviour contract, eleven
  clauses, each cited to the runtime source it was read from, and each marked as implemented,
  deliberately not implemented, or partial.
- **[`EXP-001-TARGET-OUTPUT.md`](./EXP-001-TARGET-OUTPUT.md)** — step 2 done first, on four real
  components from `project-examples/agent-chat`. Its most useful finding: **most exported code
  should not mention the library at all**, and the API is smaller because that exercise happened
  before any code was written.
- **69 in-package tests** plus **8 parity tests** at
  `packages/noodl-runtime/test/nodegx-core-parity.test.ts`, which run the same scenario through the
  *actual interpreter* and the library and compare the event sequences.
- **2.8 KB gzipped** against the 8 KB design budget, enforced by `npm run size:nodegx-core` in CI.

**Two corrections to this document.** The scope below asks for "Signal primitive with Noodl's
per-frame de-duplication behaviour". The runtime has no such behaviour — signal ports are
edge-triggered and each pulse carries its own reset, so two pulses in one frame fire the handler
twice. This was verified against the interpreter, not argued from the source: see the C4 parity
test. Implementing the doc as written would have silently dropped events.

Relatedly, two assumptions a reactive library would make by default are also false here: the runtime
does not coalesce queued values, and it does not skip an identical write. Both are C2, both are
tested against the interpreter, and both are why `Value.set` has no equality check.

## Published 2026-09-01 — `@nodegx/core@0.1.0` is on npm, and the export's `npm install` is now true

Richard claimed the `@nodegx` scope and published from his own account with 2FA
(`richard-digitalbricks`), which is what the "human-gated" note below meant. The registry now
serves `@nodegx/core@0.1.0`, MIT, **no runtime dependencies**, React an optional peer.

**Measured, not assumed.** The published tarball's shasum (`0c872625…`) is the one
`npm pack --dry-run` reported, so what shipped is the artefact that was inspected: `dist` in both
ESM and CJS with declarations, plus `README.md` and `CONTRACT.md`. Installed from the registry into
an empty directory, it reproduces the two contract clauses this task corrected — an identical write
is **not** skipped (`set(2); set(2)` → two notifications, C2) and every pulse fires (`emit(); emit()`
→ two, C4).

**The end-to-end proof, which is the one that matters.** `Deadline Desk` exported through
`scripts/emit-app.ts`, then `npm install && npm run build` **against the public registry, with no
workspace link and no local path** — install resolved `@nodegx/core@0.1.0`, and `tsc -b && vite
build` exited **0**. Until this publish that instruction — printed into every exported app by
[`readme.ts`](../../../packages/nodegx-export/src/emit/readme.ts) and
[`report.ts`](../../../packages/nodegx-export/src/emit/report.ts) — 404'd for any project whose
output imported the library.

🔴 **Four things this publish did *not* carry, and 0.1.0 cannot be amended.** A published version is
immutable, so each is a `0.1.1` row, owned by **EXP-001** (this task):

1. **No `LICENSE` file.** `package.json` declares MIT and npm renders that, but the tarball carries
   no licence text — for the one file that lands inside every user's exported app.
2. **No `repository` / `homepage` / `bugs` fields.** The npm page has no link back, and
   `npm publish --provenance` from CI *requires* `repository`.
3. **No `prepublishOnly`.** `dist/` is gitignored (`.gitignore:117`) and `files` is
   `["dist", "README.md", "CONTRACT.md"]` — a publish from a clean checkout would ship a package
   with **no code in it, and no error**. This one held only because the local `dist/` happened to be
   newer than `src/`.
4. **Nothing in CI knows the registry exists.**
   [`typecheckApp.ts:110`](../../../packages/nodegx-export/tests/helpers/typecheckApp.ts#L110)
   maps `@nodegx/core` to `packages/nodegx-core/src` **deliberately**, so the whole export suite
   stays green against a package that is missing, stale, or empty on npm. The 404 above lived
   through 504 passing tests. The gate that would have caught it is the pack-and-install run done by
   hand here.

⚠️ **The version pin is a literal.** [`emitApp.ts:256`](../../../packages/nodegx-export/src/emit/emitApp.ts#L256)
writes `"@nodegx/core": "^0.1.0"` into the emitted `package.json` with nothing tying it to
`packages/nodegx-core/package.json`. That range covers every `0.1.x`, so the metadata fixes above
reach new installs on their own once `0.1.1` is out — including apps already exported. The drift is
at the **minor**: publish `0.2.0` and every new export still pins `^0.1.0` and silently installs the
old library, because the pin is a literal in the emitter. Derive it from the package's own version.

**Left open from the original build:** re-render-on-change through a real DOM commit is not covered
here, because the repository carries no `jest-environment-jsdom` by an existing documented decision.
EXP-002's first generated app is where that gets looked at.

## Objective

Build the small runtime library that exported projects depend on: reactive primitives that preserve Noodl's push-signal semantics in idiomatic React, so generated code is readable rather than a wall of `useEffect` chains.

## Background

The question "can I export my Noodl project as a normal React codebase?" has an awkward answer, and the project has documented it honestly. Noodl applications are node graphs interpreted at runtime: signals propagate through connections, values flow between ports, and a scheduler batches updates. React thinks differently — it pulls, re-renders, and reconciles.

The earlier `CODE-EXPORT-STUDY.md` laid out the consequence with an example worth remembering: a button incrementing a counter that updates a text label is three connected nodes in Noodl, and in generated React it becomes either a chain of `useEffect` hooks simulating signals (correct, unreadable, and unmaintainable) or a complete restructuring into an idiomatic handler (readable, but requiring the compiler to understand *intent* rather than mechanics). At fifty nodes with branching, the first option produces code nobody would accept inheriting.

The design that resolved this — recorded in the Phase 7 overview — is a **companion library**. Rather than compiling signal semantics away into hooks, export code that uses a small set of primitives which model those semantics directly. The generated code then reads as an ordinary React application that happens to use a reactive state library, which is a completely normal thing for a React application to do.

The trade-off is explicit and worth stating to users: exported projects carry a small dependency. In exchange, the code is readable, the semantics are preserved exactly, and — per the original design's ADR-001 — the same primitives can later back other frameworks, which is what makes EXP-005 possible.

## Current State *(as written before the work; kept for the record — see Outcome above)*

- Phase 7 designed this library (CODE-001) and estimated it at roughly 8 KB; **nothing is implemented**. There is no `@nodegx/core` package anywhere in the repository, and no code-generation code of any kind.
- The semantics to preserve live in `packages/noodl-runtime`: a push model where outputs are flagged dirty, signals are sent explicitly and de-duplicated per frame, inputs are queued, and a scheduler drains dirty nodes. *(The "de-duplicated per frame" here is wrong — see the correction above and CONTRACT.md C4.)*
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
- [x] Package scaffolding, build, and publishing setup — **published 2026-09-01 as `@nodegx/core@0.1.0`**; four metadata/CI gaps carried to `0.1.1` (see Published above)
- [x] Value primitive with subscription and update semantics
- [x] Signal primitive with Noodl's per-frame de-duplication behaviour — **the runtime has no such behaviour** — see the correction above; implemented as edge-triggered, every pulse fires
- [x] Derived/computed values
- [x] Store primitives (variable, object, array/collection)
- [x] Event bus
- [x] React hooks binding primitives to components
- [x] Scheduling semantics matching the runtime's batching model — pluggable scheduler; microtask by default
- [x] TypeScript types throughout — `strict`, unlike the root program
- [x] Bundle-size budget and measurement in CI — 2.8 KB of 8 KB
- [x] API documentation aimed at a developer who has never used Noodl

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

- [x] All primitives implemented with TypeScript types
- [x] Behaviour contract documented and enforced by tests — `CONTRACT.md`, one named test per clause
- [x] Signal semantics match the runtime, verified by parity tests — *there is no per-frame de-duplication to match*; every pulse fires, asserted against the interpreter
- [x] React hooks bind idiomatically; no leaked subscriptions — `useSyncExternalStore` throughout, `useDerived` disposes on unmount
- [x] Bundle size within budget, enforced in CI
- [x] Documentation comprehensible to a developer who has never used Noodl — `README.md`; **not yet read by an actual unfamiliar developer**
- [x] Hand-written "target output" examples from step 2 read well and are achievable with the final API

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

- [x] ~~Branch `task/exp-001-nodegx-core`~~ — committed to `cline-dev` per this repo's working rule
- [x] Document the runtime's behaviour contract
- [x] Hand-write target exported code for three real components; derive the API — four, from `agent-chat`
- [x] Implement values, signals, derived, stores, event bus, React bindings
- [x] Parity tests against the interpreted runtime
- [x] Docs for a Noodl-unaware developer; bundle budget in CI
- [x] npm scope + first publish — **`@nodegx/core@0.1.0`, 2026-09-01**, verified by installing from
      the registry and building an exported app (exit 0)
- [x] CHANGELOG — [`packages/nodegx-core/CHANGELOG.md`](../../../packages/nodegx-core/CHANGELOG.md)
- [ ] `0.1.1`: LICENSE file, `repository`/`homepage`/`bugs`, `prepublishOnly`
- [ ] A CI gate that installs the published package into a generated app — the one check the current
      504 green tests structurally cannot make
