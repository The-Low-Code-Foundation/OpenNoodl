import React from 'react';
import ReactDOM from 'react-dom';
import NoodlRuntime from '@noodl/runtime';

import registerPolyfills from './src/polyfills';
import Viewer, { ssrSetupRuntime } from './src/viewer.jsx';
import { settle, createPageReadyGate, createFetchTracker } from './static/ssr/render-gate';

registerPolyfills();

// React 19 root management
let currentRoot = null;

// How long a page that announced SSR_PageLoading may take to signal
// SSR_PageReady before hydration proceeds with whatever state the graph is in.
// Matches the SSR server's default (NOODL_SSR_PAGE_READY_TIMEOUT).
const HYDRATION_PAGE_READY_TIMEOUT = 10000;

function createArgs() {
  // Support SSR. This branch only runs on the SSR server — the cloud runtime
  // uses its own entry (noodl-viewer-cloud) and never sees this file, and the
  // browser always has window. isSSRServer is what makes `client-only` nodes
  // instantiate inert instead of running browser-API code (nodedefinition.ts).
  if (typeof window === 'undefined') {
    return {
      type: 'browser',
      platform: {
        requestUpdate: (callback) => setImmediate(callback),
        getCurrentTime: () => 0,
        objectToString: (o) => JSON.stringify(o, null, 2),
        isSSRServer: () => true
      },
      componentFilter: (c) => !c.name.startsWith('/#__cloud__/')
    };
  }

  return {
    type: 'browser',
    platform: {
      requestUpdate: (callback) => window.requestAnimationFrame(callback),
      getCurrentTime: () => window.performance.now(),
      objectToString: (o) => JSON.stringify(o, null, 2)
    },
    componentFilter: (c) => !c.name.startsWith('/#__cloud__/')
  };
}

export { ssrSetupRuntime };

export default {
  render(element, noodlModules, { isLocal = false }) {
    const runtimeArgs = createArgs();

    if (isLocal) {
      runtimeArgs.platform.isRunningLocally = () => true;
    }

    const noodlRuntime = new NoodlRuntime(runtimeArgs);

    // React 19: Use createRoot instead of ReactDOM.render
    if (currentRoot) {
      currentRoot.unmount();
    }
    currentRoot = ReactDOM.createRoot(element);
    currentRoot.render(React.createElement(Viewer, { noodlRuntime, noodlModules }, null));
  },
  renderDeployed(element, noodlModules, projectData) {
    // The SSR server stamps `data-ssr="1"` on #root (data-reactroot is gone in
    // React 18+, so server-rendered markup can't be detected any other way).
    // Hydration must not start until the graph has been brought to the same
    // settled state the server rendered from — the runtime loads the root
    // component asynchronously (bundle fetch), so a naive hydrateRoot's first
    // render is empty, React adopts the empty tree, and the real content later
    // mounts as a duplicate beside the orphaned server DOM (verified). Hence
    // the async pre-settle in _hydrateDeployed before hydrateRoot is called.
    if (element.getAttribute('data-ssr') === '1' && element.children.length > 0) {
      this._hydrateDeployed(element, noodlModules, projectData).catch((error) => {
        console.error('Noodl: SSR hydration failed, falling back to client render.', error);
        this._createRootDeployed(element, noodlModules, projectData);
      });
      return;
    }

    this._createRootDeployed(element, noodlModules, projectData);
  },
  /** Plain client render for deployed pages (no server markup, or hydration failed).
   *  createRoot discards any existing children of the container on first render. */
  _createRootDeployed(element, noodlModules, projectData) {
    if (currentRoot) {
      currentRoot.unmount();
    }
    currentRoot = ReactDOM.createRoot(element);
    currentRoot.render(this.createElement(noodlModules, projectData));
  },
  /**
   * Hydrate server-rendered markup. Mirrors the SSR server's render sequence
   * (static/ssr/index.js) so the client's first render matches the served HTML:
   * load the project data, trigger didMount on the settled tree, wait for
   * quiescence (scheduled updates + in-flight fetches) and for any pages gating
   * on the SSR_PageReady handshake — then hydrate synchronously.
   *
   * Nodes mounted during this pre-settle carry `didCallTriggerDidMount`, which
   * suppresses the duplicate didMount React would otherwise fire when it
   * commits the hydrated tree (see react-component-node.ts / router.tsx).
   */
  async _hydrateDeployed(element, noodlModules, projectData) {
    const noodlRuntime = new NoodlRuntime({
      ...createArgs(),
      runDeployed: true
    });

    // Bundle loads and data fetches are invisible to the runtime's update
    // scheduler; count them via window.fetch so settle can wait for them.
    // Restored before hydration so the app's later fetches are untouched.
    const originalFetch = window.fetch;
    const tracker = createFetchTracker(originalFetch.bind(window));

    try {
      window.fetch = tracker.fetch;

      // Subscribe before the graph loads: pages announce SSR_PageLoading from
      // their nodeScopeDidInitialize (context emitter, not the runtime one).
      const gate = createPageReadyGate(noodlRuntime.context.eventEmitter);

      await ssrSetupRuntime(noodlRuntime, noodlModules, projectData);

      if (noodlRuntime.rootComponent) {
        noodlRuntime.rootComponent.triggerDidMount();
      }

      const settleOpts = { isIdle: tracker.isIdle };
      await settle(noodlRuntime, settleOpts);

      if (gate.hasPendingPages()) {
        const ready = await gate.whenReady(HYDRATION_PAGE_READY_TIMEOUT);
        if (!ready) {
          console.warn(
            `Noodl: page(s) never signalled Page Ready within ${HYDRATION_PAGE_READY_TIMEOUT}ms before hydration: ` +
              gate.pendingPageIds().join(', ')
          );
        }
        await settle(noodlRuntime, settleOpts);
      }
    } finally {
      window.fetch = originalFetch;
    }

    if (currentRoot) {
      currentRoot.unmount();
    }
    currentRoot = ReactDOM.hydrateRoot(
      element,
      React.createElement(Viewer, { noodlRuntime, noodlModules, projectData }, null)
    );
  },
  /** Unmount the current React root */
  unmount() {
    if (currentRoot) {
      currentRoot.unmount();
      currentRoot = null;
    }
  },
  /** This can be called for server side rendering too. */
  createElement(noodlModules, projectData) {
    const noodlRuntime = new NoodlRuntime({
      ...createArgs(),
      runDeployed: true
    });

    return React.createElement(Viewer, { noodlRuntime, noodlModules, projectData }, null);
  }
};
