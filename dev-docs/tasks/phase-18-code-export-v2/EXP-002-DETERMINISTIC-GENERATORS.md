# EXP-002: Deterministic Code Generators

## Metadata

| Field | Value |
|-------|-------|
| **ID** | EXP-002 |
| **Phase** | Phase 18 — Code Export v2 (Revival Track F) |
| **Priority** | 🔴 Critical |
| **Difficulty** | 🔴 Hard (volume + correctness) |
| **Estimated Time** | 6–8 weeks |
| **Prerequisites** | EXP-001; SUB-001, SUB-004 (Phase 13) |
| **Branch** | `task/exp-002-deterministic-generators` |
| **Recommended executor** | 🟠 **Opus 4.8** — a large, systematic body of work with clear per-node-type targets once the pipeline is designed. Individual node generators are delegable to Sonnet after the first several establish the pattern. |

## Objective

Generate idiomatic React 19 source for everything statically knowable in a Noodl project — visual nodes, state stores, events, routing, and project scaffolding — producing a buildable Vite application.

## Background

This is the mechanical majority of code export, and it is genuinely tractable. Most of a Noodl project is not the hard part: a Group is a `div`, a Text is a `span`, a component hierarchy is a component tree, props are props, a Repeater is a `map`, a Page Router is a route table. The Phase 7 design worked all of this out in per-node-type mapping tables, and with EXP-001's primitives handling reactive semantics, the remaining work is systematic rather than conceptually hard.

What makes it possible now, and what was missing when Phase 7 was designed, is the Phase 13 substrate. Generators consume per-component v2 files rather than parsing a monolithic blob, and the node catalog gives them a typed vocabulary — every node type, every port, every parameter, enumerated and described. Writing a generator against a catalog is a fundamentally different task from writing one against an open-ended JSON structure.

The output quality bar is worth stating plainly: **a React developer should be willing to inherit this code.** Not "it compiles," not "it runs" — willing to own it, extend it, and review it in a pull request. That is the standard the export feature is sold on, and code that fails it makes the feature worse than useless, because it promises an exit that nobody would actually take.

## Current State

- No code generation exists anywhere in `packages/`. The Phase 7 tasks (CODE-002/003/005/006) are designed and unimplemented.
- The design specifies: project graph → intermediate representation → component-boundary analysis → TypeScript AST via ts-morph → Prettier → files, with output organised into components, stores, logic, and events directories, depending on `@nodegx/core` and building with Vite.
- SUB-001 provides per-component files; SUB-004 provides the catalog; EXP-001 provides the runtime primitives.
- Roughly 27 node types are React-bound visual nodes; the remaining ~70 are logic/data/event nodes, many of which fall to this task and the rest to EXP-003.

## Desired State

Running export on a UI-heavy project produces a directory that:

- Builds and runs with `npm install && npm run dev`
- Contains readable, idiomatic React 19 with TypeScript
- Organises components mirroring the project's component structure
- Has extracted styles (CSS modules), working routing, and state stores
- Depends only on `@nodegx/core` plus ordinary React ecosystem packages
- Reads as though a competent developer wrote it

## Scope

### In Scope
- [ ] Intermediate representation from v2 project files
- [ ] Visual node generator (~27 React-bound types)
- [ ] Style extraction to CSS modules
- [ ] State store generator (Variables, Objects, Arrays → `@nodegx/core` stores)
- [ ] Logic generator for statically-analysable nodes (And, Or, Condition, Switch, and similar)
- [ ] Event system generator (Send/Receive Event)
- [ ] Routing generator (Page Router → React Router)
- [ ] Project scaffolding: Vite config, `package.json`, `tsconfig`, entry point
- [ ] ts-morph + Prettier pipeline producing formatted, deterministic output
- [ ] Node-type coverage reporting (what this generator handles vs. defers to EXP-003)
- [ ] Golden-output tests

### Out of Scope
- Function, Expression, and dynamic-port nodes (EXP-003)
- Database/cloud nodes — generate typed API stubs and defer implementation (EXP-004 reports them)
- Non-React targets (EXP-005)
- Round-trip import of exported code back into Noodl (not a goal, and stated as such to users)

## Technical Approach

### Pipeline

Follow the Phase 7 design: v2 files → IR → analysis → ts-morph AST → Prettier → files. The IR matters more than it might appear — it is the boundary EXP-003 and EXP-005 also work against, so design it as a shared contract rather than an internal detail of this task.

Determinism is a requirement, not a nicety: the same project must produce byte-identical output every time, or golden tests are impossible and users cannot diff successive exports.

### Node coverage strategy

Work from the catalog. For each node type, decide: generated statically here, deferred to EXP-003, or stubbed with a report entry. Track coverage explicitly and publish it — a user deserves to know before exporting how much of their project will come out clean.

**Write the target output by hand first**, as in EXP-001. For each of the main node categories, hand-write what good generated code looks like, review it as if in a pull request, and only then write the generator that produces it. Generators written without a target tend to produce technically-correct code that no one wants.

## Implementation Steps

1. **Design the IR** as a shared contract with EXP-003/EXP-005 in mind.
2. **Hand-write target output** for a representative component of each category; review critically.
3. **Scaffolding generator** first — a project that builds with an empty component proves the pipeline end to end.
4. **Visual node generator** plus style extraction — the largest single block of value.
5. **State stores**, then **events**, then **routing**.
6. **Statically-analysable logic nodes.**
7. **Coverage reporting** against the catalog.
8. **Golden-output tests** over a corpus of real projects.
9. **Inheritance review**: have a React developer with no Noodl exposure read the output and say whether they would accept it.

## Testing Plan

- Golden-output tests: fixed projects produce byte-identical expected output.
- Every exported corpus project builds (`npm install && npm run build`) without errors.
- Runtime comparison: exported UI renders equivalently to the interpreted version (a precursor to EXP-003's harness).
- TypeScript compiles cleanly with no `any` escape hatches in generated code.
- Lint: generated code passes a standard ESLint configuration.
- **Human inheritance review** — the qualitative bar, and the one that matters most.

## Success Criteria

- [ ] UI-heavy real projects export to a Vite app that installs, builds, and runs
- [ ] Output is deterministic (byte-identical across runs)
- [ ] Generated TypeScript compiles cleanly and passes standard lint
- [ ] Components, styles, stores, events, and routing all generated
- [ ] Node-type coverage reported against the catalog
- [ ] Exported UI renders equivalently to the interpreted original
- [ ] A React developer unfamiliar with Noodl reviews the output and would accept inheriting it

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Output is correct but nobody would want to maintain it | Hand-write targets first (step 2); human inheritance review as an explicit success criterion, not an afterthought |
| Coverage is much lower than users expect | Publish coverage against the catalog; EXP-004 reports it per project before and after export |
| The two systems (runtime and generator) drift as node behaviour changes | Golden tests plus EXP-003's trace harness; treat generator updates as part of node changes |
| Generated styles diverge visually from the original | Visual comparison in the test corpus; style extraction tested per visual node type |
| IR proves inadequate for EXP-003/EXP-005 | Design it as a shared contract in step 1, with those consumers' owners reviewing |

## References

- [`dev-docs/tasks/phase-7-code-export/`](../phase-7-code-export/) — CODE-002/003/005/006 designs and node mapping tables
- [Viability report — §4.3](../../reviews/NOODL-VIABILITY-REPORT.md)
- Depends on: EXP-001, SUB-001, SUB-004. Feeds: EXP-003, EXP-004, EXP-005

## Checklist

- [ ] Branch `task/exp-002-deterministic-generators`
- [ ] Design the IR with EXP-003/005 owners
- [ ] Hand-write and review target output per node category
- [ ] Scaffolding → visual nodes + styles → stores → events → routing → logic
- [ ] Coverage reporting; golden-output tests over real projects
- [ ] Human inheritance review
- [ ] CHANGELOG; open PR
