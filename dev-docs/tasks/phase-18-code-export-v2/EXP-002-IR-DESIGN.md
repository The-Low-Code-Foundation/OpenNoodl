# EXP-002 step 1 — the intermediate representation, designed as a contract

> "The IR matters more than it might appear — it is the boundary EXP-003 and EXP-005 also work
> against, so design it as a shared contract rather than an internal detail of this task."
> — [EXP-002](./EXP-002-DETERMINISTIC-GENERATORS.md)

This document is the IR design. It was written after, and is disciplined by, two hand-writing
exercises: [EXP-001-TARGET-OUTPUT.md](./EXP-001-TARGET-OUTPUT.md) (four components → the runtime
API) and [EXP-002-TARGET-OUTPUT.md](./EXP-002-TARGET-OUTPUT.md) (a whole project → the generator's
decisions). Every structure below exists because one of those exercises, or a named consumer
(EXP-003 trace verification, EXP-004 report, EXP-005 porting, EXP-006 intent, EXP-007 provenance),
demanded it.

## Where it sits, and what it is not

```
v2 files ──parse──▶ Graph IR ──analyse──▶ Emit Plan ──emit──▶ ts-morph AST → Prettier → files
(components/*/nodes.json,      (faithful,          (decisions:              + export-manifest.json
 connections.json,              typed,              dispositions, names,
 nodegx.project.json,           catalog-            file plan, routes,
 node catalog)                  resolved)           stubs)
```

**The shared contract is the Graph IR plus the manifest.** EXP-003 reads Graph IR nodes (source
text, ports, ordering) and writes verdicts into the manifest; EXP-004 renders the manifest;
EXP-005 consumes the emitted codebase but *propagates* manifest verdicts; EXP-007's `--check`
compares a directory against the manifest. The Emit Plan is EXP-002-internal and may change
freely.

The IR is **plain serialisable data** — no live editor models, no methods, no `Map`s (stable-order
arrays only, because JSON round-trips and golden tests demand defined order). Parsing **never
drops and never fails on content**: an unknown node type, a script-shaped parameter, a port set
that cannot be known statically — all parse into the IR and become *dispositions*, not errors.

## Identity: adopted, never minted

| Thing | Key | Source of authority |
|---|---|---|
| Node | `id` from `nodes.json` | SUB-012: the substrate's primary key |
| Connection | `` `${fromId}:${fromProperty}->${toId}:${toProperty}` `` | `GraphSnapshot.connectionKey` — EXP-006 wire labels are keyed by exactly this string; minting our own breaks label matching on rewired graphs |
| Component | `path` (`"Pages/Landing"`) and `id` | `component.json`; the `/`-prefixed legacy form appears only where a node's `type` references a component |
| Catalog | `catalogFormatVersion` + package versions | the catalog artifact itself — read, not hardcoded (EXP-007's Rise lesson) |

## The Graph IR

```ts
interface ExportIR {
  project: ProjectIR;
  components: ComponentIR[];   // sorted by path (codepoint order) — determinism rule D1
}

interface ProjectIR {
  name: string;
  catalogFormatVersion: string;
  exporterVersion: string;
  designTokens: TokenIR[];               // source order preserved (they render as tokens.css)
  collections: CollectionIR[];           // from metadata.dbCollections — typed stubs come from these
  routers: RouterIR[];                   // router name → ordered page component paths
  fontModules: FontModuleIR[];           // noodl_modules with font manifests
}

interface ComponentIR {
  id: string;
  path: string;                          // "Pages/Landing"
  role: 'page' | 'component';            // from component.json `type`
  nodes: NodeIR[];                       // source order from nodes.json — D2
  connections: ConnectionIR[];           // source order from connections.json — D2
  intent: AuthoringIntent;               // EXP-006's bundle, arrays not Maps
}

interface NodeIR {
  id: string;
  type: string;                          // catalog typeName, or "/Components/PuppyCard" for instances
  catalogRef: string | null;             // resolved catalog entry; null ⇒ component instance or unknown type
  authoredLabel?: string;                // present only when the serialized key was present (EXP-006 trap:
                                         //   never read via a live model's defaulting getter)
  parameters: ParamIR[];                 // sorted by name — D3 (v2 JSON object order is not authoritative)
  declaredPorts: PortIR[];               // dynamicports from the file, merged with catalog ports
  portKnowledge: 'complete' | 'partial' | 'unknown';
                                         // 'unknown': Function-style nodes whose outputs only execution
                                         //   reveals; EXP-003 back-fills via `resolvedPorts`
  resolvedPorts?: PortIR[];              // written by EXP-003 from traces; absent until then
  sourceText?: string;                   // Function/Expression/mapping-script body, VERBATIM — the LLM
                                         //   payload, and the fallback comment when unverified
  parent?: string;
  children?: string[];                   // visual tree, order = render order — D2
}

interface ParamIR {
  name: string;
  value: ParamValue;
}

type ParamValue =
  | { kind: 'literal'; value: string | number | boolean }   // "var(--x)" passes through as a literal
  | { kind: 'dimension'; value: number; unit: string }      // {value: 340, unit: "px"}
  | { kind: 'expression'; source: string }                  // any input may carry one (EXP-003 §demands)
  | { kind: 'script'; source: string }                      // codeeditor-typed params (mapping scripts…)
  | { kind: 'json'; value: unknown };                       // structured editor values (query filters…)

interface PortIR {
  name: string;
  plug: 'input' | 'output';
  kind: 'value' | 'signal';              // from catalog `isSignal` / type — NEVER flattened; EXP-003's
                                         //   equivalence counts and orders signals
  type?: string;                         // catalog/declared port type name, when known
  default?: unknown;
}

interface ConnectionIR {
  key: string;                           // the adopted connectionKey — see identity table
  fromId: string; fromProperty: string;
  toId: string;   toProperty: string;
  kind: 'value' | 'signal';              // from the source port's kind
  label?: string;                        // wire label — irrecoverable if dropped; must land as a comment
                                         //   on the statement the wire becomes (joined when several
                                         //   collapse onto one line). Never read Connection.annotation.
}

interface AuthoringIntent {              // CAN-005's bundle, serialisable form
  nodeComments: Array<{ nodeId: string; text: string }>;
  wireLabels: Array<{ connectionKey: string; text: string }>;
  regions: Array<{ text: string; nodeIds: string[] }>;   // ordered, outermost first
  componentDescription?: string;
}
```

Ordering inside a node's emission is **not** IR data — it is the emit rule from EXP-001 §4:
value outputs land before the signal that follows them, as sequential statements, and
`@nodegx/core` notifying synchronously is what makes statement order sufficient. The IR's job is
merely to never lose which outputs a signal followed; connection source order (D2) carries that.

## Dispositions — analysis output, the coverage report's raw material

Analysis assigns every node a disposition; nothing is silent:

```ts
type Disposition =
  | { kind: 'static' }                          // this task generates it
  | { kind: 'collapsed'; into: string }         // erased into another construct: a RouterNavigate
                                                //   becoming a handler, Component Inputs becoming props,
                                                //   an identity map({...}) becoming .map() — the node
                                                //   emits no artifact of its own
  | { kind: 'deferred'; to: 'EXP-003'; reason: string }   // Function/Expression/dynamic ports/
                                                          //   non-literal mapping scripts
  | { kind: 'stubbed'; reason: string }         // DB/cloud/auth nodes → typed stub + report entry
  | { kind: 'unknown-type'; reason: string };   // type not in catalog, not a component — reported,
                                                //   emitted as a commented placeholder
```

Dispositions live in the **manifest**, not in `NodeIR` — they are decisions about the graph, not
facts of it, and EXP-003 later upgrades `deferred` nodes with verdicts in place.

## The manifest — the durable sidecar

`export-manifest.json`, emitted beside the code, is the artifact that outlives the export run:

```ts
interface ExportManifest {
  exporterVersion: string;
  catalogFormatVersion: string;
  files: Array<{
    path: string;                        // 'src/pages/Landing.tsx'
    kind: 'component' | 'page' | 'store' | 'logic' | 'api-stub' | 'styles' | 'scaffold';
    sources: Array<{ componentPath: string; nodeIds: string[] }>;
                                         // EXP-007's node-set→file relation; single-node files also
                                         //   get an @nodegx:node-id header marker, aggregates omit it
    contentHash: string;                 // SHA-256 of body excluding the header — EXP-007's
                                         //   load-bearing marker, duplicated here for --check
  }>;
  nodes: Array<{
    componentPath: string;
    nodeId: string;
    disposition: Disposition;
    emittedAs?: Array<{ file: string; symbol: string }>;
                                         // 'appendYourMessage' in 'src/logic/…' — how EXP-003's
                                         //   harness finds the code a trace replays against
    verdict?: 'verified' | 'mismatched' | 'unverified';   // EXP-003 writes; EXP-005 must propagate
  }>;
  dropped: Array<{ what: string; where: string; reason: string }>;
                                         // EXP-006's rule: nothing silently dropped — an intent
                                         //   region with no surviving statements, a label on an
                                         //   optimised-away wire, all land here for EXP-004
}
```

This resolves EXP-005's requirement without giving it the IR: verdicts and provenance travel in a
file the port pipeline can read and rewrite, and EXP-007's `--check` gets its orphan/stale
classification by diffing a directory against `files[]`.

## Determinism rules (the D-numbers)

| # | Rule |
|---|---|
| D1 | Components sort by `path`, codepoint order |
| D2 | Nodes, connections, children keep **source file order** — the substrate's own serialisation is already deterministic, and preserving it keeps exports diffable against graph diffs |
| D3 | Parameters sort by name within a node (JSON object key order is not trusted) |
| D4 | Generated imports: external packages first, then internal by path, both codepoint-sorted (Prettier does not reorder imports; the emitter must) |
| D5 | Derived names (class names, symbols, files) come from author ids/names via pure functions; collisions resolve by first-wins in D1/D2 order with numeric suffixes |
| D6 | `@nodegx:generated-at` is the **only** non-deterministic byte in an export; golden tests strip the header line; `content-hash` excludes the header by definition |
| D7 | The manifest's arrays follow D1/D2; the manifest is golden-testable minus `generated-at` |

## What the IR deliberately does not have

- **No React vocabulary.** Nothing in the Graph IR says "prop", "hook", or "JSX" — ADR-001 chose
  primitives so other renderers stay possible, and the analysis/emit layer owns the React mapping.
  (EXP-005 ports the *output*, but a future native backend would re-enter at the Emit Plan.)
- **No `Node`/`Port` runtime objects, no per-port queues** — rejected in EXP-001; the IR describes
  the graph, the emitted code describes the behaviour.
- **No resolved style values.** `var(--token)` stays textual (`literal`); the token layer is the
  design system and survives export (TARGET-OUTPUT §3). This also keeps the style representation
  renderer-agnostic enough for ADR-003's CSS-Modules-default/Tailwind-option split.
- **No pre-rendered comments.** Intent and provenance are data; rendering to `//` vs `<!-- -->`
  is a per-target function (EXP-007 §1's cheapest answer to surviving EXP-005).

## Open questions, parked deliberately

1. **Statement-level attribution.** `emittedAs` maps node → exported symbol, which suffices for
   EXP-003's replay harness on extracted functions. Whether inline collapsed logic (a ternary from
   a Condition node) ever needs finer attribution is deferred until EXP-003 builds the comparator.
2. **`regions` membership.** CAN-005 suggests centre-point containment; parse adopts it, but the
   editor's `CommentsModel` is component-level and spatial — revisit when EXP-006 lands.
3. **Typed catalog subset in the IR.** `catalogRef` points at the catalog rather than embedding
   port tables per node. If EXP-003's prompt assembly wants self-contained IR nodes, add an
   embed-on-demand step rather than bloating every node now.

## Implementation home

`packages/nodegx-export` (new package, plain Node + TypeScript, no Electron dependency): `src/ir/`
(these types), `src/parse/` (v2 reader + catalog resolution), `src/analyse/`, `src/emit/`. The
CLI wrapper and editor menu item are late, thin additions (phase-7's CODE-007) once the pipeline
is real.
