/**
 * Which components a running app can actually reach (EXP-002-RECORD-VERBS-TARGET §20).
 *
 * The export emits every component in the project, and the coverage ledger counts every node in
 * every one of them. That is the right thing to emit and the wrong thing to *report*, because a
 * component no route can reach renders in no running app: its deferrals are not work the export
 * owes anybody, and its translated nodes are not reach the export has earned.
 *
 * Measured over the 40-project corpus, session 31: **904 of 4,441 nodes (20.4%) sit in components
 * nothing reaches, and they hold 432 of the 666 deferrals (64.9%)**. The largest single block is a
 * downloaded filter kit copied into eight projects and never placed on a page — 79 nodes each,
 * the whole of the "row identity" wall three handoffs in a row put at the top of the list.
 *
 * 🔴 A COMPONENT IS NAMED BY ITS LEGACY NAME, WHICH IS NOT ITS FOLDER. `components/__page__/Home`
 * is named `/#__page__/Home`, and that is the form a Router's `routes` are written in.
 * `parseProject` already carries it (`meta.path ?? meta.name`), so this module joins on
 * `/${component.path}` and never on a path it reconstructs. The first draft of the instrument that
 * found all this derived names from directories, and nine projects' routes read as unresolvable —
 * a shipped routing defect that does not exist. `ProjectImporter.toLegacyName` is the authority
 * and `lessonprojectcontext.ts:19-29` records the same trap being paid for once already.
 *
 * 🔴 THE WALK REFUSES TO ANSWER RATHER THAN GUESS. Two shapes make reachability unknowable, and
 * both return `unreachable: []` with the reason named instead of a confident empty-app answer:
 * a project with no resolvable route has no root to walk from, and a *reachable* For Each with
 * `templateType: 'dynamic'` picks its row component from row data at runtime, so any component
 * could be the one it instantiates. In this corpus every dynamic For Each sits inside the unplaced
 * kit — it is not reachable, so it cannot rescue anything — but the guard is what makes the claim
 * safe rather than lucky. [[assert-an-absence-with-a-known-firing-signal-beside-it]]
 */

import { ComponentIR, ExportIR } from '../ir/types';

export interface Reachability {
  /**
   * Legacy names ("/Filters/Range") no route reaches, in `ir.components` order (D1). Empty when
   * every component is reachable *and* when no claim can be made — read `inconclusive` to tell
   * those apart; they are opposite facts with an identical shape.
   */
  unreachable: string[];
  /** Why the walk declined to answer, or null when it did. */
  inconclusive: string | null;
}

/** Strings inside a parameter value that could name a component, whatever key they sat under. */
function componentRefsIn(value: unknown): string[] {
  if (typeof value === 'string') return value.startsWith('/') ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(componentRefsIn);
  if (value !== null && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap(componentRefsIn);
  }
  return [];
}

/**
 * Everything this component instantiates, as legacy names — filtered against the project's real
 * component list by the caller, so a stray "/" string in a script body costs nothing.
 *
 * Deliberately a scan of every parameter rather than a whitelist of the keys that are known to
 * hold one (`template`, `target`, `pages`, `path`, `targetComponent` — five node types in this
 * corpus alone). A key this misses would mark a live component dead, which is the one error that
 * would make the report wrong in a way a reader cannot check; a key it over-reads only ever
 * shrinks the answer.
 *
 * 🔴 `parameters` ONLY — never `declaredPorts`. A RouterNavigate's `target` port declares its type
 * as a *menu* of every routable page (`type.components: ["/#__page__/Home", "/Pages/Landing", …]`),
 * so a scan that included port declarations would make every page reachable from every navigate
 * node and quietly report zero orphans forever. The menu is what the author could pick; the
 * parameter is what they did pick. `parseProject` flattens `PortIR.type` to a string and drops the
 * list, so this is belt and braces — but it is the kind of edge a later "be more generous" change
 * adds without noticing it has disabled the whole module.
 */
function edgesFrom(component: ComponentIR): string[] {
  const out: string[] = [];
  for (const node of component.nodes) {
    if (node.type.startsWith('/')) out.push(node.type);
    // 🔴 A Router's own `pages` parameter is NOT an edge. Its routes are roots, read from the
    // parsed `RouterIR` — the same field `routedPages` builds the scaffold's route table from.
    // Scanning the blob as well makes the module answer from two independent copies of one fact:
    // benign while they agree, and it silently defeated the control that was supposed to prove a
    // page's reachability comes from its route (removing the route from `RouterIR` left the
    // component reachable through the App shell's stale parameter). One source of truth, and
    // reachability now agrees with the scaffold by construction.
    if (node.type === 'Router') continue;
    for (const param of node.parameters) {
      const raw =
        param.value.kind === 'literal' ? param.value.value : param.value.kind === 'json' ? param.value.value : null;
      out.push(...componentRefsIn(raw));
    }
  }
  return out;
}

/** A For Each whose row component is chosen by a script — it names no component, so it hides one. */
function hasDynamicTemplate(component: ComponentIR): boolean {
  return component.nodes.some((node) => {
    if (node.type !== 'For Each') return false;
    const templateType = node.parameters.find((p) => p.name === 'templateType')?.value;
    // foreach.tsx:496 — an absent `templateType` and 'explicit' both read the static `template`
    // input; only 'dynamic' runs `templateScript`. An *expression*-valued one is unknowable, and
    // unknowable has to count as dynamic: guessing 'static' is the reading that would let this
    // module call a live component dead.
    if (templateType === undefined) return false;
    if (templateType.kind !== 'literal') return true;
    return templateType.value === 'dynamic';
  });
}

export function componentReachability(ir: ExportIR): Reachability {
  const byLegacy = new Map<string, ComponentIR>();
  for (const component of ir.components) byLegacy.set(`/${component.path}`, component);

  // Roots: every route any router lists, plus the component each Router node lives in — the app
  // shell is live whether or not anything routes to it. `routers` is every Router in the project,
  // not just the one the scaffold builds its table from: a second router's pages still render.
  const roots = new Set<string>();
  for (const router of ir.project.routers) {
    const host = `/${router.componentPath}`;
    if (byLegacy.has(host)) roots.add(host);
    for (const route of [...router.routes, ...(router.startPage !== undefined ? [router.startPage] : [])]) {
      if (byLegacy.has(route)) roots.add(route);
    }
  }

  if (roots.size === 0) {
    return {
      unreachable: [],
      inconclusive:
        ir.project.routers.length === 0
          ? 'the project has no Router, so there is no route to walk from'
          : 'no Router route names a component this project has, so there is no root to walk from'
    };
  }

  const seen = new Set<string>();
  const stack = [...roots];
  while (stack.length > 0) {
    const legacy = stack.pop()!;
    if (seen.has(legacy)) continue;
    seen.add(legacy);
    const component = byLegacy.get(legacy);
    if (component === undefined) continue;
    for (const target of edgesFrom(component)) {
      if (byLegacy.has(target) && !seen.has(target)) stack.push(target);
    }
  }

  // A dynamic template inside a component the walk reached could instantiate anything, so no
  // component can be called unreachable. One inside a component the walk did NOT reach never runs,
  // and changes nothing — which is the case this corpus is made of.
  // Scanned in `ir.components` order (D1) rather than the walk's, so the component named in the
  // message is a function of the project and not of the order the stack happened to pop.
  const liveDynamic = ir.components.find((c) => seen.has(`/${c.path}`) && hasDynamicTemplate(c));
  if (liveDynamic !== undefined) {
    return {
      unreachable: [],
      inconclusive: `${liveDynamic.path} renders a For Each whose row component is chosen by a script, so any component could be the one it instantiates`
    };
  }

  return {
    unreachable: ir.components.map((c) => `/${c.path}`).filter((legacy) => !seen.has(legacy)),
    inconclusive: null
  };
}
