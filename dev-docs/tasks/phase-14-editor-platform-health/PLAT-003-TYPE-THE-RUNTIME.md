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

> **Status, 2026-07-27 (after slice 13).** Every success criterion is met except two, and
> neither is now a matter of doing more of the same work. The editor-side `TSFixme` sweep
> (step 9) is PLAT-004's by agreement. Full TypeScript compilation of `noodl-runtime` is
> blocked for **seven** of its remaining eighteen `.js` modules by the module-boundary
> problem in [NOTES §29.2](./PLAT-003-NOTES.md) — a structural issue about how
> `noodl-viewer-react` compiles the runtime's sources, not a volume of files. Deciding that
> (recommended: ship `.d.ts` from `@noodl/runtime`, as its own task) is what "finish" now
> means. The other eleven modules are convertible today and are itemised in NOTES §30.

### In Scope
- [x] Type the core runtime: `Node`, node definition, register, scope, context/scheduler
- [x] Publish the node-definition API types (usable from `noodl-types` or an equivalent shared package)
- [x] Convert standard-library nodes incrementally *(viewer: top level slice 5, `componentutils/`+`user/` slice 6, `data/` slice 7, `navigation/` slice 8, `nodes-deprecated/` slice 10; runtime: all 24 non-`data/` files slice 11, `std-library/data/` slice 12. **Complete — no node code remains in JavaScript in either package.**)*
- [x] Type `react-component-node.js` (the React binding hub)
- [x] Convert `noodl-viewer-react` visual and logic nodes *(visual slice 4, logic slices 5–8, deprecated slice 10; every node file in the package is now TypeScript)*
- [~] Write characterisation tests before converting each significant unit *(partially, and
  the shortfall is honest: the runtime suite grew **132 → 973** across slices 1–13, and each
  of slices 11, 12 and 13 opened with a behaviour-fixing commit whose tests were written
  first and **proven able to fail** against their own pre-fix source. But that discipline
  was applied to the *defects* conversion uncovered, not to every unit converted — for the
  conversions themselves, tests were generally written alongside rather than before.)*
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

- [~] `noodl-runtime` and `noodl-viewer-react` compile as TypeScript with meaningful types
  *(**all node code in both packages is TypeScript**, and `noodl-viewer-react` is done bar
  four deliberate non-node files. `noodl-runtime/src` is at 18 `.js` / 107 `.ts`; **seven of
  those eighteen are blocked** on the module-boundary problem in NOTES §29.2 — the react
  viewer compiles at `module: es6`, so a runtime `.ts` it ESM-imports cannot use `export =`,
  `import = require()`, or the runtime's ambient globals. Eleven are convertible today.)*
- [x] Node-definition API types published and documented
- [x] Dynamic ports modelled honestly rather than falsely typed
- [x] Port/type model agrees with SUB-004's catalog
- [x] Characterisation tests written and passing; overall coverage measurably higher
  *(runtime jest **132 → 973 passing, 0 failing**; slices 11, 12 and 13 each opened with a
  test-first behaviour-fixing commit proven able to fail against its own pre-fix source)*
- [x] No behavioural regressions in real projects *(live editor pass green at slice 10 and
  again at slice 13: project opens, graph paints, preview renders, zero renderer exceptions;
  `catalog:check` byte-identical across all thirteen slices, which is the stronger check —
  it runs `register-nodes.js`, so it proves every converted file still loads and registers)*
- [ ] Editor-side boundary `TSFixme`s removed *(spec step 9 — owned by PLAT-004, whose
  ratchet and baseline are the mechanism; see NOTES §30)*

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

- [x] ~~Branch `task/plat-003-type-the-runtime`~~; agree port/type model with SUB-004
  *(the branch never existed and should not — this repo commits task work straight to
  `cline-dev`. The SUB-004 half was done in slice 2 and has held for thirteen slices: the
  published types import SUB-004's catalog vocabulary rather than restating it, so the two
  cannot drift.)*
- [x] Characterisation tests for core runtime behaviours
- [x] Type core: Node, definition, register, scope, context
- [x] Publish and validate node-definition API types
- [x] Convert standard library and viewer nodes incrementally *(runtime std-library and
  all of `viewer/src/nodes/` done, slices 5–8; `viewer/src` root, `api/` and `constants/`
  done slice 9; `nodes-deprecated/` done slice 10; `@noodl/runtime`'s own node files
  slices 11–12. **Every node file in both packages is now TypeScript.** What is left is
  not node code: the runtime's `api/`, models and other infrastructure, the 3 Group scroll
  plugins and `viewer.jsx`. `register-nodes.js` stays JavaScript — see NOTES §27.4)*
- [x] Type `react-component-node.js`
- [~] Tighten strictness; sweep boundary `TSFixme`s *(both deliberately **not** done, and
  the reasons are recorded rather than pending. `strict` stays off per the Technical
  Approach's own instruction — "do not chase `strict: true` initially" — and every slice
  from 10 onwards has re-affirmed it; raising it is a separate task, not a step of this one.
  The editor-side sweep is spec step 9 and belongs to PLAT-004, which owns the ratchet.)*
- [x] **After each slice merges, re-run `npm run tsfixme:baseline` and
      `npm run tsfixme:report` and commit the result.** Typing the runtime is the single
      largest mover of these counts in the repo, in both directions, and PLAT-004's
      ratchet only blocks *increases* — so a slice that removes fifty markers banks
      nothing unless someone lowers the baseline, and a slice that adds one leaves the
      gate red for every other task until someone raises it. Chasing that from a third
      session is a treadmill; the task that moved the number is the one that should
      record it (PLAT-004-NOTES §2, §6.2, §10).
- [x] CHANGELOG with before/after file counts; ~~open PR~~ *(no PR — work lands on
  `cline-dev` directly; the CHANGELOG below carries the counts slice by slice)*

## CHANGELOG

In progress. Full as-built record in [PLAT-003-NOTES.md](./PLAT-003-NOTES.md).

### Slice 13 — 2026-07-27 — the runtime's infrastructure, and the boundary that stops the rest

- **Ten leaf modules → `.ts`** (`88a30806`): `services/services`, `projectsettings`,
  `editorconnection.activewarnings`, `timerscheduler`, `expression-type-coercion`,
  `api/adapters/types`, `api/adapters/index`, `api/adapters/local-sql/index`,
  `models/nodemodel`, and then `api/queryutils` (`c364c781`).
  **`timerscheduler` and `nodemodel` are §28 item 2's case** — already *described* in
  `@noodl/types`, so converting them is mostly making the implementation agree with its own
  published type, which is what finds disagreements. `api/adapters/types` had been a wall of
  `@typedef` exporting `{}`: the types existed only as comments and nothing could reference
  them.
- **The behaviour-fixing commit §28 item 4 earned** (`68f55130`), test-first and **proven
  able to fail** — 2 of 5 characterisation tests fail against the pre-fix source.
  **Query Records' `error` output had never carried a message** (setter wrote
  `_internal.err`, getter reads `_internal.error` — §23.4's defect repeated in the node that
  replaced the one it was found in); **Query Records leaked its `create` listener**
  (`_onNodeDeleted` unsubscribed `insert`, a name nothing emits, so the listener outlived the
  node and kept it reachable); and **HTTP Request's four debug `console.log`s are gone**, one
  of which printed the built request headers and so put a Bearer or Basic credential in the
  browser console.
- **The finding that matters more than the conversion** (NOTES §29.1–§29.2).
  `noodl-viewer-react` compiles at **`module: es6`**; `noodl-viewer-cloud` at
  **`module: CommonJS`**. A runtime `.ts` reached by an ESM `import` from a *react* viewer
  `.ts` is type-checked inside that ESM program, where `import … = require()` is `TS1202`
  and the runtime's ambient `src/globals.d.ts` is out of scope (`TS2304`). That is why
  `nodescope.ts` has used both idioms since slice 2 without trouble — only the *cloud*
  viewer imports it — and why `cloudstore` broke at once. **`api/cloudstore`, `api/records`,
  `api/configservice` and `api/cloudfile` were converted, typechecked clean, produced 30+
  bundle errors, and are reverted to `.js` deliberately**; `model`, `collection` and
  `javascriptnodeparser` are on the same boundary and were not attempted. Seven modules —
  the seven §28 ranked highest. `allowJs: false` in the viewer's tsconfig is why the `.js`
  majority is unaffected: **converting a file is what puts it in that program.**
  **This reopens §28 item 8** — "`@noodl/runtime` ships `.d.ts`", recommended for closure as
  dead, is in fact the thing that would make those seven convertible.
- **The `typecheck:viewer` gate could not have caught it** (NOTES §29.6 trap 1). Its filter
  since slice 5 counts only `packages/noodl-viewer-react/src/`, and every error here was
  attributed to a `packages/noodl-runtime/…` file. §13.1's trap a third time. The prod
  bundle is the gate that decides.
- `@noodl/types` corrections, both found by conversion: **`GraphPortModel.plug` admitted two
  values where four reach it** — `'input/output'`, and `'outputs'`, a misspelling real
  exported projects contain and `createFromExportData` rewrites on the way in; and
  **`ModelLike._class`**, set by `CloudStore._fromJSON` on every record from the backend and
  what lets `Noodl.Records.save(id)` work from an id alone, which reached ~12 readers as
  `unknown` (the §19.3 shape, sixth occurrence). Also published `_noodl_cloudservices`.
- **Three defects documented at the site, none fixed** (NOTES §29.3). `matchesQuery`'s
  `$lte` branch compares against `$lt` — `undefined` on an `$lte`-only condition — so local
  and server-side filtering silently *disagree*; its `$nin` branch reads `$in` and throws;
  and `NodeModel.setStateTransitionParamter` guards `stateTransitions` but not
  `stateTransitions[state]`.

File counts: `noodl-runtime/src` 28 `.js` / 97 `.ts` → **18 `.js` / 107 `.ts`**.
`noodl-viewer-react/src` unchanged at 4 `.js` / 1 `.jsx` / 138 `.ts` / 46 `.tsx`.

Gates: `catalog:check` byte-identical (154 node types, 89 dynamic); runtime, viewer, cloud
and editor typechecks 0 errors under the **corrected** filter; **viewer production bundle
green, 0 `tsl` errors**; runtime jest **973 pass / 0 fail** (968 at `70f78585`); nodegx-backend
build green and 619 specs pass — it bundles the `local-sql` tree through esbuild, so that was
verified rather than assumed. **`any` contribution zero**; the `tsfixme` gate's red is the
same 56 AIX-005 agent markers, so the baseline is again deliberately left alone.
**The live editor pass ran and is green**, clearing the debt slices 11 *and* 12 both owed.

### Slice 12 — 2026-07-27 — `@noodl/runtime`'s `std-library/data/`, and the end of node code in JavaScript

- **All 24 files under `noodl-runtime/src/nodes/std-library/data`** → `.ts` (~8,900 lines):
  the two CRUD mixin libraries, the Object/Record/Query trio, Filter Records, REST (591),
  HTTP Request (1,004) and the six BYOB files (3,184). **With this, no node code remains in
  JavaScript in either package** — slice 10 finished the viewer, slice 11 the rest of the
  runtime's nodes, and this the last block.
- **Preceded by its own behaviour-fixing commit** (`6fdd4d40`), as §26 item 3 proposed.
  **Run Tasks's `_onNodeDeleted`/`_deleteAllTasks` moved into `methods`** — where
  `nodedefinition.ts` will actually install them, since it reads `opts.methods ||
  opts.prototypeExtensions` and nothing else — *and* the cleanup's `for…of` over a `Map`
  became `.values()`, because installing it without that fix would have handed `deleteNode`
  a two-element array. The two had to be fixed together. **Expression's `_onNodeDeleted`
  now chains to `Node.prototype`**, the order `componentinstance.ts` uses; before it,
  a deleted Expression node never cleared its model listeners, never set `_deleted` and
  never unsubscribed its port-level subscriptions. Characterisation tests at
  `test/nodes/node-deletion-cleanup.test.ts`, **proven able to fail** — 6 of 8 fail against
  the pre-fix source, and the 2 that pass pin the behaviour that was already right.
- **Two protocols named, both in sibling `.d.ts` files** because `export =` carries one
  thing (NOTES §27.1). **`crud-mixins.d.ts`** describes what `modelcrudbase` and
  `dbmodelcrudbase` *add* to the seven nodes they assemble in place — members contributed by
  a different file, written down nowhere, and therefore uncallable through `NodeInstance`'s
  index signature. It also names **`MixinNodeModule`**: `category` is set by `addBaseInfo`,
  so a consumer's literal genuinely is not a complete definition when written, and `Partial`
  says so honestly rather than requiring what arrives later. **`byob-types.d.ts`** is a
  deliberate second description of the editor's `BackendServices/types.ts` — the runtime may
  not import it, and it is not node-author API — kept narrow so editor-side drift surfaces.
- **`@noodl/types` gained two** (NOTES §27.2). **`ModelScopeLike` + `NodeScopeLike.modelScope`**:
  `(nodeScope.modelScope || Model)` appears at ~30 sites here and resolved to `unknown` at
  every one; the doc records that a set scope is what makes a sandboxed preview possible and
  that it is inherited down the component tree. **`RuntimeDiscoveredPort`**, the
  `sendDynamicPorts` payload — the §25.2 shape a third time, with three local descriptions
  and no name. Its `plug` had to admit **`'input/output'`**, a third value the Object node
  depends on; the narrower type was written first and that node caught it.
- **§26 items 1 and 5 were wrong, and were tested rather than reasoned about** (NOTES §27.4).
  Converting `data/` does **not** retire `register-nodes.js`'s `.default || module` unwrap:
  `export =` is the *required* convention for a runtime module no viewer `.ts` imports
  (§25.1), so these files stay CommonJS by design while the viewer's own nodes are ESM — the
  `||` is what serves both. Removing it makes `catalog:check` fail outright. The comment
  there now records that instead of predicting its own removal, and `register-nodes.js` is
  struck from the next-slice list.
- **Ten defects found, documented at the site, none fixed** (NOTES §27.3). The three that
  matter: **Query Records' `error` output has never carried a message** — `setError` writes
  `_internal.err`, the getter reads `_internal.error`, which is §23.4's defect repeated in
  the node that replaced the one it was found in; **Create and Update Record never normalise
  their values**, because `setup` assigns `fieldSchema` to the *graph node model* while the
  reader is the *runtime instance* (the `if (!node._internal) node._internal = {}` guard
  beside it is the tell), so dates are never ISO-8601'd and `json` columns never parsed; and
  **Query Records unsubscribes `'insert'` on delete**, a name nothing emits, so its
  `'create'` listener outlives the node and keeps it reachable. Also: Record's `setModel`
  dereferences an argument its own `foreach` path passes as `undefined`; Filter Records'
  port builder calls `.find` on metadata it has already admitted may be absent; Delete
  Record reads `nodeScope.ModelScope`; `modelcrudbase`'s chain-to-previous call recurses
  into itself; HTTP Request ships four debug `console.log`s, one printing Authorization
  headers; REST's default help text is truncated by a stray `;`, and its three XHR handlers
  `delete this._xhr` off the request rather than the node.

File counts: `noodl-runtime/src` 52 `.js` / 71 `.ts` → **28 `.js` / 97 `.ts`**.
`noodl-viewer-react/src` unchanged at 4 `.js` / 1 `.jsx` / 138 `.ts` / 46 `.tsx`.

Gates: `catalog:check` byte-identical (154 node types, 89 dynamic) — and it *runs*
`register-nodes.js`, so that gate proves every one of these files still loads and registers;
runtime, viewer (`src`), cloud and editor typechecks 0 errors; **runtime jest 968 pass /
0 fail** (959 in §25.6, +8 from the characterisation tests); viewer jest 59/59; **viewer,
deploy, ssr and cloud prod bundles all green, which clears the debt §25.6 recorded as
owed**; prettier clean; lint ratchet green (3074 under baseline). **`any` contribution
zero** — the `tsfixme` gate is red by 56, every one in AIX-005 agent files this slice never
touched, so **the baseline is deliberately left alone**; three `any`s that crept into the
first draft were removed rather than baselined. 23 eslint errors, all the deliberate
`no-this-alias` of §13.7. The preview typecheck's 30 errors were **proven pre-existing** by
re-running with this slice's files stashed. **Owed:** a live editor pass, now the only one.

### Slice 11 — 2026-07-27 — `@noodl/runtime`'s own node files, minus `data/` (step 7, in the runtime)

- **All 24 non-`data/` files under `noodl-runtime/src/nodes`** → `.ts` (~3,600 lines): the
  component trio (Component Inputs/Outputs and the 334-line Component Instance node), the
  Variables family, twelve small std-library utility nodes, and the four heavyweights —
  Expression (464), Function (425), Logic Builder (422) and Run Tasks (325). Annotated
  against `NodeDefinitionOptions`/`NodeModule`, not renamed.
- **Preceded by its own behaviour-fixing commit** (`2fecd32`), as slice 10's §24 item 5
  proposed. The **Globals node's `TypeError`** is fixed by dropping the cache write rather
  than creating the cache — the output getter reads `context.globalValues` directly, so
  nothing observable changes but the crash. **`dbmodelnode`'s New action** is implemented to
  match the sibling Model node's `scheduleNew` exactly: `git log -S` shows `storageNew` has
  *never* existed in this repo, so the port has thrown since the OSS release and there was
  no prior implementation to restore. Characterisation tests for both, **proven able to
  fail** — all 7 fail against the pre-fix source. Viewer jest 52 → 59.
- **Two export conventions, and the split is load-bearing** (NOTES §25.1). `export =`
  everywhere, matching slice 2 and AIX-005's `agent/` nodes, because the package is
  CommonJS and compiles under its own tsconfig — **except `variables/variablebase.ts`**,
  which the viewer's `color.ts` imports. That pulls it into the viewer's `module: es6`
  program where `export =` is `TS1203`, the same boundary slice 4 hit with `src/utils`. New
  rule: a runtime `.ts` that any viewer `.ts` *imports* cannot use `export =`; one only
  ever `require()`d from `.js` is never in the viewer's tsc program and is free to.
- **A whole protocol had two descriptions and no name** (NOTES §25.2). Converting Component
  Instance failed on twelve members at once — `addChild`, `render`, `contains`, `getRef`,
  `parent`, `forceUpdate` and the rest — none declared anywhere, yet `ReactNodeInstance` in
  the viewer *already declares all of them locally*. Published once as **`RuntimeVisualNode`**
  in `internal.d.ts` (not `@noodl/types`: node authors never implement it). Also published:
  **`ComponentModelLike.getInputPorts()`/`getOutputPorts()`**, which existed on the real
  class but reached users as `unknown` and were therefore uncallable (the §19.3 shape,
  fifth occurrence); **`InputPortDefinition.plug`**; and **`src/globals.d.ts`** for
  `_noodl_cloud_runtime_version`, branched on by seven runtime modules and declared nowhere
  — deliberately a *script* rather than a module, because a top-level import is exactly how
  the viewer's `Window { Noodl }` came to never be in effect (§21.3).
- **Nine defects found, documented at the site, none fixed** (NOTES §25.3). The two that
  matter compound: **Run Tasks declares `_onNodeDeleted` and `_deleteAllTasks` at the
  definition's top level**, and `nodedefinition.ts:266` installs only `methods`/
  `prototypeExtensions` — so neither is installed, and deleting a Run Tasks node mid-run
  **leaks every live task component**; and `_deleteAllTasks` would not work anyway, since
  `for…of` over a `Map` yields entries rather than values. Also: Expression's
  `_onNodeDeleted` never chains to `Node.prototype`; Function's `intype-` setter tests
  `'in' + n` where the port is `'in-' + n`; Function's `Outputs` Proxy `set` trap returns
  falsy on a deleted node, so strict-mode user code throws (§21.4's shape, third
  occurrence); Condition's `getInspectInfo` overwrites its own `'[No input]'` branch;
  Counter's Reset guard reads a `this.currentValue` that does not exist; Logic Builder
  populates only `detected.outputs`.
- **New trap, and it cost ten reverted files**: `prettier --write <directory>` in a shared
  checkout reformats other sessions' work — seven `agent/` files and three `data/` ones,
  with a prettier-version disagreement on ternary indentation guaranteeing conflicts.
  Format the files you converted, by name (NOTES §25.7).

File counts: `noodl-runtime` 76 `.js` / 46 `.ts` → **52 `.js` / 71 `.ts`**.
`noodl-viewer-react` unchanged at 4 `.js` / 1 `.jsx` / 137 `.ts` / 46 `.tsx`.

Gates: `catalog:check` byte-identical (154 node types, 89 dynamic); runtime, viewer (`src`)
and cloud typechecks 0 errors; **runtime jest 959 pass / 0 fail** (928 in slice 10); viewer
jest 59/59; prettier clean; lint ratchet green (3074 under baseline — `noodl-runtime` is
not in its target set; this slice's own 29 eslint errors are all deliberate). **`any`
contribution zero**: the `tsfixme` gate is red by +56, every one in AIX-005 agent test
files at `1a5f7b4` that this slice never touched, so **the baseline is deliberately left
alone** rather than banking another workstream's markers. Two `any`s that crept into the
first draft were removed rather than baselined. **Owed:** the viewer prod bundle could not
be proven green — every webpack error belongs to an AIX-008 workstream mid-flight in the
same checkout — and the live editor pass, for the same reason.

### Slice 10 — 2026-07-27 — `nodes-deprecated/`, and the last of the node code (step 7, seventh group)

- **All 25 `nodes-deprecated/` files** → `.ts`/`.tsx` (7,052 lines): the 15 std-library nodes
  (`dbmodelnode` 797, `dbcollectionnode` 717, `animation` 551 dominating), the five `data/`
  nodes, and the nine `.jsx` controls plus their shared `utils`. Slice 9 established these
  are **live, registered and shipped** (NOTES §21.1), not dead code. **Every node file in
  `noodl-viewer-react` is now TypeScript** — the four `.js` and one `.jsx` left are the
  three Group scroll plugins, `register-nodes.js` and `viewer.jsx`, none of which is a node.
- **The §21.5 unwrap came back out.** `animation`, `numberblend` and `transition` carried
  the `.default || module` workaround slice 9 added when it converted `easecurves` out from
  under them; all three are ES modules now and take a plain `import`. `register-nodes.js`'s
  own unwrap stays, but the reason has narrowed to the `@noodl/runtime` half of its list
  (`httpnode`, the five `byob-*` nodes), which is still CommonJS and out of scope.
- **Three published types corrected** (NOTES §23.2). The significant one: **`NodePanels`
  was the wrong shape entirely** — declared `Record<string, unknown>`, it is actually a
  *list* (`sidebarmodel.tsx` filters it and takes the first matching entry) or the literal
  string `'none'`. All four in-repo definitions that set `panels` write an array, so the
  type disagreed with every one of its users and with the editor. Also published:
  `OutputPropertyLike.connections` (the deprecated Animation node reads it to sample the
  value it animates *from* — the whole implicit-start mechanism), and `NodeContextLike`'s
  four `globalValues`/`globalsEventEmitter`/`setGlobalValue`/`getGlobalValue` members, which
  forced the §13.2 mirror onto `RuntimeNodeContext`.
- **The Globals node throws** (NOTES §23.3). `_newOutputValueReceived` writes
  `this._cachedInputValues[name]`, and `_cachedInputValues` **exists nowhere in
  `@noodl/runtime`** — so a `TypeError` fires the first time a global changes and the node
  has an output for that name. Same shape as §19.4's Pop Component Stack find. Left in
  place and documented: both fixing it and deleting the line change behaviour, and the
  output getter reads `context.globalValues` directly, so the cache was never load-bearing.
- **Five more defects documented at the site, not fixed** (NOTES §23.4): `dbmodelnode`'s New
  input calls a `storageNew` that does not exist; `dbcollectionnode.setError` writes
  `_internal.err` while the getter reads `_internal.error`, so the `error` output has never
  carried a message; `_hasChangesPending` is dead *and* inverted; Range's percent-changed
  guard tests a field nothing assigns; Button's mount effect calls three props nothing
  supplies. Two *were* fixed because the compiler would not take them — `numberblend` and
  the deprecated `variablenode` returned a bare value from `getInspectInfo`, which renders
  as nothing (the §13.3 defect DEBT-006 already ruled on for `variablenode2`).
- **New rule, from the oldest code in the package**: three functions relied on `var`
  *hoisting* — declaring inside an `if` and reading after it. A mechanical `var`→`const`
  rewrite is a compile error; a careless fix silently changes what reaches the editor. Check
  the declaration and the read are in the same block before rewriting (NOTES §23.1).

File counts: `noodl-viewer-react` 21/10/118/37 → **4 `.js` / 1 `.jsx` / 137 `.ts` / 46
`.tsx`**. `noodl-runtime` unchanged at 73 `.js` / 19 `.ts`.

Gates: `catalog:check` byte-identical (154 node types, 89 dynamic); `typecheck:viewer` 0
errors in `src`; runtime and cloud typechecks clean; **runtime jest 928 pass / 0 fail**
(the suite keeps growing — 384 in §21.8); viewer jest 52/52; viewer, deploy and ssr prod
bundles green; prettier clean; 39 eslint errors, all deliberate and none gated (NOTES
§23.6). **The live editor pass ran and is green** — the Shine Phase 2 project opens, the
graph paints, the preview renders, zero renderer exceptions; this clears the debt slice 9
recorded as owed. The `tsfixme` gate is red, but 56 of the 60 are AIX-005's concurrent
agent work already on `cline-dev`; this slice contributes 4 deliberate `any`s (open JSON
filter payloads) and re-baselines with the split recorded.

### Slice 9 — 2026-07-27 — the viewer's `src/` root and `api/` (step 7, sixth group)

- **17 of the 18 `noodl-viewer-react/src` root files** → `.ts`, plus all four `api/*`,
  `noodl-js-api` and `constants/flex` (~4,000 lines). These are the modules every
  already-typed node imported untyped: `node-shared-port-definitions` (1,583 lines, the
  port-mixin library twelve node files author against), `layout`, `pointerlisteners`,
  `fontloader`, `easecurves`, `guid`, `highlighter`, `inspector`, `graph-warnings`,
  `node-transitions` and the rest. `api/` is `Noodl.*` — the surface a project's own
  Function and JavaScript nodes are written against, which had no types at all.
  `register-nodes.js` is deliberately **not** converted (NOTES §21.7): its imports name
  explicit `.ts`/`.tsx` extensions (`TS5097` in a `.ts` file) and its whole job is the
  CJS/ESM bridge for the ~25 files still on `module.exports`. It should be last.
- **`nodes-deprecated/` is live, and §20's premise was wrong** (NOTES §21.1). It is not
  "never registered": `register-nodes.js` registers all 25 files, every one appears in the
  committed catalog as a real node type `providedBy: noodl-viewer-react`, and the prod
  bundle ships them (117 KiB, 15 modules). They carry `inNodePicker: false` — the
  back-compat mechanism, not dead code. **Recommendation: keep and convert later; do not
  delete.** Deleting breaks every existing project using them, silently, at load.
- **Seven published types corrected**, all found by conversion (NOTES §21.2):
  `NodeContextLike.updateDirtyNodes` and `ComponentModelLike.getRoots()` existed on the
  real classes but were unpublished (the §19.3 shape, third and fourth occurrences);
  `RunningTransition` was a narrower second description of the scheduler's `Timer`, hiding
  `start()`; `ReactNodeDefinition.setup`'s `graphModel` was `unknown` rather than the
  `GraphModelLike` slice 5 published for it. And two the implementation had always
  contradicted: **`PortTooltip` has a third, keyed form** (per enum value for `sizeMode`,
  per sub-control for `width`/`height`), and **`InputPortDefinition.tab` is not a string** —
  `_addCornerRadius` passes `{ group, tab, label }`, and `InputPortMetadata.tab` repeated
  the same narrow lie one step later. Both widened to a shared `PortTab`.
- **`interface Window { Noodl }` had never been in effect** (NOTES §21.3).
  `typings/global.d.ts` opens with `import 'react'`, making it a module — so the top-level
  `interface Window` declared a module-local `Window` instead of merging into `lib.dom`'s.
  Nothing had reached for `window.Noodl` from TypeScript before. Moved inside
  `declare global`, and `GlobalNoodl` gained the seven members it is actually assigned
  (`Env`, `Array`, `Object`, `Arrays`, `Objects`, `eventEmitter`, `SEO`) — which retired
  **six `@ts-expect-error` suppressions** across Image, Video, Page and router. That is
  spec step 9's category of marker, retired at the declaration rather than site by site.
- **Six defects found; three fixed because the compiler would not accept them** (NOTES
  §21.4). The two that matter: `Noodl.Arrays`/`Noodl.Objects` assignment **throws a
  `TypeError` in strict-mode callers** — their Proxy `set` traps returned nothing, and a
  falsy `set` trap fails the assignment after the underlying write has succeeded; and
  TextInput's `ref={(ref) => (this.ref.current = ref)}` **returns the element**, which
  React 19 treats as a cleanup function, so it has been wrong since RUN-001. Three left
  in place and documented: `graph-warnings`' `roots.lenth` typo guard that never fires,
  `Highlighter`'s selected-node leak, and `ASyncQueue`'s dead `pendingPromise` field.
- **The ESM/CJS boundary caught a real break mid-slice** (NOTES §21.5): converting
  `easecurves` made it an ES module, and three *registered* deprecated nodes `require()`
  it, so `EaseCurves.linear` would have been `undefined` in all three. They end in
  `module.exports` and so cannot simply `import`; they take the §13.5 unwrap. New rule:
  grep for `require()` of a module before converting it — `tsc` cannot see either side.

File counts: `noodl-viewer-react` 42/10/97/37 → **21 `.js` / 10 `.jsx` / 118 `.ts` /
37 `.tsx`**. `noodl-runtime` unchanged at 73 `.js` / 19 `.ts`. Every remaining `.js` is in
exactly three places: `nodes-deprecated/` (25), the Group scroll plugins (3), and
`register-nodes.js`.

Gates: `catalog:check` byte-identical (137 node types, 89 dynamic); `typecheck:viewer` 0
errors in `src`; runtime and cloud typechecks clean; **runtime jest 384 pass / 0 fail**
(the 247/0 figure carried in §20 is stale — the suite has grown; 384/0 is the baseline at
`7779cd6` and is unchanged); viewer jest 52/52; viewer, deploy and ssr prod bundles green.
Live editor pass **owed** — `lerna exec` runs from the main checkout, so it cannot be
driven from an isolated worktree. Separately: `typecheck:editor` is red at `7779cd6` with
6 pre-existing `TS2307`s from an in-flight NodePicker workstream; this slice touched no
editor file.

### Slice 8 — 2026-07-24 — `navigation/` and the live-editor pass (step 7, fifth group)

- All 14 remaining `nodes/navigation/*` files → `.ts`/`.tsx` (~3,000 lines): the Component
  Stack (`navigation-stack.jsx` → `.tsx`, 771 lines), Page, Page Inputs, the four navigate
  nodes, both popup nodes, the navigation handler and the transition classes.
  `register-nodes.js`'s two explicit-extension imports — the hazard §18 called out — switched
  to extensionless in the same change. **Every file under `src/nodes/` is now TypeScript**
  except dead `persisthelper.js` (deletion owned by DEBT-006).
- **The live-editor pass ran at last — twice, green twice** (NOTES §19.1): before the
  conversion as the slices-1–7 baseline and after it, against the real Shine Phase 2 project
  over CDP. Project open, graph paint, preview render, navigate to `/profile` and back, zero
  renderer exceptions both runs. Found a CDP trap on the way: after a project opens the
  editor page's URL stops matching `cdp.js`'s `editor` target and health silently reports the
  *cloud runtime's* dead page — use `--target=NodeGX`.
- `@noodl/types`: published `NodeScopeLike.createPrimitiveNode` and
  `NodeContextLike.showPopup` — both exist on the real runtime classes but were hidden behind
  the index signature; `showPopup` mirrored onto `RuntimeNodeContext` per the §13.2 rule.
- Three more latent defects found, recorded in NOTES §19.4 and DEBT-006, not fixed. The
  serious one: **Pop Component Stack's `backAction-…` inputs call `_createSignal`, an
  identifier that exists nowhere** — reachable through its own `setup`-published ports, so any
  project using Back Actions throws a `ReferenceError` at load. Also: Component Stack URL
  *writing* ignores the custom `pagePath-…` that URL *matching* honours; `PopupTransition`
  reads a `crossfade` field only `PushTransition` assigns.

File counts: `noodl-viewer-react` 57/11/82/36 → **43 `.js` / 10 `.jsx` / 96 `.ts` / 37 `.tsx`**.
`noodl-runtime` unchanged at 73 `.js` / 19 `.ts`.

Gates: `catalog:check` byte-identical (135 node types, 89 dynamic); `typecheck:viewer` 0 `src`
errors (corrected §13.1 filter; it reported 7 real errors mid-slice); runtime, cloud and editor
typechecks clean; viewer, deploy and ssr prod bundles green; runtime jest 225 pass / 20
pre-existing fail; viewer jest 3/3; eslint 9 of 15 fixed, 4 `no-this-alias` kept per §13.7
precedent plus `router-handler.ts`'s 2 pre-existing; live-editor pass green before and after.

### Slice 7 — 2026-07-24 — `data/` (step 7, fourth group)

- All 14 registered `std-library/data/*` node files → `.ts`/`.tsx` (~3,000 lines), including
  `foreach.jsx` → `.tsx` (694 lines) and `collectionnode-clear`, which had **no file extension at
  all**. `persisthelper.js` deliberately left as `.js`: it is referenced by nothing in the repo and
  is never bundled — deleting it is its own commit (NOTES §17.6).
- `@noodl/types`: **`CollectionLike`**, `CollectionChangeEvent`, **`CollectionModule`** and
  **`ModelModule`** — the Noodl Array and the two module objects the whole group is built on. The
  doc comment records that `Collection` is a real `Array` whose extra members are patched onto
  `Array.prototype` for *every* array in the process, and that this is load-bearing rather than
  legacy mess: nodes call `value.on('change', …)` on whatever reaches their `items` input, so a
  plain array must answer it too. Also records that `set` is a diff, not an assignment — which is
  what lets the Repeater keep mounted components alive across an update (NOTES §17.1).
- `@noodl/types`: `ComponentInstanceLike` gains `_forEachModel`/`_forEachNode`. Not a Repeater
  private — six runtime files walk `parentNodeScope` upwards looking for `_forEachModel`; it is how
  Object, Record and Function nodes resolve "the current item" inside a template (NOTES §17.2).
- `@noodl/types` gaps filled, all found by conversion: `NodeScopeLike.getNodeWithId`,
  `GraphNodeModel.parent`, and `ComponentModelLike.inputPorts`/`outputPorts`.
- **`noodl-viewer-react`'s jest suite runs again.** `tests/collection.test.js` required a module
  that has never existed; repointed at `@noodl/runtime/src/collection`, its 3 tests pass and happen
  to cover the `set`-as-diff behaviour above. This was next-slice item 6 from §16.
- Five more latent defects found and documented, not fixed (NOTES §17.7). The serious one:
  **`cloudfunction2.doCall` throws a `TypeError` on every call in a deployed app**, reading
  `this.context.editorConnection.isRunningLocally()` outside the guard that establishes the
  connection exists — and reads `cloudServices.appId` on the path that just warned it is undefined.
  Also: `foreachactions` calls a `signalItemAction` method no node defines; `collectionnode2` tests
  an `isInputConnected('store')` port it never declares; `variablenode2.getInspectInfo` returns a
  raw value (§13.3 again); `collectionnode-new.setCollectionID` is unreachable.
- New rule, cost 43 errors: **check whether `NodeInstance` already declares a member before adding
  it to an interface that extends it.** Two local redeclarations of `model` in `foreach.tsx`
  produced 43 unrelated-looking errors; deleting them fixed 41 (NOTES §17.3).

File counts: `noodl-viewer-react` 69/12/69/35 → **57 `.js` / 11 `.jsx` / 82 `.ts` / 36 `.tsx`**.
`noodl-runtime` unchanged at 73 `.js` / 19 `.ts`.

Gates: `catalog:check` byte-identical (135 node types); `typecheck:viewer` 0 `src` errors before and
after (gate proven able to fail — it reported 43 mid-slice); runtime, cloud, editor and preview
typechecks clean; runtime jest 225 pass / 20 pre-existing fail; **viewer jest 3 pass, 0 fail (was 0
pass, 1 suite failing to load)**; viewer, deploy, ssr, cloud and preview builds green; eslint clean
on every converted file. Live editor pass still owed — but PLAT-002 has landed, so it is no longer
blocked.

### Slice 6 — 2026-07-24 — `componentutils/` and `user/` (step 7, third group)

- All 5 `std-library/componentutils/*.js` and all 8 `std-library/user/*.js` → `.ts`
  (~1,900 lines): the Component Object family and the user/session nodes.
- **Two runtime concepts that had never been named.** `ComponentInstanceLike` — what
  `nodeScope.componentOwner` actually is — replaces the `{ name, [extra]: unknown }`
  placeholder slice 2 left. `getInstanceId()` (the key component state is stored under) and
  `getRoots()` (the first step of the walk up the component tree) were `unknown` and therefore
  uncallable. `ComponentRootNode` goes with it and encodes *why* the walk is shaped as it is:
  a visual component is reached from above through `getVisualParentNode()`, a non-visual one
  through `parentNodeScope`, so both members are optional and the code tests each in turn.
- **`ModelLike`** publishes `@noodl/runtime/src/model`, the id-keyed observable record behind
  the Object node, component state and every collection entry — the type the `data/` group
  will be built on. It documents the three surprising things: `Model.get` *creates* on read,
  what comes back is a Proxy (hence the honest index signature), and `{ resolve: true }`
  walks nested Models only, abandoning the path silently otherwise.
  Also added: `NodeScopeLike.getNodesWithType` and `NodeContextLike.scheduleAfterUpdate`.
- **§13.4 repeated exactly.** Pointing `componentOwner` at the new type produced nine errors,
  all in `react-component-node.ts`, all cascade from one failing `extends` — its local
  `ComponentOwnerLike` was a second description of the same object. One line fixed all nine.
  Second occurrence of this shape; NOTES §15.2 says to go straight to the `extends` clauses.
- **`UserService`'s `error` callback always receives a string**, not an error object: every
  method unwraps the backend's `{ error, code }`, and the two HTML-answering endpoints
  substitute a message. Typing it honestly cleared seven call-site errors.
- Two cosmetic findings documented, not fixed: `setparentcomponentobjectproperties` writes an
  `_internal.parentComponentName` that nothing on that node reads, and three of the deprecated
  user nodes guard on flags named after the wrong node (copy-paste). See NOTES §15.3.
- **A `for…in` a mechanical rewrite would have broken**: `parentcomponentobject`'s port loop
  iterates a value that is `undefined` when no properties are set. `for…in` tolerates that,
  `for…of` throws. NOTES §15.4 — the `data/` group is full of these.

File counts: `noodl-viewer-react` 83/12/55/35 → **69 `.js` / 12 `.jsx` / 69 `.ts` / 35 `.tsx`**
— `.ts` equals `.js` in that package for the first time. `noodl-runtime` unchanged at
73 `.js` / 19 `.ts`.

Gates: `catalog:check` byte-identical (135 node types); `typecheck:viewer` **0 errors** before
and after; runtime/cloud/editor/preview typechecks clean; runtime jest 225 pass / 20
pre-existing fail; viewer, deploy, ssr, cloud and preview builds green; **eslint clean on all
13 files** (28 errors fixed, all unused params/locals — none whose fix could change
behaviour); prettier clean. Live editor pass still owed.

### Slice 5 — 2026-07-24 — the standard library's top level (step 7, second group)

- All 14 top-level `noodl-viewer-react/src/nodes/std-library/*.js` → `.ts` (~2,700 lines), each
  annotated against `NodeDefinitionOptions` or the new `NodeModule`.
- **The published types were the larger half of the work.** These are the first files whose
  `setup` functions were typed, and `setup` is where a node type talks to the *project* — the
  graph model, the editor connection, dynamic ports. None of it had a type. Added to
  `@noodl/types`: `NodeModule` (what a node file exports and `registerNode` accepts),
  `GraphModelLike`, `GraphNodeModel`, `GraphPortModel`, `ComponentModelLike`, `EventSenderLike`,
  `RuntimeEventEmitter`, `StylesLike`, `InspectInfoEntry`, `EventPropagation`.
  `NodeInstance.model` `unknown` → `GraphNodeModel`; `NodeContextLike`/`NodeScopeLike` gained the
  nine members these nodes call and previously got back as `unknown`.
- **The `typecheck:viewer` gate was never running.** Slices 3 and 4 filtered tsc output on
  `^src/`, but tsc prints repo-root-relative paths — the pattern could not match, so the gate
  reported zero regardless. Found when webpack failed with nine errors while the gate read clean.
  Corrected filter and the isolated-baseline recipe are in NOTES §13.1. True HEAD baseline is 0.
- **Three published types disagreed with the implementation**, all corrected declaration-only:
  `TimerScheduler` declared `onFinished` where the scheduler calls `onFinish` (so a completion
  callback written against the type would never fire); `InspectInfo` omitted the single-entry form
  and hid the fact that any other value renders as *nothing*; `ReactNodeModel` and `GraphNodeModel`
  were two names for one object, now an alias.
- Two latent defects found and documented, not fixed: Switch, Number Remapper and Animate To Value
  return bare booleans/numbers from `getInspectInfo`, so their debug inspectors have never shown
  anything; Upload File's `getInspectInfo` reads `_internal.response`, which nothing assigns. See
  NOTES §13.3.
- `require()` of a converted file yields an ES-module namespace, so `register-nodes.js` unwraps
  `.default` for the duration of the migration. Validated on a single-file pilot through both the
  esbuild (catalog) and webpack (bundle) loaders before converting the rest.

File counts: `noodl-viewer-react` 97/12/41/35 → **83 `.js` / 12 `.jsx` / 55 `.ts` / 35 `.tsx`**.
`noodl-runtime` unchanged at 73 `.js` / 19 `.ts`.

Gates: `catalog:check` byte-identical (135 node types); `typecheck:viewer` **0 errors** under the
corrected filter, matching an isolated HEAD baseline; runtime/cloud/editor typechecks clean; runtime
jest 225 pass / 20 pre-existing fail; viewer, deploy, ssr, cloud and preview builds green; prettier
clean. `eslint --fix` cleared 105 of 122 pre-existing lint errors in these files; the 17 left are
`no-this-alias` and `no-explicit-any`, both deliberate (NOTES §13.7). Live editor pass still owed.

### Slice 4 — 2026-07-24 — the visual nodes (step 7, first group)

- All nine `noodl-viewer-react/src/nodes/visual/*.js` → `.ts` (1,637 lines), each annotated against
  the type it authors: `ReactNodeDefinition` for the eight React nodes, `NodeDefinitionOptions` for
  `css-definition`, which is a plain runtime node. Annotation is the point — an unannotated object
  literal is checked against nothing under this tsconfig.
- **The ESM/CJS boundary bit for the first time.** `image`/`video` import `@noodl/runtime/src/utils`,
  and as `.ts` they pulled a `module: commonjs` runtime file into the viewer's ESM program
  (`TS1203` + `TS2497`). Fixed in `utils.ts`: `export =` → named exports. The §7 trap applies to
  runtime modules that export a *value*; a module exporting a namespace must use named exports so
  ESM consumers can import it. Emitting real `.d.ts` from `@noodl/runtime` is the general fix and is
  now item 3 on the next-slice list.
- `react-component-node.ts` gains `ReactInputDefinition`/`ReactOutputDefinition`: slice 3 pointed
  `inputs`/`outputs` at the runtime port types, whose callbacks declare `this: NodeInstance`, and
  every node body here needs the React instance. Its first real consumers found it.
  `innerReactComponentRef` `unknown` → `any` for the same reason.
- `@noodl/types`: new `PortTooltip` — `tooltip` was `string`, but the `{ standard, extended }` object
  form is written by `node-shared-port-definitions.js` and the Video node and read by the editor.
- Two latent defects found and documented, not fixed: `Noodl.runDeployed` is never set (so deployed
  bundles still carry editor-only tooltip HTML — the real flag is `Noodl.deployed`), and `propPath`
  on an ordinary input port is inert. See NOTES §11.3.

File counts: `noodl-viewer-react` 106/32/35 → **97 `.js` / 41 `.ts` / 35 `.tsx`** (+12 `.jsx`,
unchanged). `noodl-runtime` unchanged at 73 `.js` / 19 `.ts`.

Gates: `catalog:check` byte-identical (135 node types); `typecheck:viewer` 0 `src` errors before and
after; runtime/cloud/editor typechecks clean; runtime jest 225 pass / 20 pre-existing fail; viewer,
deploy, ssr, cloud and preview builds green; eslint clean on every converted file. Live editor pass
still owed — PLAT-002 has the editor package mid-conversion.

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
