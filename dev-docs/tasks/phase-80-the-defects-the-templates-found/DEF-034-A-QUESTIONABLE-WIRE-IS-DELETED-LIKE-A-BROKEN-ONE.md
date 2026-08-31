# DEF-034 — a wire the editor calls *questionable* is deleted from the build like a broken one

**Status: ✅ CLOSED** (session 32). Measured, fixed, specced. **AC5 (a drive) is owed.**

**Registered by**: DEF-028 §6, this phase. Derived from source; **blast radius unmeasured until now.**

---

## The defect

`WarningsModel.getWarnings` did not filter by level. So **any** recorded warning on a connection made
`getConnectionHealth` return `healthy: false`, and `exportComponent`'s filter drops every unhealthy
wire.

Seven connection keys exist. **Five are `level: 'error'`. Two are `level: 'warning'`, and both
describe wires that _work_:**

| key | filed by | what it says |
| --- | --- | --- |
| `con-target-port-gated` | FB-021 | a wire into a `basic`-gated port — *"is valid and its value is ignored"* |
| `con-type-unconverted` | FIX-025 | `string → number` / `string → boolean` — the value arrives, unconverted |

🔴 **The register named only the first.** The population was two keys, not one. `con-type-unconverted`
is Richard's own report of 2026-08-20, and its wires were being deleted too.

## Why deleting them is worse than keeping them

🔴 **The gate is evaluated against a SAVED PARAMETER, and the running app is not obliged to stay in
that state.** `evaluateDynamicPortsCondition` reads `getParameter(gate)`. A gate driven by a **wire**
sets no parameter, so the editor reads the port's *default*, calls the port switched off, and the
export removes the wire. When the gate flips at runtime the port goes live with **nothing delivering
a value** — permanently, with nothing in the artefact saying so.

For `con-type-unconverted` the argument is simpler. FIX-025's ruling was *"it does not refuse the
connection"*, because *"nothing that connects today stops connecting"*. Deleting the wire from the
build refused it anyway, one layer down.

---

## The measurement — "may cost nothing" is refuted

Swept **179 projects** on this machine (118 legacy `project.json`, 61 v2 directories): 5,471
components, 72,901 connections.

**Instrument**: the **real** `evaluateDynamicPortsCondition`, `reasonsForGatedPorts` and
`unconvertedCast`, bundled from `src` with esbuild; the shipped `node-catalog.json` for port
declarations, defaults and types; `isConditionalPortValid` transcribed **verbatim** from
`nodelibrary.ts:491` — it cannot be bundled, because `NodeLibrary` drags in the renderer.

| | wires deleted from the build |
| --- | --- |
| `con-target-port-gated` | **290** |
| `con-type-unconverted` | **23** (18 `string→boolean`, 5 `string→number`) |
| **total** | **313**, across **35 projects** |

**By gate port**: `useLabel` 190 · `flexDirection` 30 · `sizeMode` 23 · `borderStyle` 23 ·
`useIcon` 17 · `pointerEventsMode` 4 · `borderBottomStyle` 3.

### 🔴 The 27 that settle it

**27 of the 290 have the gate port itself driven by a wire** — a `States` node or a Component Input
feeding `flexDirection`, `useIcon`, `borderStyle` or `useLabel`. They live in **reusable
components**: `Secondary Button`, `Text Input`, `List Item Base`, `Pretty button`, `Toggle Switch`,
`Popup Small Template`, `Deal Table`. A parameter arriving from outside is the entire point of such a
component, and it is exactly the case the editor's saved-parameter reading cannot see.

**Verified end-to-end** on `LearnBook › /Global visual components/Pretty button`: a `Group` with
`flexDirection: "row"` saved, and a `States` node wired into `flexDirection`, `rowGap` and
`columnGap`. `rowGap` applies when `flexDirection = column OR flexWrap = wrap…` → false against the
saved parameter → the `vertical gap` wire was deleted from the build. When the state selects
`column`, the gap it was wired to deliver is gone.

### ✅ Both shipped templates measured 0

Site Builder **0 of 412** connections; TPL-001 (materialised *Members area*) **0 of 273**.

🔴 **This was never observable from the templates** — which is exactly why the register could only
say *"it may cost nothing"*. The population that pays for it is authored projects.
✅ **A defect measured only against what ships can read zero on a real bug.**

### The controls

The zero on Site Builder was read **before** any positive control existed, and a control was then
built rather than assumed: a `Group` with `sizeMode: contentSize` and a wire into `width` reports a
drop (**1**), and the same graph with `sizeMode: explicit` reports **none**. The pair disagrees, so
the instrument can see the thing whose absence it was reporting.

### What the instrument cannot see — stated, not implied

- **Variants.** 41 of the 290 target nodes carry a variant whose parameters could set the gate. Those
  41 are an **upper bound on false positives**. They do not touch the 27: a variant supplies a
  default, and a wire overrides a default at runtime regardless.
- **`stateParameters`.** 7 rows set the gate in a non-neutral visual state — the wired-gate argument
  in a second form.
- **`con-type-unconverted`'s 23 is a FLOOR, not a total.** 51,538 connections had a source port the
  catalog does not declare (component instances, schema-derived and other dynamic ports), so their
  cast could not be evaluated. 23 is what the catalog alone can prove.
- **Runtime-minted ports** (DEF-035's territory) are outside this reading entirely.

---

## The fix

`args.levels` — **the option this model already speaks.** `forEachWarningInComponent`,
`getAllWarningsForComponent` and `getNumberOfWarningsForComponent` all take it. `getWarnings` was the
one reader of the store that could not ask the question.

1. `WarningsModel.getWarnings(ref, args?)` — narrows by level. **Omitting it returns every level,
   exactly as before**, so no existing caller changes.
2. `NodeGraphModel.getConnectionHealth(c, args?)` — passes it through.
3. `exportComponent` — passes `{ levels: ['error'] }`.

🔴 **The canvas is deliberately untouched.** FB-021's dash is Richard's ruling, and it is drawn from
the *unfiltered* verdict, so `NodeGraphEditorConnection` still dashes a gated wire. The narrowing is
opt-in and only the exporter opts in.

⚠️ **`setWarning` normalises an absent level to `'warning'`, not `'error'`.** This phase has already
been bitten by an absent key meaning opposite things to two readers, so the fix does **not**
re-decide it — it honours the model's own ruling, and a spec asserts it. All seven connection keys
carry an explicit level, so nothing in the current population depends on that default.

✅ **One filter, eight call sites.** DEF-028 put the health flush inside `exportComponent` for that
reason, and this change inherits it: viewer bundles, incremental preview, export, deploy, cloud
functions and the AI sandbox all get it by construction.

## Acceptance criteria

- **AC1 ✅** A wire carrying only `level: 'warning'` verdicts survives `exportComponent`.
- **AC2 ✅** A wire carrying a `level: 'error'` verdict is still dropped.
- **AC3 ✅** `getConnectionHealth` with no args still calls a gated wire unhealthy, so FB-021's dash
  is unchanged.
- **AC4 ✅** Both warning keys are raised by the **real** evaluator in the spec, not written into
  `WarningsModel` by hand.
- **AC5 ⚠️ OWED — a drive.** Nobody has taken a build in a real editor of a project with a
  gate-wired port and confirmed the wire is in the artefact. 🔴 A drive serves a **built bundle** —
  `noodl-preview/dist` is stale until rebuilt. `LearnBook › Pretty button` is the named fixture.

## Files

- `packages/noodl-editor/src/editor/src/models/warningsmodel.ts` — `getWarnings(ref, args?)`
- `packages/noodl-editor/src/editor/src/models/nodegraphmodel/NodeGraphModel.ts` — `getConnectionHealth(c, args?)`
- `packages/noodl-editor/src/editor/src/utils/exporter/util.ts` — `{ levels: ['error'] }`
- `packages/noodl-editor/tests/nodegraph/def-034-warning-level-wires-survive-the-build.spec.ts`
- `packages/noodl-editor/tests/nodegraph/nodelibrary.js` — adds `def034Node`
- `packages/noodl-editor/tests/nodegraph/index.ts` — registered (a spec absent here never runs)

## Traps this row paid for

- 🔴 **A register row can name half its population.** The row said `con-target-port-gated`; the
  predicate was `level: 'warning'`, and a second key was already sitting in it. ✅ **Re-derive the
  population from the PREDICATE, not from the example the row happens to name.**
- 🔴 **A defect measured only against what SHIPS can read zero.** Both templates: 0. The corpus: 313.
- 🔴 **A backgrounded command's exit code lies.** The harness reported `exit code 0` for a `test:ci`
  run whose log ends in `npm error code 1` and five TS errors. ✅ **Read the log, not the code.**
- ⚠️ **This runner has no `toHaveLength`.** `expect(x.length).toBe(n)`.
