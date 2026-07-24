# REV-002 — Notes and Follow-ups

Findings from restoring the editor test harness that are out of scope for REV-002
itself but must not be lost.

## Root cause of the harness failure

`ELECTRON_RUN_AS_NODE=1` was present in the inherited environment. VS Code sets it
in integrated terminals and in the extension host, so the suite failed inside the
editor and would have passed in a bare terminal on the same machine — which is why
`PROGRESS-dishant.md` could report it green in February while it was dead here.

With that variable set, the Electron binary boots as plain Node and
`require('electron')` returns the CLI shim path rather than the API object, so
`app` is `undefined` before any test code runs.

Fixed by stripping the variable in `scripts/test-editor.ts` and in the new
`packages/noodl-editor/scripts/run-electron-tests.js`, plus an explicit guard in
`test.js` so the next occurrence self-explains.

## Baseline

540 specs run. 539 pass, 1 quarantined.

## Quarantined specs

### `tests/components/componentinstances.js` — "can rename component inputs and outputs"

**Marked `xit`. This is a real editor bug, not test rot.**

Renaming a port on a component's input/output node does not propagate to instances
of that component in other graphs: connections keep the old property name, and
parameter values are not migrated to the new name.

The machinery exists but the chain does not complete:

1. `NodeGraphNode.renamePortWithName` fires `nodePortRenamed` on its own graph —
   works, and the rename is correct within the defining component.
2. `ComponentModel.bindGraph` forwards that as `portRenamed` on the component
   model, gated on `args.model.type.haveComponentPorts`.
3. `NodeGraphModel.bindTypeModel` is the consumer that rewrites instance
   parameters and connections — this is where it stops.

Worth confirming whether `bindTypeModel` is ever called for a graph containing
instances of the renamed component, versus only for the graph's own type.

User-visible impact: renaming a component input in the property panel silently
breaks every existing wiring to it. Needs its own task.

> **FIXED 2026-07-25 by DEBT-004.** The step-3 suspicion was exactly right, one
> level deeper: `bindTypeModel` *was* called for the instance graph, but the
> graph held a **single** `typeModel` slot, so every later node type that
> resolved evicted the component's `portRenamed` listener — only the
> last-bound type in a graph ever propagated renames. Graphs now keep every
> distinct node type bound (`boundTypeModels` set, released in `dispose`).
> All three `xit` quarantines in `componentinstances.js` are re-enabled and
> passing (1153 specs, 0 failures). Two test-side causes were also fixed and
> recorded in the spec file: `ProjectModel.fromJSON` keeps references into the
> fixture, so the rename spec mutated the shared fixture for every later spec
> (now deep-copied per spec), and the unhealthy-connections spec had encoded
> that leakage (`p3b`) plus connection-derived port semantics that no longer
> exist (rewritten against today's WarningsModel behaviour).

## Order-dependent specs (not quarantined)

`tests/nodegraph/export.js` — "calculated dependencies for bundles" and "can export
an index that includes pages and for each nodes" — pass or fail depending on
Jasmine's random spec order. They assert exact bundle names (`b0`…`b4`) and
grouping, and the first of them carries its own comment:

> this test assume the bundles are emitted in a specific order
> it makes the test tied to implementation specifics, so not great

The suite shares global state across specs (`ProjectModel.instance`, `NodeLibrary`
module registration), so randomized order made the whole run non-deterministic.
`tests/SpecRunner.html` now sets `jasmine.getEnv().configure({ random: false })`.

That makes the gate trustworthy but does not fix the underlying coupling. Two
follow-ups worth tracking:

- Make the export bundler assertions order-independent (assert bundle *contents*
  and the dependency graph shape, not the `bN` labels).
- Isolate global state between specs so randomized order can be turned back on.

## Jest-flavoured specs in a Jasmine runner

Five spec files were written against Jest and never ran anywhere — the editor suite
is Jasmine, and `npm run test:platform` (the only Jest runner) covers
`@noodl/platform-node` only.

- `tests/utils/ParameterValueResolver.test.ts` — converted and now running. Its
  `@jest/globals` import threw at module load and took down the **entire** run,
  which is what the harness surfaced first once Electron booted.
- Still dead, excluded via `tests/models/index.ts`:
  - `tests/models/UBASchemaParser.test.ts`
  - `tests/models/ElementConfigRegistry.test.ts`
  - `tests/models/ProjectCreationWizard.test.ts`
  - `tests/models/StyleAnalyzer.test.ts` (also uses `jest.mock`, needs real work)

The first three use no Jest-specific APIs beyond the import and should convert
cheaply — that is unverified test coverage sitting on the floor. Worth a small
follow-up task.

## Product bug found and fixed here

`ParameterValueResolver.toNumber(null)` returned `0`. Its own docblock specifies
`undefined`, and `Number(null) === 0` was silently turning "no value" into a real
zero. Fixed in `src/editor/src/utils/ParameterValueResolver.ts`. There are no
production callers yet, so the blast radius was nil — but this is exactly the class
of bug that five months of unrunnable tests hides.

## Environment noise seen during runs

The git specs log `Git could not be found at the expected path:
.../packages/node_modules/dugite/git/bin/git` — one directory level off from the
`LOCAL_GIT_DIRECTORY` that `scripts/test-editor.ts` passes. The specs still pass,
so this is a fallback path being tried before the configured one, but it produces a
lot of noise and slows the run. Worth a look during REV-003.
