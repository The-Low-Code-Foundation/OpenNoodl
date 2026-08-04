/**
 * AAQ-001 — a navigation that lands somewhere.
 *
 * Richard's finding, in his words: *"'navigate to path' /puppies but there is no
 * such page"*. The mechanism behind it is not carelessness — the word "Router"
 * appeared **nowhere** in the AI stack, so the model had never been told that a
 * page exists by being listed in a Router's `pages` parameter, and it aimed
 * navigation at URLs it made up. Nothing checked. A dead button validates
 * perfectly: `RouterNavigate.target` is a runtime-discovered port, so the
 * unknown-parameter rule skips the node entirely, and any string is a valid
 * string.
 *
 * This is a *precondition* check, like `backendRequirement.ts` and for the same
 * reason: the answer depends on which components the project has, not on
 * anything the graph declares. Two identical Navigate nodes are correct in one
 * project and broken in another, and the semantic validator's model has no view
 * of a component list it should not gain.
 *
 * Pure — the caller supplies the nodes and the names that resolve.
 *
 * @module noodl-editor/validation/navigation
 */

import { DiagnosticCode, type Diagnostic, type Severity } from './diagnostics';

/**
 * Navigate nodes whose `target` is a component name. Both declare it as a
 * runtime-discovered port (`registerInputIfNeeded`), which is precisely why no
 * existing check could see it. External Link is deliberately absent: its `link`
 * is a URL to somewhere else entirely, and nothing here can say whether it
 * resolves.
 */
const COMPONENT_TARGET_TYPES: ReadonlySet<string> = new Set(['RouterNavigate', 'PageStackNavigate']);

/** Navigate nodes whose target is a URL path, resolved by a page's `urlPath`. */
const PATH_TARGET_TYPES: ReadonlySet<string> = new Set(['PageStackNavigateToPath']);

/** The nodes this check reads. Deliberately the same shape the other value checks take. */
export interface NavigatingNode {
  id: string;
  type: string;
  label?: string;
  parameters?: Record<string, unknown> | null;
}

export interface CheckNavigationOptions {
  /** Component identifier for the diagnostic's location. */
  component: string;
  /**
   * Every component name the target could legitimately name: the project's
   * components plus the ones the plan in flight is going to create. The planned
   * ones matter — a page authored before its sibling exists would otherwise be
   * told its perfectly good link is broken, purely because of the order the fan
   * out happened to run in.
   */
  components: readonly string[];
  /**
   * Url paths that resolve — one per page component that declares a `urlPath`.
   * Omitted means "do not check paths": a caller that cannot enumerate them
   * cannot tell a bad path from one it simply does not know about, and guessing
   * would report the app's own working links as broken.
   */
  urlPaths?: readonly string[];
  /** Severity for these findings. Defaults to `warning` — see {@link DiagnosticCode.UnresolvedNavigation}. */
  severity?: Severity;
}

/** Same name tolerance the rest of the stack has: `/Pages/X`, `Pages/X`, `#X`. */
function normalizeComponent(name: string): string {
  return name.trim().replace(/^\//, '').replace(/^#/, '').toLowerCase();
}

/** `/puppies`, `puppies`, `#/puppies` — one shape, so a leading slash is never the defect. */
function normalizePath(path: string): string {
  return path.trim().replace(/^#/, '').replace(/^\//, '').replace(/\/$/, '').toLowerCase();
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** The offered names, deduplicated on the identity {@link normalizeComponent} defines. */
function uniqueComponents(components: readonly string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const name of components) {
    const key = normalizeComponent(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(name);
  }
  return unique;
}

/** How many names a suggestion lists before it stops. */
const MAX_OFFERED = 8;

/**
 * What to navigate to instead.
 *
 * Two things this deliberately does NOT say. It does not call these "pages":
 * the list is every component the target could name, and `PageStackNavigate`
 * legitimately pushes a component that is not a page — telling a repairing agent
 * that `App` is a page it may navigate to is how a second wrong target gets
 * written. And when the list is cut short it says so, because a truncated list
 * read as complete is the same failure one layer down: the name the agent needed
 * was there, off the end, and nothing said so.
 */
function offerComponents(offered: readonly string[]): string {
  const shown = offered.slice(0, MAX_OFFERED);
  const rest = offered.length - shown.length;
  return (
    `Set "target" to one of these component names: ${shown.join(', ')}` +
    (rest > 0 ? ` (and ${rest} more).` : '.')
  );
}

/** The node type that makes a component a page, as far as the runtime is concerned. */
const PAGE_NODE_TYPE = 'Page';

export interface CheckPageShapeOptions {
  /** Component identifier for the diagnostic's location. */
  component: string;
  /**
   * Whether this component is one the project will route as a page. The caller
   * decides — it is the same question `stagedComponentIsPage` answers for the
   * apply, and this module holds no view of the naming convention.
   */
  isRoutedPage: boolean;
  /** Severity for the finding. Defaults to `warning` — blocking for authored output. */
  severity?: Severity;
}

/**
 * A page component the runtime will refuse to render.
 *
 * See {@link DiagnosticCode.PageWithoutPageNode}. In one sentence: a Router
 * route is resolved through the page index, the page index is built from `Page`
 * nodes and nothing else, so a routed component without one is a route to a
 * blank screen — reported by nobody, because every layer above it is working.
 *
 * Takes the node list rather than the component so it is the same shape the
 * other value checks take, and stays pure.
 */
export function checkPageShape(
  nodes: readonly NavigatingNode[],
  options: CheckPageShapeOptions
): Diagnostic[] {
  const { component, isRoutedPage, severity = 'warning' } = options;
  if (!isRoutedPage) return [];
  if (nodes.some((node) => node.type === PAGE_NODE_TYPE)) return [];

  return [
    {
      code: DiagnosticCode.PageWithoutPageNode,
      severity,
      message:
        `"${component}" will be registered as a page, but it has no Page node — so the router has ` +
        'nothing to show and the app renders a blank screen where this page should be.',
      location: { component },
      suggestion:
        'Make a Page node the root of this component and put the content inside it. Its "title" and ' +
        '"urlPath" are what give the page its browser tab and its URL.'
    }
  ];
}

/**
 * Navigations that cannot land, given what this project has.
 *
 * A path carrying a `{placeholder}` segment is never reported: its real value
 * arrives on an input port at runtime, so no static list can say whether it
 * resolves.
 */
export function checkNavigation(
  nodes: readonly NavigatingNode[],
  options: CheckNavigationOptions
): Diagnostic[] {
  const { component, components, urlPaths, severity = 'warning' } = options;
  const known = new Set(components.map(normalizeComponent));
  // The caller assembles this list from three sources that overlap — the
  // project's components, the candidate's own name, and the plan's other
  // targets — so the component being authored appears twice in every fan-out.
  // It is only ever *read* through `known` above, except in the suggestion,
  // where a duplicate is the first thing a reader notices and the last thing
  // they can explain. Deduplicated on normalized identity, first spelling kept.
  const offered = uniqueComponents(components);
  const paths = urlPaths ? new Set(urlPaths.map(normalizePath)) : undefined;
  const diagnostics: Diagnostic[] = [];

  for (const node of nodes) {
    const parameters = node.parameters ?? {};
    const where = node.label ? `"${node.label}"` : node.type;

    if (COMPONENT_TARGET_TYPES.has(node.type)) {
      const target = str(parameters['target']);
      if (!target) {
        // A Navigate with no target is the dead-button case the runtime itself
        // reports as `navigate/no-target-page` — at the moment someone presses
        // it, which is far too late to be useful.
        diagnostics.push({
          code: DiagnosticCode.UnresolvedNavigation,
          severity,
          message: `${where} navigates nowhere: no Target Page is set, so pressing it does nothing.`,
          location: { component, nodeId: node.id, port: 'target' },
          suggestion:
            'Set "target" to the page component name the router lists, e.g. "/Pages/Home".'
        });
        continue;
      }
      if (known.has(normalizeComponent(target))) continue;
      // The characteristic failure: a URL path written where a component name
      // belongs. Worth its own sentence — the repair is different from a typo.
      const looksLikePath = target.startsWith('/') && !known.has(normalizeComponent(target)) && !target.includes('/', 1);
      diagnostics.push({
        code: DiagnosticCode.UnresolvedNavigation,
        severity,
        message:
          `${where} navigates to "${target}", which is not a component in this project` +
          (looksLikePath ? ' — this looks like a URL path, and Target Page takes a component name.' : '.'),
        location: { component, nodeId: node.id, port: 'target' },
        ...(offered.length > 0 ? { suggestion: offerComponents(offered) } : {})
      });
      continue;
    }

    if (PATH_TARGET_TYPES.has(node.type)) {
      const path = str(parameters['path']);
      if (!path) {
        diagnostics.push({
          code: DiagnosticCode.UnresolvedNavigation,
          severity,
          message: `${where} navigates nowhere: no Path is set.`,
          location: { component, nodeId: node.id, port: 'path' }
        });
        continue;
      }
      if (!paths || path.includes('{')) continue;
      if (paths.has(normalizePath(path))) continue;
      diagnostics.push({
        code: DiagnosticCode.UnresolvedNavigation,
        severity,
        message:
          `${where} navigates to the path "${path}", which no page in this project declares — ` +
          'a page\'s URL is the "urlPath" on its Page node, and only a page the router lists can be reached.',
        location: { component, nodeId: node.id, port: 'path' },
        ...(paths.size > 0
          ? { suggestion: `Paths that resolve: ${[...paths].slice(0, 8).map((p) => `/${p}`).join(', ')}` }
          : {})
      });
    }
  }

  return diagnostics;
}
