# PLAT-003 NOTES — Type the Runtime and Viewer

Status: slices 1–8 landed 2026-07-24. Slice 1 restored the test toolchain (§1–§4). Slice 2
published the node-definition API and typed the runtime core — spec steps 1, 3 and 4 (§5–§7).
Slice 3 typed the React binding hub — spec step 6 (§9). Slice 4 typed the visual nodes — spec step 7
(§11). Slice 5 typed the standard library's top level and published the graph-model /
node-module types its `setup` functions needed (§13). Slice 6 typed `componentutils/` and `user/`
(§15). Slice 7 typed `data/` (§17). Slice 8 typed `navigation/` and ran the live-editor pass —
the gate every earlier slice owed (§19). Resume from **§20**.

> **Before running any gate, read §13.1.** The `typecheck:viewer` filter used in slices 3 and 4
> could never match, so that gate reported zero regardless of what tsc said. The corrected
> command and the trap that hides behind a HEAD worktree are both there.

Run in parallel with PLAT-002 (jQuery retirement) and PLAT-004 (TSFixme ratchet), all in the same
working tree — **commit by pathspec, never `git add -A`**. Boundary: PLAT-002 owns
`packages/noodl-editor` entirely; PLAT-003 stays in `packages/noodl-runtime`,
`packages/noodl-viewer-react`, and `packages/noodl-types`. The one overlap the task spec names —
sweeping editor-side `TSFixme`s at the runtime boundary (Step 9) — is deferred until PLAT-002 lands.

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

> **RESOLVED 2026-07-24 by DEBT-003.** The engine's `Variables` resolution was **correct all
> along** — expressions read the global `'--ndl--global-variables'` model, the same store the
> Variable / Set Variable nodes and `Noodl.Variables` write to; the failing tests mocked a
> `context.Variables` API that never existed. Two *real* engine defects were found and fixed in
> the same pass: dependency detection destroyed bracket-notation keys and template-literal
> interpolations before matching (so `Variables["my var"]` / `` `${Variables.x}` `` never
> re-evaluated reactively), and expression errors were swallowed inside the evaluator so the
> node's editor-warning path was unreachable (runtime errors now rethrow into it; compile
> failures now warn too). Three tests encoded wrong semantics and were corrected with recorded
> policy: `Objects.X` auto-creates (Model.get semantics), and null/undefined mean "no value" →
> fallback, uniformly. `validateConfigValue`'s null-rejection expectation contradicted the
> optional-empty rule and was likewise corrected. **New baseline: 243 passing / 4 failing** —
> the remaining 4 are the `QueryBuilder` objectId cluster, owned by DEBT-006.

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

## 7. Slice 2's plan for slice 3 (partly done; see §10 for what is actually next)

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

## 9. Slice 3 — the React binding hub

Spec step 6. `packages/noodl-viewer-react/src/react-component-node.js` → `.ts` (1,189 lines), plus
the type surface it makes possible.

`createNodeFromReactComponent` is a compiler between two authoring models. An author writes a
*React* node — a component plus ports phrased as React props (`inputProps`) and CSS
(`inputCss`) — and this file turns it into the *runtime* node definition `defineNode` accepts.
Twenty-eight node files in the standard library go through it, so its `def` parameter is the most
widely-used undocumented shape in the viewer.

### 9.1 Where the types live, and why not in `@noodl/types`

Slice 2 published the runtime authoring API in `@noodl/types`. The React types stayed in
`react-component-node.ts` and are exported from there. `@noodl/types` is shared with the cloud
runtime, which has neither React nor a DOM; putting `React.ComponentType` and `HTMLElement` in it
would make a package that describes *the runtime* depend on one particular renderer. Consumers
`import type { ReactNodeInstance } from '../../react-component-node'`, which erases at build time.

Published from there: `ReactNodeDefinition` (the `def`), `ReactNodeInstance` (`this` in every
callback, and `props.noodlNode` in every component), `ReactInputPropDefinition`,
`ReactInputCssDefinition`, `ReactOutputPropDefinition`, `ReactNodeContext`, `ReactNodeModel`,
`StyleObject`.

### 9.2 Three modelling decisions

**Generated members are typed as generated, not hidden.** Authors never write `set` on an
`inputProps`/`inputCss` port — this module synthesises it onto the very object the author wrote,
mutating the definition in place. The type declares `set?` with a doc comment saying so, rather
than omitting it (which would break the assignment) or requiring it (which would break every
author).

**`ReactNodeInstance` carries an `any` index signature, deliberately.** `def.methods` puts
author-defined members straight onto the prototype and `initialize` hangs arbitrary scratch state
off `this`. A closed interface would fail to compile against roughly every node in the standard
library. The cost is typo detection on *undeclared* members only; the ~50 declared members are
still checked, which is what catches real mistakes.

**`StyleObject` is `Record<string, any>`, not `React.CSSProperties`.** Styles here are read and
written by computed name and their values already have units appended (`'12px'`,
`'translateX(-50%) …'`). `CSSProperties` would also reject the plain `{ flexDirection: 'column' }`
literals nodes write, whose values widen to `string`. Claiming it would assert precision this code
does not have.

### 9.3 What typing found

Four things that were invisible while the file was untyped. None are fixed here — this slice is
type-only, and three of the four change published metadata:

| Finding | Evidence | Effect |
|---|---|---|
| `def.category` is silently dropped | `Page`, `NavigationStack`, `Router` declare `category: 'Visuals'`; the compiled definition hardcodes `category: 'Visual'` | Cosmetic. The catalog records `Visual` for all three. |
| `def.deprecated` is silently dropped | `form.jsx`, `fieldset.jsx`, `label.jsx` set `deprecated: true` | **Real.** The catalog reports `isDeprecated: false` for `Form` and `Label`. They are out of the node picker by another route, so the practical damage is limited to the flag being wrong for catalog consumers (SUB-005/SUB-006). |
| `def.frame` is dead | Nothing in the repository sets it, so `useFrame` is always `false` | The `Layout.size`/`Layout.align` pass and the `textStyle` merge in `NoodlReactComponent.render()` never run. Layout reaches nodes through `inputCss` and `node-shared-port-definitions` instead. |
| `hasChildCountOutput` reads a property that does not exist | `ReactComponentNode.allowChildren \|\| ReactComponentNode.displayName` — the compiled object has `displayNodeName`, never `displayName` | The second clause is always `undefined`, so the `childrenCount` output depends on `allowChildren` alone. Probably meant `def.displayName`. |

The first two are declared on `ReactNodeDefinition` with `@deprecated` JSDoc, so the mistake now
surfaces at the call site instead of only in the catalog.

A fifth was a genuine gap in slice 2's published types: `NodeVariant` was missing
`stateTransitions` and `defaultStateTransitions`, which `setVisualStates` reads and the editor's
`VariantModel` writes. Added to `@noodl/types`, along with a `StateTransition` interface — the
runtime and the editor now name the same shape.

### 9.4 Boundary `TSFixme` removed

`Noodl.ReactProps.noodlNode` was `NodeConstructor`, which `typings/global.d.ts` defined as `any`.
It is now `ReactNodeInstance`, so every React component in the viewer gets a real type for the node
rendering it. `router-handler.ts` followed, and `type NodeConstructor = any` is deleted — it had no
remaining users.

That change surfaced eight errors in seven components, all the same one: `context.styles` is
`unknown` in `NodeContextLike` (correctly — the cloud runtime has no styles). `ReactNodeContext`
narrows it to the viewer's `Styles` service and declares `setNodeFocused`, which `viewer.jsx`
installs onto the context at startup.

Note this is *viewer*-side. Spec step 9's editor-side sweep is still deferred until PLAT-002 lands.

### 9.5 Source changes, and why each is behaviour-preserving

The conversion is type-only apart from four edits:

- Three `const type = input.type as PortType` aliases, replacing repeated `input.type.units` /
  `.defaultUnit` reads. Only the object form of a port type carries units; reading through the
  bare-name form yields `undefined`, which is what the original code relied on. `input.type` is
  never reassigned in these loops.
- `radiobuttongroup.ts` did `RadioButtonGroupNode = createNodeFromReactComponent(RadioButtonGroupNode)`
  — reusing one variable for both the definition and the compiled module, which no type can
  describe. Now `export default createNodeFromReactComponent(RadioButtonGroupNode)`. Nothing read
  the variable afterwards; it was the last line.

### 9.6 Verification

| Gate | Result |
|---|---|
| `typecheck:viewer` | **0 errors in `src`**, before and after (40 pre-existing `node_modules` `@types` conflicts, unchanged) |
| `typecheck:runtime` | clean |
| `typecheck:cloud` | clean |
| root `typecheck` | 14 errors, all the pre-existing `@noodl-versioning` alias |
| `catalog:check` | **byte-identical**, 135 node types |
| `noodl-runtime` jest | 225 passing / 20 failing — the §4 baseline, unchanged |
| viewer + deploy + ssr prod bundles | green |
| `noodl-preview` build | green |

The baseline had to be measured rather than trusted: a first `npm run typecheck:viewer` reported
exit 0 with 20 error lines, which cannot both be true. Re-running with the slice stashed gave the
real figure — 40 lines, all in `node_modules`, in both directions.

Two test failures are pre-existing and were confirmed so by reproducing them with the slice stashed:

- `noodl-viewer-react`'s only jest suite, `tests/collection.test.js`, still cannot resolve a node
  that moved to the runtime (§7 trap 4).
- `noodl-preview`'s `preview.test.ts:97` asserts `noodl.deploy.js` exceeds 1 MB. A **production**
  deploy build is ~870 KB, at HEAD as well as with this slice. The assertion passes only when the
  on-disk artifact happens to be a *development* build (~4.9 MB), which is what was there when
  slice 2 recorded "14 tests green". The test is environment-dependent, not a regression — same
  class as the stale `collection.test.js` path.

The editor still has **not** been smoke-tested live; a concurrent PLAT-002 session owns the editor
package and has ~30 uncommitted files in it, so a live pass would exercise their work in progress
rather than this slice. Still owed.

## 10. Slice 3's plan for slice 4 (item 2 done; see §11)

File counts at the end of slice 3: `noodl-runtime` **73 `.js` / 19 `.ts`** (unchanged — slice 3 was
viewer-side). `noodl-viewer-react` **106 `.js` / 32 `.ts` / 35 `.tsx`** (was 107/31/35).

1. **Live editor pass** — still the one gate no slice has run. Open a real project; exercise
   signals, dynamic-port nodes (Function, Expression, numbered inputs), variants and visual
   states. Best done once PLAT-002's editor work is committed.
2. **Viewer nodes** (spec step 7). Now mechanical: `ReactNodeDefinition` types the shape they all
   author against, so each conversion is a rename plus whatever the compiler objects to. Start with
   the `nodes/visual/*.js` group — `group.js`, `text.js`, `image.js` — which are the most used.
3. **Standard library in the runtime** (spec step 5), still the opportunistic long tail.
4. **Decide on the four §9.3 findings.** `def.deprecated` being dropped is the one worth fixing;
   it changes `node-catalog.json`, so it needs its own commit and a regenerated catalog, not a
   quiet edit inside a typing slice.
5. **Do not raise `strict` yet** (spec step 8).
6. **Step 9 (editor-side `TSFixme` sweep) stays deferred** until PLAT-002 lands.

### Traps recorded by slice 3

All of §7's traps still apply. One more:

- `packages/noodl-viewer-react/tsconfig.json` sets `noImplicitAny: false` and no `strict`. That is
  why converting a 1,200-line file cost so little: untyped `.js` imports (`layout`, `mergedeep`,
  `node-shared-port-definitions`) silently become `any` instead of erroring, and null checks are
  off. Raising either flag is a separate, much larger piece of work — do not do it incidentally
  while converting a file.

## 11. Slice 4 — the visual nodes (spec step 7)

All nine files in `noodl-viewer-react/src/nodes/visual/` converted to `.ts`: `circle`, `columns`,
`css-definition`, `drag`, `group`, `icon`, `image`, `text`, `video` (1,637 lines). Eight are React
nodes and are now annotated `const X: ReactNodeDefinition = {…}`, which is where the value is — a
bare rename buys almost nothing under this tsconfig, since an unannotated object literal is checked
against nothing. `css-definition` is not a React node and types against `NodeDefinitionOptions`
directly.

### 11.1 The wall this slice hit: ESM viewer importing a CommonJS runtime

`image` and `video` import `getAbsoluteUrl` from `@noodl/runtime/src/utils`, and they are the first
**TypeScript** files in the viewer to import a runtime *source* file. That pulled `utils.ts` into the
viewer's program, which compiles at `module: es6`, and it failed two ways at once: `TS1203` on the
file's own `export =`, and `TS2497` on the named import of an `export =` module. `.js` node files
never triggered it because `allowJs: false` keeps tsc from following them.

The fix is in `utils.ts`: `export =` → named `export function`s. The §7 trap ("a `.ts` file in the
runtime must use `export =`") is right about modules whose export *is* a value — a class or a
function — because consumers `require()` them. It does not apply to a module whose export is already
a namespace of functions: both forms emit identical CommonJS, every consumer already destructures
(`const { getAbsoluteUrl } = require('./utils')`), and only the named form can be imported from a
package that compiles as ESM. The rule, refined:

> Runtime module exports a single value → `export =`. Runtime module exports a namespace → named
> exports, so viewer `.ts` files can import it.

This will recur for every runtime module a converted viewer file reaches for. The general fix — have
`@noodl/runtime` emit and ship `.d.ts` — is a build-pipeline change and belongs in its own slice, not
inside a node conversion.

### 11.2 Type surface added

Two React-flavoured port definitions in `react-component-node.ts`, and slice 3's own first real test:

- **`ReactInputDefinition` / `ReactOutputDefinition`.** `ReactNodeDefinition.inputs`/`outputs` pointed
  at the runtime's `InputPortDefinition`/`OutputPortDefinition`, whose callbacks declare
  `this: NodeInstance`. Every `set`/`valueChangedToTrue` in these nodes calls `setStyle`,
  `forceUpdate`, `props` or `innerReactComponentRef` — React members. `NodeInstance` is closed (no
  index signature, deliberately), so the runtime types rejected the very node bodies this module
  exists to compile. The two new interfaces are the runtime shapes with the callbacks re-declared
  against `ReactNodeInstance`. Slice 3 got this wrong because it had no consumers yet.
- **`innerReactComponentRef` `unknown` → `any`.** Nodes call imperative methods on it
  (`scrollToIndex`, `snapToPositionX`, `play`) and which methods exist is decided by the component
  each node returns from `getReactComponent`. There is no one type — only a per-node contract.
- **`PortTooltip` in `@noodl/types`.** `tooltip` was typed `string`, but the object form
  `{ standard, extended }` is real: `node-shared-port-definitions.js` writes it for sizeMode/width/
  height, the Video node writes it for its playback signals, and the editor reads it
  (`shared/view.js:145`, `SizeModeInput.tsx:21`). Widened on `InputPortDefinition` and on
  `InputPortMetadata`, which is where `nodedefinition.ts` copies it to.
- **`declare const Noodl`** in `noodl-viewer-react/typings/global.d.ts`, inside `declare global` —
  the file has a top-level `import`, so a bare declaration would have been module-scoped and invisible.

### 11.3 What typing found

| Finding | Evidence | Effect |
|---|---|---|
| `Noodl.runDeployed` is never set | Group and Text skip building their tooltips `if (!Noodl.runDeployed)`. `runDeployed` is a *constructor argument* to `NoodlRuntime`; the flag the deploy bootstrap sets is `Noodl.deployed` (`static/deploy/index.js`) | The skip never happens, so editor-only tooltip HTML is built and shipped in deployed apps. Recorded on `GlobalNoodl` with `@deprecated`, not fixed — correcting it changes deployed output |
| `propPath` on an ordinary input does nothing | Image's `inputs.src` declared `propPath: 'dom'`; `propPath` is only read from `inputProps`/`outputProps` | None. The port's own `set` writes `props.dom.src` itself, which is what actually put the value there. The inert key is removed and the reason recorded in the source |

Both follow slice 3's §9.3 precedent: a mistake that changes published behaviour gets declared and
documented so it surfaces at the call site, not quietly corrected inside a typing slice.

### 11.4 Verification

| Gate | Result |
|---|---|
| `typecheck:viewer` | **0 errors in `src`**, before and after (40 pre-existing `node_modules` `@types` conflicts) |
| `typecheck:runtime` / `typecheck:cloud` / `typecheck:editor` | clean |
| root `typecheck` | 14 errors, all the pre-existing `@noodl-versioning` alias |
| `catalog:check` | **byte-identical**, 135 node types |
| `noodl-runtime` jest | 225 passing / 20 failing — the §4 baseline, unchanged |
| viewer + deploy + ssr prod bundles | green |
| cloud viewer + isolate bundles, `noodl-preview` esbuild | green |
| `eslint` on every converted file | clean |

`catalog:check` is again the load-bearing gate: byte-identical output proves all nine nodes still
register with identical metadata, that removing Image's inert `propPath` changed nothing, that
`css-definition`'s `module.exports` → `export default` still resolves through `register-nodes.js`, and
that the runtime `utils.ts` export change did not break headless loading.

Pre-existing failures reproduced unchanged: `noodl-viewer-react`'s `collection.test.js` (stale path,
§7 trap 4) and `noodl-preview`'s `preview.test.ts:97` (the >1 MB assertion, which fails whenever the
on-disk artifact is a production build — §9.6).

The **live editor pass is still owed**, and still cannot be run honestly: PLAT-002 has the editor
package mid-conversion with uncommitted work, so a live run would exercise theirs, not this.

### 11.5 Traps

- **`register-nodes.js` imports with explicit extensions** (`'./nodes/visual/circle.js'`). Webpack
  does not substitute `.ts` for a request that spells `.js`, so a rename there is a silent
  module-not-found at build time. Drop the extension when converting; `tsc` never sees this file
  (`allowJs: false`), so only the bundler's opinion counts.
- **The working tree is shared and other sessions commit with `git add -A`.** The nine `git mv`
  renames in this slice were staged, and a concurrent AIX-001 commit (`d004edd`) swept them in as
  pure renames before this slice committed its content. Nothing was lost — the content landed in the
  slice's own commit — but stage renames as late as possible, or expect them to belong to someone
  else's commit.
- Running `prettier --write` on these files also reflowed a few pre-existing lines in
  `react-component-node.ts` and `node-definition.d.ts`; neither file was prettier-clean at HEAD.
  Formatting noise in the diff, no behaviour.

## 12. Slice 4's plan for slice 5 (item 2 started; see §13)

File counts at the end of slice 4: `noodl-runtime` **73 `.js` / 19 `.ts`** (unchanged — slice 4 was viewer-side).
`noodl-viewer-react` **97 `.js` / 12 `.jsx` / 41 `.ts` / 35 `.tsx`** (was 106/12/32/35).

1. **Live editor pass** — the one gate no slice has run. Still blocked on PLAT-002 committing its
   editor work; take it the moment they land.
2. **The rest of the viewer nodes** (spec step 7 continued): `nodes/std-library/` (~30 files) and
   `nodes/navigation/` (~10). Same recipe as §11 — rename, annotate `ReactNodeDefinition`, fix what
   the compiler objects to, drop the extension in `register-nodes.js`. Expect §11.1 to recur: each
   runtime module a converted file imports needs its export style checked.
3. **Make `@noodl/runtime` ship declarations.** The proper fix for §11.1, and the thing that stops
   the ESM/CJS boundary being renegotiated file by file. Its own slice: it changes how every
   consumer resolves the runtime.
4. **Decide on the §9.3 and §11.3 findings.** `def.deprecated` being dropped is still the one worth
   fixing (it changes `node-catalog.json`, so: own commit, regenerated catalog). `Noodl.runDeployed`
   is the cheapest — rename to `deployed` and deployed bundles stop carrying tooltip HTML — but it
   changes deployed output, so it needs its own commit too.
5. **Do not raise `strict` yet** (spec step 8).
6. **Step 9 (editor-side `TSFixme` sweep) stays deferred** until PLAT-002 lands. Note PLAT-004 has
   started its own escape-hatch ratchet in parallel; agree the boundary before sweeping.

## 13. Slice 5 — the standard library's top level (spec step 7, continued)

All 14 top-level files under `noodl-viewer-react/src/nodes/std-library/` converted to `.ts`
(~2,700 lines): `animate-to-value`, `colorblend`, `eventreceiver`, `eventsender`,
`externallink`, `javascript`, `numberremapper`, `openfilepicker`, `screenresolution`,
`states`, `switch`, `timer`, `uploadfile`, `valuechanged`, plus `variables/color`.

The conversion itself was the smaller half of this slice. These are the first files in the
project whose `setup` functions were typed, and `setup` is where a node type talks to the
*project* rather than to any one instance — the graph model, the editor connection, the
dynamic-port machinery. None of that had a published type. Roughly a third of the diff is
`@noodl/types` catching up with what the standard library has been doing all along.

### 13.1 The gate that was never actually running

Slices 3 and 4 both report "**0 errors in `src`**" for `typecheck:viewer`. The filter behind
that number was `grep "^src/"`, and `tsc -p packages/noodl-viewer-react` prints paths
relative to the **repo root**, not the project — `packages/noodl-viewer-react/src/…`. The
pattern could never match. Every run of that gate reported zero regardless of what tsc said.

This surfaced when the webpack build failed with nine `ts-loader` errors while the "gate" was
still reporting clean. ts-loader runs the same program and does not filter.

To find out whether those nine were pre-existing, HEAD was checked out into a temporary
worktree — and the first answer was wrong. A worktree that symlinks the main tree's
`node_modules` resolves `@noodl/types` through `node_modules/@noodl/types`, which is a
workspace symlink back into the *live* `packages/noodl-types`. The "baseline" was compiled
against the working tree's edited types and reproduced all nine errors. Only after giving the
worktree its own `node_modules` with `@noodl/*` relinked inside it did the real baseline come
back: **0**. All nine were introduced by this slice, and all nine were fixed (§13.4).

> Two rules from this. Filter tsc output on `packages/<pkg>/src/`, never `^src/`. And a HEAD
> worktree used for baselining must not share `node_modules` with the tree under test — in a
> workspace repo, that symlink is a hole straight back into the code you are trying to
> exclude.

The corrected gate for every future slice:

```
npx tsc -p packages/noodl-viewer-react --noEmit 2>&1 | grep "packages/noodl-viewer-react/src/"
```

Baseline is **0**. The 40 remaining errors are all `node_modules` `@types` conflicts
(`jasmine` vs `jest`, `css-font-loading-module`, `mdx`) and are genuinely pre-existing.

### 13.2 What a node file exports, finally typed

`NoodlRuntime.registerNode` accepts `{ node?, setup? }` — the shape almost every file in the
standard library exports — and nothing described it. Published as **`NodeModule`**, with the
`setup` contract spelled out: it runs once at registration, it is the `runtime-discovered`
dynamic-port mechanism's home, and it must be guarded with
`editorConnection.isRunningLocally()` because there is no editor to talk to in a deployed app.

Supporting it meant publishing the graph model, which is what `setup` actually manipulates:

| Type | What it is |
|---|---|
| `GraphModelLike` | The project's whole node graph. Query methods, plus the type-scoped events (`'nodeAdded.<type>'`) that let a node type hear about its own instances without filtering |
| `GraphNodeModel` | A node **as authored** — the editor's persisted node, with `parameters`, `inputPorts`, `outputPorts`, `component`. `NodeInstance` is the running object; this is its blueprint |
| `GraphPortModel` | A port on that model |
| `ComponentModelLike` | One component in the graph |
| `EventSenderLike` | The runtime's ref-scoped emitter, which both models extend |
| `RuntimeEventEmitter` | The *other* emitter — the vendored Node one on `context.eventEmitter` / `context.eventSenderEmitter`. Distinct from the above, and worth keeping distinct: they have different `on` signatures |

`NodeInstance.model` was `unknown`; it is now `GraphNodeModel`. That is what the Script node
reads to discover which ports the editor thinks it has.

`NodeContextLike` and `NodeScopeLike` gained the members these files call and previously got
back as `unknown` from the index signature: `timerScheduler`, `eventEmitter`,
`eventSenderEmitter`, `scheduleNextFrame`, `isWarningTypeEnabled`,
`sendGlobalEventFromEventSender`, `createNode`, `deleteNode`, `sendEventFromThisScope`, and
`styles` (see below). Each was mirrored onto `RuntimeNodeContext` in
`noodl-runtime/src/internal.d.ts` — adding a *required* member to the published type breaks
the runtime's own assignment unless the internal type supplies it too, which is how three of
these were found.

### 13.3 Three published types that disagreed with the implementation

These are the slice's real findings. All three are declaration-only corrections: no runtime
code changed, and each is checked against the implementation rather than inferred.

**`TimerScheduler` had the wrong callback name.** `timer_scheduler.d.ts` declared
`onFinished`. `timerscheduler.js` calls `onFinish` — and its `Timer` constructor copies every
key of the options object onto the timer (`for (var arg in args) this[arg] = args[arg]`), so
a callback under any other name is silently stored and never invoked. Anyone writing a new
timer against the published type would have got a completion callback that never fired. Also
corrected: `onStop` was missing entirely, `onRunning` was declared required but is optional,
and all four callbacks are invoked as methods on the timer, so they now declare `this: Timer`.
The copy-all behaviour is now documented as the intended way to give a timer per-use state —
which is exactly what `animate-to-value` (`startValue`/`endValue`/`ease`) and `states`
(`transitionCurves`/`startValues`/`targetValues`/`valueTypes`) do, reading them back through
`this` inside `onRunning`.

**`InspectInfo` was too narrow, and the truth is worse than that.** It was
`string | Array<entry>`. `InspectPopup.tsx` normalises in three steps: a string becomes
`{ type: 'value', value }`, a non-array is wrapped in a one-element array, and each entry is
rendered by its `type`. The consequence, stated plainly because several nodes get it wrong:

> Returning a bare `boolean`, `number` or plain object produces an inspector that shows
> **nothing**. The wrapped value has no `.value` property, `hasValuesToShow` is false, and the
> popup returns `null`.

Confirmed in this slice's own files: **Switch** returns a boolean, **Number Remapper** and
**Animate To Value** return numbers. All three have a debug inspector that has never
displayed anything. The same pattern exists in `noodl-runtime`'s `and`, `or` and `expression`
nodes, which are out of this slice's scope. Not fixed — it changes what the editor shows, so
it follows the §9.3 / §11.3 precedent: the type says so, the call sites carry a cast and a
comment pointing here, and the decision is left where it belongs.

**`Upload File`'s inspector reads a field nothing writes.** `getInspectInfo` returns
`this._internal.response`, and `response` is assigned nowhere in the file — the upload
success handler stores `cloudFile`, not `response`. Always `undefined`. Recorded in the
source, not corrected.

### 13.4 The nine errors, and why widening a type broke `react-component-node.ts`

Each of the nine came from the same cause: `react-component-node.ts` (slice 3) declared local
shapes for things `@noodl/types` had no name for, and once those names existed the two
descriptions had to be reconciled.

- **`ReactNodeModel` and `GraphNodeModel` were the same object.** Slice 3 had no published
  graph-node type and wrote its own. Now an alias — one model, not two opinions.
- **`ReactNodeContext.eventEmitter`** declared a two-method shape; the published one declares
  six. The local declaration was deleted and the inherited one kept.
- **`StylesLike` may not carry an index signature.** `context.styles` is the viewer's `Styles`
  *class*, and a class has no string index signature, so `[extra: string]: unknown` on the
  published type made `ReactNodeContext extends NodeContextLike` fail. `StylesLike` publishes
  exactly the two total lookups (`resolveColor`, `getTextStyle`) and nothing else.

The remaining six errors were cascade: once `ReactNodeInstance extends NodeInstance` failed,
every callback typed `this: ReactNodeInstance` stopped being assignable to one typed
`this: NodeInstance`. Fixing the model type cleared all six at once. Worth remembering — a
single bad `extends` in this file produces a page of unrelated-looking errors downstream.

### 13.5 The `require()` / `export default` boundary

`register-nodes.js` loads most node files with `require()`. A converted file compiles as an ES
module, and webpack's `require()` of an ES module hands back the *namespace object* — so
`registerNode` would have received `{ default: { node } }`. One line in the `forEach` unwraps
it, and works for both shapes so the migration can proceed file by file:

```js
noodlRuntime.registerNode(module.default || module);
```

Verified through both loaders before converting anything else: `catalog:check` (esbuild) and a
full webpack prod build, on a single-file pilot (`switch.ts`). Remove the unwrap once every
entry in that array is converted.

Two smaller boundary notes. `variables/color.ts` imports `variablebase` — a runtime `.js`
module — as a default import; `allowJs: false` keeps tsc from following it, so it arrives
untyped and the *annotation on the result* is what does the work. And `@noodl/runtime/src/utils`
was already fixed to named exports in slice 4 (§11.1), so `javascript.ts` importing
`logJavaScriptNodeError` needed nothing new.

### 13.6 Verification

| Gate | Result |
|---|---|
| `typecheck:viewer` (**corrected filter**) | **0 errors** in `packages/noodl-viewer-react/src/`, matching the isolated HEAD baseline |
| `typecheck:runtime` / `typecheck:cloud` / `typecheck:editor` | clean |
| `catalog:check` | **byte-identical**, 135 node types, 89 dynamic |
| `noodl-runtime` jest | 225 passing / 20 failing — the §4 baseline, unchanged |
| viewer + deploy + ssr prod bundles | green, 0 errors |
| cloud viewer bundle, `noodl-preview` esbuild | green |
| `prettier --check` | clean on every file this slice touched |

`typecheck:preview` reports 2 errors in `noodl-editor/src/utils/keyboardhandler.ts` (`Cannot
find name '$'`). Those are PLAT-002's in-flight jQuery work in the shared tree, not this
slice's.

`catalog:check` is again the load-bearing gate: byte-identical output across 135 node types
proves the `.default` unwrap resolves correctly, that `states`'s and the Script node's
dynamic-port machinery still produces the same metadata, and that nothing in the conversion
changed a port name, type or default.

### 13.7 eslint: these files were never clean, and now it shows

`eslint` on the converted files reported 122 errors — almost all `no-var` and `prefer-const`
on the *original* code. The `.js` files were never linted (the ratchet's only target is
`packages/noodl-editor/src`; the viewer package is not gated at all), and the rules only bite
once the extension changes.

`eslint --fix` cleared 105 of them. Its `no-var` fixer is semantics-aware — it declines any
declaration whose scope would change — and `catalog:check` byte-identical plus a green build
and unchanged test results is the evidence that nothing moved.

**17 remain, deliberately:**

- 12 × `@typescript-eslint/no-this-alias` (`var self = this` feeding `function()` callbacks).
  Converting those to arrows would rebind `this` inside them; a typing slice is the wrong
  place to make that call.
- 5 × `@typescript-eslint/no-explicit-any`, each on a `Record<string, any>` where the values
  genuinely are arbitrary user data (`states`'s `stateParameters`, the Script node's
  parameters).

For reference, slice 4's visual nodes are eslint-clean — that code was already modern. The
std-library is older, and the remaining `.js` files there should be expected to behave like
these did.

### 13.8 Traps

- **Do not name a module-scope constant `module`** in a converted node file. It compiles (the
  file is ESM, so there is no CommonJS `module` to shadow), but it reads as a bug at every
  glance. `EventSenderModule`, `StatesModule`, `JavascriptModule` instead.
- **Narrowing `context.editorConnection` does not survive into a callback.** Every `setup`
  function here does `if (!context.editorConnection …) return;` and then uses it inside a
  graph-model listener, where TypeScript has forgotten the check. Hoist it to a local
  (`const editorConnection = context.editorConnection`) and close over that.
- **`eventreceiver.js` assigned `module.exports` twice** — first `{ node }`, then the same
  object plus `setup`. The first was dead. Dropped in the conversion.
- **`data/collectionnode-clear` has no file extension at all.** It is `require`d
  extensionless and both webpack and esbuild resolve the literal filename. Leave it alone
  until it is converted, and give it `.ts` when it is.
- `prettier --write` reorders imports in these files (there is an import-sort plugin). Expect
  the import block to move even when nothing else does.

## 14. Next slice

File counts now: `noodl-runtime` **73 `.js` / 19 `.ts`** (unchanged — no runtime source moved;
`internal.d.ts` was edited in place). `noodl-viewer-react` **83 `.js` / 12 `.jsx` / 55 `.ts` /
35 `.tsx`** (was 97/12/41/35).

1. **The rest of `nodes/std-library/`** — 26 files in three groups, all of which should now be
   mechanical because the types their `setup` functions need exist:
   - `componentutils/` (5 files, ~758 lines) — smallest, share `base.js`; do these first.
   - `user/` (8 files, ~1,159 lines) — formulaic, all funnel through `userservice.js`.
   - `data/` (13 files, ~2,300 lines) — the hard group. `foreach.jsx` (694 lines) is the only
     `.jsx` and will need `.tsx`; `filtercollectionnode`, `cloudfunction` and `persisthelper`
     are the other large ones.
2. **`nodes/navigation/`** (15 files, ~2,900 lines) — `navigation-stack.jsx` (771) and
   `navigate.js` (331) dominate. `router-handler.ts` and `router.tsx` are already converted.
3. **Live editor pass** — still the one gate no slice has run, still blocked on PLAT-002's
   editor package. Note PLAT-004 is also active in the same tree; commit by pathspec.
4. **Make `@noodl/runtime` ship declarations** (carried from §12 item 3). Less urgent after
   this slice — the published `@noodl/types` surface now covers most of what viewer nodes
   reach for — but still the right answer for runtime *modules* like `variablebase`,
   `javascriptnodeparser` and `api/cloudstore`, which arrive as implicit `any`.
5. **Decide on the accumulated findings.** Now four: `def.deprecated` dropped and `def.frame`
   dead (§9.3), `Noodl.runDeployed` never set (§11.3), and the `getInspectInfo` nodes that
   render nothing (§13.3). Each changes observable behaviour, so each wants its own commit.
6. **Do not raise `strict` yet** (spec step 8), and step 9 stays deferred.

## 15. Slice 6 — `componentutils/` and `user/` (spec step 7, continued)

13 files, ~1,900 lines: the five Component Object nodes and the eight user/session ones. §14
predicted both groups would be mechanical "because the types their `setup` functions need
exist." Half true. The `setup` functions needed nothing new. What these files needed was a
type for the thing `setup` *cannot* reach — the running component instance — and for the
data record every one of the Component Object nodes is built around.

### 15.1 Two runtime concepts that had never been named

**`ComponentInstanceLike`** — `nodeScope.componentOwner`. Slice 2 typed it as
`{ name: string; [extra: string]: unknown }`, which was enough for the one thing everything
else does with it (pass `.name` to `sendWarning`) and useless for anything else. All five
componentutils files do more: `getInstanceId()` is the key component state is stored under,
and `getRoots()` is the first step of the walk up the component tree. Both came back as
`unknown` and were therefore uncallable.

The walk is the interesting part, and the type now says why it is shaped as it is. A
component instance is reached from *above* in two different ways depending on what kind of
component it is — a visual one through its roots' `getVisualParentNode()`, a non-visual one
through `parentNodeScope` — so `ComponentRootNode` declares both members optional and the
code tests for each in turn. That is not defensive coding; it is the only correct way to
walk, and it now reads as such.

**`ModelLike`** — `@noodl/runtime/src/model`, the id-keyed observable record behind the
Object node, component state, and every collection entry. Central enough that the `data/`
group (slice 7) is largely a study in it, and until now entirely `any`. Three things about
it are surprising enough that the type documents them rather than just listing methods:
`Model.get(id)` *creates* the record if absent, so there is no existence check to make; what
it returns is a **Proxy**, not the bare model, which is why unknown property reads work and
why an index signature is honest here rather than lazy; and `{ resolve: true }` resolves a
dotted path through *nested Models only*, abandoning the path silently if it meets anything
else.

Also added: `NodeScopeLike.getNodesWithType` (how a node asks whether its parent component
has a Component Object at all) and `NodeContextLike.scheduleAfterUpdate` — mirrored onto
`RuntimeNodeContext` in `internal.d.ts`, per §13.2.

### 15.2 §13.4 repeated itself exactly

Pointing `NodeScopeLike.componentOwner` at `ComponentInstanceLike` produced **nine errors in
`react-component-node.ts`** and none anywhere else. The same nine-error shape as slice 5, from
the same cause: that file's local `ComponentOwnerLike` was a second description of one object,
so `ReactNodeScope extends NodeScopeLike` stopped holding, and every callback typed
`this: ReactNodeInstance` stopped being assignable in cascade.

The fix was one line — `ComponentOwnerLike extends ComponentInstanceLike`, keeping only the two
members it genuinely narrows (`parent` and `parentNodeScope` are React types there). All nine
cleared at once.

> This is now twice. When a slice publishes a type for something `react-component-node.ts`
> already described locally, expect a page of unrelated-looking errors and go straight to the
> `extends` clauses. Do not start at the bottom of the list.

### 15.3 What typing found

**`UserService`'s `error` callback always receives a string.** Every method unwraps the
backend's `{ error, code }` and forwards `error`; the two endpoints that answer with HTML
rather than JSON substitute a message of their own. Typing it `unknown` produced seven errors
at `setError(err: string)` call sites — which is the compiler asking a real question, and the
answer is that `error(error?: string)` is the truth. The user nodes wire it straight to a
`string` output port and have always been right to.

**A dead write.** `setparentcomponentobjectproperties`'s `getComponentObjectId` sets
`this._internal.parentComponentName` as it walks up. Nothing on that node reads it. The Parent
Component Object node has a field of the same name that its inspector *does* read, and this
is a copy of that walk which kept the assignment. Harmless; declared as optional with a
comment rather than removed, since removing it is a behaviour change however inert.

**Two guard flags named after the wrong node.** `verifyemail`'s scheduler guards on
`this.logOutScheduled`, copy-pasted from the Log Out node. Private per-instance state and
nothing else uses the name, so it is harmless — but it is the kind of thing that reads as a
bug in six months, so the declaration says what it is. Same story with `resetpassword` and
`requestpasswordreset` using each other's warning keys: within each file `setError` and
`clearWarnings` agree, and warnings are keyed per node id, so nothing collides.

**Dead imports and dead locals.** The four deprecated user nodes each imported
`{ Node, EdgeTriggeredInput }` and used neither, and each opened its scheduler with a
`var internal = this._internal` that nothing then read. Dropped.

### 15.4 A `for…in` that a `for…of` would have broken

`parentcomponentobject`'s `updatePorts` did:

```js
var properties = parameters.properties && parameters.properties.split(',');
for (var i in properties) { … }
```

`properties` is `undefined` when the author has typed no property names. `for…in` over
`undefined` is a no-op; `for…of` **throws**. The conversion uses `for (const p of properties
|| [])` and says so in a comment. `base.ts` and `componentobject.ts` have the same loop
already guarded by an `if`, so only this one needed the `|| []`.

> Worth carrying into the `data/` group, which is full of these. `for…in` over a
> possibly-undefined value is silently fine and a mechanical rewrite to `for…of` is not.

### 15.5 The `require()` boundary, second instance

`userservice` is not in `register-nodes.js`'s array — the user nodes import it directly, and
they are all converted, so those are ESM-to-ESM. But `src/api/users.js` (the `Noodl.Users`
public API) also `require`s it and is still `.js`, so it needed the §13.5 unwrap:

```js
const UserServiceModule = require('../nodes/std-library/user/userservice')
const UserService = UserServiceModule.default || UserServiceModule
```

`base.ts` needed no such thing despite being `require`d by name from `.js` at the time —
`Base.extendSetComponentObjectProperties` is a *named* access, and webpack's namespace object
carries named exports. Only default exports need the unwrap.

> And a trap of my own making: `prettier --write` on `api/users.js` reformatted all 177 lines,
> because that file had never been formatted. Reverted and the four-line change reapplied by
> hand. Do not run prettier over a `.js` file you are only touching one line of.

### 15.6 Verification

| Gate | Result |
|---|---|
| `typecheck:viewer` (§13.1 filter) | **0 errors** in `packages/noodl-viewer-react/src/`, before and after |
| `typecheck:runtime` / `typecheck:cloud` / `typecheck:editor` / `typecheck:preview` | clean |
| `catalog:check` | **byte-identical**, 135 node types, 89 dynamic |
| `noodl-runtime` jest | 225 passing / 20 failing — the §4 baseline, unchanged |
| viewer + deploy + ssr prod bundles | green, 0 errors |
| cloud viewer bundle, `noodl-preview` esbuild | green |
| `eslint` on all 13 converted files | **clean** — 0 errors |
| `prettier --check` | clean on every file this slice touched |

`catalog:check` byte-identical is again the load-bearing evidence: it proves the `.default`
unwrap resolves for all five componentutils modules and all seven user node modules, that
`base.ts`'s shared factory still compiles two node types with the same metadata, and that
Sign Up's schema-driven dynamic ports are unchanged.

`noodl-viewer-react`'s own jest suite fails to collect — `tests/collection.test.js` requires
`../src/nodes/std-library/data/collection`, which does not exist at HEAD either. Pre-existing
and unrelated; worth fixing when slice 7 reaches `data/`.

Live editor pass still owed — the same gate no slice has run.

### 15.7 eslint, and a different answer from slice 5

Slice 5 left 17 errors deliberately. This slice left **none**. The difference is what the
errors were: 28 here, and every one was an unused parameter, an unused local, an empty catch,
or a `.apply(this, arguments)` forwarder — nothing whose fix could change behaviour.

Two checks before dropping unused parameters wholesale: `defineNode` does not inspect callback
arity anywhere (grepped), so `set(value) {}` → `set() {}` is inert; and `EventEmitter.on` takes
exactly two arguments, so `on(eventName, listener)` forwards everything
`on.apply(this.events, arguments)` ever did. One `no-explicit-any` remains, on
`RequestOptions.success`, with an inline disable and a reason: its callers both index the
response as an object and call `indexOf` on it as a string, and no single type covers that
honestly.

### 15.8 Traps

- **`git stash` is not `git stash list`.** A compound command meant to inspect the stash
  stashed the entire slice mid-verification. Recovered with `git stash pop`, no loss — but in
  a tree shared with two other active tasks this could have been expensive. Read-only git
  inspection only, in its own call.
- **Bash working directory persists between calls.** A `cd packages/noodl-viewer-react/...`
  earlier in the session made a later `npx tsc -p packages/noodl-viewer-react` silently find
  no project — and the output filter matched nothing, so the gate read *clean*. This is §13.1
  in a second costume: a gate that cannot fail is not a gate. `cd` back, or use absolute paths.
- **Do not `prettier --write` an unformatted `.js` file** you are editing one line of (§15.5).

## 16. Slice 6's plan for slice 7 (done; see §18 for what is actually next)

File counts now: `noodl-runtime` **73 `.js` / 19 `.ts`** (unchanged again — only
`internal.d.ts`, edited in place). `noodl-viewer-react` **69 `.js` / 12 `.jsx` / 69 `.ts` /
35 `.tsx`** (was 83/12/55/35). `.ts` now equals `.js` in that package for the first time.

1. **`nodes/std-library/data/`** — 13 files, ~2,300 lines, the group §14 called hard and still
   is. What slice 6 built for it: `ModelLike` is the type most of these nodes are about, and
   §15.4's `for…in` warning applies throughout. Specifics:
   - `foreach.jsx` (694 lines) is the only `.jsx` here and needs `.tsx`. It is also the file
     that reaches for `nodeScope.createNode`/`deleteNode`/`getNodeWithId` and
     `componentOwner._forEachModel` — the last of which is an ad-hoc property, so expect to
     either publish it or cast at the two sites in `foreachactions.js`.
   - `collectionnode-clear` **has no file extension at all** (§13.8). Give it `.ts`.
   - `filtercollectionnode`, `cloudfunction` and `persisthelper` are the other large ones.
   - `signup.ts`'s local `SystemCollection` interface describes the `systemCollections`
     project metadata; `cloudfunction`/`collectionnode2` read the same metadata, so promote it
     to `@noodl/types` when the second consumer appears.
2. **`nodes/navigation/`** (15 files, ~2,900 lines) — unchanged from §14. `navigation-stack.jsx`
   (771) and `navigate.js` (331) dominate.
3. **Live editor pass** — still owed, still the one gate no slice has run.
4. **Make `@noodl/runtime` ship declarations** (carried from §12/§14). `ModelLike` reduced the
   pressure again — `model.js` was the largest untyped runtime module viewer nodes touch — but
   `variablebase`, `javascriptnodeparser` and `api/cloudstore` still arrive as implicit `any`.
5. **Decide on the accumulated findings.** Now six: `def.deprecated` dropped and `def.frame`
   dead (§9.3), `Noodl.runDeployed` never set (§11.3), the `getInspectInfo` nodes that render
   nothing (§13.3), and from this slice the dead `parentComponentName` write and the
   misnamed guard flags (§15.3). The last two are cosmetic; the first four are not. Each
   changes observable behaviour, so each wants its own commit.
6. **Fix `noodl-viewer-react`'s jest suite** while in `data/` — its one spec requires a module
   that does not exist (§15.6).
7. **Do not raise `strict` yet** (spec step 8), and step 9 stays deferred.

## 17. Slice 7 — `nodes/std-library/data/` (spec step 7, continued)

14 files, ~3,000 lines: every registered node in the `data/` group. §14 and §16 both called
this the hard group. It was, but not for the reason either predicted. The `for…in`/`for…of`
hazard §15.4 warned about barely appeared (two sites, both already guarded), and
`foreach.jsx` → `.tsx` was routine. What made it hard is that the group is built on a runtime
concept that had never been written down and whose implementation is genuinely surprising.

### 17.1 `CollectionLike`, and the `Array.prototype` patch that is load-bearing

`@noodl/runtime/src/collection` is not a collection class. It is `class Collection extends
Array {}` — thirty lines — sitting under ~200 lines of `Object.defineProperty` calls that
install `on`, `off`, `set`, `add`, `remove`, `size`, `items`, `getId` and the rest onto
**`Array.prototype`**, for every array in the process.

The obvious reading is that this is old code nobody cleaned up. It is not. Nodes bind their
`items` input by calling `value.on('change', …)` without first checking what `value` is —
`mapcollectionnode`, `filtercollectionnode` and `collectionnode2` all do — so a plain array
arriving from a Function node has to answer `on` and `size` too. Turning the patch into a
proper class breaks every one of those nodes, at runtime, in the viewer, where no type-check
would have said a word. `CollectionLike`'s doc comment now says this, because it is exactly
the kind of thing a future reader "tidies up".

The typing consequence is that `CollectionLike extends Array<ModelLike>` is the honest
declaration, and that an `items` port carries one in practice whatever the author connected —
so annotate the field, do not narrow the input.

The other thing the type records is that `set` is a **diff**, not an assignment: it removes,
reorders and adds so that entries present in both keep their identity. That is what lets the
Repeater keep a mounted component alive across an update instead of rebuilding every item,
and it is why `foreach` keeps an internal collection distinct from its `items` input.

Published alongside it: `CollectionChangeEvent`, and `ModelModule`/`CollectionModule` for the
two module objects. The module types are what make `Collection.get(id)` return a
`CollectionLike` at ~15 call sites instead of `any`, and `Collection.instanceOf` a type
predicate. They also record the asymmetry between the two `instanceOf` helpers:
`Collection.instanceOf` is a plain `instanceof` test, but `Model.instanceOf` falls through to
`value.target` and therefore **throws** on `null`/`undefined` rather than returning `false`.

### 17.2 `_forEachModel` is a protocol, not a private field

`foreachactions` reads `nodeScope.componentOwner._forEachModel`, which §16 predicted would
need publishing or casting. Publishing was right, and for a bigger reason than that one call
site: six files across the runtime walk `parentNodeScope` upwards looking for exactly this
property — `javascriptnodeparser.js`, `modelcrudbase.js`, `dbmodelcrudbase.js`,
`modelnode2.js`, `dbmodelnode2.js` and `runtasks.js`. It is how the Object, Record and
Function nodes resolve "the current item" inside a Repeater template. `ComponentInstanceLike`
now declares `_forEachModel` and `_forEachNode` with that written down, because anything that
renames or stops setting them silently strips the ambient item from every node in a template.

### 17.3 The nine-error cascade did not recur — a different one did

§13.4/§15.2's rule (a page of unrelated-looking errors means a broken `extends`, go straight
to the `extends` clauses) held, but the failing clause was in the *converted file*, not in
`react-component-node.ts`. 43 errors, all in `foreach.tsx`, from two local interfaces
redeclaring `model` — which `NodeInstance` already publishes as `GraphNodeModel`. Two
deletions fixed 41 of them.

The generalised rule: **before declaring a member on an interface that extends
`NodeInstance`, check whether `NodeInstance` already has it.** The published surface has grown
enough over six slices that guessing is now worse than looking.

The four errors that survived were real gaps, and are now filled:
`NodeScopeLike.getNodeWithId`, `GraphNodeModel.parent` (with the `'parentUpdated'` event that
accompanies it), and `ComponentModelLike.inputPorts`/`outputPorts` — a component's *own*
ports, which the Repeater tracks through six separate port events to keep its forwarded item
outputs in step.

### 17.4 `no-this-alias`: 18 sites, and why the arrow rewrite is safe

Converting left 18 `const _this = this` aliases, which eslint rejects. The rewrite to arrow
functions is only correct if the callback's `this` was already the node. It was: `node.ts:476`
drains the queue with `afterInputCallbacks[i].call(this)`, so inside every
`scheduleAfterInputsHaveUpdated` callback `this` and `_this` are the same object — several
files mixed the two freely in one function, which is the tell. Collection listeners are
invoked bare (`l[i](args)`), so those had to use `_this` and an arrow is likewise exact.
Worth checking rather than assuming: had the runtime used `.apply(node, args)` on some paths
and not others, the rewrite would have been a silent behaviour change.

### 17.5 The viewer's jest suite runs again (§16 item 6)

`tests/collection.test.js` required `../src/nodes/std-library/data/collection`, which has
never existed — `Collection` lives in `@noodl/runtime/src/collection`. Repointing the import
(and dropping a `new` applied to the `create` *function*) revives three tests, and they
happen to cover precisely the `set`-as-diff behaviour §17.1 documents. **3 passed.** That
retires one of the two "pre-existing failures that look like regressions but are not" from the
task memory; `noodl-preview`'s `preview.test.ts:97` size assertion is still the other.

### 17.6 `persisthelper.js` is dead and was left as `.js`

307 lines, referenced by nothing anywhere in the repo — a Parse/MQTT-era sync helper orphaned
when the model and collection nodes moved to the runtime. It is not required, so it is not
bundled. Typing dead code buys nothing, so it was deliberately left unconverted rather than
padding the slice; deleting it is a one-line commit of its own and is item 5 below. It is the
only remaining `.js` in `data/`.

### 17.7 Latent defects found — five more, none fixed

Each changes observable behaviour, so each wants its own commit (§16 item 5's list is now
eleven).

1. ~~**`cloudfunction2` throws instead of reporting.**~~ **RESOLVED 2026-07-24 by DEBT-001.**
   `doCall` warned when `cloudServices` was `undefined`, then unconditionally read
   `cloudServices.appId` — and called `this.context.editorConnection.isRunningLocally()`
   outside the `if (this.context.editorConnection)` guard immediately above it. So the Cloud
   Function node threw a `TypeError` on **every call in a deployed app**, where there is no
   editor connection at all, and threw rather than signalling `failure` when a project had no
   cloud services. Fixed: the missing-`cloudServices` path now sets `lastCallResult`, calls
   `setError` (which signals `failure`) and returns; the `isRunningLocally()` read is guarded
   by `this.context.editorConnection &&`. Characterisation test:
   `noodl-viewer-react/tests/cloudfunction2.test.ts`.
2. **`foreachactions.itemActionTriggered` calls `signalItemAction`, which no node defines.**
   Unreachable today: the `itemAction-` ports that would register the input are only created
   by the `setup` block that is entirely commented out. Dead *and* broken.
3. **`collectionnode2` has no `store` input.** Three code paths test
   `isInputConnected('store')` and one whole method (`scheduleStore`) exists to serve it. The
   port was never declared, so the tests are always false and the method is unreachable.
   Behaviour is self-consistent — auto-copy always happens — but a quarter of the file is
   answering a question nobody asks.
4. **`variablenode2.getInspectInfo` returns the raw variable value.** The §13.3 defect again:
   only a *string* variable inspects correctly; a number, boolean or object variable shows
   nothing.
5. **`collectionnode-new`'s `setCollectionID` and its `id` output fallback are unreachable** —
   the node has no `collectionId` input, so `_internal.collectionId` is never assigned.

Also corrected in passing, and behaviour-neutral: `filtercollectionnode`'s `updatePorts` took
a `dbCollections` argument it never read, threaded through two `graphModel.getMetaData`
calls; both are gone.

### 17.8 Traps

- **Check the base interface before declaring a member** (§17.3). This is the slice's one
  genuinely new rule and it cost 43 errors.
- **A renamed file is a new path to the Write tool.** Every `mv`-ed file needs a fresh read
  before it can be written, even though its content is already in context.
- Plain `mv` rather than `git mv`, with the commit made by explicit pathspec, kept slice 4's
  stolen-rename problem from recurring while another agent worked in the same tree.
- `cd` into a package for a build **persists into the next tool call** (§15.8, third
  occurrence). Every build here was followed by an explicit `cd` back and a `pwd`.

## 18. Slice 7's plan for slice 8 (items 1–2 done; see §20 for what is actually next)

File counts now: `noodl-runtime` **73 `.js` / 19 `.ts`** (unchanged — only the published
`.d.ts` was edited). `noodl-viewer-react` **57 `.js` / 11 `.jsx` / 82 `.ts` / 36 `.tsx`**
(was 69/12/69/35). `.ts` now outnumbers `.js` by a clear margin for the first time.

1. **`nodes/navigation/`** — 15 files, ~2,900 lines, and now the largest untyped group.
   `navigation-stack.jsx` (771) and `navigate.js` (331) dominate; `router.tsx` and
   `router-handler.ts` are already converted, so the types those two settled on are the
   starting point. **One hazard this group has that `data/` did not:**
   `register-nodes.js` imports `./nodes/navigation/page.js` and
   `./nodes/navigation/navigation-stack.jsx` with **explicit extensions** — the only two such
   imports left in the file. Webpack will not substitute `.ts`/`.tsx` for a request that
   spells `.js`/`.jsx`, and `tsc` never sees it. Rename without editing those two lines and
   the build breaks silently at runtime, not at compile time.
2. **Live editor pass** — ~~still owed~~ **PAID 2026-07-24 by DEBT-002.** A real project
   (Shine Phase 2) and a fresh test project were opened and exercised in the running editor:
   canvas paints, preview renders real content, imports/merges/validation all ran, and a
   full session log shows zero renderer or viewer exceptions. See phase-14.5 PROGRESS
   (DEBT-002 section) for the full checklist and findings.
3. **Make `@noodl/runtime` ship declarations.** `ModelModule`/`CollectionModule` (§17.1) were
   the last two big module objects the viewer nodes reach for, so the pressure is lower again
   — but the `X as XModule` cast at the top of ten files in `data/` is the workaround, and
   real `.d.ts` is what removes it. `variablebase`, `javascriptnodeparser` and
   `api/cloudstore` still arrive as implicit `any`.
4. **Decide on the accumulated findings — now eleven** (§9.3, §11.3, §13.3, §15.3, §17.7).
   The `cloudfunction2` deployed-app crash (§17.7 item 1) is the most serious thing typing has
   turned up in seven slices and should not wait for a tidy batch.
5. **Delete `persisthelper.js`** (§17.6) — orphaned, 307 lines, one commit.
6. **Do not raise `strict` yet** (spec step 8), and step 9 stays deferred.

## 19. Slice 8 — `nodes/navigation/`, and the live-editor pass at last (spec step 7, fifth group)

All 14 remaining files under `nodes/navigation/` converted (~3,000 lines):
`navigation-stack.jsx` → `.tsx` (the Component Stack, 771 lines), `page`, `page-inputs`,
`navigate`, `navigate-back`, `navigate-to-path`, `router-navigate`, `showpopup`, `closepopup`,
`navigation-handler`, and the transition family (`transitions.js` index + `transition`,
`none-transition`, `push-transition`, `popup-transition`). `router.tsx` and `router-handler.ts`
were already typed and supplied the vocabulary (`NavigateArgs`, the registry-class pattern).

### 19.1 The live-editor pass — run twice, green twice

The gate every slice since §12 has owed, run **before** the conversion (baseline for slices
1–7) and **after** it (for this slice). Same script both times, against the real `Shine
Phase 2` project via `npm run dev:debug` + CDP:

launcher renders → project opens → node graph paints → preview webview renders the app →
click through to `/profile` (Router + Navigate + visual nodes) → `history.back()` to `/` →
`grep` `.logs/dev.log` for `renderer:exception|Uncaught|TypeError|ReferenceError`: **nothing,
both runs**. Slices 1–7 are now live-verified, not just gate-verified, and slice 8 matches
the baseline.

**CDP trap found doing it:** once a project opens, the editor page's URL becomes
`file:///dashboard/projects` (pushState), so `cdp.js`'s default `editor` target no longer
matches `/src/editor/index.html` and *silently falls back to the first page — the cloud
runtime, which reports `reactMounted: false`*. That is a healthy editor looking exactly like
a dead one. Use `--target=NodeGX` (title match) after a project is open. The preview is a
`<webview>`, not a page target, so `cdp.js` cannot attach to it; drive it from the editor
page via `document.querySelector('webview').executeJavaScript(...)`.

### 19.2 The register-import hazard, handled

`register-nodes.js`'s two explicit-extension imports (§18 item 1) —
`./nodes/navigation/page.js` and `./nodes/navigation/navigation-stack.jsx` — were switched to
extensionless in the same change as the renames. `catalog:check` byte-identical and a green
viewer build prove both loaders resolve the `.ts`/`.tsx` files.

### 19.3 Two runtime members the types pretended not to have

`NodeScopeLike.createPrimitiveNode` and `NodeContextLike.showPopup` both exist on the real
runtime classes (`nodescope.ts:50`, `nodecontext.ts:78`) but were unpublished, so every use
site got `unknown` back from the index signature — "this expression is not callable".
Published both; `showPopup` also mirrored onto `RuntimeNodeContext` in
`noodl-runtime/src/internal.d.ts` per the §13.2 rule. `createPrimitiveNode` needed no mirror:
`internal.d.ts` has no scope type, and `nodescope.ts` already declares it.

The published `createNode`/`createPrimitiveNode` return the runtime-level `NodeInstance`; in
the React viewer the result is always a `ReactNodeInstance`. The three call sites in the
Component Stack carry a one-line cast with a comment saying exactly that — same shape as the
`X as XModule` casts of §17.1.

### 19.4 Latent defects found — three more, none fixed

The accumulated register now lives in **phase-14.5 `DEBT-006`** (the concurrent session
created the track and already fixed §17.7 item 1 as `DEBT-001`); these three are recorded
there too.

1. **`navigate-back.ts`'s `backAction-…` inputs throw a `ReferenceError`.** The setter is
   built with `_createSignal({...})` — an identifier defined *nowhere in the repository*.
   Unlike `foreachactions` (§17.7 item 2) this is **reachable**: the node's `setup` publishes
   a `backAction-<name>` input port for every entry in the `backActions` stringlist, and
   registering any of them executes the broken line. Any project using Back Actions on Pop
   Component Stack dies at load. `closepopup.ts` does the same job correctly with
   `EdgeTriggeredInput.createSetter` — that is the intended shape. Carries a
   `@ts-expect-error` with a pointer here.
2. **Component Stack URL writing ignores custom page paths.** The `pagePath-<id>` input lands
   in `_internal.pageInfo[id].path`, which `matchPageFromUrl` reads — but `getRelativeURL`
   reads `top.pageInfo.path`, the `_findPage` result, which never carries `path`. So inbound
   URLs *match* a custom path, while written URLs always use the label-derived slug. The
   asymmetry means navigating then reloading can land somewhere the address bar never showed.
3. **`PopupTransition.update` reads `this.crossfade`, which nothing assigns** — it is
   `PushTransition`'s parameter, seemingly copied with the zoom branch. The In/Out popup
   transition therefore never fades; the node's actual `tr-fadein` parameter is only honoured
   by the translate branch.

### 19.5 eslint

15 errors on the converted files; 9 fixed (unused `_`-prefixed params — this config has no
`argsIgnorePattern` — and two `prefer-spread` on `BezierEasing.apply(null, curve)`, rewritten
as spread, which is call-for-call identical). 6 remain deliberately: 4 ×
`no-this-alias` (`_this` feeding `function()` callbacks — §13.7's precedent stands) and
`router-handler.ts`'s 2 pre-existing `no-explicit-any`, which predate this slice.

### 19.6 Traps

- `prettier --write` reorders the import block (§13.8, again). Run it before the final
  typecheck, not after.
- `zsh` eats `===MARKER===` echo separators in gate one-liners as failed globs — quote them.
- The `cd`-persists trap (§15.8, §17.8) hit again on the `rm` of the old files. `pwd` after
  every package-local build or delete.

## 20. Next slice

File counts: `noodl-viewer-react` **43 `.js` / 10 `.jsx` / 96 `.ts` / 37 `.tsx`** (was
57/11/82/36). `noodl-runtime` unchanged at 73 `.js` / 19 `.ts`. Every file under
`src/nodes/` is now TypeScript except `data/persisthelper.js` (dead, §17.6, deletion owned
by DEBT-006).

1. **The remaining viewer `.js` is no longer node code.** The 43 files cluster in `src/`
   root (18 — `guid`, `async-queue`, `node-shared-port-definitions`, …),
   `nodes-deprecated/` (16, never registered — consider whether converting them is worth
   anything at all before spending a slice on it), `api/` (4) and the Group scroll plugins
   (3). The high-value next step is probably `src` root: those are the modules every typed
   node imports untyped today.
2. **Latent defects now live in phase-14.5** — DEBT-001 (fixed), DEBT-006 (the register,
   including this slice's three §19.4 finds). Do not re-batch them here.
3. **Make `@noodl/runtime` ship declarations** (carried from §16/§18).
4. **Do not raise `strict` yet** (spec step 8), and step 9 (editor-side `TSFixme` sweep)
   stays deferred.

## 20. The findings ledger, closed out (DEBT-006, 2026-07-25)

Every accumulated finding (§9.3, §11.3, §13.3, §15.3, §17.6, §17.7, §19.4) is now fixed or
closed with a recorded decision. Item-by-item:

- **§17.7 #1 cloudfunction2** — fixed earlier by DEBT-001 (see §17.7).
- **§19.4 #1 navigate-back `_createSignal`** — fixed: `EdgeTriggeredInput.createSetter`,
  `@ts-expect-error` removed. Back Actions no longer throw at load.
- **§19.4 #2 Component Stack URL write** — fixed: `_findPage` now carries the per-page
  `path`, so written URLs use the same custom `pagePath-…` that inbound matching honours.
- **§19.4 #3 PopupTransition crossfade** — fixed by wiring the node's real `fadein` into
  the In/Out branch (default false → untouched projects render identically).
- **§9.3 `def.deprecated` dropped** — fixed; catalog regenerated in its own commit
  (Form/Fieldset/Label now `isDeprecated: true`).
- **§9.3 `def.frame` dead path** — **decision: retained.** The port-registration half is
  historical module-facing API surface; deletion only saves dead in-repo branches and risks
  third-party React nodes. Recorded at the interface.
- **§11.3 `Noodl.runDeployed`** — fixed: group/text now read `Noodl.deployed`. Deployed
  apps no longer build tooltip HTML (verified by rebuilding the deploy bundle). Side
  effect: the catalog generator (whose `Noodl` proxy returned a truthy noop for
  `runDeployed`) now runs the tooltip path and the catalog gains real port descriptions.
- **§13.3/§17.7 #4 bare-value inspectors** — fixed across the cluster (Switch, Number
  Remapper, Animate To Value, variablenode2) plus the trivial runtime siblings (and/or/
  expression): all wrap as `[{ type: 'value', value }]`. Upload File's inspector now shows
  the `cloudFile` it actually tracks instead of the never-written `_internal.response`.
- **§17.7 #2 foreachactions** — deleted: the `itemAction` mechanism (dead publishing block,
  broken `signalItemAction` call) is gone; the node keeps its real Repeater handshake.
- **§17.7 #3 collectionnode2 `store`** — **decision: deleted** (declaring the port is a
  product decision a debt task shouldn't make). Auto-copy is now unconditional in code as
  it always was in behaviour.
- **§17.7 #5 collectionnode-new** — deleted `setCollectionID` and the unreachable
  `collectionId` fallback on the `id` output.
- **§15.3 tidy** — the dead `parentComponentName` write is gone;
  `verifyemail`'s guard flag is named `verifyEmailScheduled`; `resetpassword` and
  `requestpasswordreset` use their own warning keys.
- **§17.6 persisthelper.js** — deleted (orphaned, zero importers).
- **§4 QueryBuilder `id` vs `objectId`** — **decision: real adapter bug, tests were
  right.** SchemaManager creates `"objectId" TEXT PRIMARY KEY` and the relation subquery
  already used it, but the CRUD builders (and LocalSQLAdapter's raw lookups) emitted a
  nonexistent `"id"` column — only the mock-mode regex accepting both hid it. All aligned
  to `objectId`.

Runtime jest baseline after the batch: **247 passing / 0 failing** (was 225/20 at the
start of phase 14.5, 243/4 after DEBT-003). `catalog:check` green after regeneration.

## 21. Slice 9 — the viewer's `src/` root, `api/`, and what `nodes-deprecated/` actually is

§20 said the remaining viewer `.js` "is no longer node code" and named `src` root as the
high-value target. That was right, and this slice took it: **17 of the 18 root files**,
all four of `api/`, `noodl-js-api`, and `constants/flex`. It also answered §20's
`nodes-deprecated/` question, and the answer is the opposite of what §20 assumed.

File counts: `noodl-viewer-react` **42 `.js` / 10 `.jsx` / 97 `.ts` / 37 `.tsx` →
21 `.js` / 10 `.jsx` / 118 `.ts` / 37 `.tsx`**. `noodl-runtime` unchanged at 73 `.js` /
19 `.ts` (only `internal.d.ts` was edited). Every remaining `.js` is now in exactly three
places: `nodes-deprecated/` (16 `.js` + 9 `.jsx`), the Group scroll plugins (3), and
`register-nodes.js` (1).

### 21.1 `nodes-deprecated/` is not dead code, and must not be deleted

§20 recorded it as "16, never registered — consider whether converting them is worth
anything at all". **It is registered, all of it, and it ships.** The evidence:

- `register-nodes.js` `require()`s 15 of them by name (lines 146–160) and imports the
  nine `.jsx` controls at the top (lines 24–32), registering them at 180–188.
- The committed catalog contains every one of them as a real node type `providedBy:
  noodl-viewer-react` — `Component State`, `Parent Component State`, `Model`,
  `Collection`, `DbModel`, `DbCollection`, `Variable`, `Globals`, `Gyroscope`,
  `Signal To Index`, `Number Blend`, `String Selector`, `Animation`, `Transition`,
  `Script Downloader`, `Form`, `Field Set`, `Label`, plus the six older controls.
- The prod bundle lists `./src/nodes-deprecated/std-library/ 117 KiB 15 modules`.

Every one carries `inNodePicker: false`. That is the whole mechanism: a user cannot add
a *new* one, but a project that already contains one still loads. Deleting these files
breaks every such project on upgrade, silently, at load. **Recommendation: keep, and
convert them in a later slice** — they are ordinary node files and the slices 5–8 recipe
applies unchanged. There is no argument for deletion and a weak one for conversion
(they are frozen), so they are the lowest-priority group, not a candidate for removal.

One inconsistency found while establishing this, not fixed: the six older controls
(`Button`, `Checkbox`, `Radio Button`, `Options`, `Text Input`, `Range`) live in
`nodes-deprecated/`, are hidden from the picker, and are superseded by
`net.noodl.controls.*` — but they do **not** declare `deprecated: true`, so the catalog
reports `isDeprecated: false` for all six. Only `Form`/`Field Set`/`Label` declare it
(that is why DEBT-006's `def.deprecated` fix caught only those three). Anything reading
the catalog to decide what is current — the node picker, docs, an AI author — is told
these six are current. It is a one-line change per file that moves catalog output, so it
wants its own commit and a decision.

### 21.2 The published types this slice corrected — seven, and three were lies

The pattern from §13.3/§15.2/§19.3 recurred hard. Typing the modules that *everything*
imports finds gaps faster than typing leaves does.

| What | Was | Is |
|---|---|---|
| `NodeContextLike.updateDirtyNodes` | unpublished → `unknown` | published (§19.3 shape, third time) |
| `ComponentModelLike.getRoots()` | unpublished → `unknown` | published; returns the live array, not a copy |
| `ReactNodeDefinition.setup`'s `graphModel` | `unknown` | `GraphModelLike`, which slice 5 published for exactly this |
| `RunningTransition` | local `{ stop(): void }` | alias of the scheduler's `Timer` — `start()` was invisible |
| `PortTooltip` | `string \| {standard,extended}` | plus `PortTooltipMap`, the keyed form |
| `InputPortDefinition.tab` | `string` | `PortTab`, which has an object form |
| `NavigateArgs.hasNavigated` | required | optional |

The two genuinely surprising ones:

**`PortTooltip` had a third form nobody had written down.** A port that renders more than
one control carries a *map* of tooltips rather than one: `sizeMode` keys its by enum
value, so each size mode gets its own explanation, and `width`/`height` key theirs by
sub-control (`dimension`, `fixed`). All authored in `addDimensionTooltips`, all invisible
while that file was `.js`.

**`InputPortDefinition.tab` was `string`, and the metadata type repeated the lie.**
`_addCornerRadius` passes `{ group: 'corners', tab, label }` so the four corner radii
render as one tabbed widget. Widening the authoring type immediately broke
`nodedefinition.ts:68`, which copies `input.tab` straight onto `InputPortMetadata` —
where `tab` was *also* declared `string`. Two narrow declarations, one value. Both
widened to a shared `PortTab`.

### 21.3 `interface Window { Noodl }` has never been in effect

`typings/global.d.ts` opens with `import 'react'`. That makes the file a **module**, so
its top-level `interface Window { Noodl: GlobalNoodl }` declares a `Window` local to that
module rather than merging into `lib.dom`'s. The `declare global { const Noodl }` block
below it is fine — which is why nothing noticed: every consumer so far reached for the
bare `Noodl`, never `window.Noodl`. `noodl-js-api` is the first TypeScript file to use
the `window.` form and it failed on the first line. Moved inside `declare global`.

Worth generalising: **a `.d.ts` with any top-level `import` is a module, and every
augmentation in it must be inside `declare global`.** The half of the file that worked
made the broken half look fine.

### 21.4 Defects found — six, three fixed because the compiler would not accept them

Not batched this time; DEBT-006 is closed and §20 item 2 says not to re-open a ledger
here. Three had to be fixed to compile, and each is a real behaviour change:

1. **`Noodl.Arrays` / `Noodl.Objects` assignment throws in strict-mode callers.** Their
   Proxy `set` traps returned nothing. A `set` trap must return truthy; returning
   `undefined` makes the assignment throw a `TypeError` *after* the underlying `set` has
   already succeeded. `ProxyHandler.set` is typed `boolean`, so this could not be carried
   forward. Now returns `true`. Affects `Noodl.Arrays.foo = [...]` from any project's
   JavaScript.
2. **TextInput's ref callback returns the element.** `ref={(ref) => (this.ref.current =
   ref)}` — the concise arrow returns the assignment's value. React 19 reads a ref
   callback's return value as a *cleanup function*, so this has been wrong since RUN-001
   landed. Block body now, in both the `<input>` and `<textarea>` branches.
3. **`NavigateArgs.hasNavigated` required** (§21.2) — `Noodl.Navigation.navigate` from
   user JavaScript has never passed it, and both call sites guard it.

Three left in place, documented at the site, because fixing them changes behaviour and
none is urgent:

4. **`graph-warnings` guards on `roots.lenth`** (sic). `undefined === 0` is false, so the
   early return has never fired; with no roots the code then calls `clearWarning(name,
   undefined, …)`. Harmless today, but the guard is decorative.
5. **`Highlighter.updateHighlights` leaks selected nodes.** It walks the concatenation of
   `highlightedNodes` and `selectedNodes`, but the "element is gone" branch only deletes
   from `highlightedNodes` — so a *selected* node whose element disappeared is revisited
   every frame forever, calling `remove()` on the same div each time.
6. **`ASyncQueue.pendingPromise` is dead.** The constructor initialises it; every read and
   write in `dequeue` uses `workingOnPromise`, which is therefore `undefined` until first
   use. It happens to be falsy, so the queue works by accident.

### 21.5 The ESM/CJS boundary, and the one that would have shipped broken

Converting `easecurves` to `.ts` made it an ES module, and **three registered deprecated
nodes `require()` it** — `animation`, `numberblend`, `transition`. Under webpack a
`require()` of a harmony module returns the namespace object, so `EaseCurves.linear`
would have been `undefined` in all three. These are live, catalogued, bundled nodes, so
this was a real break introduced mid-slice, not a hypothetical.

They cannot simply switch to `import`: all three end in `module.exports`, and adding an
`import` flips the file to ESM and takes `module.exports` away. So they take the §13.5
`.default || module` unwrap instead. The rule, stated plainly for the next slice:

> Before converting a leaf module, grep for `require()` of it — not just `import`. Any
> CommonJS consumer needs the unwrap *in the same commit*, and `tsc` will not tell you,
> because neither file is in the program.

`noodl-js-api` keeps `require()` for the three `@noodl/runtime` modules it pulls in, for
the §11.1 reason: the runtime compiles as CommonJS and importing its source into the
viewer's ESM program is `TS1203`/`TS2497`. Local `./api/*` modules are in the same
program and import normally.

### 21.6 Typing a module unmasks its consumers

`pointerProps` returned `any` while it was `.js`, and its result is *spread* into props
objects — and spreading an `any` makes the whole enclosing object literal `any`. Giving
it a real return type re-exposed two pre-existing errors in `Select.tsx` and
`TextInput.tsx` that had been hidden behind that spread for as long as the file was
untyped. The React 19 ref defect above is one of them.

> A gate that reads clean because a value upstream is `any` is §13.1 in a third costume.
> Expect a conversion's error count to land in files you did not touch.

Six `@ts-expect-error` suppressions also went stale and had to be deleted — three
`missing Noodl typings` on `Noodl.Env` (Image, Video, router) and three
`Noodl is not defined` on `Noodl.SEO` (Page, router ×2), once `Env` and `SEO` were
published on `GlobalNoodl`. That is spec step 9's category of marker, retired at the
declaration rather than site by site.

### 21.7 `register-nodes.js` is deliberately still `.js`

It is the one root file left, and leaving it is a judgement, not an omission. Two
reasons. Its imports name explicit extensions (`./nodes/controls/button.ts`,
`router.tsx`) — legal in a `.js` file, but `TS5097` in a `.ts` one without
`allowImportingTsExtensions`, so conversion means editing the exact lines §18/§19.2
identified as able to break the build silently at runtime. And its entire job is the
CJS/ESM bridge: it `require()`s ~25 files that are still CommonJS and unwraps
`module.default || module` for them. Converting the bridge while the things it bridges
are mid-migration buys no type safety — it exports one function — and adds risk. It
should be the **last** file converted, once `nodes-deprecated/` is done and the unwrap
can be deleted outright.

### 21.8 Verification

| Gate | Result |
|---|---|
| `typecheck:viewer` | **0 errors** in `packages/noodl-viewer-react/src/` (baseline 0) |
| `typecheck:runtime` / `typecheck:cloud` | clean |
| `catalog:check` | **byte-identical**, 137 node types, 89 dynamic, 24 port value types |
| `noodl-runtime` jest | **384 passing / 0 failing**, 23 suites |
| `noodl-viewer-react` jest | 52 passing / 0 failing, 6 suites |
| viewer + deploy + ssr prod bundles | green (3 pre-existing asset-size warnings) |
| live editor/viewer pass | **not run — owed** |

Two things to flag rather than bury.

**The runtime jest baseline is 384/0, not the 247/0 this slice was briefed with.** 247 was
the figure §20's ledger recorded at the end of phase 14.5; the suite has grown since. 384
is the number at `7779cd6` before this slice touched anything, and it is unchanged after.

**`typecheck:editor` reports 6 errors at `7779cd6`, pre-existing.** All `TS2307` for
NodePicker components (`NodePickerCategory`, `NodePickerSection`, `NodePicker.selectors`,
…) that do not exist in the tree — an in-flight NodePicker workstream committed
`NodeLibrary.tsx` referencing files it had not committed. This slice touched no file
under `packages/noodl-editor`. Worth someone's attention: the editor typecheck is red on
cline-dev tip.

### 21.9 Traps

- **`terminal-link` is missing from this environment's install**, and `@jest/reporters`
  requires it *only when printing a failing suite's header* — so the runtime suite dies
  with a module-not-found stack the moment anything fails, and you cannot see what failed.
  The same breakage RUN-004 hit. Worked around with a local stub in `node_modules`
  (gitignored, cosmetic — the real package only emits an OSC-8 hyperlink and falls back to
  plain text). Not a source change, and it must not become one.
- **`npm install` in a fresh worktree rewrites `package-lock.json`** with optional
  platform binaries (`@img/sharp-*`, `@emnapi/runtime`) — 451 lines of it. Restore the
  lockfile before staging or it lands in the commit.
- The §19.6 zsh trap has a sibling: **unquoted `--include=*.ts` is eaten as a failed
  glob** before `grep` ever sees it. Quote every glob argument.
- **es5 target without `downlevelIteration`**: `for…of` over a `Map` or `Set` is a compile
  error in `.ts` that was silently fine in `.js`. `Array.from(map.entries())`.
- A `.d.ts` containing any top-level `import` is a module; augmentations must be inside
  `declare global` (§21.3).

## 22. Slice 9's plan for slice 10 (item 1 done; see §23 for what is actually next)

File counts: `noodl-viewer-react` **21 `.js` / 10 `.jsx` / 118 `.ts` / 37 `.tsx`**.
`noodl-runtime` unchanged at 73 `.js` / 19 `.ts`.

1. **`nodes-deprecated/`** — 16 `.js` + 9 `.jsx`, and now the largest group by a distance.
   §21.1 settles that they are live and must not be deleted. `dbmodelnode` (797),
   `dbcollectionnode` (717) and `animation` (547) dominate; the nine `.jsx` controls need
   `.tsx`. Three of them already carry the §13.5 unwrap this slice added, which comes back
   out when they become ES modules. Slices 5–8's recipe applies unchanged.
2. **The Group scroll plugins** — 3 files, 1,182 lines, `slide-scroll-plugin.js` being 940
   of it. Untouched this slice: pure momentum/physics code with no type surface anyone
   imports, so it is the lowest value per line in the package. Fine to leave until last.
3. **`register-nodes.js` last**, for the reasons in §21.7, and delete the
   `module.default || module` unwrap in the same commit once nothing needs it.
4. **`@noodl/runtime` shipping `.d.ts` — carried again, and now with a concrete finding.**
   Four slices have listed this (§12, §16, §18, §20). It did not fit alongside the `src`
   root work and was not attempted. What is now known: the blocker is not the tsconfig —
   `packages/noodl-runtime/tsconfig.json` already has `allowJs: true`, so
   `declaration: true` + `emitDeclarationOnly` would emit for the `.ts` files and, with
   `checkJs` still off, best-effort `any`-shaped ones for the 73 `.js`. The blockers are
   that the package has **no `types` field** in `package.json` and **no build step at all**
   (`main` points straight at `noodl-runtime.js` source), so shipping declarations means
   introducing a build artefact and a generation order into a package four other packages
   consume from source. That is a build-pipeline change and deserves its own slice, which
   is exactly what §11.1 said. Its value also keeps falling: this slice needed only three
   `require()`s in `noodl-js-api` and two `const X = require(...)` in `api/`, all of which
   are honest CommonJS boundaries rather than workarounds.
5. **Decide the six mis-flagged deprecated controls** (§21.1) — `isDeprecated: false` on
   nodes that are hidden from the picker and superseded. Moves catalog output.
6. **The live editor/viewer pass is owed** for slice 9. It was not attempted here: `lerna
   exec` runs from the main checkout rather than a worktree, so it cannot be driven from
   an isolated tree. §19.1's recipe and `--target=NodeGX` still apply.
7. **Do not raise `strict`** (spec step 8) — still a global flip with concurrent
   workstreams in the same tsconfig. Step 9's editor-side sweep stays with PLAT-004,
   though §21.6 retired six markers at the declaration rather than the site, which is the
   cheaper half of that job done from this side.

## 23. Slice 10 — `nodes-deprecated/`, and the end of node code in JavaScript

§22 named `nodes-deprecated/` as the next target and it was right: 25 files, 7,052 lines,
the largest remaining group by a distance. All 25 are converted. **Every node file in
`noodl-viewer-react` is now TypeScript** — the four `.js` and one `.jsx` that remain are
the three Group scroll plugins, `register-nodes.js` and `viewer.jsx`, none of which is a
node.

File counts: `noodl-viewer-react` **21 `.js` / 10 `.jsx` / 118 `.ts` / 37 `.tsx` →
4 `.js` / 1 `.jsx` / 137 `.ts` / 46 `.tsx`**. (The 118→137 gap is wider than this slice's
19 conversions by three files another workstream added in between; the `.js`/`.jsx` fall
is entirely this slice's.) `noodl-runtime` unchanged at 73 `.js` / 19 `.ts` — only
`internal.d.ts` was edited.

### 23.1 What made this group different from slices 5–8

The recipe carried over unchanged, but the *material* did not. These files are the oldest
in the package and were never touched by the intervening cleanups, so three things showed
up that the `nodes/` groups had already had fixed:

- **`var` hoisting used as control flow.** Three functions declare a `var` inside an `if`
  and read it *after* the block: `dbmodelnode`'s `renamed`, `dbcollectionnode`'s `_where`
  and `_sort`, and `_convertFilterOp`'s `schema`. A mechanical `var`→`const` rewrite turns
  each into a compile error, and a careless fix (moving the read inside the block) would
  silently change what gets sent to the editor. Each is now a `let` declared at the top of
  the enclosing function, with a comment saying why it is there.
- **`var` redeclaration in one scope.** `dbcollectionnode.updatePorts` declares
  `var filters` twice and `_convertFilterOp` declares `var m` twice. Legal with `var`,
  an error with `const`. Renamed (`sortFields`, and the second `m` was dead).
- **The definition object assigned over itself.** Five controls end
  `var XNode = {…}; XNode = createNodeFromReactComponent(XNode); export default XNode` —
  two different types in one binding. Split into a `const` definition and the module the
  factory returns.

> Rule for the remaining old code: before rewriting `var`, check whether the declaration
> and the read are in the same block. `tsc` catches the ones that break; it cannot catch
> the ones you "fix" into a different program.

### 23.2 The published types this slice corrected — three, and one was a lie

| What | Was | Is |
|---|---|---|
| `NodePanels` | `Record<string, unknown>` | `NodePanel[] \| 'none'` |
| `OutputPropertyLike.connections` | unpublished → error | published as `OutputConnectionLike[]` |
| `NodeContextLike.globalValues` / `globalsEventEmitter` / `setGlobalValue` / `getGlobalValue` | unpublished → `unknown` | published (§19.3 shape, fourth time) |

**`NodePanels` was the wrong shape entirely.** It was declared a record keyed by panel
name. It is a *list*: `sidebarmodel.tsx` does `panels.filter((x) => …x.name)` and takes
the first entry matching a registered panel, and it tests `panels === 'none'` before
that — a string sentinel the type had no room for either. Every in-repo definition that
sets `panels` (Component Inputs, Component Outputs, Globals, Animation) writes an array,
so the type has disagreed with all four of its users and with the editor since it was
written. Now `NodePanel[] | 'none'`, with the entry's four common fields named and the
rest left open, because everything past `name` is forwarded to the panel as its `args`.

**`connections` is not an internal.** The deprecated Animation node reads
`getOutput(name).connections[0].node.getInputValue(…)` to sample the value it should
animate *from* — that is the whole implicit-start-value mechanism. The published output
port had `hasConnections()` but not the list, so the one node that needs it could not be
typed. Publishing it forced the §13.2 rule again: `RuntimeNodeContext` had to gain the
four globals members before `RuntimeNode` was assignable to `NodeInstance` again, and
until it did, four unrelated-looking errors appeared in `node.ts` and `nodedefinition.ts`.

### 23.3 The defect that matters: the Globals node throws

`globals.ts`'s `_newOutputValueReceived` does `this._cachedInputValues[name] = …`.
**`_cachedInputValues` exists nowhere in `@noodl/runtime`** — not on `Node`, not on any
prototype, not assigned by any node. So the first time a global changes and a Globals node
has registered an *output* for that name, the listener throws
`TypeError: Cannot set properties of undefined`. This is the same shape as §19.4's
Pop Component Stack finding (`_createSignal`, an identifier that exists nowhere), found
the same way — by giving the instance a type and watching the member fail to resolve.

Left in place, declared optional with the explanation at the site. Both fixes are
behaviour changes: creating the cache makes the node work, and deleting the line also
makes it work, because the output getter reads `context.globalValues[name]` directly and
never consulted the cache. Somebody should pick one; this slice is not the place.

### 23.4 Five more defects found, documented at the site, not fixed

1. **`dbmodelnode`'s New input calls `this.storageNew()`** — a method this node does not
   have and `Node` does not provide. Same class of bug as the above: the New action has
   thrown for as long as the file has existed. (Insert, the neighbouring port, works.)
2. **`dbcollectionnode.setError` writes `_internal.err`, the getter reads
   `_internal.error`.** The `error` output has therefore never carried a message, though
   the `failure` signal does fire.
3. **`dbmodelnode._hasChangesPending` is both dead and inverted** — its only call site is
   commented out, and it returns `true` for the first property that is *equal*.
4. **`range`'s `_updateValuePercent` compares `_internal.valuePercentChanged`**, a field
   nothing assigns, so `valuePercent` is flagged dirty on every call rather than on change.
5. **`button`'s mount effect calls `focusChanged`/`hoverChanged`/`pressedChanged`** — three
   props nothing supplies. Harmless: `initialize` already zeroes the same three
   `outputPropValues`.

Two smaller ones recorded without a code comment: `numberedInputs.<name>.selectors`
(Signal To Index) is read by nothing — `registerSetupFunctionForNumberedInputs` builds its
ports from `type`, `displayPrefix`, `group` and `index` only; and `collectionnode`'s Clear
action calls `sendSignalOnOutput('count')` on a `number` output, which sends nothing.

Two *were* fixed, because the compiler would not take them and both are the §13.3 defect
DEBT-006 already ruled on: `numberblend` and the deprecated `variablenode` returned a bare
number / raw value from `getInspectInfo`, which renders as **nothing** in the editor's
inspector popup. Both now return a one-element `[{ type: 'value', value }]`, exactly as
DEBT-006 corrected `variablenode2`.

### 23.5 The §21.5 unwrap came back out, as predicted

`animation`, `numberblend` and `transition` carried the `.default || module` unwrap slice 9
added when it converted `easecurves` out from under them. All three are ES modules now, so
all three take a plain `import EaseCurves from '../../easecurves'` and the unwrap is gone.
That is the whole of §21.5's debt repaid.

**`register-nodes.js`'s unwrap stays, and so does the file.** §21.7's reasoning is
unchanged, but the reason has narrowed usefully: every *viewer* node in that `require()`
list is now TypeScript. What still needs the unwrap is the `@noodl/runtime` half —
`httpnode` and the five `byob-*` nodes — which is CommonJS and out of this task's scope.
The comment in the file now says so. Its nine `.jsx` control imports lost their explicit
extensions in the same change (§18/§19.2's hazard, handled the same way slice 8 did).

### 23.6 Verification

| Gate | Result |
|---|---|
| `typecheck:viewer` | **0 errors** in `packages/noodl-viewer-react/src/` (baseline 0) |
| `typecheck:runtime` / `typecheck:cloud` | clean |
| `catalog:check` | **byte-identical**, 154 node types, 89 dynamic, 24 port value types |
| `noodl-runtime` jest | **928 passing / 0 failing**, 34 suites (7 skipped) |
| `noodl-viewer-react` jest | 52 passing / 0 failing, 6 suites |
| viewer + deploy + ssr prod bundles | green (3 pre-existing asset-size warnings) |
| prettier | clean |
| eslint (`nodes-deprecated/**`) | 39 errors, all deliberate — see below |

The runtime jest baseline keeps moving: §21.8 recorded 384, and it is 928 now. Other
workstreams are adding suites; the figure to check is that it is unchanged across the
slice, not that it matches the last one written down.

The 39 eslint errors are `no-this-alias` ×32 (the `var self = this` closures §13.7 already
ruled deliberate), `no-explicit-any` ×4 (the open filter shapes in `dbcollectionnode`),
`ban-types` ×1 (the `(string & {})` literal-union idiom the whole package uses — `layout.ts`
carries the same error), `prefer-spread` ×1 (`Function.apply(null, args)`, which builds a
function from a source string) and `react/jsx-key` ×1 (a genuine missing `key` in the
deprecated Options node's `<option>` map; adding one changes React's reconciliation, so it
is a behaviour change, not a lint fix). None of these is gated: `.eslint-baseline.json`
targets `packages/noodl-editor/src` only. `controls/utils.ts` *is* clean — three helpers it
defined and never exported or called (`addInputCss`, `addInputs`, `addDynamicInputPorts`)
were deleted.

### 23.7 Traps

- **A stale Electron holds port 9222 and looks exactly like a live one.** The first
  live-pass attempt attached to a CDP target that answered `/json/list`, accepted the
  WebSocket, and then never replied to `Runtime.evaluate`. The cause was in the log:
  `bind() failed: Address already in use (48)` — an orphan from an earlier session still
  owned 9222, so the *new* stack could not start its devtools server and exited, leaving
  the orphan to answer. `pkill` without `-9` had not killed it. **Check
  `lsof -ti:9222` is empty after killing, and grep the log for `bind() failed` before
  concluding the renderer is wedged.**
- The §23.1 `var`-hoisting rule, restated: check the declaration and the read are in the
  same block before rewriting `var`.
- `Model` and `Collection` need the `as ModelModule` / `as CollectionModule` cast at
  import (the §17 convention) for `value instanceof Model` to narrow. Without it the
  `instanceof` compiles but narrows nothing, and the error lands on the `.getId()` after it.

## 24. Next slice

File counts: `noodl-viewer-react` **4 `.js` / 1 `.jsx` / 137 `.ts` / 46 `.tsx`**.
`noodl-runtime` unchanged at 73 `.js` / 19 `.ts`.

**Spec step 7 is finished.** There is no node code left in JavaScript in the viewer, and
the four `.js` files that remain are not nodes. The task's centre of gravity moves to
`@noodl/runtime`, which is where the untyped mass now is: 73 `.js` against 19 `.ts`.

1. **`@noodl/runtime`'s own node files** — `httpnode`, the five `byob-*` nodes and the rest
   of `src/nodes/`. These are the last consumers of `register-nodes.js`'s
   `module.default || module` unwrap, so converting them is what finally lets that go —
   and `register-nodes.js` with it (§21.7). Higher value than anything left in the viewer.
2. **The Group scroll plugins** — 3 files, 1,182 lines, `slide-scroll-plugin.js` 940 of it.
   Still the lowest value per line in the package: momentum physics with no type surface
   anyone imports. Fine to leave until last.
3. **`viewer.jsx`** — the 18th root file slice 9 left. Small, but it installs
   `context.setNodeFocused` and the global click handler, so it is the last untyped thing
   the visual nodes depend on.
4. **`register-nodes.js` last**, after (1), deleting the unwrap in the same commit.
5. **Decide the Globals-node crash** (§23.3) and `dbmodelnode`'s missing `storageNew`
   (§23.4 #1). Both are hard failures in registered, shipping nodes, and both need a
   decision rather than a conversion. They are the strongest candidates for a small
   behaviour-fixing commit of their own.
6. **Decide the six mis-flagged deprecated controls** (§21.1) — still open. `isDeprecated:
   false` on nodes hidden from the picker and superseded by `net.noodl.controls.*`.
   One line per file, moves catalog output.
7. **`@noodl/runtime` shipping `.d.ts`** — carried a fifth time (§12, §16, §18, §20, §22).
   §22's finding stands: the blocker is the missing `types` field and the absence of any
   build step, not the tsconfig. Its value keeps falling and item (1) would lower it
   further, since a converted runtime needs no declarations to be imported from source.
8. **Do not raise `strict`** (spec step 8). Unchanged: a global flip with concurrent
   workstreams in the same tsconfig. Step 9's editor-side sweep stays with PLAT-004.
