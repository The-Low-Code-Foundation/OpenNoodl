# EXP-010 — Custom nodes, modules and prefabs export

**Status:** 🟢 **Route B built and driven (2026-08-28, session 34).** AC1–AC5 met and measured in a
browser; AC6 settled as a decision (§8). Route A is not built and is not owed by this task — see §9.
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

---

## §7 What was built — session 34

Route B, as §3 recommended, with one improvement it did not ask for: the shim is confined to a
single generated file and every *call site* is a typed React wrapper, so the emitted pages read as
ordinary React (`<Dial reading={42} onPress={…} />`) rather than as node-model plumbing.

**Parse.** `src/parse/parseModules.ts` reads `noodl_modules/` through
`@nodegx/module-inject`'s scanner — the LIB-003 one, not a fourth copy; the package gained a
`scanModuleManifestsSync` twin sharing the async one's core, because `parseProject` is synchronous
by contract. `src/parse/kitSource.ts` then *runs* each kit's `index.js` in a `vm` context and reads
its definitions, because a custom node's ports are declared nowhere else on disk. ⚠️ **Exporting a
project now runs that project's kit code on the machine doing the export.** That is stated in both
files rather than buried.

**Analysis.** A new `RenderRole`, `'custom'`. A kit node participates in the tree walk, its
parameters become props, its signal outputs become handler props (the `instanceSignalOutputs`
pattern, for the same reason — the wire parses as `'value'` because nothing static knows the port),
and its value outputs lift into local `useState` and bind. `dispositionForLogic` is kit-aware, so a
kit's logic node no longer reads `type X is not in the catalog`.

**Emit.** `src/emit/kits.ts` writes `src/kits/runtime.tsx` (the shim), one typed wrapper module per
kit, and the copy list. `EmittedApp` gained a `copies` channel — `files` is `Record<string, string>`
and a `.woff2` is not a string.

### The five things that were nearly wrong

1. 🔴 **A kit whose nodes the project does not use reached neither destination.** Kit scripts go to
   `src/kits/modules/` and everything else to `public/`; excluding *every* module's `main` from the
   verbatim copy meant an unused kit's `index.js` was in neither. That is this task's own defect,
   one directory over. The exclusion is now keyed on the scripts actually bundled, and a test
   asserts every module asset appears exactly once as a copy source.
2. 🔴 **`isStyledRole` returned true for a kit node**, so `computeNodeStyle` ran over ports it knows
   nothing about and reported *every* one as unmapped — six "dropped, reported" lines about
   `label`, `amount` and `day`, each of which the wrapper passes through perfectly.
3. 🔴 **The page collapse orphaned the AC3 markers.** A `Page` whose sole child is a `Group` rehomes
   that Group's children onto the page div; a marker still keyed to the Group would be looked up
   under an id the emitter never renders — the one line in the file saying "something was here"
   would itself have disappeared.
4. ⚠️ **The drive could not tell the two signals apart.** Both fired into the same popup slot, so
   the second to arrive satisfied the observation whether or not the first ever ran. The fixture's
   dial now has two separate targets.
5. ⚠️ **The icon `codeAsClass` question was left alone deliberately.** The runtime reads
   `codeAsClass` from the *parameter*, not the manifest (`IconGlyph.tsx:63`), and the editor writes
   it there at pick time. Teaching the export to consult the manifest would have made it render
   **differently from the running app** — which is the opposite of what shipping the stylesheet is
   for. `cn015-editor-drive`'s icon parameter lacks the flag, so it renders as text in the preview
   too; that is a fixture defect, not an export one.

## §8 The acceptance criteria, and how each was measured

Suite: `packages/nodegx-export/tests/custom-nodes.test.ts` (34 tests) over
`tests/fixtures/kits`, a project carrying one of every module shape — a kit that loads, one that
throws, one whose `index.js` is missing, an ES-module build, a plain library, and an icon set with a
binary font.

| AC | Verdict | How |
|---|---|---|
| 1. Nodes render | ✅ | **Driven.** `cn027-drive` — a real 25-component site — exported, `tsc -b && vite build` clean, and headless Chrome shows all four of its custom nodes: `SSRPROBEPILL`, `BADGE:(none)`, `GROW-ALPHA:GROWTAG`, `BROKEN-KIT-INTACT:v1`. Every one was a hole in the JSX before. |
| 2. Ports both ways | ✅ | **Driven, each path separately.** From a fresh load: clicking `[data-dial-press]` (an `outputProps` signal) shows `SIGNAL-PRESSED`; clicking `[data-dial-settle]` shows `SIGNAL-SETTLED` (an `outputs` signal fired by `sendSignalOnOutput` from `initialize`, with no `outputProps` entry — the shape a partial reader loses) **and** puts `42` into a bound `<p>` (the `liveReading` value output). Parameters are visible in the render itself. |
| 3. Nothing dropped silently | ✅ | Three shapes: a node whose kit did not load leaves a `{/* TODO(export): … */}` **in the emitted file**; a parameter or wire naming a port the kit no longer declares says *the running app delivers nothing there either* rather than "deferred"; a kit's logic node is named as out of scope. |
| 4. A broken kit does not take the app down | ✅ | Five of six modules in the fixture cannot contribute a node; the page still exports with its built-ins, its working kit nodes and its state. Each failure is named once with its own status (`threw` / `unreadable` / `es-module` / `no-define-module`), and a module that loaded or has nothing to load is **not** in the report. |
| 5. Assets ship | ✅ | **Over real HTTP.** `/noodl_modules/dots-icons/dots.woff2` → 200; `styles.css` → 200 with its relative `url(dots.woff2)` intact, because the folder is copied verbatim rather than put through the bundler. The stylesheet is `<link>`ed from `index.html`. A binary is a copy, never a string in `files`. |
| 6. The picker ratchet | ✅ *(decision)* | See below. |

**AC6 — settled, and deliberately not a number.** Custom node types stay out of the picker
denominator and out of `coverage-ledger.json`; the decision and its reasoning are recorded in that
file's `$customNodesComment`, which is where someone asking "where are custom nodes?" will look.
The short version: a custom type's population is per-project and unbounded, so a percentage over it
has a denominator that moves with whichever project you point the tool at — which is exactly the
instance-weighted corpus number this phase lost twelve sessions to. The claim is categorical
instead: **a kit's visual nodes export and render; a kit's logic nodes do not, and every instance
is named.** `tests/custom-nodes.test.ts` is the ratchet for it.

### Regression net

47 corpus projects parse and emit, 0 failures. 24 have modules — mostly the bundled Inter font and
Lucide icon set, which now ship and link in every one of those exports. Full suite 554/554;
`@nodegx/module-inject` 31/31; `export-ledger:check` and `export-ledger:picker` (51/127) unchanged.

## §9 What is left

- **Route A** — a generated wrapper per node kind with no shim at all. Needs the kit-format
  convention §6 asks phase 69 to settle. Route B is the floor it gets diffed against, and nothing
  about it is load-bearing: a node kind can be moved to Route A one wrapper at a time.
- **A kit's logic nodes** (`nodes:` rather than `reactNodes:`). `tally-kit` is an entire vocabulary
  of them and every instance exports as a named deferral. They are `set`/`get` functions over
  `_internal` — the same shape the shim already drives for visual nodes — so this is a smaller
  slice than it sounds, but it is a slice.
- **npm-dependency kits**, still out of scope (§5). Every kit on this machine has
  `dependencies: []`; when one does not, the export has to merge them into the emitted
  `package.json`.
- **The `broken-kit` fixture no longer breaks.** An earlier session repaired it ("Repaired: the
  syntax error is gone"), so `cn015-editor-drive` no longer covers the throwing case it was built
  for. `tests/fixtures/kits/noodl_modules/thrower-kit` covers it now; the drive fixture does not.
