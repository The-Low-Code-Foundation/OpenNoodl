/**
 * HLS-013 AC4 — **the editor's Deploy button and the headless door reach the
 * same code**, and the build-side half of AC2.
 *
 * ## Why this spec exists in this suite
 *
 * The headless door is graded twice already: `tests-unit/hls-013` grades the
 * decision in plain Node, and `noodl-mcp`'s `hls013-deploy-cloud-functions`
 * drives it against a real backend. Neither of those touches the editor. So on
 * their own they prove the new door works and say **nothing** about whether the
 * old one still goes through the same code — which is exactly the shape of
 * SB-017, where `nodegx-backend`'s suite was green on the same seven components
 * that the editor's deploy was silently breaking, because the two built their
 * bundles differently and nothing compared them.
 *
 * This is the comparison, from the editor's side: it drives the real
 * `CloudFunctionDeployer.pushToBackend` — the method both UI call sites use —
 * through a fake `ipcRenderer`, and asserts that what it PUT on the wire is
 * exactly what the shared builder produces. A mutant in `buildCloudBundleParts`,
 * `cloudBundleNameFrom`, `hashCloudExport` or `deployCloudBundle` reddens this
 * spec **and** the other two suites, which is what AC4 asks for.
 *
 * 🔴 The seam is `utils/ipc`'s own documented one: `getIpc()` reads
 * `window.require`, and answers `null` outside Electron. Installing a fake
 * `window.require` is therefore using the escape hatch the module already
 * declares, not defeating a boundary.
 */

import { CLOUD_DYNAMIC_PORT_ADAPTERS } from '@noodl-models/NodeTypeAdapters/CloudDynamicPortsAdapter';
import { NamedPortsAdapter } from '@noodl-models/NodeTypeAdapters/NamedPortsAdapter';
import { NodeLibrary } from '@noodl-models/nodelibrary';
import { ProjectModel } from '@noodl-models/projectmodel';
import { WarningsModel } from '@noodl-models/warningsmodel';

import cloudNodeLibrary from '../../src/editor/src/models/nodelibrary/cloud-node-library.json';
import siteBuilderContent from '../../src/editor/src/models/template/templates/site-builder.content.json';
import { CloudFunctionDeployer } from '../../src/editor/src/services/CloudFunctionDeployer';
import { cloudBundleNameFrom, hashCloudExport } from '../../src/editor/src/utils/exporter/cloudDeployCore';
import { buildCloudBundlePartsWithKits, getCloudFunctionComponents } from '../../src/editor/src/utils/exporter/cloudFunctions';

interface PutCall {
  channel: string;
  args: unknown[];
}

describe('HLS-013 AC4 — the editor deploy goes through the shared path', () => {
  let project: ProjectModel;
  let previousLibrary: unknown;
  let previousRequire: unknown;
  let calls: PutCall[];
  /** What the fake main process answers `backend:update-workflow` with. */
  let answer: unknown;

  beforeEach(() => {
    // `loadLibrary()` replaces a singleton for the whole spec bundle; snapshot
    // and put it back, exactly as `sb017-deploy-connection-parity` does.
    previousLibrary = (window as TSFixme).NodeLibraryData;
    previousRequire = (window as TSFixme).require;

    WarningsModel.instance.clearAllWarnings();
    (window as TSFixme).NodeLibraryData = cloudNodeLibrary;
    NodeLibrary.instance.loadLibrary();

    project = ProjectModel.fromJSON(JSON.parse(JSON.stringify(siteBuilderContent)));
    // The bundle name is keyed on this, so it has to be something.
    project._retainedProjectDirectory = '/tmp/hls013-editor-door';
    ProjectModel.instance = project;
    NodeLibrary.instance.registerModule(project);

    new NamedPortsAdapter().events.projectLoaded();
    CLOUD_DYNAMIC_PORT_ADAPTERS.forEach((Adapter) => new Adapter().events.projectLoaded());
    project.getComponents().forEach((component) => component.graph.evaluateHealth());

    calls = [];
    answer = { success: true };
    (window as TSFixme).require = (name: string) =>
      name === 'electron'
        ? {
            ipcRenderer: {
              invoke: (channel: string, ...args: unknown[]) => {
                calls.push({ channel, args });
                return Promise.resolve(answer);
              },
              on: () => undefined,
              removeListener: () => undefined
            }
          }
        : undefined;
  });

  afterEach(() => {
    NodeLibrary.instance.unregisterModule(project);
    WarningsModel.instance.clearAllWarnings();
    ProjectModel.instance = undefined;
    (window as TSFixme).require = previousRequire;
    (window as TSFixme).NodeLibraryData = previousLibrary;
    if (previousLibrary) NodeLibrary.instance.loadLibrary();
  });

  it('🔴 pushes exactly what the shared builder builds, under the shared name', async () => {
    // A control first: this project really does have cloud functions, so nothing
    // below is vacuously true about an empty bundle.
    expect(getCloudFunctionComponents(project).length).toBeGreaterThan(0);

    const ok = await CloudFunctionDeployer.pushToBackend('backend-under-test', { force: true, quiet: true });
    expect(ok).toBe(true);

    const put = calls.filter((c) => c.channel === 'backend:update-workflow');
    expect(put.length).toBe(1);

    const sent = put[0].args[0] as { backendId: string; name: string; workflow: Record<string, unknown> };
    expect(sent.backendId).toBe('backend-under-test');

    // The name comes from the ONE rule the headless door also uses.
    expect(sent.name).toBe(cloudBundleNameFrom(project.name, project._retainedProjectDirectory));

    // …and the payload is what the ONE builder builds. Compared as data, not as
    // a count: a bundle with the right number of components and the wrong wires
    // is the SB-017 defect exactly.
    const expected = await buildCloudBundlePartsWithKits(project);
    const { deployFingerprint, ...payload } = sent.workflow as Record<string, unknown>;
    expect(payload).toEqual(expected.bundle as Record<string, unknown>);

    // 🔴 And the fingerprint rode along, so a headless run against this backend
    // can tell "already deployed" from "deployed just now". Without this the
    // editor and the CLI would disagree about what is on the backend.
    expect(deployFingerprint).toBe(hashCloudExport(expected.bundle));
  });

  it('a rejected bundle is a failure, and the editor says so', async () => {
    answer = { success: false, error: 'the backend rejected the function bundle' };

    const ok = await CloudFunctionDeployer.pushToBackend('backend-under-test', { force: true, quiet: true });

    expect(ok).toBe(false);
    expect(CloudFunctionDeployer.getState().lastError['backend-under-test']).toBe(
      'the backend rejected the function bundle'
    );
  });

  it('🔴 a second push with the same graph does not re-send it', async () => {
    // The editor's idempotency now runs through the same `deployCloudBundle`
    // decision the headless door uses — its hash source is its own memory of
    // what it pushed, which is legitimate only because it is the process that
    // pushed. Forced first (to seed), then unforced.
    await CloudFunctionDeployer.pushToBackend('backend-under-test', { force: true, quiet: true });
    expect(calls.filter((c) => c.channel === 'backend:update-workflow').length).toBe(1);

    const ok = await CloudFunctionDeployer.pushToBackend('backend-under-test', { quiet: true });

    expect(ok).toBe(true);
    // Still one: the second call decided there was nothing to send.
    expect(calls.filter((c) => c.channel === 'backend:update-workflow').length).toBe(1);
  });
});

describe('HLS-013 AC2 — one broken function does not take the others down', () => {
  let project: ProjectModel;
  let previousLibrary: unknown;

  beforeEach(() => {
    previousLibrary = (window as TSFixme).NodeLibraryData;
    WarningsModel.instance.clearAllWarnings();
    (window as TSFixme).NodeLibraryData = cloudNodeLibrary;
    NodeLibrary.instance.loadLibrary();

    project = ProjectModel.fromJSON(JSON.parse(JSON.stringify(siteBuilderContent)));
    ProjectModel.instance = project;
    NodeLibrary.instance.registerModule(project);
    new NamedPortsAdapter().events.projectLoaded();
    CLOUD_DYNAMIC_PORT_ADAPTERS.forEach((Adapter) => new Adapter().events.projectLoaded());
    project.getComponents().forEach((component) => component.graph.evaluateHealth());
  });

  afterEach(() => {
    NodeLibrary.instance.unregisterModule(project);
    WarningsModel.instance.clearAllWarnings();
    ProjectModel.instance = undefined;
    (window as TSFixme).NodeLibraryData = previousLibrary;
    if (previousLibrary) NodeLibrary.instance.loadLibrary();
  });

  it('names the component that could not be exported, and ships the rest', async () => {
    const components = getCloudFunctionComponents(project);
    expect(components.length).toBeGreaterThan(1);

    // Break exactly one, at the first thing `exportComponent` does to a graph —
    // `flushEvaluateHealth()`, its opening line. This stands in for any
    // malformed component; the point is not this particular breakage, it is that
    // ONE of them used to stop all the others.
    const victim = components[0];
    const broken = victim.graph as TSFixme;
    const originalFlush = broken.flushEvaluateHealth;
    broken.flushEvaluateHealth = () => {
      throw new Error('this component cannot be read');
    };

    try {
      const parts = await buildCloudBundlePartsWithKits(project);

      // The failure is a NAME, not a count.
      expect(parts.failures.map((f) => f.name)).toEqual([victim.name]);
      expect(parts.failures[0].reason).toContain('this component cannot be read');

      // 🔴 And everything else still shipped. Before HLS-013 this threw out of
      // `exportCloudFunctionsToJSON`, straight through `pushToBackend` (which
      // never wrapped it) and into the save-triggered push's
      // `.catch(() => undefined)` — so ONE broken component silently stopped
      // EVERY function in the project from deploying, on every autosave, with
      // nothing said anywhere.
      expect(parts.shipped.length).toBe(components.length - 1);
      expect(parts.shipped).not.toContain(victim.name);
      expect((parts.bundle!.components as unknown[]).length).toBe(components.length - 1);
    } finally {
      broken.flushEvaluateHealth = originalFlush;
    }
  });
});
