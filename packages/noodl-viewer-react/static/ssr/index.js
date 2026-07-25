import fs from 'fs';
import path from 'path';
import express from 'express';
import fetch from 'node-fetch';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import NodeCache from "node-cache"; 
import { XMLHttpRequest } from 'xmlhttprequest';

const myCache = new NodeCache();
async function cacheFetch(args, callback) {
  const cacheKey = typeof args === 'string' ? args : args.key;
  const cached = myCache.get(cacheKey);
  if (cached) return Promise.resolve(cached);

  const result = await callback();
  myCache.set(cacheKey, result);
  return result;
}

// In the DOM, these are global.
globalThis.React = React;
globalThis.ReactDOM = ReactDOMServer;
globalThis.XMLHttpRequest = XMLHttpRequest;
globalThis.File = class File {};

globalThis.__noodl_modules = [];
globalThis.Noodl = {
  defineModule: function (m) {
    globalThis.__noodl_modules.push(m);
  },
  deployed: true
};

globalThis.projectData = {{#export#}};

// Add some ugly polyfill
globalThis.requestAnimationFrame = (callback) => setImmediate(callback);

// SEO head injection and render gating live in sibling modules so they can be
// unit tested (tests/ssr-inject-seo.test.js, tests/ssr-render-gate.test.js).
// webpack copies the whole static/ssr directory into the deploy runtime, so
// they travel alongside this server.
const { injectSeo } = require('./inject-seo');
const { settle, createPageReadyGate, createFetchTracker } = require('./render-gate');

// Async work the runtime awaits (bundle loads, data fetches) is invisible to
// its update scheduler, so the render gate consults the tracker's in-flight
// counter: while a fetch is pending the runtime is not idle and renderToString
// must wait. Same tracker the client hydration path uses (render-gate.js).
const fetchTracker = createFetchTracker(async (args) => {
  if (typeof args === 'string') {
    const relativePath = '.' + args;
    if (args.startsWith('/noodl_bundles') && fs.existsSync(relativePath)) {
      const fileContent = await fs.promises.readFile(relativePath, 'utf-8');
      return {
        status: 200,
        json() {
          return Promise.resolve(JSON.parse(fileContent));
        }
      };
    }
  }
  return await fetch(args);
});
globalThis.fetch = fetchTracker.fetch;

class LocalStorageMock {
  constructor() {
    this.store = {};
  }

  getItem(key) {
    return this.store[key] || null;
  }

  setItem(key, value) {
    this.store[key] = value.toString();
  }

  removeItem(key) {
    delete this.store[key];
  }

  clear() {
    this.store = {};
  }

  get(key) {
    return this.store[key] || null;
  }

  set(key, value) {
    this.store[key] = value.toString();
  }

  delete(key) {
    delete this.store[key];
  }

  // Allow direct access like localStorageMock['key']
  get store() {
    return this._store;
  }

  set store(data) {
    this._store = data;
  }
}

globalThis.localStorage = new LocalStorageMock();

// Import the Noodl runtime
require('./noodl.deploy');

// From that file we get some runtime stuff defined on "NoodlSSR"
const { createElement, ssrSetupRuntime } = globalThis.NoodlSSR;

const PORT = process.env.PORT || 3000;
const app = express();

app.use(express.static('public', { index: false }));

function log(...args) {
  // Uncomment to see full request log
  // console.log(...args);
}

let htmlData = '';

// How long a page that announced SSR_PageLoading may take to signal
// SSR_PageReady before we render whatever we have (degraded, not broken).
const PAGE_READY_TIMEOUT = Number(process.env.NOODL_SSR_PAGE_READY_TIMEOUT || 10000);

async function setup() {
  htmlData = await fs.promises.readFile(path.resolve('./public/index.html'), 'utf8');
}

async function buildPage(path) {
  return new Promise((resolve, reject) => {
    const noodlModules = globalThis.__noodl_modules;
    const projectData = globalThis.projectData;

    // Noodl.SEO is a per-process singleton reused across requests (and kept
    // idempotent so the Viewer constructor doesn't clobber it mid-render — see
    // noodl-js-api.js). Clear it before each page so the previous page's title
    // and meta cannot bleed into this one. May be undefined on the very first
    // request (ssrSetupRuntime creates it below).
    globalThis.Noodl && globalThis.Noodl.SEO && globalThis.Noodl.SEO.reset();

    // TODO: Maybe fix page router
    globalThis.location = {
      pathname: path,
      search: ""
    }

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

    const settleOpts = { isIdle: fetchTracker.isIdle };

    noodlRuntime.eventEmitter.once('rootComponentUpdated', async () => {
      try {
        log('Spin up...');
        noodlRuntime.rootComponent.triggerDidMount();

        // Let the runtime run to quiescence: scheduled updates fire on their
        // own (platform.requestUpdate is setImmediate server-side), settle
        // yields until nothing is scheduled and no fetch (bundle load, data
        // request) is in flight. Replaces the old fixed 1000-iteration
        // triggerDidMount/_doUpdate busy loop, which was a timeout-shaped
        // guess — too long for static pages, too short for slow data.
        const first = await settle(noodlRuntime, settleOpts);
        if (!first.settled) {
          console.warn(`SSR: runtime did not settle for ${path} (never went quiet — looping animation?); rendering current state`);
        }

        // Pages with a connected `Page Ready` signal gate the render until the
        // graph says the page is complete (e.g. data has arrived).
        if (gate.hasPendingPages()) {
          log('Waiting for SSR_PageReady...', gate.pendingPageIds());
          const ready = await gate.whenReady(PAGE_READY_TIMEOUT);
          if (!ready) {
            console.warn(`SSR: page(s) never signalled Page Ready for ${path} within ${PAGE_READY_TIMEOUT}ms: ${gate.pendingPageIds().join(', ')}; rendering current state`);
          }
          // The ready signal usually lands together with the state changes it
          // announces; give those a chance to propagate through the graph.
          await settle(noodlRuntime, settleOpts);
        }

        log('Rendering...');
        const output1 = ReactDOMServer.renderToString(ViewerComponent);
        log('result:', output1);

        // Stamp the root so the client hydrates instead of re-rendering from
        // scratch. renderDeployed() reads this back (data-reactroot is gone in
        // React 18+, so it can no longer be used to detect server-rendered markup).
        let result = htmlData.replace('<div id="root"></div>', `<div id="root" data-ssr="1">${output1}</div>`);

        // Inject the SEO state the runtime buffered during render (Noodl.SEO is
        // SSR-aware: server-side it stores title/meta in memory instead of touching
        // the DOM). Without this the served page keeps the template's default title
        // and carries none of the project's meta tags — i.e. no SEO benefit at all.
        result = injectSeo(result, globalThis.Noodl && globalThis.Noodl.SEO);

        resolve(result);
      } catch (error) {
        // Reject so the express handler serves the CSR fallback instead of
        // hanging this request forever on an unresolved promise.
        reject(error);
      }
    });

    log('Setup Runtime...');
    ssrSetupRuntime(noodlRuntime, noodlModules, projectData);
    log('done.');
  });
}

app.get('*', async (req, res) => {
  const path = req.path;
  
  try {
    const cacheKey = `cache__${path}`
    const cached = await cacheFetch(cacheKey, () => buildPage(req.path));
    res.send(cached);
  } catch (error) {
    console.error(error);
    
    // We failed to render SSR, lets just respond with the index.html file, 
    // and then the user should be able to render the page client side.
    res.send(htmlData);
  }
});

setup().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
  });
});
