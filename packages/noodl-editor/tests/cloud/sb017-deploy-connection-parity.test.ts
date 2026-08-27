/**
 * SB-017 acceptance 1 — the assertion whose absence let a broken template ship.
 *
 * The Site Builder template deploys through the editor and **every cloud
 * endpoint times out**. `nodegx-backend`'s 29-spec publication suite is green on
 * the same seven components, because it builds its bundle with
 * `tests/helpers/authored-bundle.ts` rather than the editor's deploy path. Two
 * paths, same graphs, opposite outcomes, and nothing compared them — so the one
 * a person actually gets was the one nobody measured (SB-017 §4).
 *
 * This is that comparison, from the editor's side. Both paths are measured
 * against the same third thing — the shipped template on disk — rather than
 * against each other, because they cannot run in one process: the editor's
 * `exportComponent` needs a live `NodeLibrary`, which is *why* the helper exists
 * (SB-004 §7). The backend-side half is `sb017-helper-is-lossless.test.ts`;
 * together they say the two paths agree, and a failure says which one moved.
 *
 * ## What breaks it today
 *
 * `exportComponent` drops any connection `getConnectionHealth` calls unhealthy
 * (`utils/exporter/util.ts:90`), and that predicate is *any warning on the
 * connection*. `evaluateConnectionHealth` warns when `node.getPort(name)` does
 * not resolve. For a cloud component nothing resolves a node's **dynamic**
 * ports: they arrive from a connected runtime client calling `sendDynamicPorts`,
 * and the cloud runtime window was deleted by WF-007 — `NodeLibraryImporter.ts`
 * says so at line 285. `cloud-node-library.json` replaced it with a static
 * snapshot, which carries declared ports and nothing a node computes.
 *
 * So 51 of 100 connections never reach the backend. 32 are lost to
 * `JavaScriptFunction` script ports alone; the other 19 involve a Db-node port,
 * and one of those 19 is `claimSite`'s `secret.done -> DbCollection2.storageFetch`
 * — the wire that starts the function. **A fix scoped to script ports leaves
 * `claimSite` hanging**, which is why the per-component counts below are
 * asserted individually and why `storageFetch` gets a line of its own. A total
 * can be right while two components are wrong in opposite directions.
 *
 * ## It reproduces the real bundle, and that was checked
 *
 * The seven per-component counts this spec measures are **identical** to the
 * bundle s15's drive deployed to a real backend
 * (`~/.noodl/backends/backend_mtbxrca3axpbc/workflows/sb015-editor-drive-*.workflow.json`):
 * 4, 4, 5, 5, 8, 9, 14 — 49 of 100. So what fails here is what fails in
 * production, not an artefact of a test harness standing in for one.
 *
 * 🔴 **This spec must not be satisfiable by deleting the health check.** The
 * last case is a known-firing control: a wire to a port that is genuinely wrong
 * is still dropped. Without it, "every connection survives" and "the export no
 * longer filters" are the same green.
 */

import { NamedPortsAdapter } from '@noodl-models/NodeTypeAdapters/NamedPortsAdapter';
import { NodeLibrary } from '@noodl-models/nodelibrary';
import { ProjectModel } from '@noodl-models/projectmodel';
import { WarningsModel } from '@noodl-models/warningsmodel';

import cloudNodeLibrary from '../../src/editor/src/models/nodelibrary/cloud-node-library.json';
import siteBuilderContent from '../../src/editor/src/models/template/templates/site-builder.content.json';
import {
  exportCloudFunctionsToJSON,
  getCloudFunctionComponents
} from '../../src/editor/src/utils/exporter/cloudFunctions';

/** Connections the shipped template holds, per cloud component — read from the artefact. */
function connectionsOnDisk(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const component of (siteBuilderContent as TSFixme).components) {
    if (!component.name.startsWith('/#__cloud__/')) continue;
    counts[component.name] = component.graph.connections.length;
  }
  return counts;
}

describe('SB-017: the editor deploy path ships every connection the template holds', () => {
  let project: ProjectModel;

  beforeEach(() => {
    WarningsModel.instance.clearAllWarnings();

    // The library the editor really serves for cloud components — the generated
    // artefact, not a fixture, so a regeneration that changed a port set fails
    // here rather than passing against a hand-written copy of what it used to say.
    (window as TSFixme).NodeLibraryData = cloudNodeLibrary;
    NodeLibrary.instance.loadLibrary();

    project = ProjectModel.fromJSON(JSON.parse(JSON.stringify(siteBuilderContent)));
    ProjectModel.instance = project;
    NodeLibrary.instance.registerModule(project);

    // WFA-009's `pm-` sweep, which the editor gets from `registeradapters.ts` at
    // boot. Constructed and driven directly rather than importing that module,
    // which registers every adapter on a shared EventDispatcher for the whole
    // spec bundle. **Without it this spec is not a faithful stand-in**: measured
    // against s15's surviving bundle, its absence costs exactly one connection,
    // `compose.out-built -> Response.pm-received` in `submitContactForm` — and a
    // spec that could never reach parity would read as a failed fix.
    new NamedPortsAdapter().events.projectLoaded();

    // What opening the project does. `exportComponent` reads WarningsModel, and
    // in the editor this pass is debounce-scheduled from the canvas; a test that
    // skipped it would measure an export with no health signal at all and pass
    // on a defect that ships.
    project.getComponents().forEach((component) => component.graph.evaluateHealth());
  });

  afterEach(() => {
    NodeLibrary.instance.unregisterModule(project);
    WarningsModel.instance.clearAllWarnings();
    ProjectModel.instance = undefined;
  });

  it('raises the port warnings that drive the drop — the instrument is live', () => {
    // A negative control on the setup itself. If `evaluateHealth` had not run,
    // or the library had not loaded, every connection would read healthy and the
    // parity assertions below would pass while the template stayed broken.
    const warned = getCloudFunctionComponents(project).some((component) =>
      component.graph.connections.some((c) => !component.graph.getConnectionHealth({
        sourceId: c.fromId,
        sourcePort: c.fromProperty,
        targetId: c.toId,
        targetPort: c.toProperty
      }).healthy)
    );
    expect(warned).toBe(true);
  });

  it('exports the same number of connections each component holds', () => {
    const expected = connectionsOnDisk();
    const exported = exportCloudFunctionsToJSON(project) as TSFixme;

    const actual: Record<string, number> = {};
    for (const component of exported.components) {
      actual[component.name] = component.connections.length;
    }

    // Per component, not a total: a total can be right while two components are
    // wrong in opposite directions.
    expect(actual).toEqual(expected);
  });

  it('keeps the wire that starts claimSite', () => {
    // SB-017 §6.4. `secret.done -> DbCollection2.storageFetch` is a Db-node
    // dynamic port, not a script port, so a fix scoped to `JavaScriptFunction`
    // clears 32 connections and still leaves this one — and with the collection
    // never fetching, `fetched` never fires and the gate never runs.
    const exported = exportCloudFunctionsToJSON(project) as TSFixme;
    const claimSite = exported.components.find((c: TSFixme) => c.name === '/#__cloud__/claimSite');

    const startsTheFetch = claimSite.connections.some(
      (c: TSFixme) => c.sourcePort === 'done' && c.targetPort === 'storageFetch'
    );
    expect(startsTheFetch).toBe(true);
  });

  it('still drops a wire whose port really is wrong', () => {
    // The known-firing control. Without this, "every connection survives" and
    // "the export stopped filtering" are indistinguishable greens.
    const claimSite = project.getComponentWithName('/#__cloud__/claimSite');
    const before = (exportCloudFunctionsToJSON(project) as TSFixme).components.find(
      (c: TSFixme) => c.name === '/#__cloud__/claimSite'
    ).connections.length;

    const wired = claimSite.graph.connections[0];
    const broken = {
      fromId: wired.fromId,
      fromProperty: 'no-such-port-on-any-node',
      toId: wired.toId,
      toProperty: wired.toProperty
    };
    claimSite.graph.addConnection(broken);
    claimSite.graph.evaluateHealth();

    const after = (exportCloudFunctionsToJSON(project) as TSFixme).components.find(
      (c: TSFixme) => c.name === '/#__cloud__/claimSite'
    ).connections.length;

    // The added wire is not exported: one more connection in the graph, the same
    // number out.
    expect(after).toBe(before);
  });
});
