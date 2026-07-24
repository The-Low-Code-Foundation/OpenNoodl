# PLAT-003: Type the Runtime and Viewer Packages

## Metadata

| Field | Value |
|-------|-------|
| **ID** | PLAT-003 |
| **Phase** | Phase 14 — Editor Platform Health (Revival Track B) |
| **Priority** | 🟠 High |
| **Difficulty** | 🔴 Hard (volume + untested legacy code) |
| **Estimated Time** | 8–12 weeks |
| **Prerequisites** | REV-005 (TypeScript unified at 5.9.3); coordinate with SUB-004 |
| **Branch** | `task/plat-003-type-the-runtime` |
| **Recommended executor** | 🟠 **Opus 4.8** — mechanically repetitive but semantically demanding: inferring intended types from untyped, sparsely-tested code where a wrong annotation is a lie the compiler will enforce. Delegate individual node files to Sonnet once the core types (`Node`, `NodeDefinition`, ports, signals) are designed. |

## Objective

Convert `noodl-runtime` and `noodl-viewer-react` to TypeScript incrementally, tests-first, and publish typed definitions for the node-definition API.

## Background

The runtime is the healthiest part of OpenNoodl architecturally — the viability assessment found it to be a genuinely framework-neutral execution engine with zero React dependencies, which is what makes multi-framework export and AI authoring plausible at all. It is also almost entirely untyped: 98 JavaScript files against 6 TypeScript ones, with `noodl-viewer-react` similar at 131 JavaScript files.

Untyped does not mean broken — this code has run in production for years. But it does mean three specific things that matter now. Contributors cannot discover the node-definition API without reading implementations. The editor's 554 `TSFixme` markers cluster precisely where typed editor code meets untyped runtime code, so the debt is contagious. And AI-assisted modification is markedly less reliable without types, which is awkward for a project whose strategy is built on AI collaboration.

There is a further reason to do this now rather than later, and it is the sequencing note in the phase README: **SUB-004 (the node catalog) extracts the same knowledge in a different form.** Both tasks are asking "what are this node's inputs, outputs, and types." Doing them independently means encoding that knowledge twice, in two representations that can then drift. Doing them together means the catalog and the types can share a source of truth.

## Current State

- `packages/noodl-runtime`: 98 `.js`, 6 `.ts`. Core files include the base `Node` class, node definition compilation, the node register, node scope, and the node context/scheduler, plus the standard library under `src/nodes/std-library/`.
- `packages/noodl-viewer-react`: 131 `.js`, 32 `.ts`, 35 `.tsx`. Contains the React binding hub (`react-component-node.js`, roughly 1,190 lines), visual node definitions, and many framework-neutral logic/data nodes that live here for historical reasons (with `// moved to runtime` comments indicating an in-progress migration).
- Test coverage is thin: `noodl-runtime` has a Jest devDependency and limited specs; `noodl-viewer-react` similar.
- No published types for the node-definition API — the shape a node author must satisfy is discoverable only by reading `nodedefinition.js` and existing nodes.
- REV-005 unifies TypeScript at 5.9.3, which this task assumes.

## Desired State

- Both packages compile as TypeScript with meaningful types (not a blanket `any` conversion, which would be worse than leaving them alone).
- The node-definition API is a published, documented type — a node author, human or AI, gets autocomplete and compile-time errors.
- Core runtime concepts (ports, signals, values, dirty-flagging, scope) are typed precisely enough to catch real mistakes.
- Test coverage meaningfully higher than at the start, because tests are written before each conversion.
- Editor-side `TSFixme` markers at the runtime boundary can be removed (feeding PLAT-004).

## Scope

### In Scope
- [x] Type the core runtime: `Node`, node definition, register, scope, context/scheduler
- [x] Publish the node-definition API types (usable from `noodl-types` or an equivalent shared package)
- [ ] Convert standard-library nodes incrementally
- [x] Type `react-component-node.js` (the React binding hub)
- [ ] Convert `noodl-viewer-react` visual and logic nodes
- [ ] Write characterisation tests before converting each significant unit
- [x] Coordinate the port/type model with SUB-004 so catalog and types agree
- [ ] Remove editor-side `TSFixme`s that existed only because the runtime was untyped

### Out of Scope
- Behavioural changes or refactors — this is typing, and any behaviour change is a bug
- Moving nodes between packages (the "moved to runtime" migration is a separate concern)
- React 19 runtime migration (RUN-001, Phase 16)
- New node types

## Technical Approach

### Method

Enable `allowJs` with incremental strictness rather than converting wholesale. Order the work core-outward: the base `Node` class and node-definition machinery first, since every node depends on them and typing them well makes the rest largely mechanical. The standard library then converts file by file, and each conversion is small enough to review properly.

The one genuinely hard modelling problem is **dynamic ports**. Some nodes create ports at runtime — Function nodes discover outputs from user code through a proxy, Expression nodes derive dependencies by parsing text, several nodes generate ports from configuration. TypeScript cannot express this statically, and pretending otherwise produces types that lie. Model the dynamic case explicitly (an index signature or an explicit dynamic-ports marker), the same way SUB-004 flags it in the catalog, and document the boundary.

Do not chase `strict: true` initially. Get accurate types with `strict: false`, then tighten per package once the shape is right — attempting both at once turns a mechanical task into an argument with the compiler.

## Implementation Steps

1. **Agree the port/type model with SUB-004's owner** before writing types. Both tasks encode the same knowledge; they must not disagree.
2. **Characterisation tests** for the core runtime: signal propagation, dirty-flagging, input queueing, scope resolution. These are the behaviours that must not change.
3. **Type the core** — `Node`, node definition, register, scope, context.
4. **Publish node-definition API types** and validate them by retro-fitting a handful of existing nodes.
5. **Convert the standard library** file by file, in dependency order, with tests.
6. **Type `react-component-node.js`**, the React binding hub — the most intricate single file in `noodl-viewer-react`.
7. **Convert viewer nodes**, visual and logic.
8. **Tighten strictness** per package once shapes are correct.
9. **Sweep editor-side `TSFixme`s** that existed only because of the untyped boundary.

## Testing Plan

- Characterisation tests pass unchanged throughout.
- Runtime behaviour verified by running real projects in preview after each significant conversion — type errors are caught by the compiler, but wrong *runtime* behaviour from a bad refactor is not.
- Node-definition types validated by authoring a new trivial node using only the published types.
- Full editor + preview regression at each package milestone.

## Success Criteria

- [ ] `noodl-runtime` and `noodl-viewer-react` compile as TypeScript with meaningful types
- [x] Node-definition API types published and documented
- [x] Dynamic ports modelled honestly rather than falsely typed
- [x] Port/type model agrees with SUB-004's catalog
- [ ] Characterisation tests written and passing; overall coverage measurably higher
- [ ] No behavioural regressions in real projects
- [ ] Editor-side boundary `TSFixme`s removed

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Typing "fixes" that silently change runtime behaviour | Characterisation tests first; type-only changes per commit; run real projects in preview at each milestone |
| Types that lie about dynamic behaviour | Model dynamism explicitly; align with SUB-004; document the boundary |
| The task never ends (12 weeks becomes 12 months) | Convert core-outward and treat the standard library as a long tail that can be finished opportunistically; the value is front-loaded in the core types |
| Duplicated, drifting knowledge with SUB-004 | Step 1 exists precisely to prevent this — do not skip it |

## References

- [Viability report — §4.1 (framework-neutral runtime), Appendix E/F](../../reviews/NOODL-VIABILITY-REPORT.md)
- `dev-docs/reference/NODE-PATTERNS.md`, `dev-docs/reference/LEARNINGS-RUNTIME.md`
- Related: SUB-004 (shared source of truth), PLAT-004, REV-005

## Checklist

- [ ] Branch `task/plat-003-type-the-runtime`; agree port/type model with SUB-004
- [x] Characterisation tests for core runtime behaviours
- [x] Type core: Node, definition, register, scope, context
- [x] Publish and validate node-definition API types
- [ ] Convert standard library and viewer nodes incrementally
- [x] Type `react-component-node.js`
- [ ] Tighten strictness; sweep boundary `TSFixme`s
- [ ] CHANGELOG with before/after file counts; open PR

## CHANGELOG

In progress. Full as-built record in [PLAT-003-NOTES.md](./PLAT-003-NOTES.md).

### Slice 3 — 2026-07-24 — the React binding hub (step 6)

- `noodl-viewer-react/src/react-component-node.js` → `.ts` (1,189 lines), the compiler between the
  React node-authoring model and the runtime node definition. 28 standard-library node files author
  against its `def` parameter, which was previously undocumented.
- Published from that file: `ReactNodeDefinition`, `ReactNodeInstance`, `ReactInputPropDefinition`,
  `ReactInputCssDefinition`, `ReactOutputPropDefinition`, `ReactNodeContext`, `ReactNodeModel`,
  `StyleObject`. Kept out of `@noodl/types` so the shared runtime types stay renderer-neutral.
- `@noodl/types`: `NodeVariant` gains `stateTransitions`/`defaultStateTransitions` and a new
  `StateTransition` interface — a gap in slice 2, exercised by `setVisualStates`.
- Boundary `TSFixme` removed: `Noodl.ReactProps.noodlNode` was `any`; it is now `ReactNodeInstance`,
  so every React component in the viewer gets a real type for its node. `type NodeConstructor = any`
  deleted.
- Four latent defects found and documented (not fixed — three change published metadata): `def.category`
  and `def.deprecated` are silently dropped, `def.frame` is dead code, and `hasChildCountOutput`
  reads a property that never exists. See NOTES §9.3.

File counts: `noodl-viewer-react` 107/31/35 → **106 `.js` / 32 `.ts` / 35 `.tsx`**.
`noodl-runtime` unchanged at 73 `.js` / 19 `.ts`.

Gates: `catalog:check` byte-identical (135 node types); `typecheck:viewer` 0 `src` errors before and
after; runtime jest 225 pass / 20 pre-existing fail; viewer, deploy, ssr and preview builds green.
Live editor pass still owed.

### Slice 2 — 2026-07-24 — published API and runtime core (steps 1, 3, 4)

12 core runtime files converted (~2,500 lines); node-definition API published at
`packages/noodl-types/src/runtime/node-definition.d.ts`; runtime internals kept unpublished. See
NOTES §5.

### Slice 1 — 2026-07-24 — test toolchain (step 2)

The runtime's test harness was broken and its tests had never run: 11 of 14 suites collected zero
tests, and the package had no TypeScript toolchain at all. Tests collected 132 → 235. See NOTES §1–§4.
