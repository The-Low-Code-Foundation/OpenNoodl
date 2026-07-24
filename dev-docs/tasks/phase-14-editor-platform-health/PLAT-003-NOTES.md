# PLAT-003 NOTES — Type the Runtime and Viewer

Status: slices 1 and 2 landed 2026-07-24. Slice 1 restored the test toolchain (§1–§4). Slice 2
published the node-definition API and typed the runtime core — spec steps 1, 3 and 4 (§5–§7).
Resume from **§7**.

Run in parallel with PLAT-002 (jQuery retirement). Boundary: PLAT-002 owns `packages/noodl-editor`
entirely; PLAT-003 stays in `packages/noodl-runtime`, `packages/noodl-viewer-react`, and
`packages/noodl-types`. The one overlap the task spec names — sweeping editor-side `TSFixme`s at the
runtime boundary (Step 9) — is deferred until PLAT-002 lands.

## 1. The finding that reordered the work

The task spec assumes characterisation tests can be written against a working test harness, and
notes only that coverage is "thin". The harness was in fact substantially broken, and the existing
tests had never run:

| Symptom | Cause |
|---|---|
| 8 of 14 suites collected **0 tests** | Tests in `test/` used `require('./nodescope')` while sources live in `src/`. Written as if co-located; never executed, so never noticed. |
| 2 `.ts` suites failed to parse | `noodl-runtime` had **no TypeScript toolchain at all** — no `tsconfig.json`, no Jest TS transform. Its 6 existing `.ts` files under `src/config/` were neither tested nor typechecked. |
| 1 suite could not select an environment | `test/node-expression-evaluation.test.js` carried an `@jest-environment jsdom` docblock, but `jest-environment-jsdom` is not installed (Jest 28 removed it from core). |
| Every failure crashed the reporter | `terminal-link` absent from `node_modules`, so Jest's failure-path reporter threw and masked the real errors. |

Net effect: **the core runtime had no executable test coverage**, while appearing to have some. The
`Node`/`NodeContext`/`NodeScope` behaviours PLAT-003 must preserve while typing — signal
propagation, dirty-flagging, input queueing, scope resolution — were exactly the dead suites.

## 2. What slice 1 changed

Test files and configuration only. **No runtime source file was modified**, so no behaviour changed.

| Change | Files |
|---|---|
| Rewrote broken relative requires to point at `src/` | `test/{nodescope,nodecontext,outputproperty,eventsender,editormodeleventshandler,editorconnection.activewarnings}.test.js`, `test/models/componentmodel.test.js`, `test/nodes/componentinstance.test.js` |
| Fixed `const { ComponentModel } = require(...)` → default import (the module does `module.exports = ComponentModel`) | `test/{nodecontext,nodescope}.test.js`, `test/models/componentmodel.test.js`, `test/nodes/componentinstance.test.js` |
| Removed the spurious `@jest-environment jsdom` docblock | `test/node-expression-evaluation.test.js` |
| New: Jest config with ts-jest for `.ts` and babel-jest passthrough for `.js` | `packages/noodl-runtime/jest.config.js` |
| New: package tsconfig (`allowJs`, `checkJs: false`, `noEmit`, CommonJS) | `packages/noodl-runtime/tsconfig.json` |
| Added `typecheck` script + `ts-jest`/`typescript` devDeps | `packages/noodl-runtime/package.json` |
| Added `typecheck:runtime`, matching the existing `typecheck:*` convention | root `package.json` |

Note on the jsdom docblock: the runtime contains **zero** `document.`/`window.` references
(verified across `node.js`, `outputproperty.js`, `expression-evaluator.js`). It is a
framework-neutral engine, so requiring a DOM environment for its tests was wrong on principle as
well as broken in practice. Removing the docblock was preferable to adding a dependency.

Note on ts-jest: it resolves from the root workspace (`ts-jest@29.4.6`, `typescript@5.9.3` — the
version REV-005 unified on), so **no `npm install` was required**. This was deliberate: a root
install could disturb the concurrent PLAT-002 session's dev server. The devDeps are declared so CI
installs them properly.

## 3. Baseline

| Metric | Before | After slice 1 |
|---|---|---|
| Suites collecting 0 tests | 11 of 14 | **0** |
| Tests collected | 132 | **235** |
| Tests passing | 124 | **215** |
| Tests failing | 8 | 20 |
| `tsc --noEmit` on the package | not possible | **0 errors** |
| `noodl-runtime` file counts | 85 `.js` / 6 `.ts` | unchanged (no conversions yet) |

`noodl-viewer-react` baseline, untouched so far: 107 `.js` / 31 `.ts` / 35 `.tsx`.

The core is now green: `NodeContext`, `NodeScope`, `ComponentModel`, `ComponentInstance`,
`EventSender`, `OutputProperty`, `EditorModelEventsHandler`, `EditorConnection.ActiveWarnings` all
pass. That is the safety net Step 3 (type the core) needs.

## 4. Known failures — deliberately not fixed

20 failures remain, in three clusters. All are **behavioural**, and PLAT-003 scopes behaviour
changes out ("this is typing, and any behaviour change is a bug"). They are recorded here rather
than fixed, and none touches the core classes being typed first.

| Cluster | Count | Nature | Pre-existing? |
|---|---|---|---|
| Expression subsystem (`expression-evaluator`, `expression-type-coercion`, `node-expression-evaluation`) | 15 | Expressions cannot see `Variables` — `Variables.x * 2` evaluates to `0`, expected `20`. Also bracket-notation and template-literal dependency detection. | 4 visible before; 11 newly visible |
| `QueryBuilder` (LocalSQL adapter) | 4 | Emits `"id"` where tests expect Noodl's canonical `"objectId"`. Either a stale test or a real adapter bug — worth a decision, but not this task's. | Yes |
| `validateConfigValue` | 1 | Object-type rejection. | Newly visible (suite was dead) |

The 11 + 1 "newly visible" failures were always failing; they were simply unobservable because the
suites did not load. Nothing regressed.

**Recommendation:** the expression/`Variables` cluster deserves its own investigation — 15 failing
tests in the expression engine is a real signal, and the expression subsystem is on SUB-004's and
the AI-authoring path. It is not, however, a typing problem.

## 5. Slice 2 — the published API and the core conversion

Spec steps 1, 3 and 4. Two commits: one strictly type-only, one removing debug output.

### 5.1 The port/type model is shared by import, not by agreement

Step 1 of the spec says to *agree* the port/type model with SUB-004 before writing types. Agreement
between two hand-maintained files is exactly the thing that drifts, so instead
`packages/noodl-types/src/runtime/node-definition.d.ts` **imports** `PortType`, `PortTypeName`,
`NumberedInputSpec` and `NodeCategory` from the generated `node-catalog.d.ts` and re-exports them.
The catalog describes nodes *as observed* after the runtime compiled them; the new file describes
the same nodes *as authored*. They are two views of one model, and the vocabulary now has one home.

The file also carries the mapping table between the two views, so the correspondence is documented
rather than folklore.

### 5.2 Dynamic ports: what is data and what is behaviour

The catalog names five `DynamicPortMechanism` values. Each is now mapped to the concrete thing an
author writes:

| Mechanism | Authored as | Expressible as data? |
|---|---|---|
| `declared-port-groups` | `dynamicports: [{ condition, inputs, outputs }]` | **Yes** — the ports are static, only their visibility is conditional |
| `numbered-inputs` | `numberedInputs: { value: { createSetter } }` | No — the set is unbounded by construction |
| `component-ports` | `haveComponentPorts: true` | No — comes from the project's components |
| `runtime-discovered` | overriding `registerInputIfNeeded` / `sendDynamicPorts` | No — depends on user code or user text |
| `editor-adapter` | nothing in the runtime | No — lives in the editor |

Only the first is data. The rest are behaviour, so the honest type for a dynamic node's port set is
"the declared ports, **plus more**" — never a closed record. Consumers that need the closed set must
read the catalog, which records which mechanism applies. This is written into the file's header so
the next person does not have to rediscover it.

### 5.3 What was converted

Twelve files, roughly 2,500 lines: `node`, `nodedefinition`, `nodescope`, `nodecontext`,
`noderegister`, `outputproperty`, `eventsender`, `edgetriggeredinput`, `variants`, `guid`, `utils`,
`async-pool`.

Three decisions worth keeping:

**`Node` stays a constructor function.** `nodedefinition` builds every node type with
`Node.call(this, context, id)` and `Object.create(Node.prototype, extensions)`, and neither works
against an ES class. It is typed as a callable-and-newable interface
(`const Node = function Node(this: RuntimeNode, …) {} as unknown as NodeConstructor`), which emits
byte-for-byte the same JavaScript while still typechecking every `Node.prototype.x = …` assignment
against the declared shape. The same pattern is used for `NodeScope`, `NodeContext`, `NodeRegister`,
`EventSender` and `OutputProperty`.

**Internals are not published.** `packages/noodl-runtime/src/internal.d.ts` holds `RuntimeNode`,
`RuntimeOutputProperty`, `RuntimeNodeContext` and `RuntimeEditorConnection` — the underscore-prefixed
machinery the core files use to talk to each other. Putting these in `@noodl/types` would invite node
authors to depend on things that exist in order to be changed. `@noodl/types` publishes only what a
node author may write and call.

**Three no-op source edits.** `nodescope` had two `var` declarations shadowing each other in
different branches of one function (`nodes`, `children`) and two zero-parameter closures called with
a stray argument. TypeScript rejects both; both were resolved by renaming/dropping, with no
behavioural effect. Nothing else in the twelve files changed shape.

### 5.4 The conversion pipeline (this is the part that bites)

The prediction in slice 1's §"Conversion pipeline is de-risked" — that webpack's `.ts` resolution
would make renaming safe — was **half right**. Resolution works; compilation does not.

The runtime is CommonJS: its modules `require()` each other and so do its consumers. A converted
file therefore exports with `export =`, which TypeScript permits **only** under `module: commonjs`.
Both viewers compile at `module: es6`/`es2020`, so the first conversion failed the viewer build with
`TS1203: Export assignment cannot be used when targeting ECMAScript modules`.

The fix, in order of what each piece solves:

| Piece | Why |
|---|---|
| `packages/noodl-runtime/webpack-ts-rule.js` | Exports a webpack rule giving the runtime's `.ts` files their **own ts-loader instance** with its own config. Lives in the runtime because both viewers need it. |
| `packages/noodl-runtime/tsconfig.build.json` | ts-loader does **not** override `noEmit`, so the typecheck config cannot be reused — "TypeScript emitted no output for …". This variant sets `noEmit: false` and excludes tests. |
| `include: runtimePath` on the new rule | The runtime resolves through a `node_modules/@noodl/runtime` symlink, but webpack resolves symlinks to their real path, so a `node_modules` pattern never fires. Match the real package directory. |
| `exclude: [/node_modules/, runtimePath]` on each viewer's own `.tsx?` rule | Two ts-loader instances fighting over the same file is a silent, confusing failure. |
| `noodl-viewer-cloud/tsconfig.json` → `module: CommonJS` | Unlike `noodl-viewer-react` (which reaches the runtime from `.js` files that root `tsc` does not follow), the cloud runner `import`s runtime sources directly from `.ts`. It targets Node and its webpack bundles are CJS anyway, so this costs nothing. |
| Root `tsconfig.json` drops `noodl-viewer-cloud/src`; new `typecheck:cloud` script | The root config is ESM-oriented for the editor; the cloud package now needs CommonJS. Root `tsc --noEmit` is back to its prior 14 errors, all pre-existing and unrelated. |

**Consequence for anyone with a dev server running:** `webpack.common.js` changed, and webpack does
not reload its own config. A dev server started before slice 2 will fail to compile the runtime's
`.ts` files until it is restarted.

### 5.5 Verification

| Gate | Result |
|---|---|
| `noodl-runtime` jest | **225 passing** (was 215) / 20 failing — the same 20 from §4 |
| `typecheck:runtime` | clean |
| `typecheck:cloud` | clean |
| root `typecheck` | 14 errors, all pre-existing (`@noodl-versioning` alias, unrelated work in flight) |
| viewer + deploy + ssr bundles | green |
| cloud viewer + isolate bundles | green |
| `noodl-preview` esbuild + its 14 tests | green |
| `catalog:check` | **byte-identical**, 135 node types |

`catalog:check` is the strongest of these: it loads the whole runtime headlessly, registers every
shipped node type through the converted `defineNode`/`NodeRegister`/`Node`, and regenerates the
committed catalog. Byte-identical output means the metadata every node produces is unchanged.

The editor itself was **not** smoke-tested — a concurrent PLAT-002 session owned the dev server. The
bundles all build and the catalog is identical, but a live editor pass is still owed.

### 5.6 New tests

`packages/noodl-runtime/test/node-definition-api.test.ts` (10 tests) authors two nodes using **only**
the published types — one with a signal input, one with numbered inputs — and runs them. It serves
two purposes at once: it stops compiling if the published types drift from what `defineNode` accepts
(spec step 4's "validate them by retro-fitting existing nodes"), and it characterises behaviours the
rest of PLAT-003 must preserve — rising-edge-only signals, per-instance edge state, defaults applied
before `initialize`, on-demand numbered-input registration, and `extend`'s initialize chaining.

## 6. Side catch: 16 leftover debug `console.log`s

Committed separately so the typing commit stays type-only. Three were on the hottest path in the
engine: `edgetriggeredinput` logged three times per signal (setter created, value set, rising edge)
for **every signal input in every project, every frame**, and `node.setInputValue` ran a
`this.name === 'net.noodl.HTTP'` string comparison on every input set of every node just to decide
whether to print. The rest were `🚀 INITIALIZE called` / `⚡ SIGNAL RECEIVED` prints in the HTTP node
and the four BYOB record nodes.

## 7. Next slice

File counts now: `noodl-runtime` **73 `.js` / 19 `.ts`** (was 85/6 at slice 1; the core is done and
the standard library is the long tail). `noodl-viewer-react` untouched at 107 `.js` / 31 `.ts` /
35 `.tsx`.

1. **Live editor pass** — the one gate slice 2 could not run. Open a real project, exercise signals,
   dynamic-port nodes (Function, Expression, numbered inputs) and variants.
2. **`react-component-node.js`** (spec step 6), the React binding hub and the most intricate single
   file in `noodl-viewer-react`. It is the natural next core-outward step and the one that unblocks
   the viewer node conversions.
3. **Standard library, file by file** (spec step 5). Now mechanical: the core types exist, and the
   pipeline is proven. Treat as an opportunistic long tail — the value was front-loaded.
4. **Do not raise `strict` yet** (spec step 8). Shapes first.
5. **Step 9 (editor-side `TSFixme` sweep) stays deferred** until PLAT-002 lands.

### Traps for the next session

- Renaming a runtime file `.js` → `.ts` is safe for jest and both viewers **only** because of the
  dedicated ts-loader instance in §5.4. If a new bundler starts consuming the runtime, it needs the
  same treatment.
- A `.ts` file in the runtime must use `export =` / `import x = require(…)`. ESM syntax compiles,
  but consumers `require()` these modules and would get a namespace object instead of the value.
- Anything importing runtime sources from a `module: es*` package will fail to typecheck. Either give
  that package `module: commonjs` or keep it out of the ESM program (see the cloud viewer).
- `packages/noodl-viewer-react/tests/collection.test.js` fails to resolve
  `../src/nodes/std-library/data/collection` — that node moved to the runtime and the test path is
  stale. Pre-existing, same class of dead test slice 1 found; not fixed here.

## 8. Slice 1's plan for slice 2 (superseded, kept for the record)

1. Design the core types against SUB-004's catalog representation in `packages/noodl-types`
   (`node-catalog.d.ts`, `node-catalog-enriched.d.ts`) so the two do not drift — this is Step 1 of
   the spec and must precede writing types.
2. Refine `packages/noodl-types/src/runtime/node.d.ts`. It already exists but is largely untyped
   signatures (`addChild(child, index)` with implicit `any`) and carries a local `type TSFixme = any`.
   It is a skeleton to make accurate, not a greenfield.
3. Model dynamic ports explicitly. `nodedefinition.js` builds ports at runtime in at least two
   ways — `registerNumberedInput` rewrites `registerInputIfNeeded` to synthesise `"name N"` ports on
   demand, and `sendDynamicPorts` recomputes port sets from parameters/connections on graph events.
   Types must mark this honestly rather than pretend the port set is static.
4. Only then convert core files to `.ts`, starting with the smallest (`noderegister.js`, 38 lines)
   to prove the pipeline end-to-end before touching `node.js` (754) and `nodedefinition.js` (334).

### Conversion pipeline is de-risked

`noodl-viewer-react`'s webpack resolves `['.tsx', '.ts', '.jsx', '.js']`, so a `.ts` file in the
runtime resolves through the existing `require('./node')` call sites when bundled. Combined with the
new ts-jest transform, renaming a runtime file `.js` → `.ts` should be safe for both tests and
bundling. Verify against a real build at the first conversion.
