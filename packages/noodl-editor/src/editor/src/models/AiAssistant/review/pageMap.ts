/**
 * AIX-010 — the page map, derived from what the project actually declares.
 *
 * The spec proposed reading `nodegx.routes.json` as "the page graph as declared,
 * not inferred". That file exists, but it is a *serialisation of
 * `metadata.routes`*, and `buildRoutesV2File` returns `null` unless that
 * metadata is array-shaped — which no hand-built project in this repo has,
 * including `project-examples/agent-chat`, the acceptance corpus. Nothing in the
 * runtime consumes it either. Keying the retrofit on it would have produced an
 * empty page map for exactly the projects this task exists to serve.
 *
 * What a real project declares is authored as node *parameters*, and it is every
 * bit as declarative:
 *
 *   Router      → { name, pages: { startPage, routes: [componentName…] } }
 *   Page        → { title, urlPath }              (in the page component itself)
 *   RouterNavigate / PageStackNavigate → { router, target }
 *
 * So this reads those, uses `metadata.routes` when it happens to exist, and
 * records which source each fact came from. A page known only by naming
 * convention is marked as such, because "we guessed from the folder name" and
 * "the Router names it" deserve different amounts of trust in a document a human
 * is about to sign off.
 *
 * Pure. No editor models, no filesystem.
 *
 * @module AiAssistant/review/pageMap
 */

import type { ExplainGraph, GraphNode } from '../explain/types';
import type { DeclaredRoute, NavigationEntry, PageMap, PageMapEntry, PageSource, RouterEntry } from './types';

/** Node types that mount pages. */
const ROUTER_TYPES = new Set(['Router', 'Page Stack']);
/** The node a page component puts at its root to declare its title and url. */
const PAGE_TYPES = new Set(['Page']);
/** Node types that navigate. Their `target` is a component name. */
const NAVIGATE_TYPES = new Set([
  'RouterNavigate',
  'PageStackNavigate',
  'PageStackNavigateToPath',
  'NavigateToPath'
]);

/** Component-name shapes that mean "page" when nothing better says so. */
const PAGE_NAME_PATTERNS = [/__page__/i, /(^|\/)pages\//i];

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** A Router's `pages` parameter: `{ startPage, routes: [...] }`, defensively read. */
function routerPages(node: GraphNode): { startPage?: string; routes: string[] } {
  const pages = node.parameters['pages'];
  if (!pages || typeof pages !== 'object') return { routes: [] };
  const record = pages as Record<string, unknown>;
  const routes = Array.isArray(record['routes'])
    ? (record['routes'] as unknown[]).map(str).filter((r): r is string => Boolean(r))
    : [];
  return { startPage: str(record['startPage']), routes };
}

/** Same name-shape tolerance `findComponent` uses: `/#Home`, `#Home`, `Home`. */
function sameComponent(a: string, b: string): boolean {
  const strip = (n: string) => n.replace(/^\//, '').replace(/^#/, '').toLowerCase();
  return a === b || strip(a) === strip(b);
}

function upsert(pages: Map<string, PageMapEntry>, component: string, patch: Partial<PageMapEntry>, source: PageSource) {
  const existing = pages.get(component);
  if (existing) {
    Object.assign(existing, { ...patch, sources: existing.sources });
    if (!existing.sources.includes(source)) existing.sources.push(source);
    return;
  }
  pages.set(component, { component, ...patch, sources: [source] });
}

/**
 * The page graph, from the strongest available source down to naming
 * convention. `declared` wins where it exists, because a route someone wrote
 * down is a route someone meant.
 */
export function buildPageMap(graph: ExplainGraph, declared?: readonly DeclaredRoute[]): PageMap {
  const pages = new Map<string, PageMapEntry>();
  const routers: RouterEntry[] = [];
  const navigations: NavigationEntry[] = [];
  const sources = new Set<PageSource>();

  for (const route of declared ?? []) {
    const component = str(route.component);
    if (!component) continue;
    sources.add('routes-file');
    upsert(pages, component, { urlPath: str(route.path), title: str(route.title) }, 'routes-file');
  }

  for (const component of graph.components) {
    for (const node of component.nodes) {
      if (ROUTER_TYPES.has(node.type)) {
        const { startPage, routes } = routerPages(node);
        const name = str(node.parameters['name']) ?? node.label ?? 'Main';
        routers.push({ name, host: component.name, startPage, pages: routes });
        for (const target of routes) {
          sources.add('router-node');
          upsert(pages, target, { router: name, isStart: startPage === target || undefined }, 'router-node');
        }
        // A start page that is not in `routes` still mounts.
        if (startPage && !routes.some((r) => sameComponent(r, startPage))) {
          sources.add('router-node');
          upsert(pages, startPage, { router: name, isStart: true }, 'router-node');
        }
        continue;
      }

      if (PAGE_TYPES.has(node.type)) {
        sources.add('page-node');
        upsert(
          pages,
          component.name,
          { title: str(node.parameters['title']), urlPath: str(node.parameters['urlPath']) },
          'page-node'
        );
        continue;
      }

      if (NAVIGATE_TYPES.has(node.type)) {
        const target = str(node.parameters['target']) ?? str(node.parameters['path']);
        if (!target) continue;
        navigations.push({ from: component.name, router: str(node.parameters['router']), target });
      }
    }
  }

  // Last resort: components whose name says "page" and which nothing mounted.
  for (const component of graph.components) {
    if (pages.has(component.name)) continue;
    if (!PAGE_NAME_PATTERNS.some((p) => p.test(component.name))) continue;
    sources.add('name-convention');
    upsert(pages, component.name, {}, 'name-convention');
  }

  return {
    routers,
    pages: [...pages.values()].sort(comparePages),
    navigations,
    sources: [...sources]
  };
}

/** Start page first, then routed pages, then whatever naming convention found. */
function comparePages(a: PageMapEntry, b: PageMapEntry): number {
  if (Boolean(a.isStart) !== Boolean(b.isStart)) return a.isStart ? -1 : 1;
  const weight = (p: PageMapEntry) => (p.sources.includes('name-convention') && p.sources.length === 1 ? 1 : 0);
  const delta = weight(a) - weight(b);
  return delta !== 0 ? delta : a.component.localeCompare(b.component);
}

/**
 * The page map as prompt text. States its own provenance — a model told "these
 * pages were guessed from folder names" writes a `> TODO:` where one told
 * "these pages are declared" would state a fact.
 */
export function renderPageMap(map: PageMap): string {
  if (map.pages.length === 0 && map.routers.length === 0) {
    return [
      'This project declares no routing: no Router or Page Stack node, no Page nodes, no routes file, and no',
      'component named like a page. Either it is a single-screen app or its navigation is done some other way.',
      'Do not assert a page structure you cannot see.'
    ].join('\n');
  }

  const lines: string[] = [];

  for (const router of map.routers) {
    const start = router.startPage ? `, start page ${router.startPage}` : '';
    lines.push(`Router "${router.name}" in ${router.host} mounts ${router.pages.length} page(s)${start}.`);
  }

  if (map.pages.length > 0) {
    lines.push('Pages:');
    for (const page of map.pages) {
      const parts: string[] = [`- ${page.component}`];
      if (page.title) parts.push(`title "${page.title}"`);
      if (page.urlPath) parts.push(`url /${page.urlPath.replace(/^\//, '')}`);
      if (page.isStart) parts.push('START PAGE');
      const guessed = page.sources.length === 1 && page.sources[0] === 'name-convention';
      if (guessed) parts.push('(inferred from its name only — nothing mounts it)');
      lines.push(parts.join(' — '));
    }
  }

  if (map.navigations.length > 0) {
    const targets = new Map<string, number>();
    for (const nav of map.navigations) targets.set(nav.target, (targets.get(nav.target) ?? 0) + 1);
    const ranked = [...targets.entries()].sort((a, b) => b[1] - a[1]);
    lines.push(
      `Navigation targets, most-linked first: ${ranked.map(([t, n]) => `${t} (${n})`).join(', ')}.`
    );
  }

  lines.push('', `Source of the above: ${describeSources(map.sources)}.`);
  return lines.join('\n');
}

function describeSources(sources: readonly PageSource[]): string {
  if (sources.length === 0) return 'nothing — this is a guess';
  const label: Record<PageSource, string> = {
    'routes-file': 'the project routes file (declared)',
    'router-node': "a Router node's page list (declared)",
    'page-node': "each page component's own Page node (declared)",
    'name-convention': 'component naming convention (INFERRED — treat as uncertain)'
  };
  return sources.map((s) => label[s]).join('; ');
}
