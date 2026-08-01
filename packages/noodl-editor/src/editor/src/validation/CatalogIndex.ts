/**
 * SUB-006 — Semantic Validator: Catalog index
 *
 * Fast, query-shaped view over SUB-004's node catalog. The catalog is the
 * *language definition*; this index is what the validator (the "compiler")
 * consults to decide whether a node type, a port, or a wire means anything.
 *
 * Purity: the class takes a `NodeCatalog` object — it does not read the catalog
 * from disk. `loadDefaultCatalog()` (in ./catalog) supplies the bundled one.
 * This keeps the rule engine testable with tiny hand-built catalogs.
 *
 * @module noodl-editor/validation/CatalogIndex
 */

// Type-only import of the generated catalog shape (no runtime cost).
import type { NodeCatalog, CatalogNode, CatalogPort, Typecast } from '../../../../../noodl-types/src/node-catalog';

export type { NodeCatalog, CatalogNode, CatalogPort };

/**
 * Dynamic-port mechanisms whose ports are genuinely *not* statically knowable —
 * created by user code (Function/Expression), numbered at will (And/Or), taken
 * from a referenced component, or synthesised by an editor adapter. When a
 * connection names a port we can't find on such a node, we must NOT error: the
 * port is very likely legitimate and runtime-determined.
 *
 * `declared-port-groups` is deliberately absent — its ports are (mostly) listed
 * in the static inputs/outputs plus `declaredPortGroups`. But because a handful
 * of legacy/adapter port names (e.g. Text Input's `disabled`) are reachable on
 * such nodes without appearing in either list, ANY node carrying dynamic ports
 * still takes the conservative skip path in the port rule (see `isDynamicNode`).
 * This matches the SUB-004 corpus preview, which produced zero static-port
 * false positives across the whole real-project corpus.
 */
const RUNTIME_DYNAMIC_MECHANISMS = new Set([
  'runtime-discovered',
  'numbered-inputs',
  'component-ports',
  'editor-adapter'
]);

export type Plug = 'input' | 'output';

/**
 * NDA-017 §2's port prefix. Duplicated from `@noodl/runtime`'s `run-on-value-change.ts`
 * rather than imported: the validator runs in the editor, in the MCP server and in a CLI, and
 * must not pull the runtime in for one string. `catalog:check` is what keeps the two honest —
 * the ports appear in the generated catalog under this exact name.
 */
const RUN_ON_CHANGE_PREFIX = 'runOnChange-';

/** See {@link CatalogIndex.completionSignalOutputNames} for why `failure` is absent. */
const COMPLETION_SIGNAL_NAMES = new Set(['success', 'done', 'completed', 'fetched', 'stored', 'saved']);

export class CatalogIndex {
  private readonly byType = new Map<string, CatalogNode>();
  /** typeName → plug → Set<portName> (static + declared-port-group names). */
  private readonly portNamesCache = new Map<string, { input: Set<string>; output: Set<string> }>();
  /** from-type → Set<to-type> reachable via a documented typecast. */
  private readonly typecasts = new Map<string, Set<string>>();
  private readonly allTypeNames: string[];

  constructor(private readonly catalog: NodeCatalog) {
    for (const node of catalog.nodes) {
      this.byType.set(node.typeName, node);
    }
    this.allTypeNames = catalog.nodes.map((n) => n.typeName);
    for (const cast of catalog.typecasts ?? ([] as Typecast[])) {
      this.typecasts.set(cast.from, new Set(cast.to));
    }
  }

  // ── Node types ────────────────────────────────────────────────────────────

  hasType(typeName: string): boolean {
    return this.byType.has(typeName);
  }

  getNode(typeName: string): CatalogNode | undefined {
    return this.byType.get(typeName);
  }

  /** Type names an author should reasonably use (in the node picker, not deprecated). */
  authorableTypeNames(): string[] {
    return this.catalog.nodes.filter((n) => n.inNodePicker && !n.isDeprecated).map((n) => n.typeName);
  }

  // ── Dynamic ports ────────────────────────────────────────────────────────

  /**
   * True when the node creates ports at runtime (or via editor adapters, numbered
   * inputs, or referenced-component ports). Used by the port rule to skip rather
   * than error on ports it cannot see.
   */
  isDynamicNode(typeName: string): boolean {
    return !!this.byType.get(typeName)?.dynamicPorts;
  }

  /** True when the node's dynamism is of a genuinely runtime-unbounded kind. */
  hasRuntimeDynamicPorts(typeName: string): boolean {
    const dyn = this.byType.get(typeName)?.dynamicPorts;
    if (!dyn) return false;
    return dyn.mechanisms.some((m) => RUNTIME_DYNAMIC_MECHANISMS.has(m));
  }

  /** A short human note describing why a port could not be checked. */
  dynamicPortNote(typeName: string): string | undefined {
    const dyn = this.byType.get(typeName)?.dynamicPorts;
    if (!dyn) return undefined;
    return dyn.description || `ports are runtime-determined (${dyn.mechanisms.join(', ')})`;
  }

  // ── Ports ─────────────────────────────────────────────────────────────────

  private computePortNames(node: CatalogNode): { input: Set<string>; output: Set<string> } {
    const input = new Set<string>(node.inputs.map((p) => p.name));
    const output = new Set<string>(node.outputs.map((p) => p.name));
    // Fold in conditionally-declared port-group members so suggestions and
    // "available" lists are complete for declared-port-group nodes.
    const groups = node.dynamicPorts?.declaredPortGroups as
      | Array<{ inputs?: string[]; outputs?: string[] }>
      | undefined;
    for (const g of groups ?? []) {
      for (const n of g.inputs ?? []) input.add(n);
      for (const n of g.outputs ?? []) output.add(n);
    }
    return { input, output };
  }

  private portNamesFor(typeName: string): { input: Set<string>; output: Set<string> } | undefined {
    if (this.portNamesCache.has(typeName)) return this.portNamesCache.get(typeName);
    const node = this.byType.get(typeName);
    if (!node) return undefined;
    const sets = this.computePortNames(node);
    this.portNamesCache.set(typeName, sets);
    return sets;
  }

  /** Does this node statically declare a port with the given name and plug? */
  hasPort(typeName: string, plug: Plug, portName: string): boolean {
    return !!this.portNamesFor(typeName)?.[plug].has(portName);
  }

  /** The static port names for a plug (sorted), for suggestions / "available" lists. */
  portNames(typeName: string, plug: Plug): string[] {
    const set = this.portNamesFor(typeName)?.[plug];
    return set ? [...set].sort() : [];
  }

  /** The catalog port object, when statically known. */
  getPort(typeName: string, plug: Plug, portName: string): CatalogPort | undefined {
    const node = this.byType.get(typeName);
    if (!node) return undefined;
    const list = plug === 'input' ? node.inputs : node.outputs;
    return list.find((p) => p.name === portName);
  }

  /** Signal inputs on a node — the common "how do I trigger this" question. */
  signalInputNames(typeName: string): string[] {
    const node = this.byType.get(typeName);
    if (!node) return [];
    return node.inputs.filter((p) => p.isSignal).map((p) => p.name);
  }

  /**
   * NDA-017 — is this one of the node families whose value inputs are governed by
   * per-input "Run on value change" checkboxes?
   *
   * Derived from the catalog rather than listed here, so the set cannot drift from what the
   * runtime actually ships. Two mechanisms, because §2 covered both fixed- and
   * discovered-input families: a family with fixed value inputs declares its
   * `runOnChange-<input>` ports statically, and a family whose inputs are discovered
   * (`Expression`, `Function`, `DbCollection2`) can only describe the pattern in
   * `parameterEncoding`.
   */
  isRunOnValueChangeFamily(typeName: string): boolean {
    const node = this.byType.get(typeName);
    if (!node) return false;
    if (node.inputs.some((p) => p.name.startsWith(RUN_ON_CHANGE_PREFIX))) return true;
    const enc = node.parameterEncoding as unknown;
    return !!enc && JSON.stringify(enc).includes(RUN_ON_CHANGE_PREFIX);
  }

  /** The value-input names a `runOnChange-<input>` port governs, when statically declared. */
  runOnChangeGovernedInputs(typeName: string): string[] {
    const node = this.byType.get(typeName);
    if (!node) return [];
    return node.inputs
      .filter((p) => p.name.startsWith(RUN_ON_CHANGE_PREFIX))
      .map((p) => p.name.slice(RUN_ON_CHANGE_PREFIX.length));
  }

  /**
   * Signal outputs that mean *"the work this node was asked to do has finished"*.
   *
   * This is what makes a producer **asynchronous** for the purposes of NDA-017: a node that
   * publishes a completion signal is one whose value outputs land some time after it was
   * triggered, which is the entire precondition for the staleness the report described.
   *
   * ⚠️ `failure` is deliberately **not** on its own sufficient and is not listed. Plenty of
   * synchronous nodes report a failure — `Expression` raises one for a compile error — so
   * treating it as an async marker would sweep in most of the library. The names here are the
   * ones NDA-004 §2/§3 established as *completion* signals.
   */
  completionSignalOutputNames(typeName: string): string[] {
    const node = this.byType.get(typeName);
    if (!node) return [];
    return node.outputs.filter((p) => p.isSignal && COMPLETION_SIGNAL_NAMES.has(p.name)).map((p) => p.name);
  }

  // ── Type compatibility ──────────────────────────────────────────────────────

  /**
   * Resolve a port's value-type name from a catalog port (the `type` field can be
   * a string or an object with a `name`).
   */
  static portTypeName(port: CatalogPort | undefined): string | undefined {
    if (!port) return undefined;
    const t = port.type as unknown;
    if (typeof t === 'string') return t;
    if (t && typeof t === 'object' && 'name' in (t as Record<string, unknown>)) {
      return String((t as { name: unknown }).name);
    }
    return undefined;
  }

  /**
   * Can a value of `fromType` feed an input of `toType`? Conservative: unknown
   * types, wildcards, and signal endpoints are treated as compatible so the
   * type rule only ever fires on a *provably* incompatible, statically-typed pair.
   */
  isTypeCompatible(fromType: string | undefined, toType: string | undefined): boolean {
    if (!fromType || !toType) return true; // unknown ⇒ don't guess
    if (fromType === toType) return true;
    if (fromType === '*' || toType === '*') return true;
    // Signals interoperate broadly and the runtime coerces around them, so a
    // signal on either side is treated as compatible (a common, legal pattern).
    if (fromType === 'signal' || toType === 'signal') return true;
    const reach = this.typecasts.get(fromType);
    return !!reach && reach.has(toType);
  }

  // ── Suggestions (edit distance) ──────────────────────────────────────────────

  /** Nearest authorable catalog type to an unknown type string, if close enough. */
  suggestType(unknown: string): string | undefined {
    return nearest(unknown, this.allTypeNames);
  }

  /** Nearest port name (of a plug) to an unknown port string, if close enough. */
  suggestPort(typeName: string, plug: Plug, unknown: string): string | undefined {
    return nearest(unknown, this.portNames(typeName, plug));
  }
}

// ─── Edit distance ──────────────────────────────────────────────────────────

/** Classic Levenshtein distance. */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/**
 * The closest candidate to `input`, but only if it is a plausible near-miss:
 * distance ≤ a threshold that scales with length (so short names need to be
 * very close, long names allow a couple of typos). Case-insensitive tie-break
 * favours the exact-but-for-case match.
 */
export function nearest(input: string, candidates: string[]): string | undefined {
  if (candidates.length === 0) return undefined;
  const lower = input.toLowerCase();
  let best: string | undefined;
  let bestDist = Infinity;
  for (const cand of candidates) {
    if (cand === input) return cand;
    let dist = levenshtein(input, cand);
    // Reward case-only differences.
    if (cand.toLowerCase() === lower) dist = Math.min(dist, 1);
    if (dist < bestDist) {
      bestDist = dist;
      best = cand;
    }
  }
  if (best === undefined) return undefined;
  // Threshold: allow ~1 edit per 4 chars, min 1, cap 4.
  const threshold = Math.min(4, Math.max(1, Math.floor(input.length / 4) + 1));
  return bestDist <= threshold ? best : undefined;
}
