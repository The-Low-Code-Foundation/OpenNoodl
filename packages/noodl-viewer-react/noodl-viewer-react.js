import React from 'react';
import ReactDOM from 'react-dom';
import NoodlRuntime from '@noodl/runtime';

import registerPolyfills from './src/polyfills';
import Viewer, { ssrSetupRuntime } from './src/viewer.jsx';

registerPolyfills();

// React 19 root management
let currentRoot = null;

function createArgs() {
  // Support SSR
  if (typeof window === 'undefined') {
    return {
      type: 'browser',
      platform: {
        requestUpdate: (callback) => setImmediate(callback),
        getCurrentTime: () => 0,
        objectToString: (o) => JSON.stringify(o, null, 2)
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
    // Deployed pages use createRoot, which replaces any server-rendered markup in
    // #root with a fresh client render. Crawlers still get the SSR HTML (SEO), the
    // user gets a client-managed tree.
    //
    // Hydration is intentionally NOT done here yet, even for SSR output. The old
    // code tried to hydrate when #root's first child had `data-reactroot` — a
    // marker React 18+ `renderToString` no longer emits (RUN-001 moved the runtime
    // to React 18.3.1 / 19), so the branch was already dead and this path has in
    // fact always been createRoot. Naively switching to hydrateRoot is worse than
    // the status quo: the deployed runtime loads the root component *asynchronously*
    // (bundle fetch), so hydrateRoot's first synchronous render is empty, React
    // adopts the empty tree, and when the real content arrives it mounts as a
    // *duplicate* alongside the orphaned server DOM (verified: #root ends with two
    // subtrees). Real hydration needs a synchronous first render — the root
    // component and its bundle available before hydrateRoot — which is a RUN-002
    // deliverable, not a one-line detection fix. The SSR server still stamps
    // `data-ssr="1"` on #root as the signal that slice will key off.
    if (currentRoot) {
      currentRoot.unmount();
    }
    currentRoot = ReactDOM.createRoot(element);
    currentRoot.render(this.createElement(noodlModules, projectData));
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
