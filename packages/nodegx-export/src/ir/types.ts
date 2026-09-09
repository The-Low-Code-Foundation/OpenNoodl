/**
 * The prefix a `For Each` gives a relayed row signal, and the one it gives a relayed row value.
 *
 * These are the runtime's own names, registered in `foreach.tsx`'s `_managePortsForNode`: a
 * template's signal output becomes `itemOutputSignal-<name>` on the repeater, a value output
 * `itemOutput-<name>`. Shared because the plan gates on them and the emitter strips them, and a
 * second copy of a prefix drifts.
 */
export const ITEM_OUTPUT_SIGNAL = 'itemOutputSignal-';
export const ITEM_OUTPUT_VALUE = 'itemOutput-';

/**
 * The export IR — the shared contract between the deterministic generators (EXP-002), AI logic
 * translation (EXP-003) and the manifest consumers (EXP-004/005/007).
 *
 * Design rationale, invariants and the determinism rules (D1–D7) live in
 * dev-docs/tasks/phase-18-code-export-v2/EXP-002-IR-DESIGN.md. The short version:
 *
 * - Plain serialisable data. No live models, no Maps, no methods. Arrays carry a defined order.
 * - Identity is adopted, never minted: node ids from the substrate, the GraphSnapshot
 *   connectionKey format for connections, component paths in "Pages/Landing" form.
 * - Parsing never drops and never fails on content. Unknown types, script parameters and
 *   statically-unknowable port sets become representable states, and later dispositions —
 *   not errors.
 * - Nothing React-shaped appears here. The analysis/emit layer owns the React mapping.
 */

export interface ExportIR {
  project: ProjectIR;
  /** Sorted by `path`, codepoint order (D1). */
  components: ComponentIR[];
}

/**
 * One stored parameter the export had to settle to read the graph the author saw (HLS-003).
 *
 * Structurally the migration's own `RunOnChangeWrite`, restated here rather than imported so the
 * IR — the shared contract with EXP-003/005 — does not take a dependency on the editor's patch
 * pass to describe its own shape. The producer imports the real one and assigns it.
 */
export interface SettledParameterIR {
  /** Component path, as the report prints it. */
  component: string;
  nodeId: string;
  nodeType: string;
  /** The governed input, full port name — `in-amount`, not `amount`. */
  input: string;
  /** Always `runOnChange-<input>`, and always settled to `false`. */
  parameter: string;
}

export interface ProjectIR {
  name: string;
  catalogFormatVersion: string;
  exporterVersion: string;
  /**
   * HLS-003 — what an editor load would have written that the files did not say, applied to this
   * read so the export sees the canvas's graph rather than the file's.
   *
   * 🔴 **Empty is not the same as "the seam is closed."** It means this project does not exercise
   * it: no node of the fifteen NDA-017 families with its control signal wired and a governed input
   * left unstated. A project with no such node reads empty however open the seam is.
   */
  settledRunOnValueChange: SettledParameterIR[];
  /** Source order preserved — these render as tokens.css in that order. */
  designTokens: TokenIR[];
  /** From nodegx.project.json metadata.dbCollections; typed API stubs are generated from these. */
  collections: CollectionIR[];
  /** One per Router node found in the project. */
  routers: RouterIR[];
  /**
   * From nodegx.project.json metadata.cloudservices — the deployed backend this project's data,
   * auth and cloud-function nodes already talk to. EXP-009 emits a real client against it.
   * Absent when the project declares no backend, and the api modules stay stubs (AC7).
   *
   * Exactly these four fields are copied and nothing else: anything privileged someone pastes
   * into project metadata (a master key, an admin token) must never reach the IR, because
   * everything in the IR is presumed emittable into a browser bundle.
   */
  cloudservices?: CloudServicesIR;
  /**
   * Component paths under components/__cloud__ — cloud functions, executed by the backend's
   * interpreter. The frontend export skips them entirely; they surface as one report note.
   */
  cloudComponents: string[];
  /**
   * Everything under `noodl_modules/` — custom node kits, icon sets, bundled fonts, ERG-002
   * libraries (EXP-010). Directory order.
   *
   * 🔴 **Present even when empty, and every module is listed whatever became of it.** The defect
   * this closed was an absence: the directory was never opened, so a kit node had no ports, no
   * generator and no mention anywhere in the output. A module that failed to load is a row here
   * with a `status` and a `message`, never a missing row.
   */
  modules: ModuleIR[];
}

/** Why a module's node definitions are, or are not, in {@link ModuleIR.nodes}. */
export type ModuleStatus =
  /** Ran and registered at least one node. */
  | 'loaded'
  /**
   * Nothing to load and nothing wrong: an icon set, a bundled font, an ERG-002 library. Its files
   * still ship. ⚠️ Distinct from every failure below — a font module reporting "threw" would send
   * an author looking for a bug in a folder that contains no code.
   */
  | 'no-nodes-declared'
  /** The folder has no readable `manifest.json`, so nothing knows what it is. Files still ship. */
  | 'no-manifest'
  /** A kit whose manifest names no `main` — its code arrives from a URL at runtime. */
  | 'no-main'
  /** The manifest names a `main` that could not be read. The one status meaning there is no code. */
  | 'unreadable'
  /** Ran and never called `Noodl.defineModule`. */
  | 'no-define-module'
  /** Called `defineModule` and named no nodes. */
  | 'defines-no-nodes'
  /** An ES-module build — a `<script>` tag cannot load it, in the editor or in the exported app. */
  | 'es-module'
  /** A CommonJS build — same. */
  | 'commonjs'
  /** Threw while loading. It registers nothing in the running app either. */
  | 'threw';

/** One folder under `noodl_modules/`. */
export interface ModuleIR {
  /** The folder name — `cashflow-kit`. The identity everything joins on. */
  dirName: string;
  /** The manifest's `name`, falling back to the folder name. What a surface displays. */
  displayName: string;
  /**
   * Which of the four manifest shapes this is. Subtractive, because there is no `kind: 'node-kit'`
   * marker to test — `projectmodules.ts` measured this across every project on this machine.
   */
  kind: 'kit' | 'iconset' | 'external-library' | 'asset';
  status: ModuleStatus;
  /** Why, in a sentence a person can act on. Absent only for a plain `loaded`-adjacent asset. */
  message?: string;
  /** The manifest's `main`, when it declares one. */
  main?: string;
  /** Node definitions this module registered. Empty for every status but `loaded`. */
  nodes: KitNodeIR[];
  /** `browser.stylesheets`, project-relative. These become `<link>`s in the exported page. */
  stylesheets: string[];
  /**
   * An icon set's `iconClass` (`"lucide"`) — the CSS class its stylesheet defines glyph rules for.
   *
   * The join key between an emitted `<span class="lucide icon-alert-circle">` and the module whose
   * stylesheet makes it render. Carried so the export can tell "this icon will work" from "this
   * icon's set is not in the project", which are the same span with opposite outcomes.
   */
  iconClass?: string;
  /**
   * Every file under the module directory, project-relative, sorted. The copy list.
   *
   * 🔴 The whole directory rather than what the manifest names: a stylesheet's `url()` references
   * are invisible to the manifest, and shipping the CSS without its font renders blank glyphs
   * instead of an error.
   */
  assets: string[];
  /** Manifest `runtimes`, defaulted to `['browser']` — the same default every other reader applies. */
  runtimes: string[];
}

/**
 * One custom node type a kit registers.
 *
 * Mirrors `KitNodeDefinition` in `parse/kitSource.ts`, which is where it is read from source. It
 * is restated here because the IR is the contract other tasks build against and may not depend on
 * the shape of the evaluator that happens to fill it.
 */
export interface KitNodeIR {
  /** The node type name the graph stores — `nodegx.cashflow.Pill`. */
  type: string;
  displayName?: string;
  docs?: string;
  allowChildren: boolean;
  /** True when the definition has a `getReactComponent` — a visual node rather than a logic one. */
  visual: boolean;
  /**
   * Every input, tagged with how the runtime delivers it. `via: 'prop'` is an `inputProps` entry
   * that becomes a React prop; `via: 'node'` is an `inputs` entry whose `set` the node runs —
   * the shape a kit's logic nodes use, and invisible if only `inputProps` is read.
   */
  inputs: Array<KitPortIR & { via: 'prop' | 'node' }>;
  /**
   * Every output, tagged with how the runtime wires it. `via: 'prop'` is an `outputProps` entry
   * the component fires by calling a callback prop; `via: 'node'` is an `outputs` entry the node
   * publishes itself. A `Money Pill`'s `dropped` exists only in the second, so reading one place
   * loses it.
   */
  outputs: Array<KitPortIR & { kind: 'value' | 'signal'; via: 'prop' | 'node' }>;
}

export interface KitPortIR {
  name: string;
  /** Declared port type name ("string", "number", "color", "signal", …). */
  type?: string;
  /** The port type's `defaultUnit` ("px"). The runtime appends it to a default before it is a prop. */
  defaultUnit?: string;
  displayName?: string;
  group?: string;
  default?: unknown;
}

export interface CloudServicesIR {
  /** "http://localhost:8581" — the backend's base URL. */
  endpoint: string;
  /** The Parse application id — the non-secret identifier every deployed app ships with. */
  appId: string;
  instanceId?: string;
  /** "nodegx" — the discriminator EXP-009 §6 leaves room for BYOB backends on. */
  type?: string;
}

export interface TokenIR {
  /** CSS custom property name, exactly as authored ("--primary"). */
  name: string;
  value: string;
  category?: string;
  /** Authored description; becomes the comment above the token in tokens.css. */
  description?: string;
}

export interface CollectionIR {
  name: string;
  columns: Array<{ name: string; type: string }>;
}

export interface RouterIR {
  /** The Router node's `name` parameter ("Main"). */
  name: string;
  /** Component id of the node's own component, and the node's id — provenance for the manifest. */
  componentPath: string;
  nodeId: string;
  /** Legacy component path of the start page ("/Pages/Landing"). */
  startPage?: string;
  /** Legacy component paths, source order. */
  routes: string[];
}

export interface ComponentIR {
  id: string;
  /** "Pages/Landing" — component.json `path` with the leading slash stripped. */
  path: string;
  /** From component.json `type`; anything not "page" is "component". */
  role: 'page' | 'component';
  /** Source order from nodes.json (D2). */
  nodes: NodeIR[];
  /** Source order from connections.json (D2). */
  connections: ConnectionIR[];
  /**
   * nodes.json's own `visualRoots` — the ids the *runtime* renders the component from, in order.
   * `componentModel.roots` is fed from this list and `componentinstance.ts:326` renders
   * `roots[0]` alone, so it is the authoritative answer to "what draws"; the editor re-derives it
   * on every save (`getVisualRootIds()`). Undefined for files that predate the field, where the
   * planner falls back to its own parentless-node rule.
   */
  visualRoots?: string[];
  intent: AuthoringIntent;
}

export interface NodeIR {
  id: string;
  /** Catalog typeName, or a "/"-prefixed legacy component path for component instances. */
  type: string;
  /**
   * The catalog typeName this node resolved against, or null for component instances and types
   * the catalog does not know (old projects). Ports beyond `declaredPorts` are looked up in the
   * catalog through this reference rather than embedded per node.
   */
  catalogRef: string | null;
  /**
   * Present only when the serialized `label` key was present in nodes.json. Never read through a
   * live model's defaulting getter (EXP-006's trap: that emits a title for every node).
   */
  authoredLabel?: string;
  /** Sorted by name (D3). */
  parameters: ParamIR[];
  /** The node's own `dynamicports` declarations, as-written. Catalog ports are not duplicated here. */
  declaredPorts: PortIR[];
  /**
   * 'complete'  — catalog entry with dynamicPorts: null, or a component instance whose interface
   *               is its Component Inputs/Outputs.
   * 'partial'   — the catalog marks this type's port set as parameter-dependent (dynamicPorts
   *               non-null); declaredPorts + catalog cover what is statically knowable.
   * 'unknown'   — ports only execution reveals (Function-style nodes). EXP-003 back-fills
   *               `resolvedPorts` from traces.
   */
  portKnowledge: 'complete' | 'partial' | 'unknown';
  /** Written by EXP-003 from trace data; absent until then. */
  resolvedPorts?: PortIR[];
  /**
   * Verbatim author-written **JavaScript** for script-bearing nodes, from the first such
   * parameter in name order. This is the EXP-003 LLM payload and the preserved-as-comment
   * fallback when a translation stays unverified. Never trimmed, never reformatted.
   *
   * 🔴 "Script-bearing" is decided by the catalog's declared **language**, not by the presence of
   * a code editor — `styleCss` is a codeeditor port on 29 node types and holds CSS, and Static
   * Data's `json`/`csv` hold data. Selecting on the code editor alone put a Text node's CSS in
   * this field, under this sentence. See `isJavaScriptCodeEditorType`.
   */
  sourceText?: string;
  parent?: string;
  /** Visual children, order = render order (D2). */
  children?: string[];
}

export interface ParamIR {
  name: string;
  value: ParamValue;
}

export type ParamValue =
  /** Strings (including "var(--token)" references, kept textual), numbers, booleans. */
  | { kind: 'literal'; value: string | number | boolean }
  /** {value: 340, unit: "px"} objects. */
  | { kind: 'dimension'; value: number; unit: string }
  /** An expression parameter — any input may carry one, evaluated live in the interpreter. */
  | { kind: 'expression'; source: string }
  /** Code-editor-typed parameters (mapping scripts, function bodies). */
  | { kind: 'script'; source: string }
  /** Structured editor values (query filters, sort specs, router page sets). */
  | { kind: 'json'; value: unknown };

export interface PortIR {
  name: string;
  plug: 'input' | 'output';
  /**
   * Never flattened: EXP-003's equivalence rules count and order signals, and the emit rule that
   * value outputs land before the signal that follows them depends on knowing which is which.
   */
  kind: 'value' | 'signal';
  /** Port type name when declared ("string", "boolean", "component", …). */
  type?: string;
  default?: unknown;
}

export interface ConnectionIR {
  /**
   * `${fromId}:${fromProperty}->${toId}:${toProperty}` — the GraphSnapshot.connectionKey format,
   * adopted verbatim because EXP-006's wire labels are keyed by exactly this string.
   */
  key: string;
  fromId: string;
  fromProperty: string;
  toId: string;
  toProperty: string;
  /** The source port's kind. 'value' when it cannot be determined statically (reported, not guessed). */
  kind: 'value' | 'signal';
  /**
   * Author-written wire label. Irrecoverable if dropped — the wire itself vanishes in generated
   * code, so this must land as a comment on the statement the wire becomes.
   */
  label?: string;
}

/** CAN-005's authoring-intent bundle, in serialisable form. */
export interface AuthoringIntent {
  nodeComments: Array<{ nodeId: string; text: string }>;
  wireLabels: Array<{ connectionKey: string; text: string }>;
  /** Ordered, outermost first. */
  regions: Array<{ text: string; nodeIds: string[] }>;
  componentDescription?: string;
}

/**
 * Dispositions are analysis output about the graph, not facts of it — they live in the manifest
 * (ExportManifest.nodes), never on NodeIR.
 */
export type Disposition =
  | { kind: 'static' }
  | { kind: 'collapsed'; into: string }
  | { kind: 'deferred'; to: 'EXP-003'; reason: string }
  | { kind: 'stubbed'; reason: string }
  | { kind: 'unknown-type'; reason: string };

/**
 * EXP-013 — one node the export left out, as a row rather than a sentence.
 *
 * `ComponentPlan.notes` is prose, and the report renders it. Two things the prose could not say
 * were measured on `tests/fixtures/task-desk` (§50.2, then EXP-013): a refused node that only
 * ever appears inside dropped-wire keys is never *named* as a node — `sweepUnreportedDeferrals`
 * counts a mention inside `wire a:b->c:d` as the node having been reported — and a node refused
 * only because the node that fires it was refused carries no pointer back to that node. This row
 * is built from `dispositions` (which every gate writes) rather than from `notes` (which only
 * some do), so a refused node is here whether or not any sentence mentions it.
 */
export interface RefusedNode {
  nodeId: string;
  /** The catalog typeName, or the component path for an instance. */
  type: string;
  /** The picker's name for the type, when the catalog knows it; `type` otherwise. */
  displayName: string;
  /** The author's own label, only when nodes.json carried one. */
  label?: string;
  /** The exporter's reason, in its own words — the same text `notes` carries when it carries one. */
  reason: string;
  /**
   * The refused node(s) whose refusal is the only reason this one is refused — the **roots** of the
   * cascade, never an intermediate. Absent on a node the export has no rule for in its own right.
   */
  causedBy?: string[];
  /**
   * The node is a pathway rather than a feature: a backend verb, a navigation, an `On App Error`.
   * Losing one of these to a cascade is what EXP-013's verdict is about.
   */
  pathway: boolean;
}

/** The durable sidecar emitted beside the code — see EXP-002-IR-DESIGN.md "The manifest". */
export interface ExportManifest {
  exporterVersion: string;
  catalogFormatVersion: string;
  files: ManifestFile[];
  nodes: ManifestNode[];
  /** EXP-006's rule: nothing silently dropped. */
  dropped: Array<{ what: string; where: string; reason: string }>;
}

export interface ManifestFile {
  path: string;
  kind: 'component' | 'page' | 'store' | 'logic' | 'api-stub' | 'styles' | 'scaffold';
  sources: Array<{ componentPath: string; nodeIds: string[] }>;
  /** SHA-256 of the body excluding the provenance header. */
  contentHash: string;
}

export interface ManifestNode {
  componentPath: string;
  nodeId: string;
  disposition: Disposition;
  emittedAs?: Array<{ file: string; symbol: string }>;
  /** Written by EXP-003; EXP-005 must propagate it, never drop it at the framework boundary. */
  verdict?: 'verified' | 'mismatched' | 'unverified';
}
