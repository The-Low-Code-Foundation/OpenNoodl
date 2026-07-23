# Node Catalog Enrichment

**Authored inputs:** `docs/node-catalog/enrichment/*.json`, `docs/node-catalog/examples/*.json`,
`docs/node-catalog/compatibility.json`, `docs/node-catalog/patterns.md`
**Merge tool:** `scripts/node-catalog/merge.js` (`npm run catalog:merge`, CI gate: `npm run catalog:merge:check`)
**Published artifact:** `packages/noodl-types/src/node-catalog-enriched.json` (+ `node-catalog-enriched.d.ts`)
**Example gate:** `npm run catalog:examples` — every example must validate error- and warning-free
against the SUB-006 semantic validator.

The structural catalog (`node-catalog.json`, see `SCHEMA.md`) is **generated** from the live node
registries and answers *what exists*: node types, ports, value types, defaults. This enrichment
layer is **authored** and answers *what things mean*: what a node does, when to use it, what a
given signal actually causes, which wirings are idiomatic. The two are kept in separate files
precisely so that regenerating the structural catalog can never destroy authored semantics; the
merge tool combines them into the published enriched catalog and warns when a node in the
generated catalog has no enrichment entry, so new nodes cannot ship undocumented.

Everything here is written for a reader — human or AI — with **no prior Noodl/NodeGX context**.
The enriched catalog plus the v2 project schemas are intended to be sufficient to author correct,
idiomatic graphs.

## Core mental model (read this first)

A NodeGX application is a graph of nodes per **component**. Two kinds of things flow along
connections:

- **Values** — data (string, number, boolean, object, array, color, …). A value connection means
  "whenever the output changes, the input receives the new value." Values are *level*-like: they
  hold their latest state.
- **Signals** — momentary events with no payload (`isSignal: true` in the catalog). A signal
  connection means "when the source fires, the target's action runs once." Signals are
  *edge*-triggered: the runtime fires a signal input when the incoming value transitions to true
  (`valueChangedToTrue`), and a fired output is suppressed from re-firing within the same update
  cycle. Connecting a boolean to a signal input is legal (see `compatibility.json`) and means
  "trigger on the rising edge of this boolean."

Visual nodes (`isVisual: true`) additionally live in a parent/child hierarchy (`children` in
`nodes.json`) that defines the render tree. Logic nodes participate only in connections.

A node's `parameters` in a project file are *static* values for its input ports — the same ports
a connection could otherwise drive. Ports listed with `allowConnectionsOnly` cannot be set via
`parameters`; ports with `allowEditOnly` cannot be connected.

## Enrichment entry schema — `enrichment/<type>.json`

One JSON file per node type. Filename: the `typeName` lowercased with every run of characters
outside `[a-z0-9.]` replaced by `-` (e.g. `Query Records` → `query-records.json`,
`net.noodl.controls.button` → `net.noodl.controls.button.json`).

| Field | Required | Meaning |
|-------|----------|---------|
| `typeName` | yes | Exact catalog `typeName` this entry enriches. Unknown names fail the merge. |
| `summary` | yes | One line (≤ 140 chars). What the node is, for pickers and completion lists. |
| `description` | yes | 2–6 sentences. What the node does and the mental model behind it, for a reader with no context. Factual, present tense, no marketing. |
| `whenToUse` | yes | When to reach for this node — and when *not* to (name the better alternative). |
| `ports` | no | Map of port `name` → one-sentence semantic note. Only ports whose meaning is not obvious from name+type: signal causality ("fires after the animation completes"), units, side effects, ordering. Port names must exist in the catalog for fully static nodes. |
| `runtimeBehavior` | iff `dynamicPorts` | Precise description of how this node's runtime-determined ports come to exist (what drives them, when they appear, what an authoring tool may/may not assume). Required for every node with `dynamicPorts`, forbidden otherwise. |
| `examples` | yes* | Array of example ids (see below). At least one for every current node; deprecated or picker-hidden (`inNodePicker: false`) nodes may omit it — we do not author examples of discouraged wirings. The example's `demonstrates` must include this `typeName`. |
| `patterns` | no | Short idiomatic-combination notes ("Feed a Repeater's `Items` from Query Records `Items`"). |
| `antiPatterns` | no | Known misuses and what to do instead. |
| `relatedNodes` | no | Catalog `typeName`s a reader should also consider. Validated against the catalog. |

Keep entries short and factual. Prefer adding an example over adding prose: examples are
validated in CI, prose is not.

## Example schema — `examples/<id>.json`

Examples are **real v2 graph fragments**, not pseudo-code. Every example is validated by the
SUB-006 semantic validator (strict mode, warnings are failures) on every CI run — an example
that does not validate is worse than no example.

| Field | Required | Meaning |
|-------|----------|---------|
| `id` | yes | Kebab-case id, must equal the filename. |
| `title` | yes | Human title. |
| `description` | yes | What the wiring achieves and why it is the idiomatic shape. |
| `demonstrates` | yes | Catalog `typeName`s this example teaches. Each must actually occur in the graph. |
| `components` | yes | Array of `{ name, nodes, connections }` in v2 shape: nodes are `{ id, type, label?, parent?, children?, parameters? }`, connections are `{ fromId, fromProperty, toId, toProperty }`. Component references (`/#Name`) must resolve within the example's own components. |

`parameters` keys are checked against catalog input ports for fully static node types
(dynamic-port nodes are exempt, mirroring the validator's own conservatism).

## Compatibility — `compatibility.json`

The connection-compatibility rules as the editor actually enforces them
(`NodeLibrary.canCastPortTypes`, `packages/noodl-editor/.../nodelibrary.ts`), with the semantic
meaning of each permitted coercion. The typecast table itself lives in the structural catalog and
is exported by the runtime (`packages/noodl-runtime/src/nodelibraryexport.js`) — this file must
stay in sync with it, and the merge tool fails if a cast documented here disappears from the
catalog or vice versa. `verifiedPairs` lists sampled permitted/rejected pairs asserted against
the rule implementation on every merge check.

## Merge behaviour

`npm run catalog:merge` reads the structural catalog + all authored inputs and writes the
enriched catalog. It is deterministic; `npm run catalog:merge:check` fails CI when the committed
artifact is stale.

- **Errors** (merge fails): enrichment for an unknown `typeName`; duplicate entries; example id ≠
  filename; example demonstrating a type absent from its graph; unknown example id referenced;
  invalid `parameters` key on a static node; `runtimeBehavior` missing on a dynamic node (or
  present on a static one); `relatedNodes` not in catalog; compatibility file out of sync with
  catalog typecasts; failed `verifiedPairs` assertion.
- **Warnings** (listed, non-fatal unless `--require-coverage`): catalog node with no enrichment
  entry; node whose entry has no example. `--require-coverage` (used in CI once coverage reached
  100 %) promotes these to errors.

## Authoring voice

- Present tense, active, concrete. "Fires `On True` once each time `Evaluate` is triggered while
  `Condition` is true" — not "can be used to check conditions."
- Name ports by their **name** (the key used in files), with the display name in parentheses on
  first mention if it differs: "`eval` (Evaluate)".
- State signal vs value explicitly whenever a port note mentions a port.
- Never invent behaviour. If behaviour is runtime-determined, say exactly that and say what
  determines it. `dev-docs/reference/LEARNINGS.md` records a feature that died assuming static
  knowledge of dynamic ports; this corpus must not repeat the mistake.
- Deprecated / `inNodePicker: false` nodes get a minimal entry: summary, description of what
  supersedes them, `whenToUse: "Do not use in new graphs — use X instead."`.
