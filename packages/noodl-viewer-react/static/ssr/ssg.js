import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { XMLHttpRequest } from 'xmlhttprequest';

/**
 * SSG build entry (RUN-002 step 5): pre-renders every enumerable route to a
 * static HTML file, producing an output directory a plain static host can
 * serve with no Node server at all. Same deployment layout as the SSR server
 * (run from the deploy root, bundles at ./noodl_bundles, browser assets in
 * ./public), same {{#export#}} splice, same per-path render (server-core.js)
 * — SSG is the SSR render executed once per route at build time instead of
 * per request.
 *
 * Usage: node ssg.js [outDir]   (default ./dist)
 *
 * Output: public/* copied to outDir, then one <route>/index.html per route
 * (directory-index layout — '/second' → second/index.html — so static hosts
 * resolve routes without rewrite rules). Dynamic routes ({param} segments)
 * cannot be enumerated without data; they are reported and skipped — the
 * copied index.html still serves them as CSR on hosts with SPA fallback.
 */

const { installRuntimeGlobals } = require('./runtime-globals');
const { loadKitModules } = require('./kit-modules');
const { renderPage } = require('./server-core');
const { routesFromExport, outputPathFor } = require('./ssg-paths');

const { trackersIdle } = installRuntimeGlobals({ React, ReactDOMServer, XMLHttpRequest, fetch });

globalThis.projectData = {{#export#}};

// Import the Noodl runtime
require('./noodl.deploy');

const { createElement, ssrSetupRuntime } = globalThis.NoodlSSR;

const OUT_DIR = process.argv[2] || './dist';
const PAGE_READY_TIMEOUT = Number(process.env.NOODL_SSR_PAGE_READY_TIMEOUT || 10000);

async function main() {
  const htmlData = await fs.promises.readFile(path.resolve('./public/index.html'), 'utf8');

  // CN-013 — the same kit load the SSR server does, for the same reason. A pre-rendered page with
  // its kit nodes missing is worse than a CSR one: it is served as finished.
  const kits = loadKitModules({ htmlData });
  if (kits.loaded.length) console.log(`SSG: loaded ${kits.loaded.length} kit script(s) for pre-rendering`);

  const { routes, dynamicRoutes } = routesFromExport(globalThis.projectData);
  if (dynamicRoutes.length > 0) {
    console.warn(
      `SSG: ${dynamicRoutes.length} dynamic route(s) cannot be pre-rendered without data and were skipped: ` +
        dynamicRoutes.join(', ') +
        ' (they fall back to client-side rendering)'
    );
  }

  // Start from the browser assets — the generated pages hydrate with them.
  await fs.promises.rm(OUT_DIR, { recursive: true, force: true });
  await fs.promises.cp('./public', OUT_DIR, { recursive: true });

  let failed = 0;
  for (const route of routes) {
    const outFile = path.join(OUT_DIR, outputPathFor(route));
    try {
      const { html } = await renderPage(
        {
          createElement,
          ssrSetupRuntime,
          ReactDOMServer,
          htmlData,
          noodlModules: globalThis.__noodl_modules,
          projectData: globalThis.projectData,
          isIdle: trackersIdle,
          pageReadyTimeout: PAGE_READY_TIMEOUT
        },
        route
      );
      await fs.promises.mkdir(path.dirname(outFile), { recursive: true });
      await fs.promises.writeFile(outFile, html);
      console.log(`SSG: ${route} → ${outFile}`);
    } catch (error) {
      // A failed route gets the CSR page (same fallback the SSR server uses
      // per-request) so the site still works — but the build says so loudly.
      failed++;
      console.error(`SSG: FAILED to pre-render ${route}; writing CSR fallback.`, error);
      await fs.promises.mkdir(path.dirname(outFile), { recursive: true });
      await fs.promises.writeFile(outFile, htmlData);
    }
  }

  console.log(
    `SSG: wrote ${routes.length - failed}/${routes.length} pre-rendered route(s)` +
      (failed ? `, ${failed} CSR fallback(s)` : '') +
      (dynamicRoutes.length ? `, ${dynamicRoutes.length} dynamic route(s) skipped` : '') +
      ` → ${OUT_DIR}`
  );
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('SSG: build failed', error);
  process.exit(1);
});
