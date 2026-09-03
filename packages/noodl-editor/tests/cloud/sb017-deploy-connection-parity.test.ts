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
 * 🔴 SBR-015 added the second group. `RunTasks.completed` was wired straight
 * into the thing that means success in both graphs — the page write in
 * `publishPage`, the Response in `duplicatePage` — and `completed` is the one
 * outcome port that cannot mean it: it *"fires after every invocation, whatever
 * the outcome"* (`outcome.ts`). So publish marked a page published after a run
 * that failed to set a single section's access rules, and duplicate answered
 * with a page id after a section copy that failed. Both are now `.done ->`,
 * which is why the `completed` spellings are missing from the template and
 * present in the frozen bundle.
 *
 * ⚠️ **This is an exemption list, not a relaxation.** Both cases still assert
 * the shortfall EQUALS this set: a wire that goes missing for any other reason
 * reddens exactly as before, and so does one of these coming back without the
 * list being updated.
 */
const REMOVED_SINCE_THE_BUNDLE: string[] = [
  // SB-018 (5)
  'NewDbModelProperties.done -> noodl.cloud.sendemail.send',
  'JavaScriptFunction.out-built -> noodl.cloud.response.pm-received',
  // SBR-015 — `completed` replaced by `done` on both Run Tasks nodes
  'RunTasks.completed -> SetDbModelProperties.store',
  'RunTasks.completed -> noodl.cloud.response.send',
  // 🔴 P77 D24 — `Fetched` replaced by `Done` on `duplicatePage`'s page read.
  // `Record.Fetched` fires from the `Id` **setter** as well as from a finished
  // read, so the write hung off it ran before the data existed: measured, one
  // call wrote FOUR Page rows, three of them junk drafts a person would have to
  // delete by hand. `Done` is the fetch invocation's own outcome and cannot fire
  // early. The replacement adds `DbModel2.id -> JavaScriptFunction.in-sourceId`,
  // which is an ADDITION and therefore not exempted here — this list is
  // shortfall only, and an addition has to survive the parity assertion on its
  // own.
  'DbModel2.fetched -> JavaScriptFunction.run'
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
    // 20 Function nodes across 11 browser components, and none of them may have
    // been touched. 17 across 8 until SBR-004 gave `/Site/NavLink` its
    // current-page state function — the first Function node that component has
    // ever carried, which is why the component count moved with it; 18 until
    // SBR-006 built the admin shell.
    //
    // 🔴 18 → 20 is SBR-006's (`/Admin/Shell` and the rebuilt `/Pages/ThemeEditor`),
    // and it sat red from the moment that task landed because s9 never ran
    // `test:ci` — the count was stale for a whole session before this run found
    // it. That is the argument for the gate being a literal: it only works if
    // somebody runs it.
    //
    // 🔴 20 → 23 is SBR-007's, and this time the gate did its job in the session
    // that moved it: the rebuilt `/Pages/PageEditor` carries three new Function
    // nodes — `headline` (the "Editing · <title>" line), `status` (the publish
    // pill's word and colour) and `dirty` (acceptance 5's unsaved-changes
    // comparison). ⚠️ **The count is the population; the LINE BELOW is the
    // claim.** Three more browser Function nodes must still have had no ports
    // written onto them by the cloud adapters, or the ruling's scope has leaked
    // — and that assertion never even ran while this literal was stale.
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

    // 23 → 25: AC2's `moveUp` and `moveDown` on `/Pages/PageEditor`. They are
    // BROWSER Function nodes, which is the half this case is about — the cloud
    // export must leave them alone however many of them there are.
    // 25 → 26: AC2's GESTURE — `dropIndex` on `/Admin/SectionRow`. It is the
    // first browser Function in this count that lives in a REPEATER ITEM rather
    // than on a screen, which is worth naming because the line below is about
    // what the cloud adapters wrote onto it: an item template is authored once
    // and instantiated N times, and the adapters walk components, not instances.
    // 🔴 **26 → 34, and SIX of those eight were already owed at HEAD.** Measured
    // rather than derived: counting `JavaScriptFunction` nodes in the non-cloud
    // components of the committed artefact reads **32** before SBR-010's two and
    // **34** after, against a literal that still said 26. SBR-005's section kinds
    // and SBR-009's theme editor both moved this population and neither session
    // ran `test:ci` — the same failure the paragraph above records for SBR-006's,
    // now three sessions deep. **A literal gate only works if somebody runs it,
    // and this one is in the runner D19 named as unwatched.**
    //
    // +2 is SBR-010's: `/Admin/MessageRow stamp` (the row's date and sender
    // sentences) and `/Pages/Messages tally` (the count-or-empty sentence).
    // ⚠️ The count is the POPULATION; the line below is the CLAIM — and while
    // this literal was stale that claim did not run at all, for three sessions.
    //
    // 🔴 **34 → 35 is REL-011b AC1's, and this is the FOURTH session in a row to
    // move this population without running the gate that counts it.** The one
    // component that changed is `/Admin/PresetChip`, which gained its first
    // Function node when P82 s19 fixed D54: three theme chips wired a
    // `Component Inputs` constant into the SAME `presets.in-name`, so last
    // placement won and every press published `night`. The chip now publishes
    // `{ name }` — its own — at the press. That session ran the full `noodl-mcp`
    // suite and `template:site-builder` and neither can see this literal; the
    // editor's `test:ci` is the only runner that can, and P82 s20 is the session
    // that ran it. Attributed by counting the artefact either side of
    // `3f95a804`, not by inference: 34 before, 35 after, `/Admin/PresetChip`
    // the sole mover.
    //
    // 🔴 **35 → 38 is REL-011c's, and this time the gate was red for one hour,
    // not four sessions.** P82 s22 built the six admin-surface findings and ran
    // `template:site-builder`, the full `noodl-mcp` suite and both look
    // harnesses — none of which can see this literal — and P18 s83 read the red
    // in the editor `test:ci` the same evening and registered it here. Attributed
    // by counting `JavaScriptFunction` nodes in the non-cloud components of the
    // artefact either side of `86fcbcc6`, not by inference: 35 before, 38 after,
    // and the three new ones are named for what they answer —
    // `/Admin/Shell` *"Is there room for the rail beside the content?"* (A1: the
    // shell had no breakpoint of any kind, so `Screen Resolution` plus one
    // function moves four ports together below 760), `/Pages/PageEditor` *"Is
    // there room for two fields side by side?"* and `/Pages/ThemeEditor` *"Is
    // there room for the preview beside the fields?"* (the pair that carry
    // `flexWrap` with the direction, after a first build authored `wrap`
    // statically to unlock `rowGap` and unstacked the two-up at **every** width).
    //
    // ⚠️ All three are functions that decide a LAYOUT, which is new for this
    // population: every earlier entry computed a string or a colour. It changes
    // nothing about the claim below — a cloud adapter must still have written no
    // ports onto them — but it is why the count moved by three in one session
    // and will move again the next time a breakpoint is authored.
    //
    // ⚠️ The increment is NOT the point and must not be made silently. What has
    // to stay true is the line below: the cloud adapters must have written no
    // ports onto that new browser Function node either, or the ruling's scope
    // has leaked. It is a browser component's Function, the viewer pushes its
    // ports over `sendDynamicPorts`, and a cloud adapter that also wrote them
    // would be a second writer on the same `setDynamicPorts`.
    expect(browserFunctions.length).toBe(38);
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

    // Equality, not containment — see `REMOVED_SINCE_THE_BUNDLE`.
    expect(missing.sort()).toEqual([...REMOVED_SINCE_THE_BUNDLE].sort());
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
    expect(missing.sort()).toEqual([...REMOVED_SINCE_THE_BUNDLE].sort());
  });
  /**
   * The signal calls the template's cloud scripts make, read from the artefact
   * on disk — `component -> node id -> ['ready', 'built', …]`.
   *
   * 🔴 Deliberately a *looser* pattern than the product's. `cloudDynamicPorts.ts`
   * mints a signal only for `Outputs.x()` with empty parens and no underscore in
   * the name; this matches any call. The two agreeing is a claim worth making —
   * if an author writes `Outputs.done(1)` the runtime still throws, and a spec
   * that copied the product's regex would call that correct.
   */
  function signalCallsOnDisk(): Record<string, Record<string, string[]>> {
    const out: Record<string, Record<string, string[]>> = {};
    for (const component of (siteBuilderContent as TSFixme).components) {
      if (!component.name.startsWith('/#__cloud__/')) continue;
      const perNode: Record<string, string[]> = {};
      for (const node of flatten(component.graph.roots)) {
        if (node.type !== 'JavaScriptFunction') continue;
        const script = String((node.parameters ?? {}).functionScript ?? '');
        const names = [...script.matchAll(/Outputs\.([A-Za-z0-9_]+)\s*\(/g)].map((m) => m[1]);
        if (names.length) perNode[node.id] = [...new Set(names)];
      }
      if (Object.keys(perNode).length) out[component.name] = perNode;
    }
    return out;
  }

  it('ships a signal port for every signal a cloud script fires — D14', () => {
    // 🔴 The assertion whose absence let a dead bundle deploy. Every case above
    // this one measures **connections**; nothing measured the `ports` array, and
    // on 2026-08-29 a deploy wrote `ports: []` on all 11 Function nodes of
    // `SBR-017 Sign In Drive` while every connection survived. The result was
    // `publishPage` and `duplicatePage` answering HTTP 400 in under 60 ms with
    // `The script threw: Outputs.ready is not a function`.
    //
    // The mechanism is one line of the runtime: `_isSignalType` (`simplejavascript.ts:635`)
    // reads `model.outputPorts[name].type === 'signal'`, and a deployed node's
    // `outputPorts` come only from `nodeData.ports` (`nodemodel.ts:255`) — there
    // is no editor to send them. No port, no callable, and `Outputs.ready` is
    // `undefined`. So this is not a tidiness assertion about the bundle's shape:
    // it is the difference between a cloud function that runs and one that dies
    // at its first node.
    const expectedByComponent = signalCallsOnDisk();

    // The denominator, as a literal. A regex that stopped matching, or a
    // template that stopped calling signals, would otherwise pass this case
    // vacuously — the population has to be read before the measurement.
    // 🔴 13 → 15 over 11 → 13 nodes: SBR-007 AC2's `reorderSection` adds `prep`
    // (`out-ready`) and `plan` (`out-built`). Both numbers had to move together —
    // two new Function nodes each declaring exactly one signal. A port count that
    // moved without the node count would mean a script had grown a second signal,
    // which is a different fact and is what this pair exists to separate.
    const pairs = Object.values(expectedByComponent).flatMap((nodes) => Object.values(nodes).flat());
    expect(pairs.length).toBe(15);
    expect(Object.values(expectedByComponent).flatMap((nodes) => Object.keys(nodes)).length).toBe(13);

    const exported = exportCloudFunctionsToJSON(project) as TSFixme;

    const missing: string[] = [];
    for (const [componentName, nodes] of Object.entries(expectedByComponent)) {
      const component = exported.components.find((c: TSFixme) => c.name === componentName);
      const byId: Record<string, TSFixme> = {};
      flatten(component.nodes).forEach((n: TSFixme) => (byId[n.id] = n));

      for (const [nodeId, signals] of Object.entries(nodes)) {
        const ports = byId[nodeId].ports ?? [];
        for (const signal of signals) {
          // `type === 'signal'` exactly, because that string is what the runtime
          // predicate compares against. A port that shipped as `'*'` would read
          // as present here and still be uncallable there.
          const shipped = ports.some(
            (p: TSFixme) => p.name === 'out-' + signal && p.plug === 'output' && p.type === 'signal'
          );
          if (!shipped) missing.push(`${componentName} ${nodeId} out-${signal}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it('does not mint a signal port for a name no script calls', () => {
    // The instrument's negative control. The case above is satisfied by an
    // exporter that emits every conceivable `out-*` port, and by one that emits
    // whatever the node happens to be carrying — neither of which is the claim.
    // This reads **false** for a name in the same shape and the same place, so a
    // green above is about the scripts and not about the check.
    const exported = exportCloudFunctionsToJSON(project) as TSFixme;

    const spurious: string[] = [];
    for (const component of exported.components) {
      for (const node of flatten(component.nodes)) {
        for (const port of node.ports ?? []) {
          if (port.name === 'out-notCalledByAnyScript') spurious.push(`${component.name} ${node.id}`);
        }
      }
    }

    expect(spurious).toEqual([]);

    // …and the same walk over the same bundle does find the real ones, so the
    // empty list above is an absence and not a walk that reached nothing.
    const real = exported.components.flatMap((c: TSFixme) =>
      flatten(c.nodes).flatMap((n: TSFixme) =>
        (n.ports ?? []).filter((p: TSFixme) => p.type === 'signal').map(() => 1)
      )
    );
    expect(real.length).toBe(15);
  });

});

/**
 * D14 — the bundle that shipped with no ports at all.
 *
 * On 2026-08-29 a deploy of `SBR-017 Sign In Drive` wrote `ports: []` on all 11
 * cloud Function nodes while every connection survived, and `publishPage` and
 * `duplicatePage` answered HTTP 400 in under 60 ms with
 * `The script threw: Outputs.ready is not a function`. The chain from that empty
 * array to that throw is `withScriptPorts`'s docblock; this suite is the other
 * end — the export.
 *
 * 🔴 **The signal ports are not derived. They are persisted**, on the node,
 * in `site-builder.content.json`, and the drive project carried them on disk at
 * the moment of the deploy that lost them (checked: `nodes.json` for both the
 * failing and the working project holds `out-ready:output:signal`). So no sweep
 * and no adapter had to run for them to ship — which is why the first attempt at
 * this suite, which withheld `CLOUD_DYNAMIC_PORT_ADAPTERS`, passed with the fix
 * sabotaged and reproduced nothing.
 *
 * The one gate in `exportPorts` (`util.ts:16`) that can drop a *persisted* port
 * is `node.type.exportDynamicPorts` — falsy on an `UnknownNodeType`, which is
 * what every node has until the node library resolves. That is the condition
 * below, and it produces the same `ports: []` production shipped.
 *
 * ⚠️ **What made the live editor's library unresolved at 15:48 was not observed**
 * and is not claimed here. This suite is about the consequence: whatever the
 * session did, a deployed cloud function has to be able to fire its own signals.
 */
describe('D14: a cloud bundle carries its signal ports even when no node type resolves', () => {
  let project: ProjectModel;
  let previousLibrary: unknown;

  beforeEach(() => {
    previousLibrary = (window as TSFixme).NodeLibraryData;
    WarningsModel.instance.clearAllWarnings();

    // 🔴 The condition, and the only line that differs from the suite above:
    // no library, so `NodeLibrary` resolves every node to an `UnknownNodeType`.
    (window as TSFixme).NodeLibraryData = {};
    NodeLibrary.instance.loadLibrary();

    project = ProjectModel.fromJSON(JSON.parse(JSON.stringify(siteBuilderContent)));
    ProjectModel.instance = project;
    NodeLibrary.instance.registerModule(project);
  });

  afterEach(() => {
    NodeLibrary.instance.unregisterModule(project);
    WarningsModel.instance.clearAllWarnings();
    ProjectModel.instance = undefined;

    (window as TSFixme).NodeLibraryData = previousLibrary;
    if (previousLibrary) NodeLibrary.instance.loadLibrary();
  });

  /** The cloud Function nodes, as the editor's models. */
  function cloudFunctionNodes(): TSFixme[] {
    const nodes: TSFixme[] = [];
    getCloudFunctionComponents(project).forEach((component) =>
      component.forEachNode((node: TSFixme) => {
        if (node.type.name === 'JavaScriptFunction') nodes.push(node);
        // 🔴 `forEachNode` stops on a truthy return, so this returns nothing.
      })
    );
    return nodes;
  }

  /** Every `out-*` signal port in a bundle, as `component node port`. */
  function signalPorts(exported: TSFixme): string[] {
    const out: string[] = [];
    for (const component of exported.components) {
      for (const node of flatten(component.nodes)) {
        for (const port of node.ports ?? []) {
          if (port.plug === 'output' && port.type === 'signal') out.push(`${component.name} ${node.id} ${port.name}`);
        }
      }
    }
    return out.sort();
  }

  it('the types really are unresolved, and the ports really are on the nodes', () => {
    // Read the condition before the measurement, and read both halves: an
    // absence of ports in the export means nothing if the ports were never on
    // the nodes, and a green below means nothing if the library resolved after
    // all. This is the pair that makes the next case a reproduction rather than
    // a description.
    const nodes = cloudFunctionNodes();
    // 11 → 13 with AC2's `prep` and `plan` — see the healthy suite's note.
    expect(nodes.length).toBe(13);
    expect(nodes.every((node) => NodeLibrary.instance.typeIsMissing(node.type))).toBe(true);

    // The persisted ports the export is about to be asked for.
    const persisted = nodes.flatMap((node: TSFixme) =>
      (node.ports || []).filter((p: TSFixme) => p.type === 'signal')
    );
    expect(persisted.length).toBe(15);
  });

  it('still ships all 15 signal ports', () => {
    // The same 15 the healthy suite counts, and the equality is the claim: what
    // a deploy contains is a property of the project, not of when in the session
    // it was taken. 🔴 Red before `withScriptPorts` — the export dropped every
    // one of them, which is the bundle that shipped.
    expect(signalPorts(exportCloudFunctionsToJSON(project) as TSFixme).length).toBe(15);
  });

  it('adds only what the script declares — it does not invent a port', () => {
    // The known-firing control on the backstop. It reads the node's own
    // `functionScript`, so the set it produces is the set the artefact on disk
    // asks for — asserted as a list, not a count, so a backstop that added 13
    // wrong ports is red.
    const exported = exportCloudFunctionsToJSON(project) as TSFixme;

    expect(signalPorts(exported).filter((p) => p.endsWith('out-notCalledByAnyScript'))).toEqual([]);

    const wanted = new Set<string>();
    for (const component of (siteBuilderContent as TSFixme).components) {
      if (!component.name.startsWith('/#__cloud__/')) continue;
      for (const node of flatten(component.graph.roots)) {
        if (node.type !== 'JavaScriptFunction') continue;
        const script = String((node.parameters ?? {}).functionScript ?? '');
        for (const match of script.matchAll(/Outputs\.([A-Za-z0-9_]+)\s*\(/g)) {
          wanted.add(`${component.name} ${node.id} out-${match[1]}`);
        }
      }
    }

    expect(signalPorts(exported)).toEqual([...wanted].sort());
  });
});
