import { NodeLibrary } from '@noodl-models/nodelibrary';
import { ProjectModel } from '@noodl-models/projectmodel';
import { WarningsModel } from '@noodl-models/warningsmodel';
import { exportComponent } from '@noodl-utils/exporter';

/**
 * DEF-028 (phase 80) · P77 D13 — what a build contains must not depend on when
 * it was taken.
 *
 * `exportComponent` (`utils/exporter/util.ts`) drops every connection
 * `getConnectionHealth` calls unhealthy. **`getConnectionHealth` reads no
 * ports** — it asks `WarningsModel` whether a warning is recorded and returns
 * `healthy: true` when none is, which is also the answer when none has been
 * *evaluated* yet. The warning it reads, `con-no-target-port`, is written on a
 * debounced pass (~2 s lazy, ~50 ms urgent), and before this fix nothing forced
 * that pass to settle before an export.
 *
 * So two builds of a byte-identical project could differ in which wires they
 * contain, with no diagnostic and nothing in the artefact recording which one
 * you got. Silent in both directions — a wire kept that the editor would call
 * broken, or a wire dropped that the author can see on the canvas.
 *
 * 🔴 This is not a deploy-only property. One filter, **eight call sites**: the
 * viewer's component bundles (`editorapi.js`), incremental preview updates
 * (`ViewerConnection`), the full export and deploy (`json.ts`, `deployer.ts`),
 * cloud functions (`cloudFunctions.ts`), and the AI authoring sandbox
 * (`sandboxExport.ts`, `componentBench.ts`). A "works in preview" observation is
 * not a control for it. The fix is inside the filter for exactly that reason —
 * it covers every caller by construction, including ones not yet written.
 *
 * ⚠️ **The fix picks a direction, and the direction is "settled".** A build now
 * contains what the editor would say about the project if you asked it — the
 * same answer the canvas paints. That is a deliberate choice over "keep
 * everything": a wire onto a port that does not exist cannot carry a value at
 * runtime, so keeping it ships a graph the runtime cannot honour.
 */
describe('DEF-028 — a build is a function of the project, not of when it was taken', () => {
  // `Image-1.image → Image-2.image` resolves on both ends and must survive every
  // export. `Image-1.screenX → Image-2.thisPortDoesNotExist` has no target port
  // and is the wire whose fate used to depend on the clock.
  const GOOD = { fromId: 'Image-1', fromProperty: 'image', toId: 'Image-2', toProperty: 'image' };
  const BROKEN = { fromId: 'Image-1', fromProperty: 'screenX', toId: 'Image-2', toProperty: 'thisPortDoesNotExist' };

  const PROJECT = {
    components: [
      {
        name: '/comp1',
        graph: {
          roots: [
            { id: 'Image-1', type: 'image' },
            { id: 'Image-2', type: 'image' }
          ],
          connections: [GOOD, BROKEN]
        }
      }
    ]
  };

  let comp: TSFixme;

  // 🔴 `exportConnection` renames the fields: a wire is `from/toProperty` on the
  // graph and `source/targetPort` in the artefact. Reading the graph's names off
  // the export yields `undefined->undefined` for every wire — which still
  // *satisfies* an absence assertion, and did: the fourth spec below passed
  // vacuously on the first run. Hence the positive control in the precondition.
  function exportedConnections() {
    return exportComponent(comp).connections.map((c: TSFixme) => `${c.sourcePort}->${c.targetPort}`);
  }

  beforeEach(() => {
    // Nine other spec files install their own library and reload; inheriting
    // whichever ran last is what makes an export assertion pass on the seed.
    (window as TSFixme).NodeLibraryData = require('./nodelibrary');
    NodeLibrary.instance.loadLibrary();

    // WarningsModel is a global singleton — leftovers from another spec key into
    // this component's slot and would decide these assertions.
    WarningsModel.instance.clearAllWarnings();

    ProjectModel.instance = ProjectModel.fromJSON(PROJECT);
    NodeLibrary.instance.registerModule(ProjectModel.instance);
    comp = ProjectModel.instance.getComponentWithName('/comp1');
  });

  afterEach(() => {
    NodeLibrary.instance.unregisterModule(ProjectModel.instance);
    WarningsModel.instance.clearAllWarnings();
  });

  /**
   * The precondition, asserted rather than assumed. If a health pass had already
   * landed by the time these specs run, the two exports below would agree for a
   * reason that has nothing to do with the fix — and the suite would be green on
   * a defect. This is the known-firing signal beside the absence.
   */
  it('starts with the broken wire unevaluated — no warning recorded yet', () => {
    expect(
      WarningsModel.instance.getWarnings({ component: comp, connection: BROKEN })
    ).toBeUndefined();

    // And the graph really does contain both wires, so a later count of 1 is a
    // drop rather than a fixture with one wire in it.
    expect(comp.graph.connections.length).toBe(2);

    // 🔴 The positive control the absence assertions rest on. `not.toContain` is
    // satisfied by a list of the wrong shape just as readily as by a wire that
    // was dropped, so something this helper CAN see has to be named here. The
    // good wire survives every export, before and after the fix, so it reads the
    // same in both directions and cannot itself be a hidden defect.
    expect(exportedConnections()).toContain('image->image');
  });

  it('exports the same connections before and after the health pass settles', () => {
    const beforeAnyPass = exportedConnections();

    comp.graph.evaluateHealth();

    const afterPassSettled = exportedConnections();

    expect(beforeAnyPass).toEqual(afterPassSettled);
  });

  /**
   * And it agrees in the *settled* direction — the answer the canvas paints —
   * rather than by keeping everything. Asserted by name, not by count: a
   * two-element result that dropped the wrong wire would pass a length check.
   */
  it('takes the settled answer: the unresolvable wire is dropped, the good one kept', () => {
    expect(exportedConnections()).toEqual(['image->image']);
  });

  /**
   * The window D13 is actually about. A freshly imported graph has never
   * scheduled a pass at all, so "flush what is pending" would be a no-op here
   * and the stale answer would stand. Nothing is ticked and nothing is
   * scheduled before this export.
   */
  it('settles a graph on which no pass has ever been scheduled', () => {
    expect(exportedConnections()).not.toContain('screenX->thisPortDoesNotExist');
  });
});
