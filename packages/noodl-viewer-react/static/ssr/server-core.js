'use strict';

/**
 * The per-path server render, shared by the SSR server template (index.js)
 * and the SSG build template (ssg.js) so the two modes cannot drift: same
 * settle/PageReady gating, same client-only-deferral reporting, same
 * `data-ssr` stamp and SEO head injection.
 *
 * CommonJS on purpose — bundled by esbuild into both templates and consumed
 * directly by Jest (same pattern as render-gate.js / inject-seo.js).
 */

const { injectSeo } = require('./inject-seo');
const { settle, createPageReadyGate } = require('./render-gate');

/**
 * Renders one URL path to a full HTML document.
 *
 * @param {object} deps
 * @param {Function} deps.createElement  NoodlSSR.createElement.
 * @param {Function} deps.ssrSetupRuntime  NoodlSSR.ssrSetupRuntime.
 * @param {object} deps.ReactDOMServer  For renderToString.
 * @param {string} deps.htmlData  The CSR index.html template to splice into.
 * @param {Array} deps.noodlModules
 * @param {object} deps.projectData
 * @param {() => boolean} deps.isIdle  Conjunction of the fetch/XHR trackers.
 * @param {number} deps.pageReadyTimeout  Ms before a gated page renders degraded.
 * @param {Function} [deps.log]
 * @param {Function} [deps.warn]
 * @param {string} path  URL path to render ('/'-prefixed).
 * @returns {Promise<{html: string}>}
 */
function renderPage(deps, path) {
  const {
    createElement,
    ssrSetupRuntime,
    ReactDOMServer,
    htmlData,
    noodlModules,
    projectData,
    isIdle,
    pageReadyTimeout,
    log = () => {},
    warn = console.warn.bind(console)
  } = deps;

  return new Promise((resolve, reject) => {
    // Noodl.SEO is a per-process singleton reused across requests (and kept
    // idempotent so the Viewer constructor doesn't clobber it mid-render — see
    // noodl-js-api.js). Clear it before each page so the previous page's title
    // and meta cannot bleed into this one. May be undefined on the very first
    // render (ssrSetupRuntime creates it below).
    globalThis.Noodl && globalThis.Noodl.SEO && globalThis.Noodl.SEO.reset();

    // The runtime's router reads location to resolve the route server-side.
    globalThis.location = {
      pathname: path,
      search: ''
    };

    log('Create Component...');
    const ViewerComponent = createElement(noodlModules, projectData);
    log('created.');

    const noodlRuntime = ViewerComponent.props.noodlRuntime;

    // Subscribe before the runtime mounts: pages announce SSR_PageLoading from
    // initialize, which fires while the graph settles below. Note the CONTEXT
    // emitter — pages emit on nodeScope.context.eventEmitter, which is a
    // different object from noodlRuntime.eventEmitter (where
    // rootComponentUpdated lives). The original template listened on the
    // runtime emitter and would never have heard the pages.
    const gate = createPageReadyGate(noodlRuntime.context.eventEmitter);

    const settleOpts = { isIdle };

    noodlRuntime.eventEmitter.once('rootComponentUpdated', async () => {
      try {
        log('Spin up...');
        noodlRuntime.rootComponent.triggerDidMount();

        // Let the runtime run to quiescence: scheduled updates fire on their
        // own (platform.requestUpdate is setImmediate server-side), settle
        // yields until nothing is scheduled and no fetch/XHR (bundle load,
        // data request) is in flight.
        const first = await settle(noodlRuntime, settleOpts);
        if (!first.settled) {
          warn(`SSR: runtime did not settle for ${path} (never went quiet — looping animation?); rendering current state`);
        }

        // Pages with a connected `Page Ready` signal gate the render until the
        // graph says the page is complete (e.g. data has arrived).
        if (gate.hasPendingPages()) {
          log('Waiting for SSR_PageReady...', gate.pendingPageIds());
          const ready = await gate.whenReady(pageReadyTimeout);
          if (!ready) {
            warn(`SSR: page(s) never signalled Page Ready for ${path} within ${pageReadyTimeout}ms: ${gate.pendingPageIds().join(', ')}; rendering current state`);
          }
          // The ready signal usually lands together with the state changes it
          // announces; give those a chance to propagate through the graph.
          await settle(noodlRuntime, settleOpts);
        }

        log('Rendering...');
        const output = ReactDOMServer.renderToString(ViewerComponent);

        // Nodes classified `client-only` were created inert (nodedefinition.ts
        // makeNodeInert) — name them per page so a degraded render is loud in
        // the log rather than a silent partial page.
        const deferredTypes = noodlRuntime.context._ssrDeferredNodeTypes;
        if (deferredTypes && deferredTypes.size) {
          warn(
            `SSR: ${path} rendered with client-only node types deferred to the browser: ${[...deferredTypes].sort().join(', ')}`
          );
        }

        // Stamp the root so the client hydrates instead of re-rendering from
        // scratch. renderDeployed() reads this back (data-reactroot is gone in
        // React 18+, so it can no longer be used to detect server-rendered markup).
        let html = htmlData.replace('<div id="root"></div>', `<div id="root" data-ssr="1">${output}</div>`);

        // Inject the SEO state the runtime buffered during render (Noodl.SEO is
        // SSR-aware: server-side it stores title/meta in memory instead of touching
        // the DOM). Without this the served page keeps the template's default title
        // and carries none of the project's meta tags — i.e. no SEO benefit at all.
        html = injectSeo(html, globalThis.Noodl && globalThis.Noodl.SEO);

        resolve({ html });
      } catch (error) {
        // Reject so the caller can fall back to CSR (server) or fail the
        // build loudly (SSG) instead of hanging on an unresolved promise.
        reject(error);
      }
    });

    log('Setup Runtime...');
    ssrSetupRuntime(noodlRuntime, noodlModules, projectData);
    log('done.');
  });
}

module.exports = { renderPage };
