/**
 * UNI-010 — deriving a lesson's STARTER from its solution, by subtraction.
 *
 * WHY THIS EXISTS, AND WHY IT IS NOT AN ERGONOMIC CONVENIENCE
 * -----------------------------------------------------------
 * `create_lesson` takes two project directories: the starter the learner opens
 * and the solution the lesson's conditions are replayed against. The MCP server
 * binds **one** project, so an authoring model builds the solution with the
 * ordinary write tools and then has to produce the starter some other way. Slice
 * 2 recorded that as "works, and is not ergonomic". The criterion-3 run turned it
 * into something sharper.
 *
 * That run authored five lessons and every one of its starters was built by
 * **subtraction from the solution** — and the harness's ghostwriting refusal
 * (F2′, *"this step is already complete in the project the learner opens"*) fired
 * **zero times in five lessons**. The run's own §11 says why that number is an
 * upper bound rather than a result: subtraction makes ghostwriting structurally
 * hard to commit, and a model building the two projects *independently* is far
 * more exposed to it. The natural way to author a lesson is to build the finished
 * thing and describe it — at which point the starter you ship **is** the solution.
 *
 * So this module makes the safe route the cheap one.
 *
 * 🔴 THE STRUCTURAL GUARANTEE, PARTLY BACK
 * ----------------------------------------
 * The 2026-08-14 ruling traded a structural guarantee for a gate: the prior arc's
 * §3.1 held that *a condition never generated cannot be wrong*, and UNI-010 let a
 * model author predicates freely in exchange for the F1–F6 verifier absorbing the
 * risk. That trade is not reversed here and should not be. But F2′ specifically
 * is a class **construction** can answer better than inspection can: a starter
 * derived by retracting each graded step's own conditions cannot ghostwrite them.
 *
 * ⚠️ **And that is exactly why this module measures instead of assuming.** A
 * derivation that guaranteed F2′ by construction, and said so, would make the
 * gate's F2′ check vacuous for every lesson authored this way — and a check that
 * cannot fail is one nobody audits. So the postcondition below is *evaluated*,
 * through the same evaluator the gate uses, and this module refuses when it does
 * not hold. F2′ then still means something at `create_lesson`, on a second and
 * independent code path, and this module's own claim is checked rather than
 * asserted.
 *
 * 🔴 THE VERB IS THE GRANULARITY, AND THAT IS THE WHOLE DESIGN
 * ------------------------------------------------------------
 * The hard question in subtraction is *how much* to take away. "The learner adds
 * a Text node" and "the learner types into the Text node that is already there"
 * are different lessons, and no amount of reading the prose settles it. The
 * condition settles it, because the author already had to choose a verb:
 *
 * | The step's condition says | So the starter | Because |
 * |---|---|---|
 * | `hasType` / `exists` / `hasLabel` / `hasPort` | **has no such node** | the step is about the node being there |
 * | `hasParams` / `paramsEqual` | has the node, **with those parameters unset** | the step is about the values |
 * | `connection` | has both nodes, **not wired** | the step is about the wire |
 * | `routerLists` | has the page, **not listed by the router** | the step is about reachability |
 * | `metadata` | **without that metadata key** | the step is about a project setting |
 * | every node of a component | **has no such component** — unless something still refers to it | the step is about creating it, or about filling it in (P79 L1) |
 *
 * A model that wrote a lenient condition therefore gets a lenient subtraction,
 * which is the one-directional authoring gradient the criterion-3 run named (F2
 * punishes a condition that is too strong and nothing punishes one that is too
 * weak) showing up in a second place. ⚠️ It is not made worse here — a starter
 * that still holds the answer is caught by the postcondition — but it is not
 * fixed here either, and the brief is where that is addressed.
 *
 * ⚠️ WHAT THIS DELIBERATELY DOES NOT DO
 * -------------------------------------
 * - **It does not render or validate the starter.** A starter that draws nothing
 *   is the ordinary case — an empty page is where a lesson begins — so a render
 *   gate here would refuse correct work, which is the failure this arc has
 *   already paid for once (RULINGS.md, the fourth amendment).
 * - **It does not retract `isVisualRoot`.** Clearing the project's root node
 *   leaves a project that cannot render anything at all, which is a worse starter
 *   than one that ghostwrites a step. It is reported as unsupported, the
 *   postcondition then fails honestly, and the author is told which step.
 * - **It has no per-step override.** If the default subtraction is wrong for a
 *   step, the author builds that starter by hand — which is exactly today's
 *   position, so nothing regresses. Recorded as a known limit rather than
 *   designed around, because the run has no evidence about which overrides are
 *   wanted and inventing them would be guessing at a vocabulary.
 *
 * Pure: files in, files out. No filesystem, no Electron, no editor singleton —
 * the caller reads and writes, so `noodl-mcp` bundles this without a renderer.
 *
 * @module noodl-editor/models/lessonstarter
 */

import { stepConditions } from './lessonbundleverify';
import { buildLessonEvalContext } from './lessonprojectcontext';
import type { LessonProjectComponentFiles, LessonProjectSource } from './lessonprojectcontext';
import { isSamePage, readRouterPagesValue, ROUTER_NODE_TYPES } from './AiAssistant/authoring/pageRegistration';
import { toLegacyName } from '../io/ProjectImporter';
import type { LessonManifest } from './lessonformat';
import { evalConditionsWithContext, findNodeWithPath } from '../views/lessons/lessonevalconditions';
import type { LessonCondition } from '../views/lessons/lessonevalconditions';
import type { ConnectionV2, NodeV2 } from '../schemas';

// ─── What a derivation reports ──────────────────────────────────────────────

export type RetractionKind =
  /** The addressed node, and everything under it, is not in the starter. */
  | 'remove-node'
  /** The node stays; the named parameters are unset. */
  | 'clear-params'
  /** Both nodes stay; the wire between those two ports is gone. */
  | 'remove-connection'
  /** The page stays; no router lists it. */
  | 'remove-route'
  /** A project metadata key is unset. */
  | 'clear-metadata'
  /**
   * A whole component is not in the starter, because every node in it was
   * subtracted and nothing else in the project refers to it (P79 L1).
   *
   * The learner is being asked to CREATE the component, and a starter that
   * shipped an empty directory under its name would hand them a component they
   * are then told to make. Reported once per component, against the step that
   * removed its last node.
   */
  | 'remove-component'
  /**
   * Nothing was retracted, and the reason is recorded rather than swallowed.
   *
   * 🔴 This is never *by itself* a refusal. Whether it matters is decided by the
   * postcondition: an unretractable condition alongside others that were
   * retracted may still leave the step incomplete in the starter, which is all
   * that is actually required.
   */
  | 'unsupported';

export interface StarterRetraction {
  /** Zero-based step index, matching the scorecard's `step` field. */
  step: number;
  where: string;
  kind: RetractionKind;
  /** One sentence, written for the authoring model that has to act on it. */
  detail: string;
}

export interface DeriveStarterResult {
  /**
   * The derived project — present **only** when every postcondition held.
   *
   * 🔴 Absent on refusal rather than present-and-flagged. A caller with a
   * plausible-looking project in hand and a warning beside it writes the project;
   * this is the same argument `writeLessonBundle` makes for scoring before it
   * copies anything.
   */
  starter?: LessonProjectSource;
  retractions: StarterRetraction[];
  /**
   * Graded steps whose conditions **still hold** against the derived starter.
   * The postcondition, measured through the real evaluator rather than reasoned
   * about — these are the steps that would tick themselves on arrival.
   */
  stillSatisfied: Array<{ step: number; where: string }>;
  /**
   * References the subtraction would have left pointing at nothing. Always empty
   * when `starter` is present; a non-empty list is a bug in this module, not in
   * the lesson, and it says so.
   */
  danglingReferences: string[];
  /**
   * Registry paths of components the starter does not carry at all — emptied by
   * the subtraction and referenced by nothing that survived it. The writer
   * removes their directories and registry entries; without this list it would
   * copy them across as empty components (P79 L1).
   */
  removedComponents: string[];
  ok: boolean;
  /** Present when `starter` is absent. Written for a model to act on. */
  refusal?: string;
}

// ─── Small structural helpers over the v2 files ─────────────────────────────

function cloneSource(source: LessonProjectSource): LessonProjectSource {
  return {
    components: source.components.map((c) => ({
      registryPath: c.registryPath,
      component: structuredCloneish(c.component),
      nodes: structuredCloneish(c.nodes),
      connections: structuredCloneish(c.connections)
    })),
    ...(source.rootNodeId ? { rootNodeId: source.rootNodeId } : {}),
    ...(source.metadata ? { metadata: structuredCloneish(source.metadata) } : {})
  };
}

/**
 * JSON round-trip clone.
 *
 * ⚠️ Deliberately not `structuredClone`: these are files that came from JSON and
 * go back to JSON, so anything a JSON round trip would lose is already not
 * representable on disk — and a clone that preserved it would produce a starter
 * the writer cannot serialise faithfully.
 */
function structuredCloneish<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null)) as T;
}

/** Which component file holds this node id, or `undefined`. */
function componentHolding(source: LessonProjectSource, nodeId: string): LessonProjectComponentFiles | undefined {
  return source.components.find((c) => (c.nodes?.nodes ?? []).some((n) => n.id === nodeId));
}

/** A node id and every id beneath it, following the flat file's `children` refs. */
function nodeAndDescendants(files: LessonProjectComponentFiles, rootId: string): Set<string> {
  const byId = new Map<string, NodeV2>((files.nodes?.nodes ?? []).map((n) => [n.id, n]));
  const ids = new Set<string>();
  const queue = [rootId];

  while (queue.length) {
    const id = queue.shift() as string;
    if (ids.has(id)) continue;
    ids.add(id);
    for (const child of byId.get(id)?.children ?? []) {
      if (typeof child === 'string') queue.push(child);
    }
  }

  return ids;
}

/**
 * Remove a node and its subtree from one component's files, and repair every
 * reference to it.
 *
 * 🔴 The repair is the substance. A node entry deleted from `nodes.json` while a
 * parent's `children` array, `visualRoots`, or a connection still names it
 * produces a project that reads back with wires to nowhere — and the learner
 * opens it. The four places an id can be named are enumerated here rather than
 * discovered later, and `danglingReferences` re-checks the whole project
 * afterwards on the principle that an enumeration is a claim.
 */
function removeNodeSubtree(files: LessonProjectComponentFiles, rootId: string): Set<string> {
  const doomed = nodeAndDescendants(files, rootId);

  files.nodes.nodes = (files.nodes.nodes ?? []).filter((n) => !doomed.has(n.id));

  for (const node of files.nodes.nodes) {
    if (Array.isArray(node.children)) {
      node.children = node.children.filter((c) => !doomed.has(c));
    }
    if (typeof node.parent === 'string' && doomed.has(node.parent)) {
      delete node.parent;
    }
  }

  if (Array.isArray(files.nodes.visualRoots)) {
    files.nodes.visualRoots = files.nodes.visualRoots.filter((id) => !doomed.has(id));
  }

  files.connections.connections = (files.connections.connections ?? []).filter(
    (c) => !doomed.has(c.fromId) && !doomed.has(c.toId)
  );

  return doomed;
}

function clearParameters(source: LessonProjectSource, nodeId: string, names: readonly string[]): string[] {
  const files = componentHolding(source, nodeId);
  const node = (files?.nodes?.nodes ?? []).find((n) => n.id === nodeId);
  if (!node || !node.parameters) return [];

  const cleared: string[] = [];
  for (const name of names) {
    // Case-insensitively, because `isParamEqual` reads them that way and a
    // condition written `Text` against a parameter stored `text` would otherwise
    // clear nothing and refuse with a postcondition failure the author cannot
    // act on.
    const key = Object.keys(node.parameters).find((k) => k.toLowerCase() === name.toLowerCase());
    if (key === undefined) continue;
    delete node.parameters[key];
    cleared.push(key);
  }
  return cleared;
}

function removeConnection(
  source: LessonProjectSource,
  fromId: string,
  toId: string,
  fromPort: string,
  toPort: string
): boolean {
  const files = componentHolding(source, fromId);
  if (!files) return false;

  const before = files.connections.connections?.length ?? 0;
  files.connections.connections = (files.connections.connections ?? []).filter(
    (c: ConnectionV2) =>
      !(
        c.fromId === fromId &&
        c.toId === toId &&
        (c.fromProperty ?? '').toLowerCase() === fromPort.toLowerCase() &&
        (c.toProperty ?? '').toLowerCase() === toPort.toLowerCase()
      )
  );
  return (files.connections.connections?.length ?? 0) < before;
}

/**
 * Stop routers listing a page.
 *
 * `nodeId` scopes it to one router (the condition named a path); without one,
 * every Router and Page Stack in the project is de-listed, which is the same
 * reach the unscoped `routerLists` verb has. Borrowed semantics throughout —
 * `readRouterPagesValue` and `isSamePage` are the editor's own, from the module
 * its apply path writes `routes` with.
 */
function removeRoute(source: LessonProjectSource, page: string, nodeId?: string): number {
  let changed = 0;

  for (const files of source.components) {
    for (const node of files.nodes?.nodes ?? []) {
      if (!ROUTER_NODE_TYPES.has(node.type)) continue;
      if (nodeId !== undefined && node.id !== nodeId) continue;

      const pages = readRouterPagesValue(node.parameters as Record<string, unknown>);
      const routes = pages.routes.filter((route) => !isSamePage(route, page));
      const dropsStart = pages.startPage !== undefined && isSamePage(pages.startPage, page);
      if (routes.length === pages.routes.length && !dropsStart) continue;

      node.parameters = { ...(node.parameters ?? {}) };
      // ⚠️ `startPage` goes with it when it names the page being retracted. A
      // router listing no route to its own start page is a state the editor
      // never writes, and it would make the starter's own reachability worse
      // than the subtraction intended.
      node.parameters['pages'] = { ...(dropsStart ? {} : pages.startPage ? { startPage: pages.startPage } : {}), routes };
      changed++;
    }
  }

  return changed;
}

/** Every `fromPort → toPort` wire between two nodes, as the solution has them. */
function wiresBetween(source: LessonProjectSource, fromId: string, toId: string): string[] {
  const files = componentHolding(source, fromId);
  return (files?.connections?.connections ?? [])
    .filter((c) => c.fromId === fromId && c.toId === toId)
    .map((c) => `${c.fromProperty ?? ''} → ${c.toProperty ?? ''}`);
}

/**
 * Where the draft still refers to a component by its legacy name, if anywhere.
 *
 * Three places can: a node whose `type` is the component (an instance placed on
 * a page), a parameter naming it (a Repeater's `template`), and a router's page
 * list. The first sentence that fits is the one reported, because one is enough
 * to decide the question below.
 */
function referenceTo(source: LessonProjectSource, legacyName: string): string | undefined {
  for (const files of source.components) {
    for (const node of files.nodes?.nodes ?? []) {
      if (node.type === legacyName) {
        return `node ${node.id}${node.label ? ` ("${node.label}")` : ''} in ${files.registryPath} is an instance of it`;
      }
      if (ROUTER_NODE_TYPES.has(node.type)) {
        const pages = readRouterPagesValue(node.parameters as Record<string, unknown>);
        const listed = [...pages.routes, ...(pages.startPage ? [pages.startPage] : [])];
        if (listed.some((route) => isSamePage(route, legacyName))) {
          return `the router ${node.id} in ${files.registryPath} lists it as a page`;
        }
      }
      for (const [param, value] of Object.entries(node.parameters ?? {})) {
        if (value === legacyName) {
          return `node ${node.id}${node.label ? ` ("${node.label}")` : ''} in ${files.registryPath} names it in "${param}"`;
        }
      }
    }
  }
  return undefined;
}

/**
 * P79 L1 — a component whose every node the subtraction removed.
 *
 * 🔴 Two lessons look identical at this point and want opposite starters. *"Build
 * the Home page"* empties a page component that the router still lists: the
 * learner is filling in a component that exists, and the starter must keep it,
 * empty. *"Make a Snack component"* empties a component nothing refers to: the
 * learner is creating it, and a starter that carries an empty `/Snack` hands
 * them a component they are then told to make — which is what shipped lesson 8's
 * first derivation, and what the chain gate refused.
 *
 * The reference decides it, and the decision is written into the retraction
 * either way so an author whose lesson is the *inconsistent* third shape (the
 * learner creates a component a page already places) can see which reading was
 * taken and grade the instance too.
 *
 * ⚠️ Only a component the SOLUTION had nodes in. One that was empty to begin
 * with was not subtracted, and dropping it would be inventing a step.
 */
function dropEmptiedComponents(
  draft: LessonProjectSource,
  original: LessonProjectSource,
  removedNodes: Map<string, number>,
  retractions: StarterRetraction[]
): string[] {
  const removed: string[] = [];

  for (const files of [...draft.components]) {
    if ((files.nodes?.nodes ?? []).length > 0) continue;
    const before = original.components.find((c) => c.registryPath === files.registryPath);
    const hadNodes = (before?.nodes?.nodes ?? []).length > 0;
    if (!hadNodes) continue;

    const legacyName = toLegacyName(files.component, files.registryPath);
    // The step that took the last of it: the highest step index among its nodes.
    const step = Math.max(...(before?.nodes?.nodes ?? []).map((n) => removedNodes.get(n.id) ?? -1));
    const where = retractions.find((r) => r.step === step)?.where ?? `Step ${step + 1}`;

    const reference = referenceTo(draft, legacyName);
    if (reference) {
      retractions.push({
        step,
        where,
        kind: 'unsupported',
        detail:
          `kept "${legacyName}" (${files.registryPath}) as an EMPTY component: every node in it was removed, but ` +
          `${reference}. If the learner is meant to create this component rather than fill it in, grade that ` +
          'reference too and it will be dropped from the starter.'
      });
      continue;
    }

    draft.components.splice(draft.components.indexOf(files), 1);
    removed.push(files.registryPath);
    retractions.push({
      step,
      where,
      kind: 'remove-component',
      detail:
        `dropped "${legacyName}" (${files.registryPath}) from the starter: every node in it was removed and nothing ` +
        'else in the project refers to it, so the learner is creating the component, not filling it in.'
    });
  }

  return removed;
}

// ─── The postcondition's second half ────────────────────────────────────────

/**
 * Every id named by something that no longer exists.
 *
 * Runs over the *whole* derived project rather than the components the
 * subtraction touched, because that is the difference between checking the
 * repair and re-stating it.
 */
export function danglingReferences(source: LessonProjectSource): string[] {
  const problems: string[] = [];

  for (const files of source.components) {
    const ids = new Set((files.nodes?.nodes ?? []).map((n) => n.id));
    const where = files.registryPath;

    for (const node of files.nodes?.nodes ?? []) {
      for (const child of node.children ?? []) {
        if (!ids.has(child)) problems.push(`${where}: node ${node.id} lists a child ${child} that is not there.`);
      }
      if (typeof node.parent === 'string' && !ids.has(node.parent)) {
        problems.push(`${where}: node ${node.id} names a parent ${node.parent} that is not there.`);
      }
    }

    for (const id of files.nodes?.visualRoots ?? []) {
      if (!ids.has(id)) problems.push(`${where}: visualRoots names ${id}, which is not there.`);
    }

    for (const c of files.connections?.connections ?? []) {
      if (!ids.has(c.fromId)) problems.push(`${where}: a connection comes from ${c.fromId}, which is not there.`);
      if (!ids.has(c.toId)) problems.push(`${where}: a connection goes to ${c.toId}, which is not there.`);
    }
  }

  return problems;
}

// ─── One condition's retraction ─────────────────────────────────────────────

interface RetractionContext {
  /** The project being subtracted from, mutated in place. */
  draft: LessonProjectSource;
  /** The unmodified solution — what a wire or a node looked like before any step took it. */
  original: LessonProjectSource;
  /** Path resolution happens against the ORIGINAL, so one retraction cannot move another's target. */
  resolve(path: string): string | undefined;
  /** Zero-based index of the step whose condition is being retracted. */
  step: number;
  /**
   * Every node id a `remove-node` retraction has taken out so far, and the step
   * that took it. This is what lets a later `connection` condition say *"that
   * wire went with the node step 2 removed"* instead of *"no such wire"* — the
   * two sentences P79 G3 found being written identically.
   */
  removedNodes: Map<string, number>;
}

/**
 * Apply one condition's retraction to the draft, and say what it did.
 *
 * 🔴 Paths resolve against the **unmodified solution**, never against the draft.
 * `findNodeWithPath` returns the *first* match at each segment, so a `%Type`
 * segment resolved after a sibling has already been removed can name a different
 * node than the condition meant — the F3 lottery, run by this module rather than
 * by the learner. Resolving everything up front costs one context build and
 * removes the ordering dependency entirely.
 */
function retract(condition: LessonCondition, ctx: RetractionContext): { kind: RetractionKind; detail: string } {
  const cond = condition as unknown as Record<string, unknown>;
  const path = typeof cond.path === 'string' ? cond.path : undefined;

  // The node-identity verbs: the step is about the node being there at all.
  if ('hastype' in cond || 'exists' in cond || 'haslabel' in cond || 'hasport' in cond) {
    // `exists: false` asks for a node to be ABSENT, and it is already absent from
    // a solution that satisfies it — there is nothing to subtract, and removing
    // anything would be inventing work the lesson did not ask for.
    if ('exists' in cond && cond.exists !== true) {
      return {
        kind: 'unsupported',
        detail: `"${path}" is asked to be absent, which the solution already satisfies — nothing to remove.`
      };
    }

    const id = path ? ctx.resolve(path) : undefined;
    if (!id) {
      return {
        kind: 'unsupported',
        detail: `"${path}" does not resolve in the solution, so there is nothing to take out of the starter. That is a step the F2 replay will fail anyway.`
      };
    }

    const files = componentHolding(ctx.draft, id);
    if (!files) {
      // Already gone — two steps addressing the same node is ordinary (step 2
      // "add a Text", step 3 "and it is labelled Greeting"), and the second one
      // is satisfied by the first one's removal rather than unsupported by it.
      return { kind: 'remove-node', detail: `"${path}" (node ${id}) was already removed by an earlier step.` };
    }

    for (const doomed of removeNodeSubtree(files, id)) {
      if (!ctx.removedNodes.has(doomed)) ctx.removedNodes.set(doomed, ctx.step);
    }
    return { kind: 'remove-node', detail: `removed "${path}" (node ${id}) and anything under it.` };
  }

  if ('hasparams' in cond || 'paramseq' in cond) {
    const names =
      'hasparams' in cond
        ? String(cond.hasparams ?? '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : Object.keys((cond.paramseq as Record<string, unknown>) ?? {});

    const id = path ? ctx.resolve(path) : undefined;
    if (!id) {
      return {
        kind: 'unsupported',
        detail: `"${path}" does not resolve in the solution, so its parameters cannot be unset.`
      };
    }

    if (!componentHolding(ctx.draft, id)) {
      return { kind: 'clear-params', detail: `"${path}" was already removed by an earlier step, parameters with it.` };
    }

    const cleared = clearParameters(ctx.draft, id, names);
    if (cleared.length === 0) {
      return {
        kind: 'unsupported',
        detail: `"${path}" has none of ${JSON.stringify(names)} set in the solution, so there was nothing to unset.`
      };
    }
    return { kind: 'clear-params', detail: `unset ${JSON.stringify(cleared)} on "${path}".` };
  }

  if ('hasconnection' in cond) {
    const ports = String(cond.hasconnection ?? '')
      .split(',')
      .map((s) => s.trim());
    const fromId = typeof cond.from === 'string' ? ctx.resolve(cond.from) : undefined;
    const toId = typeof cond.to === 'string' ? ctx.resolve(cond.to) : undefined;
    if (!fromId || !toId || ports.length < 2) {
      return { kind: 'unsupported', detail: `the connection ${JSON.stringify(cond)} does not resolve in the solution.` };
    }

    const removed = removeConnection(ctx.draft, fromId, toId, ports[0], ports[1]);
    if (removed) {
      return {
        kind: 'remove-connection',
        detail: `removed the ${ports[0]} → ${ports[1]} wire from "${cond.from}" to "${cond.to}".`
      };
    }

    // 🔴 Three different absences, and only one of them is the author's mistake.
    // Written as three sentences because the benign one (the node went earlier,
    // and its wires with it) used to read identically to the typo (a port that
    // never existed), and a reader who had seen the benign one twice skimmed
    // past the real one — P79 G3.
    const goneWith = [
      [cond.from, ctx.removedNodes.get(fromId)] as const,
      [cond.to, ctx.removedNodes.get(toId)] as const
    ].filter(([, step]) => step !== undefined);
    if (goneWith.length) {
      const [where, step] = goneWith[0];
      return {
        kind: 'remove-connection',
        detail:
          `the ${ports[0]} → ${ports[1]} wire from "${cond.from}" to "${cond.to}" went when Step ${(step as number) + 1} ` +
          `removed "${where}" — nothing left to remove.`
      };
    }

    const inSolution = wiresBetween(ctx.original, fromId, toId);
    const wanted = `${ports[0]} → ${ports[1]}`.toLowerCase();
    if (inSolution.some((w) => w.toLowerCase() === wanted)) {
      return {
        kind: 'remove-connection',
        detail: `the ${ports[0]} → ${ports[1]} wire from "${cond.from}" to "${cond.to}" was already removed by an earlier step.`
      };
    }
    return {
      kind: 'unsupported',
      detail:
        `no ${ports[0]} → ${ports[1]} wire exists between "${cond.from}" and "${cond.to}" in the solution` +
        (inSolution.length
          ? ` — the wires that do: ${inSolution.join(', ')}. A port name that is not one of these is probably ` +
            'a typo, and the F2 replay will refuse it too.'
          : ' — those two nodes are not wired to each other at all. Check the paths and the port names.')
    };
  }

  if ('routerlists' in cond) {
    const page = String(cond.routerlists ?? '');
    const routerId = path ? ctx.resolve(path) : undefined;
    if (path && !routerId) {
      return { kind: 'unsupported', detail: `the router at "${path}" does not resolve in the solution.` };
    }

    const changed = removeRoute(ctx.draft, page, routerId);
    return changed > 0
      ? { kind: 'remove-route', detail: `stopped ${changed === 1 ? 'the router' : `${changed} routers`} listing "${page}".` }
      : { kind: 'unsupported', detail: `no router lists "${page}" in the solution, so there is nothing to unlist.` };
  }

  if ('metadata' in cond) {
    const [key, subkey] = String(cond.metadata ?? '').split(':');
    const bag = ctx.draft.metadata?.[key];
    if (!bag || typeof bag !== 'object' || !(subkey in (bag as Record<string, unknown>))) {
      return { kind: 'unsupported', detail: `project metadata has no "${key}:${subkey}" to unset.` };
    }
    delete (bag as Record<string, unknown>)[subkey];
    return { kind: 'clear-metadata', detail: `unset project metadata "${key}:${subkey}".` };
  }

  if ('isvisualroot' in cond) {
    return {
      kind: 'unsupported',
      detail:
        `"${path}" is asked to be the app's visual root, and clearing the project's root node would leave a ` +
        'starter that cannot render at all — a worse starter than one that ghostwrites a step. Give this step ' +
        'another condition, or build its starter by hand.'
    };
  }

  return {
    kind: 'unsupported',
    detail: `${JSON.stringify(condition)} observes a running editor, not the project files, so it cannot be retracted.`
  };
}

// ─── The derivation ─────────────────────────────────────────────────────────

/**
 * Derive a starter project from a solution and the lesson's own steps.
 *
 * Never throws for a lesson that is wrong — a lesson being wrong is the ordinary
 * case this exists to catch, and it comes back as `ok: false` with a refusal a
 * model can act on. The only inputs that are the *caller's* mistake (a solution
 * that is not a project) are the caller's to check before getting here.
 */
export function deriveLessonStarter(solution: LessonProjectSource, manifest: LessonManifest): DeriveStarterResult {
  const graded = stepConditions(manifest);
  const draft = cloneSource(solution);
  const retractions: StarterRetraction[] = [];

  // 🔴 Resolved against the original, once, for every retraction. See `retract`.
  const originalContext = buildLessonEvalContext(solution);
  const resolve = (path: string) => findNodeWithPath(path, originalContext.components)?.id;
  const removedNodes = new Map<string, number>();

  for (const step of graded) {
    if (step.compileError) {
      retractions.push({
        step: step.index,
        where: step.where,
        kind: 'unsupported',
        detail: `the step's conditions do not compile, so nothing could be retracted: ${step.compileError}`
      });
      continue;
    }

    for (const condition of step.checkable) {
      const done = retract(condition, { draft, original: solution, resolve, step: step.index, removedNodes });
      retractions.push({ step: step.index, where: step.where, ...done });
    }

    for (const skipped of step.skipped) {
      retractions.push({
        step: step.index,
        where: step.where,
        kind: 'unsupported',
        detail: `${skipped.reason} — so this condition cannot be subtracted, and the starter may satisfy it.`
      });
    }
  }

  const removedComponents = dropEmptiedComponents(draft, solution, removedNodes, retractions);

  // ─── The postcondition, measured ───────────────────────────────────────────
  // Through the real evaluator against the real derived files. The alternative —
  // trusting the retraction table — is exactly the module-header claim the fifth
  // amendment in RULINGS.md is about.
  const derived = buildLessonEvalContext(draft);
  const stillSatisfied: Array<{ step: number; where: string }> = [];

  for (const step of graded) {
    if (step.compileError || step.checkable.length === 0) continue;
    let holds: boolean;
    try {
      holds = evalConditionsWithContext(step.checkable, derived);
    } catch {
      // A condition that throws against the starter has not been shown to hold,
      // and the gate reports it as `condition-error` on its own terms. Treating
      // it as "still satisfied" here would refuse a bundle for a second reason
      // it is already going to be refused for, naming the wrong cause.
      continue;
    }
    if (holds) stillSatisfied.push({ step: step.index, where: step.where });
  }

  const dangling = danglingReferences(draft);
  const ok = stillSatisfied.length === 0 && dangling.length === 0;

  if (!ok) {
    return {
      retractions,
      stillSatisfied,
      danglingReferences: dangling,
      removedComponents,
      ok: false,
      refusal: buildRefusal(stillSatisfied, dangling, retractions)
    };
  }

  return { starter: draft, retractions, stillSatisfied, danglingReferences: dangling, removedComponents, ok: true };
}

function buildRefusal(
  stillSatisfied: Array<{ step: number; where: string }>,
  dangling: string[],
  retractions: StarterRetraction[]
): string {
  const parts: string[] = [];

  if (stillSatisfied.length) {
    const named = stillSatisfied.map((s) => s.where).join(', ');
    parts.push(
      `Nothing was written, because the derived starter still satisfies ${named}. A learner would open the ` +
        'lesson with that step already ticked, which is the one defect a starter must not have. ' +
        'Why it could not be subtracted, per step:'
    );
    for (const s of stillSatisfied) {
      const reasons = retractions
        .filter((r) => r.step === s.step && r.kind === 'unsupported')
        .map((r) => `  - ${r.detail}`);
      parts.push(`${s.where}:`);
      parts.push(reasons.length ? reasons.join('\n') : '  - every condition was retracted, and the step still holds.');
    }
  }

  if (dangling.length) {
    parts.push(
      'The subtraction left references pointing at nothing, which is a defect in derive_starter rather than in ' +
        'your lesson — please report it with the lesson that produced it:'
    );
    parts.push(dangling.map((d) => `  - ${d}`).join('\n'));
  }

  return parts.join('\n');
}
