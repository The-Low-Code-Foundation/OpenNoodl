# PLAT-003 NOTES — Type the Runtime and Viewer

Status: slice 1 (toolchain restoration) landed 2026-07-24. This records the as-built state of
Implementation Step 2's prerequisite — the characterisation safety net — which turned out not to
exist in runnable form.

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

## 5. Next slice

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
