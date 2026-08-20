/**
 * UNI-010 — a {@link LessonEvalContext} built from project files, with no editor.
 *
 * WHY THIS EXISTS
 * ---------------
 * UNI-007's engine 1 grades a step by evaluating its `completeWhen` conditions
 * against a context describing the editor's live state. That is the right shape
 * for grading a *learner*, and it is useless for grading a *lesson*: LEARN-009's
 * harness has to answer "do these conditions fire against the lesson's own
 * solution?" (failure class F2) and "would they still fire if a second plausible
 * node existed?" (class F3), and neither question has a running editor in it.
 *
 * So this module builds the same context out of the same files the editor would
 * load, and the harness evaluates the same compiled conditions through the same
 * evaluator. There is no second evaluator and no second path grammar — the whole
 * point of the exercise is that what the harness proves is what the learner will
 * experience.
 *
 * 🔴 THE RECONSTRUCTION IS BORROWED, NOT REIMPLEMENTED
 * ----------------------------------------------------
 * `reconstructLegacyComponent` and `toLegacyName` come straight from
 * `io/ProjectImporter` — the code the editor itself opens a v2 project with.
 * That matters more than tidiness. A condition's first path segment is matched
 * against the component's **legacy name**, and the legacy name is not the
 * registry path: this repo's own drive bundle has a component whose directory is
 * `components/__page__/Home` and whose name is `/#__page__/Home`. A harness that
 * named components after their folders would fail every condition in a correct
 * lesson and report the author's own solution as class F2 — a *manufactured*
 * failure, which is the one output a gate must never produce.
 *
 * 🔴 PORTS COME FROM THE CATALOG, BECAUSE A STORED NODE DOES NOT CARRY THEM
 * -------------------------------------------------------------------------
 * The same trap by a second route. A live `NodeGraphNode` knows its ports from
 * its type definition; a node on disk serialises only the *dynamic* ones. Build
 * the context from the file alone and `{ hasPort: "text" }` — true in the editor,
 * for every Text node ever made — reads false here. So the catalog's declared
 * inputs and outputs are folded in beside the instance ports, and `getPort`
 * answers from the union.
 *
 * ⚠️ WHAT THIS CONTEXT CANNOT KNOW, AND WHY IT SAYS SO
 * ----------------------------------------------------
 * Two of the eleven condition verbs observe the editor rather than the project —
 * `viewerPathEq` (which route the preview is showing) and `activeComponentNameEq`
 * (which component is open on the canvas). There is no file that answers them.
 *
 * Evaluating them anyway would return `false`, and a `false` here is
 * indistinguishable from "the solution does not satisfy this step" — the harness
 * would report class F2 against a lesson that is perfectly sound. So they are
 * reported as **not checkable**, never as failures. This is the same distinction
 * `WholeSolutionResult.unavailable` draws against `rendered: false`, for the same
 * reason: a check that could not run has not found anything, and a gate that
 * cannot tell those apart tells the author they are wrong when it means it does
 * not know.
 *
 * @module noodl-editor/models/lessonprojectcontext
 */

import { reconstructLegacyComponent, toLegacyName } from '../io/ProjectImporter';
import type { ComponentV2File, ConnectionsV2File, NodesV2File } from '../schemas';
import type { LegacyComponent, LegacyConnection, LegacyNode } from '../io/ProjectExporter';
import { CatalogIndex } from '../validation/CatalogIndex';
import { loadDefaultCatalog } from '../validation/catalog';
import { everyNode, isCollectionCondition } from '../views/lessons/lessonevalconditions';
import type {
  LessonComponent,
  LessonCondition,
  LessonConnection,
  LessonDatabaseSnapshot,
  LessonEvalContext,
  LessonNode,
  LessonPort
} from '../views/lessons/lessonevalconditions';

// ─── What the builder is given ──────────────────────────────────────────────

/** One component's three v2 files, as the editor's importer takes them. */
export interface LessonProjectComponentFiles {
  /** The registry key, e.g. `__page__/Home`. Only used when `component.path` is absent. */
  registryPath: string;
  component: ComponentV2File;
  nodes: NodesV2File;
  connections: ConnectionsV2File;
}

/**
 * A project, as far as lesson conditions can see it.
 *
 * `rootNodeId` and `metadata` come from `nodegx.project.json` and are what make
 * `isVisualRoot` and `metadata` conditions checkable — without them those two
 * verbs would join the unevaluable pair, which would be a bigger hole than it
 * looks: `isVisualRoot` is how a lesson asks "is this the page the app opens on".
 */
export interface LessonProjectSource {
  components: LessonProjectComponentFiles[];
  rootNodeId?: string;
  metadata?: Record<string, unknown>;
  /**
   * TUT-002 AC3 — the built-in database, pre-read by the caller, for the three collection verbs.
   *
   * 🔴 **Absent is the normal case here, and it is not "no collections".** There is no file that
   * answers "does this collection exist"; a bundle on disk simply does not contain the learner's
   * database. So a caller that has not started a backend omits this, and `unevaluableReason`
   * then reports collection conditions as **not checkable** rather than letting them evaluate to
   * `false` — which is the difference between "the harness could not answer" and "the author's
   * own solution fails its own step". The second is a *manufactured* failure, the one output a
   * gate must never produce.
   *
   * A caller that *has* read one — the MCP sidecar, from a backend it started — passes it, and
   * the same conditions grade through the same evaluator.
   */
  database?: LessonDatabaseSnapshot;
}

export interface BuildLessonContextOptions {
  /** Reuse a memoised index; defaults to the bundled catalog. */
  catalog?: CatalogIndex;
}

// ─── Which verbs a file-backed context can honestly answer ──────────────────

/**
 * The two condition verbs that observe the editor, not the project.
 *
 * Keyed by the *compiled* (internal, lower-case) verb, because that is what the
 * harness holds by the time it asks.
 */
export const EDITOR_ONLY_CONDITIONS: Record<string, string> = {
  viewerpatheq: 'which route the preview is showing is a property of a running editor, not of the project files',
  activecomponentnameeq: 'which component is open on the canvas is a property of a running editor, not of the project files'
};

/**
 * TUT-002 — the reason a collection verb is not checkable, when nobody read a database.
 *
 * 🔴 **A third kind of unanswerable, and it had to be one.** The two above are unanswerable
 * *always*; this one is unanswerable only when the caller supplied no snapshot — which is the
 * usual case for a bundle on disk, and never the case in the live editor. Left out, the harness
 * would replay `collectionExists` against a context with no database, read the evaluator's
 * (correct, safe) `false`, and report **F2 dead-on-solution** against a perfectly good data
 * lesson. F1's collection-reachability check is what covers these instead: it asks whether the
 * bundle's own projects ever name the collection, which files *can* answer.
 */
const NO_DATABASE_REASON =
  'this condition observes the project\'s built-in database, and no database snapshot was read — ' +
  'a bundle on disk does not contain the learner\'s data';

export interface UnevaluableOptions {
  /** True when the context this condition will be replayed against carries a database snapshot. */
  hasDatabase?: boolean;
}

/** Why this condition cannot be checked against files, or `undefined` if it can. */
export function unevaluableReason(condition: LessonCondition, options: UnevaluableOptions = {}): string | undefined {
  for (const key of Object.keys(condition as unknown as Record<string, unknown>)) {
    const reason = EDITOR_ONLY_CONDITIONS[key.toLowerCase()];
    if (reason) return reason;
  }
  if (!options.hasDatabase && isCollectionCondition(condition)) return NO_DATABASE_REASON;
  return undefined;
}

/** True when a file-backed context can answer this condition faithfully. */
export function staticallyEvaluable(condition: LessonCondition, options: UnevaluableOptions = {}): boolean {
  return unevaluableReason(condition, options) === undefined;
}

// ─── Node adaptation ────────────────────────────────────────────────────────

interface InstancePortLike {
  name?: unknown;
  type?: unknown;
  plug?: unknown;
}

function instancePorts(node: LegacyNode): InstancePortLike[] {
  const declared = Array.isArray(node.ports) ? node.ports : [];
  const dynamic = Array.isArray(node.dynamicports) ? node.dynamicports : [];
  return [...declared, ...dynamic].filter((p): p is InstancePortLike => !!p && typeof p === 'object');
}

/**
 * Every port the evaluator could see on this node in the editor: the catalog's
 * declared inputs and outputs, plus whatever the instance serialised.
 *
 * Instance ports are listed *first* so a node that re-declares a catalog port
 * with a narrower type wins — the instance is the more specific statement, and
 * `getPort` returns the first match.
 */
function portsFor(node: LegacyNode, catalog: CatalogIndex): Array<LessonPort & { plug?: string }> {
  const ports: Array<LessonPort & { plug?: string }> = [];

  for (const p of instancePorts(node)) {
    if (typeof p.name !== 'string') continue;
    ports.push({
      name: p.name,
      type: p.type as LessonPort['type'],
      ...(typeof p.plug === 'string' ? { plug: p.plug } : {})
    });
  }

  const catalogNode = catalog.getNode(node.type);
  for (const p of catalogNode?.inputs ?? []) {
    ports.push({ name: p.name, type: p.type as LessonPort['type'], plug: 'input' });
  }
  for (const p of catalogNode?.outputs ?? []) {
    ports.push({ name: p.name, type: p.type as LessonPort['type'], plug: 'output' });
  }

  return ports;
}

function eqi(a: string | undefined, b: string | undefined): boolean {
  return (a ?? '').toLowerCase() === (b ?? '').toLowerCase();
}

/**
 * Wrap one reconstructed node as a {@link LessonNode}.
 *
 * `connections` is the whole component's list, shared by reference across every
 * node in it — `forAllConnectionsOnThisNode` filters, exactly as the live
 * NodeGraphNode does.
 */
function toLessonNode(node: LegacyNode, connections: LegacyConnection[], catalog: CatalogIndex): LessonNode {
  const ports = portsFor(node, catalog);

  return {
    id: node.id,
    label: typeof node.label === 'string' ? node.label : '',
    type: { name: node.type },
    ports,
    parameters: (node.parameters as Record<string, unknown>) ?? {},
    children: (node.children ?? []).map((child) => toLessonNode(child, connections, catalog)),
    getPort(name: string, filter?: 'input' | 'output') {
      return ports.find((p) => eqi(p.name, name) && (!filter || !p.plug || p.plug === filter));
    },
    forAllConnectionsOnThisNode(callback: (connection: LessonConnection) => void) {
      for (const c of connections) {
        if (c.fromId === node.id || c.toId === node.id) {
          callback({ fromId: c.fromId, toId: c.toId, fromProperty: c.fromProperty, toProperty: c.toProperty });
        }
      }
    }
  };
}

function toLessonComponent(legacy: LegacyComponent, catalog: CatalogIndex): LessonComponent {
  const connections = legacy.graph?.connections ?? [];
  return {
    name: legacy.name,
    graph: { roots: (legacy.graph?.roots ?? []).map((n) => toLessonNode(n, connections, catalog)) }
  };
}

/**
 * Depth-first walk of a component's nodes.
 *
 * The implementation moved to the evaluator when the `routerLists` verb needed
 * the same walk (UNI-010 criterion 3 §12.4). Kept exported here because callers
 * and a spec name it, and because a walk in two places is a walk that will
 * disagree with itself the first time a node shape changes.
 */
export const walkNodes = everyNode;

// ─── The builder ────────────────────────────────────────────────────────────

/**
 * Build a lesson evaluation context from project files.
 *
 * Pure: no filesystem, no Electron, no editor singleton. The caller reads the
 * files — from a bundle directory in the MCP sidecar, from a fixture in a test —
 * and hands them in.
 */
export function buildLessonEvalContext(
  source: LessonProjectSource,
  options: BuildLessonContextOptions = {}
): LessonEvalContext {
  const catalog = options.catalog ?? loadDefaultCatalog();

  const components = (source.components ?? []).map((files) => {
    const legacy = reconstructLegacyComponent(
      files.registryPath,
      files.component ?? ({} as ComponentV2File),
      files.nodes ?? ({ componentId: files.registryPath, nodes: [] } as NodesV2File),
      files.connections ?? ({ componentId: files.registryPath, connections: [] } as ConnectionsV2File)
    );
    // `reconstructLegacyComponent` already resolves this; naming it here keeps
    // the reason visible at the one place a future edit might "simplify" it to
    // the registry path.
    legacy.name = toLegacyName(files.component ?? ({} as ComponentV2File), files.registryPath);
    return toLessonComponent(legacy, catalog);
  });

  const rootNode = source.rootNodeId
    ? walkNodes(components).find((n) => n.id === source.rootNodeId)
    : undefined;

  const metadata = source.metadata ?? {};

  return {
    components,
    rootNode,
    getMetaData: (key: string) => metadata[key] as Record<string, unknown> | undefined,
    // Deliberately undefined rather than guessed. See the module note: the two
    // verbs that read these are reported as not-checkable, never evaluated.
    viewerPath: undefined,
    activeComponentName: undefined,
    // TUT-002: present only when the caller read one. Omitted is not empty — see
    // `LessonProjectSource.database`.
    ...(source.database ? { database: source.database } : {})
  };
}

// ─── Decoy graphs (failure class F3) ────────────────────────────────────────

/**
 * A node synthesised to sit in front of the one a condition means.
 *
 * Empty on purpose: no label, no parameters, no connections. The decoy is a
 * *distractor*, not a second correct answer, so any condition that says
 * something substantive about the node it addresses will fail against it — which
 * is precisely the signal. A condition that survives an empty decoy is one whose
 * address does not depend on being first.
 */
function decoyNode(typeName: string): LessonNode {
  return {
    id: '__decoy__',
    label: '',
    type: { name: typeName },
    ports: [],
    parameters: {},
    children: [],
    getPort: () => undefined,
    forAllConnectionsOnThisNode: () => undefined
  };
}

export interface DecoyInjection {
  /** The path segment that made this possible, e.g. `%Text`. */
  segment: string;
  typeName: string;
  /** The components list with the decoy in it. The original is not mutated. */
  components: LessonComponent[];
}

/**
 * Insert a decoy in front of the node a `%Type` segment resolves to.
 *
 * 🔴 **Why this is the whole of the F3 test.** `findNodeWithPath` returns the
 * **first** node matching each segment (`lessonevalconditions.ts` — the walk is
 * `nodes.find(...)`, not a filter). So type-only addressing means "whichever one
 * happens to come first", and in a learner's own project the answer changes the
 * moment they add a second node of that type — which several lessons ask them to
 * do. Putting an empty decoy at the head of the same list reproduces that exact
 * state, and asks the only question that matters: does the step still pass?
 *
 * Returns one injection per `%Type` segment in the path, plus `undefined` for
 * none — a path that addresses purely by `#label` cannot be made ambiguous this
 * way, which is §3.2's binding recommendation *checked* rather than restated.
 */
export function injectDecoys(components: LessonComponent[], path: string): DecoyInjection[] {
  const tokens = path.split(':');
  const injections: DecoyInjection[] = [];

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token.startsWith('%')) continue;
    const typeName = token.substring(1);
    if (!typeName) continue;

    const clone = cloneComponents(components);
    const component = clone.find((c) => eqi(c.name, tokens[0]));
    if (!component) continue;

    // Walk the prefix on the *clone*, so the list we splice into is the clone's.
    let siblings: LessonNode[] | undefined = component.graph.roots;
    for (let j = 1; j < i && siblings; j++) {
      const parent = resolveSegment(siblings, tokens[j]);
      siblings = parent ? parent.children : undefined;
    }
    if (!siblings) continue;

    // Only meaningful if something is actually there to be shadowed. A decoy in
    // front of nothing turns "no match" into "wrong match", which is a different
    // (and already reported) defect.
    if (!resolveSegment(siblings, token)) continue;

    siblings.unshift(decoyNode(typeName));
    injections.push({ segment: token, typeName, components: clone });
  }

  return injections;
}

/** One path segment against a node list — the same three rules as `findNodeWithPath`. */
function resolveSegment(nodes: LessonNode[], ref: string): LessonNode | undefined {
  if (ref[0] === '#') return nodes.find((n) => eqi(n.label, ref.substring(1)));
  if (ref[0] === '%') return nodes.find((n) => n.type && eqi(n.type.name, ref.substring(1)));
  return nodes[parseFloat(ref)];
}

/**
 * Structural clone, deep enough to splice into and no deeper.
 *
 * The node objects carry closures (`getPort`, `forAllConnectionsOnThisNode`)
 * bound to the original node and its component's connections, so they are
 * *shared* rather than rebuilt: a decoy changes which node a path resolves to,
 * never what any real node reports about itself.
 */
function cloneComponents(components: LessonComponent[]): LessonComponent[] {
  const cloneNode = (n: LessonNode): LessonNode => ({ ...n, children: (n.children ?? []).map(cloneNode) });
  return components.map((c) => ({ ...c, graph: { roots: c.graph.roots.map(cloneNode) } }));
}

/**
 * Every `%Type` segment in `path` that already resolves ambiguously in this
 * project — more than one node of that type among the candidates.
 *
 * Distinct from the decoy test and weaker: this says the lottery is *already*
 * running in the author's own solution, which is worth telling them about even
 * when the step happens to pass.
 */
export function ambiguousTypeSegments(components: LessonComponent[], path: string): string[] {
  const tokens = path.split(':');
  const component = components.find((c) => eqi(c.name, tokens[0]));
  if (!component) return [];

  const ambiguous: string[] = [];
  let siblings: LessonNode[] | undefined = component.graph.roots;

  for (let i = 1; i < tokens.length && siblings; i++) {
    const token = tokens[i];
    if (token.startsWith('%')) {
      const typeName = token.substring(1);
      const matches = siblings.filter((n) => n.type && eqi(n.type.name, typeName));
      if (matches.length > 1) ambiguous.push(token);
    }
    const next = resolveSegment(siblings, token);
    siblings = next ? next.children : undefined;
  }

  return ambiguous;
}
