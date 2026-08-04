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
        ...(components.length > 0
          ? { suggestion: `Pages in this project: ${components.slice(0, 8).join(', ')}` }
          : {})
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
