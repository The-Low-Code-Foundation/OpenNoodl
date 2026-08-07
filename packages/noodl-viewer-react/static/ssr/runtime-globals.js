'use strict';

/**
 * Installs the browser-shaped globals the Noodl runtime expects when running
 * in Node, shared by the SSR server template (index.js) and the SSG build
 * template (ssg.js). Call BEFORE require()-ing noodl.deploy.js.
 *
 * Returns the request trackers so the caller can gate rendering on them:
 * async work the runtime awaits (bundle loads, data fetches) is invisible to
 * its update scheduler, so `settle`'s isIdle must consult the in-flight
 * counters. Fetch AND XMLHttpRequest are both tracked — the Parse-backed
 * cloud data nodes (cloudstore.js), config service and cloud functions use
 * XHR, never fetch, and Query Records auto-fetches on graph load.
 */

const fs = require('fs');
const { createFetchTracker, createXhrTracker } = require('./render-gate');

/**
 * @param {object} deps
 * @param {object} deps.React
 * @param {object} deps.ReactDOMServer  Installed as globalThis.ReactDOM.
 * @param {Function} deps.XMLHttpRequest  The node polyfill to wrap.
 * @param {Function} deps.fetch  The node fetch to delegate to for real URLs.
 * @returns {{fetchTracker: object, xhrTracker: object, trackersIdle: () => boolean}}
 */
function installRuntimeGlobals({ React, ReactDOMServer, XMLHttpRequest, fetch }) {
  // In the DOM, these are global.
  globalThis.React = React;
  globalThis.ReactDOM = ReactDOMServer;
  globalThis.File = class File {};

  globalThis.__noodl_modules = [];
  globalThis.Noodl = {
    defineModule: function (m) {
      globalThis.__noodl_modules.push(m);
    },
    deployed: true
  };

  // Add some ugly polyfill
  globalThis.requestAnimationFrame = (callback) => setImmediate(callback);

  const fetchTracker = createFetchTracker(async (args) => {
    if (typeof args === 'string') {
      // Bundle fetches resolve from the deploy ROOT (cwd-relative), not
      // public/ — see RUN-002-ASSESSMENT §4.
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

  const xhrTracker = createXhrTracker(XMLHttpRequest);
  globalThis.XMLHttpRequest = xhrTracker.XMLHttpRequest;

  globalThis.localStorage = createLocalStorageMock();

  return {
    fetchTracker,
    xhrTracker,
    trackersIdle: () => fetchTracker.isIdle() && xhrTracker.isIdle()
  };
}

function createLocalStorageMock() {
  // Items are stored as own properties so BOTH access styles work — the
  // runtime uses both (e.g. cloudstore.js reads
  // localStorage['Parse/<appId>/currentUser'] by bracket access).
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(this, key) ? this[key] : null;
    },
    setItem(key, value) {
      this[key] = String(value);
    },
    removeItem(key) {
      delete this[key];
    },
    clear() {
      for (const key of Object.keys(this)) {
        if (typeof this[key] !== 'function') delete this[key];
      }
    }
  };
}

module.exports = { installRuntimeGlobals };
