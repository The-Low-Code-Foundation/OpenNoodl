import { NodeLibrary } from '@noodl-models/nodelibrary';
import { ProjectModel } from '@noodl-models/projectmodel';

/**
 * A node's port list must not memoise an answer it gave before the node library
 * could speak.
 *
 * Found while measuring SIG-005, recorded as its R8 and as SIG-006's R2: on a
 * fresh open of a project, every connection in the component the editor lands on
 * reported `fromPort === undefined`, so `NodeLibrary.nameForPortType` returned
 * undefined, `CanvasTheme.connectionColors` fell through to the *data* pair, and
 * **a signal wire painted green instead of cyan** — phase 60's own premise
 * failing in the one graph every builder sees first. It self-healed the moment
 * you navigated to another component and back, which is why nobody had ever
 * reported it.
 *
 * The cause is not the editor's load ordering, which is what it looked like. It
 * is `NodeGraphNode.getPorts()`:
 *
 * ```ts
 * if (!this._ports) {
 *   var ports = this.type.ports ? this.type.ports : [];   // Unknown type -> []
 *   …
 *   this._ports = ports;                                  // and [] is TRUTHY
 * } else ports = this._ports;
 * ```
 *
 * The node library arrives asynchronously — `NodeLibraryImporter` receives it
 * over `ViewerConnection` and only then calls `NodeLibrary.instance.reload()`
 * (`NodeLibraryImporter.ts:316`) — so until it does, `type` is an
 * `UnknownNodeType`, which declares no ports at all. The first caller to ask
 * during that window banks an empty list forever: `[]` is truthy, so the
 * `if (!this._ports)` guard never re-derives it. In the editor the first caller
 * is `NodeGraphEditorConnection.resolvePorts()`, run from `connect()` at
 * bindModel time.
 *
 * Two listeners then fire on `libraryUpdated` and neither rescues it:
 * `EditorEventBindings.ts:58-70` re-resolves every connection's ports
 * **synchronously** — off the stale cache — while `NodeGraphModel.ts:145-149`
 * only *schedules* `updateTypes()`, and `scheduleUpdateTypes` is a
 * `setTimeout(…, 1)`. So the cache is cleared one tick after the only thing that
 * would have re-read it. Nothing re-resolves the connections again until the
 * next `bindModel` — which is what navigating away and back does.
 *
 * The fix is in the cache, not the ordering: a port list derived from a type the
 * library could not answer for is a "don't know yet", and memoising "don't know
 * yet" is the defect. See `NodeGraphNode.getPorts`.
 */
describe('NodeGraphNode.getPorts — a port list derived before the library loaded (R8)', () => {
  // A type name of this spec's own. `require` hands out one cached module object
  // for the shared library fixture, so pushing a type into it would leak into
  // every other spec that asks for it — `nodelibrary-spec.js` asserts that
  // `newimage` is *missing* until it adds it, and would then pass or fail on
  // seed order. The blob is deep-copied below for the same reason.
  const LATE_TYPE = 'elo001-late-type';

  const PORT_ON_A_LATE_TYPE = {
    name: 'x',
    type: { name: 'number' },
    plug: 'input'
  };

  function project() {
    return {
      components: [
        {
          name: 'comp1',
          graph: {
            roots: [
              { id: 'A', type: 'image' },
              // Deliberately not in the library the beforeEach installs. It is
              // pushed in mid-test, which is what a late `reload()` looks like.
              { id: 'B', type: LATE_TYPE }
            ]
          }
        }
      ]
    };
  }

  function loadLibraryWithoutTheLateType() {
    // Same reset the node library specs use — no modules left registered from a
    // previous spec (`unregisterModule` splices, so iterate a copy), then load —
    // but off a private copy of the blob.
    (window as TSFixme).NodeLibraryData = JSON.parse(JSON.stringify(require('../nodegraph/nodelibrary')));
    for (const module of [...NodeLibrary.instance.modules]) {
      NodeLibrary.instance.unregisterModule(module);
    }
    NodeLibrary.instance.loadLibrary();
  }

  function arriveLate() {
    (window as TSFixme).NodeLibraryData.nodetypes.push({
      name: LATE_TYPE,
      allowAsChild: true,
      category: 'visuals',
      ports: [PORT_ON_A_LATE_TYPE]
    });
    NodeLibrary.instance.reload();
  }

  let p: TSFixme;
  let lateNode: TSFixme;

  beforeEach(() => {
    loadLibraryWithoutTheLateType();
    p = ProjectModel.fromJSON(project());
    NodeLibrary.instance.registerModule(p);
    lateNode = p.components[0].graph.findNodeWithId('B');
  });

  afterEach(() => {
    NodeLibrary.instance.unregisterModule(p);
    // Hand the shared fixture object back, unmodified, so a spec that does not
    // install its own blob sees what it has always seen.
    (window as TSFixme).NodeLibraryData = require('../nodegraph/nodelibrary');
    NodeLibrary.instance.loadLibrary();
  });

  it('resolves the port once the type arrives, even though it was asked first', () => {
    // The editor asks during the window where the library has nothing to say —
    // this is `resolvePorts()` at bindModel, before the viewer has delivered.
    expect(lateNode.getPort('x', 'input')).toBeUndefined();

    arriveLate();

    // R8 was here: `undefined`, for the rest of the session, because the empty
    // list derived from the UnknownNodeType had been banked.
    const port = lateNode.getPort('x', 'input');
    expect(port).toBeDefined();
    expect(port.name).toBe('x');
  });

  it('resolves it synchronously, in the tick the library reloads in', () => {
    // Not incidental: `EditorEventBindings` re-resolves every connection's ports
    // inside the `libraryUpdated` handler, so a repair that only lands on
    // `NodeGraphModel`'s deferred `updateTypes()` is one tick too late for the
    // wire that is about to be painted.
    lateNode.getPorts();

    // A listener context of its own, so `off` detaches exactly this one — `this`
    // inside an arrow-bodied spec is not the object the model keyed the
    // subscription under.
    const listener = {};
    let portDuringTheReload;
    NodeLibrary.instance.on(
      'libraryUpdated',
      () => {
        portDuringTheReload = lateNode.getPort('x', 'input');
      },
      listener
    );

    try {
      arriveLate();
    } finally {
      NodeLibrary.instance.off(listener);
    }

    expect(portDuringTheReload).toBeDefined();
  });

  it('still caches the port list of a type that did resolve', () => {
    // The repair must not turn a hot path into a per-call rebuild. A node whose
    // type the library *can* answer for memoises exactly as before.
    const resolved = p.components[0].graph.findNodeWithId('A');

    const first = resolved.getPorts();
    expect(first.length).toBeGreaterThan(0);
    expect(resolved.getPorts()).toBe(first);
  });
});
