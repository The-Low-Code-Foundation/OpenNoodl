/**
 * CN-015 AC1's editor half — how a kit's load failure lives in the editor.
 *
 * ## The trap this suite exists to hold shut
 *
 * 🔴 The obvious place to put these failures is on `currentNodeLibrary`, beside
 * `projectsettings`. It is also wrong, and silently so: `mergeUpdates` walks
 * **`nodetypes` and nothing else**, so a top-level field arriving on a *second*
 * import is simply ignored. The list would freeze at whatever the first client
 * reported and go on accusing a kit the author had already fixed — a stale
 * answer that reads exactly like a correct one, which is this repo's most
 * expensive recurring failure.
 *
 * So the failures are held per client and replaced on every import, and the
 * tests below are about that lifetime rather than about the rendering.
 */

import { NodeLibraryImporter } from '@noodl-models/nodelibrary/NodeLibraryImporter';
import { RuntimeType } from '@noodl-models/nodelibrary/NodeLibraryData';

// `updateIndex` publishes to `window.NodeLibraryData`; this runner is plain
// Node. A bare object is enough — nothing here asserts on it.
(globalThis as unknown as { window: unknown }).window = globalThis;

const THREW = { module: 'Throwing Kit', reason: 'threw', message: 'Uncaught ReferenceError: nope is not defined' };
const NOT_LOADED = {
  module: 'Missing Main Kit',
  reason: 'script-not-loaded',
  message: 'its script could not be loaded (/noodl_modules/missing-main-kit/index.js)'
};

/** A minimal payload in the shape a viewer sends. */
function payload(modulefailures?: unknown) {
  const base = {
    projectsettings: { ports: [], dynamicports: [] },
    typecasts: [],
    dynamicports: [],
    colors: { nodes: {}, connections: {} },
    nodetypes: [{ name: 'Group', ports: [] }],
    nodeIndex: { coreNodes: [], moduleNodes: [] }
  };
  return (modulefailures === undefined ? base : { ...base, modulefailures }) as never;
}

function freshImporter() {
  // Each test gets its own, so a leaked failure from one cannot pass another.
  return new (NodeLibraryImporter as unknown as new () => NodeLibraryImporter)();
}

describe('CN-015 — kit load failures in the editor', () => {
  it('reports what a client sent', () => {
    const importer = freshImporter();
    importer.onClientImport('viewer-1', RuntimeType.Browser, payload([THREW]));

    expect(importer.getModuleFailures()).toEqual([THREW]);
  });

  it('reports none when the payload carries no such field', () => {
    // A healthy project's payload omits it entirely, which must read as "no
    // failures" and not as a crash or an undefined.
    const importer = freshImporter();
    importer.onClientImport('viewer-1', RuntimeType.Browser, payload());

    expect(importer.getModuleFailures()).toEqual([]);
  });

  it('🔴 clears a failure when the same client re-imports without it', () => {
    // The freeze trap, stated as a test. The author fixes the kit, the preview
    // reloads, the same client re-reports — and the accusation must go.
    const importer = freshImporter();
    importer.onClientImport('viewer-1', RuntimeType.Browser, payload([THREW]));
    expect(importer.getModuleFailures()).toHaveLength(1);

    importer.onClientImport('viewer-1', RuntimeType.Browser, payload());
    expect(importer.getModuleFailures()).toEqual([]);
  });

  it('replaces that client’s list rather than accumulating across imports', () => {
    const importer = freshImporter();
    importer.onClientImport('viewer-1', RuntimeType.Browser, payload([THREW]));
    importer.onClientImport('viewer-1', RuntimeType.Browser, payload([NOT_LOADED]));

    expect(importer.getModuleFailures()).toEqual([NOT_LOADED]);
  });

  it('drops a client’s failures when it disconnects', () => {
    // A failure is an observation made by a page. With the page gone there is
    // nothing standing behind the claim.
    const importer = freshImporter();
    importer.onClientImport('viewer-1', RuntimeType.Browser, payload([THREW]));

    importer.onClientDisconnect('viewer-1');
    expect(importer.getModuleFailures()).toEqual([]);
  });

  it('does not let one client’s disconnect take another’s failures', () => {
    const importer = freshImporter();
    importer.onClientImport('viewer-1', RuntimeType.Browser, payload([THREW]));
    importer.onClientImport('viewer-2', RuntimeType.Browser, payload([NOT_LOADED]));

    importer.onClientDisconnect('viewer-1');
    expect(importer.getModuleFailures()).toEqual([NOT_LOADED]);
  });

  it('reports a kit once when two clients both hit it', () => {
    // Two viewer windows on the same project both fail to load the same kit.
    // That is one broken kit, and the panel must say so once.
    const importer = freshImporter();
    importer.onClientImport('viewer-1', RuntimeType.Browser, payload([THREW]));
    importer.onClientImport('viewer-2', RuntimeType.Browser, payload([THREW]));

    expect(importer.getModuleFailures()).toEqual([THREW]);
  });
});
