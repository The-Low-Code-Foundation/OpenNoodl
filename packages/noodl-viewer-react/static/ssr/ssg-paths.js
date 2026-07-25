'use strict';

/**
 * Route enumeration + output-path mapping for SSG (RUN-002 step 5).
 *
 * Routes come from the export's routerIndex — the graph knows its own pages,
 * which is what makes build-time enumeration possible at all. Dynamic routes
 * (path segments like `{id}`) cannot be enumerated without data and are
 * returned separately so the build can warn instead of silently dropping them.
 *
 * CommonJS on purpose: consumed by the esbuild-bundled ssg template and by
 * Jest with no transform step (same pattern as render-gate.js / inject-seo.js).
 */

/**
 * @param {object} projectData  The export JSON (needs `routerIndex`).
 * @returns {{routes: string[], dynamicRoutes: string[]}}  `routes` are
 *   renderable URL paths ('/'-prefixed, deduped, root first); `dynamicRoutes`
 *   are the parameterised ones that need data to enumerate (excluded).
 */
function routesFromExport(projectData) {
  const pages = (projectData && projectData.routerIndex && projectData.routerIndex.pages) || [];

  const seen = new Set();
  const routes = [];
  const dynamicRoutes = [];

  // The start page is served at '/', always first.
  routes.push('/');
  seen.add('/');

  for (const page of pages) {
    if (!page || typeof page.path !== 'string' || page.path.length === 0) continue;
    const route = page.path.startsWith('/') ? page.path : '/' + page.path;
    if (seen.has(route)) continue;
    seen.add(route);
    if (route.includes('{')) {
      dynamicRoutes.push(route);
    } else {
      routes.push(route);
    }
  }

  return { routes, dynamicRoutes };
}

/**
 * Maps a route to the file a static host serves for it: '/' → 'index.html',
 * '/second' → 'second/index.html' (directory-index layout, so plain static
 * servers resolve the route without rewrite rules).
 *
 * @param {string} route  '/'-prefixed URL path.
 * @returns {string}  Relative output file path (POSIX separators).
 */
function outputPathFor(route) {
  const trimmed = route.replace(/^\/+/, '').replace(/\/+$/, '');
  return trimmed === '' ? 'index.html' : trimmed + '/index.html';
}

module.exports = { routesFromExport, outputPathFor };
