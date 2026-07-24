# PLAT-003 NOTES — Type the Runtime and Viewer

Status: slices 1, 2 and 3 landed 2026-07-24. Slice 1 restored the test toolchain (§1–§4). Slice 2
published the node-definition API and typed the runtime core — spec steps 1, 3 and 4 (§5–§7).
Slice 3 typed the React binding hub — spec step 6 (§9). Resume from **§10**.

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

## 12. Next slice

File counts now: `noodl-runtime` **73 `.js` / 19 `.ts`** (unchanged — slice 4 was viewer-side).
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
