# EXP-010 — Custom nodes, modules and prefabs export

**Status:** 🔴 Not started (new, 2026-08-28, session 32)
**Depends on:** EXP-002 (props, callback props and lifted outputs already exist)
**Related:** phase 69 (`dev-docs/tasks/phase-69-the-node-you-write-yourself/`) — the authoring side

---

## §1 What is wrong today

`packages/nodegx-export/src/parse/parseProject.ts` contains **zero references to
`noodl_modules`**. The directory is never opened.

A node from a custom kit therefore has no catalog entry, so the planner reaches
`dispositionForLogic` and files it as:

```
type nodegx.cashflow.Pill is not in the catalog
visual child of probe-group with no deterministic generator (nodegx.cashflow.DangerBanner)
```

…and the node **disappears from the emitted JSX with no marker in the file**. A user who built
their app around a kit the MCP wrote for them gets an export with holes in it and no indication of
where.

This matters more every release: phase 69 shipped custom nodes as a headline capability, the MCP
writes them on request, and prefabs and kits are how a NodeGX project is meant to grow. **Every
one of them currently exports to nothing.**

## §2 The good news: they are already React

`noodl_modules/<kit>/index.js` is a plain file with a manifest beside it. The node definitions
inside it look like this (`cashflow-kit`, `nodegx.cashflow.Pill`):

```js
var MoneyPill = {
  name: 'nodegx.cashflow.Pill',
  displayNodeName: 'Money Pill',
  getReactComponent: function () { return PillComponent; },   // ← a real React component
  inputProps: {
    label:  { type: 'string', displayName: 'Label',  group: 'Content' },
    amount: { type: 'number', displayName: 'Amount', group: 'Content', default: 0 },
    …
  },
  outputProps: { onClick: { type: 'signal', displayName: 'Click' } },
  outputs: {
    liveDay: { type: 'number', get: function () { return this._internal.liveDay; } },
    …
  },
  initialize: function () { /* wires the component's callbacks into _internal + flagOutputDirty */ }
};
```

The component is written with `window.React` and `React.createElement` — no JSX build step, no
bundler, no npm install. **It is the same React the export targets.** The Noodl-specific part is
only the binding: `inputProps` → props, `outputProps` → callbacks, `outputs` → values the graph
can read, `initialize` → the glue between them.

And the export already has a translation for every one of those three shapes:

| kit concept | what EXP-002 already emits for the built-in equivalent |
|---|---|
| `inputProps` | props, with defaults and the content/style split |
| `outputProps` (signals) | callback props — the Component Outputs slice |
| `outputs` (values) | lifted state + push effects — `liftedOutputProps` |

So this is **mapping work against machinery that exists**, not a new subsystem. That is why it
sits above most of the picker gap despite sounding harder.

## §3 Two routes, and the recommendation

### Route A — generate a typed wrapper per custom node *(recommended)*

Copy the kit into the exported repo, emit one small React wrapper per node type that maps ports to
props and hoists the value outputs into state, and render that wrapper from the JSX like any other
component.

- ✅ Output is idiomatic React a developer can read and edit — the phase's exit criterion.
- ✅ No Noodl runtime concepts in the exported app.
- ✅ Uses the existing props/callback/lifted-output machinery.
- ⚠️ Needs the kit's component to be reachable as a value. Today it is inside an IIFE that
  registers via `Noodl.defineModule` and reads `window.React`, so the export needs either a small
  loader shim or a documented export convention for kits (which phase 69 should own — see §6).

### Route B — ship the kit verbatim with a minimal node shim

Copy `noodl_modules/` into the output, provide `window.React`, and render each custom node through
its own `getReactComponent()` behind a tiny shim that implements `_internal`,
`flagOutputDirty` and `sendSignalOnOutput`.

- ✅ Fastest to working, and correct by construction — it runs the kit's own code.
- ✅ Zero per-kit work; every existing kit works the day it lands.
- ❌ Puts a slice of the Noodl node model into the exported app, which the phase has otherwise
  spent 30 sessions keeping out (`EXP-002-TARGET-OUTPUT.md` headline: *zero `@nodegx/core`
  imports*).

**Recommendation: build Route B first as the correctness floor, then Route A per node kind.** B
makes custom-node apps export *working* immediately and gives A a reference to diff against —
which is the pattern this phase has used successfully all along (hand-write the target, then
generate it). Do not let A's elegance delay B's correctness.

## §4 Acceptance criteria

1. **A project using a custom kit exports and the nodes render.** `cn015-editor-drive` /
   `cn001-kit-drive` build and show the kit's nodes, not holes.
2. **Ports work in both directions.** An input parameter reaches the component; a signal output
   (`onClick`, `dropped`) fires the parent's handler; a value output (`liveDay`) updates a binding.
3. **A node the export cannot handle is named in the artefact**, not dropped silently — see
   EXP-004. This is the acceptance criterion that stops this task recreating the original defect.
4. **A kit with a broken or missing `index.js`** (`broken-kit`, `gone-kit` in the drive fixtures
   exist for exactly this) exports the rest of the app and reports the kit, rather than throwing.
5. **Assets ship.** `noodl_modules/<kit>/styles.css`, fonts and sprites referenced by the kit land
   in the output and are linked. The icon sets (`lucide-icons`, `inter`) are the test case, and
   `iconsets.ts` already documents that `noodl_modules/` ships verbatim in a deploy.
6. **The picker ratchet moves.** Custom node types are not in the catalog and so are not in the
   picker denominator — but a project-catalog overlay exists (phase 69 CN-003). Decide whether
   custom nodes get their own coverage line rather than silently sitting outside the number.

## §5 Out of scope

- **Cloud-side custom nodes** (phase 69 CN-013) — the frontend export never runs them.
- **Authoring** custom nodes. This task consumes what phase 69 produces.
- **npm-dependency kits.** `manifest.json` has a `dependencies` array; every kit on this machine
  has it empty. When one is non-empty, that is a second slice (the export would have to merge them
  into the emitted `package.json`).

## §6 One thing to settle with phase 69

Route A needs a kit's React component reachable as a value. That is a small, additive convention
on the kit format — e.g. the module may attach its components to the definition object, or export
them — and it belongs in phase 69's authoring contract rather than being reverse-engineered here.
**Agree it there, then build Route A against it.** Route B needs nothing from anyone.
