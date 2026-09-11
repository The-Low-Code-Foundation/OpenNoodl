/**
 * Lesson completion-detection evaluator.
 *
 * Given a step's `conditions` and a view of the current editor state, decides
 * whether the learner has done what the step asked. Conditions observe the
 * *semantic* layer — the project model and node graph (node types, labels,
 * ports, parameters, connections, active component, preview route) — never the
 * DOM or view internals, which is what keeps a lesson from breaking every time
 * the editor's UI changes.
 *
 * LEARN-001 notes:
 *  - Typed and de-`eval`'d. The legacy module `eval()`'d both the stored
 *    parameter value and the author's expected value to compare `array`-typed
 *    ports; that is replaced here by a structured parse + deep-equal
 *    ({@link parseArrayValue}, {@link deepEqual}).
 *  - Evaluation is now a pure function of (conditions, context): it does not
 *    mutate its inputs and reads editor state only through {@link LessonEvalContext}.
 *    That makes it unit-testable with fake graphs and removes the legacy's
 *    inconsistent per-condition "stickiness" (some conditions latched to
 *    completed, others re-checked every refresh). A step now completes when all
 *    of its conditions hold *simultaneously* against current state — which is
 *    also what "does not fire on near-misses" requires.
 *  - The condition vocabulary (the `LessonCondition` union) is the semantic
 *    contract the new declarative lesson-content format (LEARN-001 Slice 2)
 *    compiles down to.
 */

// 🔴 UNI-010 slice 2 — THIS MODULE REACHES NO EDITOR SINGLETON AT ALL, and the
// live half lives next door in `lessonevalconditions.live.ts`.
//
// UNI-007 arrived at half of this: `ProjectModel` and `NodeGraphContextTmp` were
// moved out of module scope into a `require` **inside** `liveLessonEvalContext()`,
// with the stated purpose that "UNI-010 runs that runner inside an MCP sidecar
// with no renderer around it". That was true of jest, which never evaluates the
// branch, and false of the sidecar, which is **bundled**:
//
//   ⚠️ **A lazy `require` defers execution. It does not defer resolution.**
//
// esbuild resolves a `require()` with a literal path at build time regardless of
// where it sits, so bundling anything that transitively reached this module
// pulled in `projectmodel` → the node graph → React → `.scss` and `.svg`, and the
// build failed outright. Runtime-loadable and bundle-clean are two different
// properties, and three slices of this arc rested on the wrong one because
// nothing had tried to bundle it yet.
//
// The fix is the split, not a cleverer require: everything here is a pure
// function of (conditions, context), and the one function that needed a renderer
// is now in a `.live.ts` sibling — the same convention `lessonwholesolution.live.ts`
// already uses for exactly this reason.

// 🔴 THE ONE IMPORT, AND WHY IT DOES NOT BREAK THE RULE ABOVE.
//
// `pageRegistration.ts` is the module that already owns "what does a Router's
// `pages` parameter mean" — it is pure by construction and is *already* in the
// sidecar's bundle, re-exported through `noodl-mcp/src/editor-deps.ts`. So this
// edge costs the bundle nothing it was not already paying, and the alternative
// costs something real: a second statement of `routes` / `startPage` /
// "is this the same page", drifting from the one the editor's apply path writes.
// That is exactly the divergence `editor-deps` exists to prevent.
//
// ⚠️ Verified by BUILDING the sidecar, not by reading this comment. The fifth
// amendment in phase 67's RULINGS.md is about a purity claim in a module header
// that nobody could falsify until something depended on it.
import { isSamePage, readRouterPagesValue, ROUTER_NODE_TYPES } from '../../models/AiAssistant/authoring/pageRegistration';

// ─── Structural views of the editor graph ──────────────────────────────────
// The evaluator only needs a narrow, stable subset of NodeGraphNode/ProjectModel.
// Typing against these structural interfaces (rather than the concrete classes)
// keeps the coupling honest and lets tests supply plain-object fakes.

export interface LessonPort {
  name: string;
  /** Port type is either a bare string or `{ name }` depending on the node. */
  type?: string | { name?: string };
}

export interface LessonConnection {
  fromId: string;
  toId: string;
  fromProperty: string;
  toProperty: string;
}

export interface LessonNode {
  id: string;
  label: string;
  type: { name: string };
  ports: LessonPort[];
  parameters: Record<string, unknown>;
  children: LessonNode[];
  getPort(name: string, filter?: 'input' | 'output'): LessonPort | undefined;
  forAllConnectionsOnThisNode(callback: (connection: LessonConnection) => void): void;
}

export interface LessonComponent {
  name: string;
  graph: { roots: LessonNode[] };
}

/**
 * TUT-002 — one collection in the project's **built-in** database, as the grader sees it.
 *
 * 🔴 `rowCount` is optional and the distinction is load-bearing. **Zero rows is a legitimate
 * answer; a snapshot that could not count is not.** Conflating them lets a lesson congratulate a
 * learner whose backend never started — `rowCountAtLeast: 0` would hold against a collection
 * nobody could read. Absent means *not counted*, and every verb treats it as unproven.
 */
export interface LessonCollection {
  name: string;
  columns: string[];
  /** Number of rows, or absent when the snapshot could not count them. */
  rowCount?: number;
}

/**
 * TUT-002 — a pre-fetched view of the built-in database, or the reason there isn't one.
 *
 * 🔴 **This is the whole reason the evaluator stays synchronous.** A database read is
 * asynchronous; grading an already-read snapshot is not. Making {@link evalConditionsWithContext}
 * async would have made all twelve existing verbs async for the benefit of three new ones, so the
 * *caller* does the reading and hands the result over as plain data — the same bargain
 * {@link LessonEvalContext} already strikes for the node graph.
 *
 * 🔴 **`refused` is not `unavailable`, and neither is an empty `ok`.** A project bound to Parse,
 * Directus or a bare REST endpoint must be *refused* by name: grading such a lesson would have the
 * editor query someone else's server, unprompted, during a lesson, possibly on a school-managed
 * machine. An empty `{ status: 'ok', collections: [] }` would read as "the learner has not made the
 * collection yet" and quietly teach against the wrong database.
 */
/**
 * 🔴 **NO PRODUCTION CALLER FILLS THIS YET (TUT-002, session 2).** Neither
 * `lessonevalconditions.live.ts` nor `lessonprojectcontext.ts` sets `database`, so every collection
 * verb currently answers `false` with a refusal sentence in the real editor. That is the *safe*
 * direction — nothing congratulates a learner wrongly — but the verbs are **not yet usable in a
 * shipped lesson**, and TUT-003 must not author against them until AC3 lands the two fillers.
 *
 * Recorded here rather than only in the task file because this arc has been bitten repeatedly by a
 * mechanism that exists, is tested, and is called by nobody.
 */
export type LessonDatabaseSnapshot =
  | { status: 'ok'; collections: LessonCollection[] }
  /** The project is bound to a backend this grader will not query. `binding` names it. */
  | { status: 'refused'; binding: string }
  /** The built-in database is the right one and could not be read. */
  | { status: 'unavailable'; reason: string };

/** Everything the evaluator reads about the current editor state. */
export interface LessonEvalContext {
  components: LessonComponent[];
  /** The project's visual root node, or undefined if none. */
  rootNode: LessonNode | undefined;
  getMetaData(key: string): Record<string, unknown> | undefined;
  /** The route currently shown in the preview/viewer, if any. */
  viewerPath: string | undefined;
  /** The name of the component currently open in the node graph editor. */
  activeComponentName: string | undefined;
  /**
   * TUT-002 — the built-in database, pre-read by the caller. Absent when the caller does not
   * supply one, which every collection verb treats as unproven rather than as "no collections".
   */
  database?: LessonDatabaseSnapshot;
}

// ─── Condition vocabulary ───────────────────────────────────────────────────
// Each condition observes one fact about editor state. `path` uses the node-path
// grammar resolved by findNodeWithPath (see below).

export interface HasTypeCondition {
  path: string;
  hastype: string;
}
export interface HasPortCondition {
  path: string;
  hasport: string;
}
export interface HasLabelCondition {
  path: string;
  haslabel: string;
}
export interface ExistsCondition {
  path: string;
  exists: boolean;
}
export interface IsVisualRootCondition {
  path: string;
  isvisualroot: boolean;
}
export interface HasParamsCondition {
  path: string;
  /** Comma-separated list of parameter names that must be present. */
  hasparams: string;
}
export interface ParamsEqCondition {
  path: string;
  /** Map of parameter name → expected value. */
  paramseq: Record<string, unknown>;
}
export interface HasConnectionCondition {
  /** Node-path of the source node. */
  from: string;
  /** Node-path of the target node. */
  to: string;
  /** "fromPort,toPort" — the connected port pair. */
  hasconnection: string;
}
export interface MetadataCondition {
  /** "key:subkey" into ProjectModel metadata. */
  metadata: string;
  equals: unknown;
}
export interface ViewerPathEqCondition {
  viewerpatheq: string;
}
export interface ActiveComponentNameEqCondition {
  activecomponentnameeq: string;
}
/**
 * UNI-010 criterion 3 §12.4 — "a router lists this page".
 *
 * 🔴 **This verb exists because a run found a hole no better authoring could
 * close.** The criterion-3 lesson that teaches building a second page asked the
 * learner to create it *through the Router's Pages list*, and the condition that
 * shipped checked only that the page's Text existed — because there was no way to
 * say the other thing. A component created outside the router is unreachable, so
 * the next step's navigation silently does nothing while the step ticks green.
 * `paramsEqual` on `pages` was the only route and it is not one: it would have to
 * restate the whole `{ startPage, routes: [...] }` value, so it breaks the moment
 * the learner adds any *other* page, and it cannot express "contains".
 *
 * `path` is optional and that is the point. Unscoped, this asks the question the
 * learner's app actually cares about — *is this page reachable from anywhere* —
 * without making the author address a Router node they may not know the location
 * of. Scoped, it names one router, which is what a lesson teaching nested
 * routing or a Page Stack needs.
 */
export interface RouterListsCondition {
  /** Optional node-path of a specific Router / Page Stack. Omitted = any of them. */
  path?: string;
  /** The component's legacy name, e.g. `/#__page__/About`. */
  routerlists: string;
}

/**
 * TUT-002 — "the learner made this collection."
 *
 * The first of three verbs that observe the project's **built-in database** rather than its graph.
 * Everything before them in this union is structural: a data tutorial could grade *"you wired
 * Create Record's `Do` to the Visual Function's signal output"* and could not grade *"you created a
 * record"* — which for TUT-003 is the difference between checking the wiring and checking the
 * outcome.
 *
 * 🔴 All three read {@link LessonEvalContext.database} and **never** return `true` against a
 * snapshot that is missing, refused or unavailable. See {@link databaseRefusal} for how a caller
 * turns that into a sentence rather than an unticked box.
 */
export interface CollectionExistsCondition {
  /** Collection name. Compared case-insensitively — SQLite identifiers are. */
  collection: string;
  collectionexists: boolean;
}
export interface CollectionHasColumnsCondition {
  collection: string;
  /** Comma-separated column names, all of which must be present. Matches `hasparams`' shape. */
  collectionhascolumns: string;
}
export interface CollectionRowCountAtLeastCondition {
  collection: string;
  collectionrowcountatleast: number;
}

export type LessonCondition =
  | HasTypeCondition
  | HasPortCondition
  | HasLabelCondition
  | ExistsCondition
  | IsVisualRootCondition
  | HasParamsCondition
  | ParamsEqCondition
  | HasConnectionCondition
  | MetadataCondition
  | ViewerPathEqCondition
  | ActiveComponentNameEqCondition
  | RouterListsCondition
  | CollectionExistsCondition
  | CollectionHasColumnsCondition
  | CollectionRowCountAtLeastCondition;

/** The three TUT-002 verbs, by their compiled (internal, lower-case) key. */
const COLLECTION_VERBS = ['collectionexists', 'collectionhascolumns', 'collectionrowcountatleast'] as const;

/** True when this condition observes the built-in database rather than the graph. */
export function isCollectionCondition(condition: LessonCondition): boolean {
  return COLLECTION_VERBS.some((v) => v in (condition as unknown as Record<string, unknown>));
}

/**
 * TUT-002 — why these conditions could not be graded, or `undefined` if they could.
 *
 * 🔴 **A collection verb against a refused binding must not read as `false`.** `false` is the same
 * answer the evaluator gives a learner who simply has not made the collection yet, so a lesson
 * graded against a Directus-bound project would sit there un-ticking forever with nothing on screen
 * explaining why. This is the same distinction `lessonprojectcontext`'s `unevaluableReason` draws,
 * and it exists for the same reason: **a check that could not run has not found anything.**
 *
 * Callers surface this sentence *instead of* the unticked step, never alongside a `true`.
 */
export function databaseRefusal(conditions: LessonCondition[], ctx: LessonEvalContext): string | undefined {
  if (!conditions.some(isCollectionCondition)) return undefined;

  const snapshot = ctx.database;
  if (!snapshot) {
    return (
      'This step grades against the built-in database, and nothing read it. ' +
      'The grader was given no database snapshot.'
    );
  }
  if (snapshot.status === 'refused') {
    return (
      `This lesson grades against the built-in database, and this project is bound to ` +
      `${snapshot.binding}. The lesson will not query it — point the project at its built-in ` +
      `backend in Backend Services to continue.`
    );
  }
  if (snapshot.status === 'unavailable') {
    return `This step grades against the built-in database, which could not be read: ${snapshot.reason}.`;
  }
  return undefined;
}

// ─── Small helpers (replacing underscore / eval / assert) ───────────────────

function splitAndTrim(stringList: string | undefined): string[] {
  if (!stringList) return [];
  return stringList.split(',').map((s) => s.trim());
}

/** TUT-002 — the collections the snapshot can actually vouch for, or undefined. */
function readableCollections(ctx: LessonEvalContext): LessonCollection[] | undefined {
  return ctx.database && ctx.database.status === 'ok' ? ctx.database.collections : undefined;
}

/** TUT-002 — one collection by name, case-insensitively, from a readable snapshot only. */
function findCollection(ctx: LessonEvalContext, name: string): LessonCollection | undefined {
  const collections = readableCollections(ctx);
  if (!collections || typeof name !== 'string') return undefined;
  const wanted = name.trim().toLowerCase();
  if (wanted === '') return undefined;
  return collections.find((c) => c.name.trim().toLowerCase() === wanted);
}

/** Case-insensitive string equality that tolerates non-string operands. */
function eqi(a: unknown, b: unknown): boolean {
  if (typeof a === 'string' && typeof b === 'string') return a.toLowerCase() === b.toLowerCase();
  return a === b;
}

function getPortTypeName(node: LessonNode, paramName: string): string | undefined {
  const port = node.getPort(paramName, 'input');
  if (!port) return undefined;
  return typeof port.type === 'object' ? port.type?.name : port.type;
}

/**
 * Parse a stored/expected `array`-typed parameter value into a comparable form,
 * replacing the legacy `eval()`. Values are usually JSON, but authored content
 * and older projects can use JS-array literals with single quotes, so we fall
 * back to a lenient quote-normalising parse before giving up and comparing raw.
 */
export function parseArrayValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (trimmed === '') return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    // Lenient: turn `['a', 'b',]` into valid JSON. Best-effort only.
    try {
      const normalised = trimmed.replace(/'/g, '"').replace(/,\s*([\]}])/g, '$1');
      return JSON.parse(normalised);
    } catch {
      return value;
    }
  }
}

/** Structural deep equality — order-sensitive for arrays, key-set-sensitive for objects. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (a && b && typeof a === 'object') {
    const ak = Object.keys(a as object);
    const bk = Object.keys(b as object);
    if (ak.length !== bk.length) return false;
    return ak.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return false;
}

/** `object` contains every key of `attrs` with an equal value (arrays compared as sets). */
function isMatch(object: Record<string, unknown>, attrs: Record<string, unknown>): boolean {
  if (object == null) return Object.keys(attrs).length === 0;
  for (const key of Object.keys(attrs)) {
    if (!(key in object)) return false;
    const a = attrs[key];
    const b = object[key];
    if (Array.isArray(a) && Array.isArray(b)) {
      // Set equality: same length and no element in `a` missing from `b`.
      if (a.length !== b.length) return false;
      if (a.some((el) => !b.includes(el))) return false;
    } else if (a !== b) {
      return false;
    }
  }
  return true;
}

// ─── Node-path resolution ───────────────────────────────────────────────────
// Path grammar: "Component:#label:%type:idx", walking component.graph.roots and
// node.children. Segments: `#name` = by label, `%name` = by type name, bare
// number = by child index. Semantic (names/types), not DOM-coupled.

/**
 * FIX-025 — 🔴 A `#label` OR `%type` SEGMENT SEARCHES THE WHOLE SUBTREE, not one level of it.
 *
 * Reported by Richard against the shipped *State on a page* lesson, whose last step asks the
 * learner to drag a second `Text` onto the page and label it `Caption`, then grades it with
 * `/#__page__/Home:#Caption`. He did it; the node is in the project file with `"type": "Text"`
 * and `"label": "Caption"`; the step never completed.
 *
 * **A node dropped onto a page is a CHILD of the `Page` node**, and this resolver only ever
 * looked at `component.graph.roots`. So the grammar could not express *"the Caption somewhere
 * on this page"* — which is the only thing a lesson author ever means by a label — and the
 * lesson's other two graded steps (`%Text`, `%Variable2`) were unreachable for the same reason.
 * The lesson had never been completable; nothing detected that because every fixture in the
 * suite put the graded node at the root.
 *
 * ⚠️ **A bare numeric segment is deliberately NOT descended.** An index is positional and only
 * means anything among siblings; searching a subtree for "the third node" would return
 * something arbitrary rather than nothing. Names are unique enough to search for, indices are not.
 *
 * ⚠️ Breadth-first, so the shallowest match wins. With depth-first, adding a nested decoy
 * *deeper* in an earlier branch would silently steal a path that used to resolve to the
 * obvious node.
 */
function findInSubtree(nodes: LessonNode[], matches: (node: LessonNode) => boolean): LessonNode | undefined {
  let level = nodes;
  while (level.length) {
    const hit = level.find(matches);
    if (hit) return hit;
    level = level.flatMap((n) => n.children ?? []);
  }
  return undefined;
}

export function findNodeWithPath(path: string, components: LessonComponent[]): LessonNode | undefined {
  const tokens = path.split(':');

  const component = components.find((c) => eqi(c.name, tokens[0]));
  if (!component) return undefined;
  if (tokens.length === 1) {
    // A path with only a component name resolves to "the component" — represented
    // here as a truthy sentinel so `exists` works. Callers that need a node treat
    // this as present-but-not-a-node.
    return component as unknown as LessonNode;
  }

  function findNodeThatMatches(nodes: LessonNode[], index: number): LessonNode | undefined {
    const ref = tokens[index];
    const lastToken = index === tokens.length - 1;

    let match: LessonNode | undefined;
    if (ref[0] === '#') {
      const label = ref.substring(1);
      match = findInSubtree(nodes, (n) => eqi(n.label, label));
    } else if (ref[0] === '%') {
      const typename = ref.substring(1);
      match = findInSubtree(nodes, (n) => !!n.type && eqi(n.type.name, typename));
    } else {
      // See the note above: positional, so siblings only.
      match = nodes[parseFloat(ref)];
    }

    if (!match) return undefined;
    return lastToken ? match : findNodeThatMatches(match.children, index + 1);
  }

  return findNodeThatMatches(component.graph.roots, 1);
}

/**
 * Every node in every component, depth-first.
 *
 * Lives here rather than in `lessonprojectcontext.ts` (which had it first, and
 * now delegates) because the evaluator is the lower layer and needs it: the
 * unscoped `routerlists` verb has to look at *all* routers, and a router is
 * rarely a graph root.
 */
export function everyNode(components: LessonComponent[]): LessonNode[] {
  const out: LessonNode[] = [];
  const visit = (nodes: LessonNode[]) => {
    for (const n of nodes) {
      out.push(n);
      visit(n.children ?? []);
    }
  };
  for (const c of components) visit(c.graph?.roots ?? []);
  return out;
}

/**
 * Does this node route to `page`?
 *
 * Both halves are borrowed from `pageRegistration.ts`: which node types mount
 * pages, and how its `pages` parameter is read defensively — a hand-edited or
 * half-understood value must never throw here, because the answer for a
 * malformed router is simply "no, it does not list that page", which is true and
 * is what the learner will experience.
 *
 * `isSamePage` supplies the tolerance: routes are stored as legacy names, and
 * `/#__page__/About` and `#__page__/About` are the same page written two ways.
 */
function routerListsPage(node: LessonNode, page: string): boolean {
  if (!node.type || !ROUTER_NODE_TYPES.has(node.type.name)) return false;
  return readRouterPagesValue(node.parameters).routes.some((route) => isSamePage(route, page));
}

// ─── Per-condition evaluation (pure) ────────────────────────────────────────

function hasParam(node: LessonNode, name: string): boolean {
  return Object.keys(node.parameters).some((k) => eqi(k, name));
}

function isParamEqual(node: LessonNode, paramName: string, expected: unknown): boolean {
  for (const key of Object.keys(node.parameters)) {
    if (!eqi(key, paramName)) continue;
    const actual = node.parameters[key];

    if (typeof actual === 'object' && actual !== null) {
      return isMatch(actual as Record<string, unknown>, expected as Record<string, unknown>);
    }

    const portType = getPortTypeName(node, paramName);
    if (portType === 'array') {
      return deepEqual(parseArrayValue(actual), parseArrayValue(expected));
    }
    if (portType === 'stringlist') {
      // Order-independent comma lists.
      const actualList = String(actual ?? '').split(',').sort();
      const expectedList = String(expected ?? '').split(',').sort();
      return actualList.join(',') === expectedList.join(',');
    }
    if (typeof actual === 'string' && typeof expected === 'string') {
      return actual.toLowerCase() === expected.toLowerCase();
    }
    return actual === expected;
  }
  return false;
}

/**
 * Evaluate a single condition against current editor state. Pure: no mutation,
 * no side effects. Unknown/malformed conditions throw so the layer can surface
 * an authoring error to the lesson author.
 */
export function evaluateSingleCondition(condition: LessonCondition, ctx: LessonEvalContext): boolean {
  const cond = condition as unknown as Record<string, unknown>;

  if ('hastype' in cond) {
    const node = findNodeWithPath(cond.path as string, ctx.components);
    return !!(node && node.type && eqi(node.type.name, cond.hastype));
  }

  if ('hasport' in cond) {
    const node = findNodeWithPath(cond.path as string, ctx.components);
    if (!node || !node.ports) return false;
    return node.ports.some((p) => eqi(p.name, cond.hasport));
  }

  if ('haslabel' in cond) {
    const node = findNodeWithPath(cond.path as string, ctx.components);
    return !!(node && eqi(node.label, cond.haslabel));
  }

  if ('exists' in cond) {
    const node = findNodeWithPath(cond.path as string, ctx.components);
    return cond.exists === true ? node !== undefined : node === undefined;
  }

  if ('isvisualroot' in cond) {
    const node = findNodeWithPath(cond.path as string, ctx.components);
    const isRoot = node === ctx.rootNode;
    return cond.isvisualroot === true ? isRoot : !isRoot;
  }

  if ('hasparams' in cond) {
    const node = findNodeWithPath(cond.path as string, ctx.components);
    if (!node) return false;
    return splitAndTrim(cond.hasparams as string).every((p) => hasParam(node, p));
  }

  if ('paramseq' in cond) {
    const node = findNodeWithPath(cond.path as string, ctx.components);
    if (!node) return false;
    const params = cond.paramseq as Record<string, unknown>;
    return Object.keys(params).every((name) => isParamEqual(node, name, params[name]));
  }

  if ('hasconnection' in cond) {
    if (!cond.to) throw new Error("'hasconnection' condition is missing a 'to' property");
    if (!cond.from) throw new Error("'hasconnection' condition is missing a 'from' property");

    const from = findNodeWithPath(cond.from as string, ctx.components);
    if (!from) return false;
    const to = findNodeWithPath(cond.to as string, ctx.components);
    if (!to) return false;

    const ports = splitAndTrim(cond.hasconnection as string);
    let connected = false;
    from.forAllConnectionsOnThisNode((c) => {
      if (
        c.fromId === from.id &&
        c.toId === to.id &&
        eqi(c.fromProperty, ports[0]) &&
        eqi(c.toProperty, ports[1])
      ) {
        connected = true;
      }
    });
    return connected;
  }

  if ('metadata' in cond) {
    const [key, subkey] = (cond.metadata as string).split(':');
    const data = ctx.getMetaData(key);
    return !!(data && data[subkey] === cond.equals);
  }

  if ('viewerpatheq' in cond) {
    return cond.viewerpatheq === ctx.viewerPath;
  }

  if ('activecomponentnameeq' in cond) {
    return cond.activecomponentnameeq === ctx.activeComponentName;
  }

  if ('routerlists' in cond) {
    const page = cond.routerlists as string;
    // Scoped: the author named one router, so only that one may answer. A path
    // that resolves to something which is not a router is `false`, not an
    // error — the same shape every other node-path verb has when the node is
    // missing, and the F2 replay is what tells the author about it.
    if (typeof cond.path === 'string') {
      const node = findNodeWithPath(cond.path, ctx.components);
      return !!node && routerListsPage(node, page);
    }
    // Unscoped: any Router or Page Stack anywhere in the project.
    return everyNode(ctx.components).some((n) => routerListsPage(n, page));
  }

  // ── TUT-002: the three verbs that observe the built-in database ──────────
  //
  // 🔴 Every arm below returns `false` for a snapshot that is not `ok`. That is deliberately the
  // safe direction — a grader that cannot see the database must never congratulate — and it is
  // only half the answer: `databaseRefusal()` is what turns "refused" into a sentence, so the two
  // are not read as the same thing by the learner. Do not "simplify" one without the other.
  if ('collectionexists' in cond) {
    const found = findCollection(ctx, cond.collection as string);
    // A `false` expectation is answerable from an `ok` snapshot: the collection is genuinely
    // absent. It is NOT answerable from a missing one, which is why the guard is on the snapshot
    // rather than on `found`.
    if (!readableCollections(ctx)) return false;
    return (cond.collectionexists as boolean) ? !!found : !found;
  }

  if ('collectionhascolumns' in cond) {
    const found = findCollection(ctx, cond.collection as string);
    if (!found) return false;
    const wanted = splitAndTrim(cond.collectionhascolumns as string).filter((c) => c !== '');
    if (wanted.length === 0) return false;
    const have = new Set(found.columns.map((c) => c.toLowerCase()));
    // Case-insensitive: SQLite identifiers are, and `planSchemaReconciliation` already paid for
    // assuming otherwise — `ADD COLUMN age` against an existing `Age` fails, and
    // `SchemaManager.addColumn` swallows precisely that error.
    return wanted.every((c) => have.has(c.toLowerCase()));
  }

  if ('collectionrowcountatleast' in cond) {
    const found = findCollection(ctx, cond.collection as string);
    if (!found) return false;
    // 🔴 `rowCount` absent means the snapshot could not count, which is not the same as zero.
    // Without this guard `rowCountAtLeast: 0` would hold against a collection nobody could read.
    if (typeof found.rowCount !== 'number') return false;
    return found.rowCount >= (cond.collectionrowcountatleast as number);
  }

  throw new Error(`Unknown lesson condition: ${JSON.stringify(condition)}`);
}

/**
 * A step is complete when *all* its conditions hold against the given context.
 * Pure — does not mutate `conditions`.
 */
export function evalConditionsWithContext(conditions: LessonCondition[], ctx: LessonEvalContext): boolean {
  return conditions.every((c) => evaluateSingleCondition(c, ctx));
}

// 🔴 `liveLessonEvalContext()` and the default `evalConditions()` used to live
// here and are now in `./lessonevalconditions.live.ts`. See the note at the top
// of this file: an inside-the-function `require` was never enough, because a
// bundler resolves it anyway. Nothing below this line may reach an editor
// singleton, directly or through an import.
