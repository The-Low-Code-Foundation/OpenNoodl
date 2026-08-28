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
 * So 51 of 100 connections never reach the backend. (⚠️ **100 is the template as
 * it stood when this was measured.** SB-018 (5) has since made it 101 — one wire
 * out of `submitContactForm` and three in. Every number in this header is a
 * record of the defect as it shipped and is left as it was read; the assertions
 * below derive theirs.) 32 are lost to
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

import { CLOUD_DYNAMIC_PORT_ADAPTERS } from '@noodl-models/NodeTypeAdapters/CloudDynamicPortsAdapter';
import { NamedPortsAdapter } from '@noodl-models/NodeTypeAdapters/NamedPortsAdapter';
import { NodeLibrary } from '@noodl-models/nodelibrary';
import { ProjectModel } from '@noodl-models/projectmodel';
import { WarningsModel } from '@noodl-models/warningsmodel';

import deployedBundle from './fixtures/sb017-deployed-bundle.workflow.json';
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


/** Every node in a graph, flattened — `children` is a tree. */
function flatten(roots: TSFixme[]): TSFixme[] {
  const out: TSFixme[] = [];
  const visit = (n: TSFixme) => {
    out.push(n);
    (n.children ?? []).forEach(visit);
  };
  roots.forEach(visit);
  return out;
}

/**
 * A component's connections as a multiset of type-qualified wires.
 *
 * Ids are useless across the two artefacts (F9), and a multiset keeps the two
 * Response nodes in `claimSite` from collapsing into one.
 */
function wireCounts(nodes: TSFixme[], connections: TSFixme[], from: 'bundle' | 'authored'): Record<string, number> {
  const typeOf: Record<string, string> = {};
  flatten(nodes).forEach((n) => (typeOf[n.id] = n.type));

  const counts: Record<string, number> = {};
  for (const c of connections) {
    const [sid, sport, tid, tport] =
      from === 'bundle'
        ? [c.sourceId, c.sourcePort, c.targetId, c.targetPort]
        : [c.fromId, c.fromProperty, c.toId, c.toProperty];
    const key = `${typeOf[sid]}.${sport} -> ${typeOf[tid]}.${tport}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/** The wires `have` is missing relative to `want`, as a flat list. */
function shortfall(want: Record<string, number>, have: Record<string, number>): string[] {
  const missing: string[] = [];
  for (const [wire, n] of Object.entries(want)) {
    for (let i = 0; i < n - (have[wire] ?? 0); i++) missing.push(wire);
  }
  return missing;
}

/**
 * 🔴 The two wires the **template deliberately removed** after this bundle was
 * recorded, and the only ones a shortfall against the frozen bundle is allowed
 * to contain.
 *
 * `sb017-deployed-bundle.workflow.json` is a record of one deploy of one version
 * of the template. Both cases below ask "is anything the deploy shipped missing
 * now?", and that question silently changes meaning the moment the template
 * itself drops a wire on purpose — the fixture stops being a floor and starts
 * being a claim about a graph that no longer exists.
 *
 * So the answer is stated rather than zeroed. SB-018 (5) replaced
 * `compose.out-built -> res.pm-received` — a **signal** cast into a **value**
 * parameter, which made the endpoint answer `{"received": false}` about a
 * message it had stored — with a `stored` node between `save.done` and
 * `mail.send`. That removes exactly these two and adds three.
 *
 * ⚠️ **This is an exemption list, not a relaxation.** Both cases still assert
 * the shortfall EQUALS this set: a wire that goes missing for any other reason
 * reddens exactly as before, and so does one of these two coming back without
 * the list being updated.
 */
const REMOVED_BY_SB018: string[] = [
  'NewDbModelProperties.done -> noodl.cloud.sendemail.send',
  'JavaScriptFunction.out-built -> noodl.cloud.response.pm-received'
];

describe('SB-017: the editor deploy path ships every connection the template holds', () => {
  let project: ProjectModel;
  let previousLibrary: unknown;

  beforeEach(() => {
    // 🔴 `loadLibrary()` replaces a singleton for the whole spec bundle, so a
    // suite that installs one and walks away decides what every later spec with
    // no library of its own resolves against — the documented failure where a
    // file "inherited whichever ran last, which is why its assertions passed or
    // failed on the seed". This one installs the CLOUD library, which is not
    // what most of the editor's specs expect. Snapshot and put it back.
    previousLibrary = (window as TSFixme).NodeLibraryData;

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
    // against s15's surviving bundle, its absence costs exactly one connection —
    // the single wire into a `pm-` parameter port, which in `submitContactForm`
    // is now `stored.out-received -> Response.pm-received` (it was
    // `compose.out-built -> Response.pm-received` until SB-018 (5) replaced the
    // signal with a value raised after the write). A spec that could never reach
    // parity would read as a failed fix.
    new NamedPortsAdapter().events.projectLoaded();

    // SB-017's own adapters, constructed the same way and for the same reason.
    // Three, not one, because `setDynamicPorts` REPLACES a node's dynamic port
    // list — so the families are partitioned by node type and each type has
    // exactly one writer. Driving them here rather than importing
    // `registeradapters` keeps this spec from installing ten adapters on a
    // shared EventDispatcher for the whole bundle.
    CLOUD_DYNAMIC_PORT_ADAPTERS.forEach((Adapter) => new Adapter().events.projectLoaded());

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

    (window as TSFixme).NodeLibraryData = previousLibrary;
    if (previousLibrary) NodeLibrary.instance.loadLibrary();
  });

  /** `getConnectionHealth`'s verdict for one wire, read the way `exportComponent` reads it. */
  function unhealthyWires(component: TSFixme): string[] {
    return component.graph.connections
      .filter(
        (c: TSFixme) =>
          !component.graph.getConnectionHealth({
            sourceId: c.fromId,
            sourcePort: c.fromProperty,
            targetId: c.toId,
            targetPort: c.toProperty
          }).healthy
      )
      .map((c: TSFixme) => `${c.fromProperty} -> ${c.toProperty}`);
  }

  it('no cloud wire is unhealthy, and the instrument saying so is live', () => {
    // 🔴 **This case asserted the defect and was rewritten to assert the fix**,
    // which is the point where a control usually stops controlling anything.
    // Before the fix it read "some connection is unhealthy" and was the negative
    // control on the setup: if `evaluateHealth` had not run, or the library had
    // not loaded, every wire would read healthy and the parity assertions below
    // would pass on a template that stayed broken.
    //
    // That blindness is still real, so the control is still here — it just needs
    // a signal that fires *after* the fix. A wire to a port that exists on
    // nothing is that signal, and it separates the two failure modes the plain
    // "everything is healthy" assertion cannot:
    //
    //   - `evaluateHealth` never ran           → the broken wire does not warn
    //   - the node library never loaded        → every OTHER wire warns too
    //
    // so both halves have to hold at once.
    const claimSite = project.getComponentWithName('/#__cloud__/claimSite');
    const wired = claimSite.graph.connections[0];
    claimSite.graph.addConnection({
      fromId: wired.fromId,
      fromProperty: 'no-such-port-on-any-node',
      toId: wired.toId,
      toProperty: wired.toProperty
    });
    claimSite.graph.evaluateHealth();

    expect(unhealthyWires(claimSite)).toEqual(['no-such-port-on-any-node -> ' + wired.toProperty]);

    // And every other cloud component — untouched — is clean. This is the fix's
    // own claim on the canvas rather than in the bundle: SB-017 acceptance 4.
    for (const component of getCloudFunctionComponents(project)) {
      if (component.name === '/#__cloud__/claimSite') continue;
      expect(unhealthyWires(component)).toEqual([]);
    }
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
  it('leaves every browser component alone — SB-017 acceptance 6', () => {
    // The negative control on the ruling's scope. A browser component's Function
    // node **already has** these ports: the viewer is a connected runtime client
    // and pushes them over `sendDynamicPorts` (SB-017 §6.1 counted 69 undeclared
    // browser script-port connections raising **0** warnings, against the cloud
    // side's 44 raising 44). An adapter that also wrote them would be a second
    // writer on the same `setDynamicPorts` with a shorter list, and the two would
    // overwrite each other on every parameter change.
    //
    // 18 Function nodes across 9 browser components, and none of them may have
    // been touched. 17 across 8 until SBR-004 gave `/Site/NavLink` its
    // current-page state function — the first Function node that component has
    // ever carried, which is why the component count moved with it.
    // Asserted on `dynamicports` rather than on an export, because
    // the export here is measured against the *cloud* node library — the browser
    // half's deploy is `build/deployer.ts`, and measuring it is SB-017 §6.5's
    // separate, still-open question.
    const browserFunctions = project
      .getComponents()
      .filter((component) => !component.name.startsWith('/#__cloud__/'))
      .flatMap((component) => {
        const nodes: TSFixme[] = [];
        component.forEachNode((node: TSFixme) => {
          if (node.type.name === 'JavaScriptFunction') nodes.push(node);
        });
        return nodes;
      });

    expect(browserFunctions.length).toBe(18);
    expect(browserFunctions.filter((node) => (node.dynamicports || []).length > 0)).toEqual([]);

    // …and the same sweep on the cloud side did write ports, so the assertion
    // above is about the scope and not about the adapters having done nothing.
    const cloudFunctions: TSFixme[] = [];
    getCloudFunctionComponents(project).forEach((component) =>
      component.forEachNode((node: TSFixme) => {
        if (node.type.name === 'JavaScriptFunction') cloudFunctions.push(node);
      })
    );
    expect(cloudFunctions.length).toBeGreaterThan(0);
    expect(cloudFunctions.every((node) => (node.dynamicports || []).length > 0)).toBe(true);
  });

  it('the bundle the drive really deployed is a strict subset of the template', () => {
    // The frozen record of the defect as it shipped. Nothing here reads the
    // current export, so this case does not change when the fix lands — it is
    // what makes the header's "49 of 100" re-derivable rather than remembered.
    //
    // It also says something the connection counts alone do not: the deploy only
    // ever *drops*. No deployed wire is absent from the template except the two
    // the template itself removed afterwards, so no connection was rewritten or
    // re-pointed on the way out.
    const missing: string[] = [];
    for (const deployed of (deployedBundle as TSFixme).components) {
      const authored = (siteBuilderContent as TSFixme).components.find(
        (c: TSFixme) => c.name === deployed.name
      );

      const inBundle = wireCounts(deployed.nodes, deployed.connections, 'bundle');
      const inTemplate = wireCounts(authored.graph.roots, authored.graph.connections, 'authored');

      missing.push(...shortfall(inBundle, inTemplate));
    }

    // Equality, not containment — see `REMOVED_BY_SB018`.
    expect(missing.sort()).toEqual([...REMOVED_BY_SB018].sort());
  });

  it('never loses a connection production already had', () => {
    // The durable half of "this spec reproduces production", and a regression
    // guard the count assertions cannot give: a fix that reached 100 by
    // re-pointing wires rather than restoring them would satisfy every count
    // above and still be wrong. True today (49 of 49) and required to stay true
    // at 100.
    const exported = exportCloudFunctionsToJSON(project) as TSFixme;

    const missing: string[] = [];
    for (const deployed of (deployedBundle as TSFixme).components) {
      const now = exported.components.find((c: TSFixme) => c.name === deployed.name);

      const inBundle = wireCounts(deployed.nodes, deployed.connections, 'bundle');
      const inExport = wireCounts(now.nodes, now.connections, 'bundle');

      missing.push(...shortfall(inBundle, inExport));
    }

    // 🔴 The SAME set as the case above, which is the load-bearing part: a wire
    // the template still holds but the export loses would land here and not
    // there, and this equality is what tells the two apart.
    expect(missing.sort()).toEqual([...REMOVED_BY_SB018].sort());
  });
});
