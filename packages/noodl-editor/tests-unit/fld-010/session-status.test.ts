/**
 * FLD-010 — what the editor says about itself when an agent asks.
 *
 * ## The half the MCP suite deliberately fakes
 *
 * `noodl-mcp/tests/fld010SessionStatus.test.ts` grades the transport against the real relay with a
 * *faked* editor window. This grades the reading that window produces, with no relay in sight.
 * Between them the only unmeasured seam is the wire itself, which AC1 and AC3 drive in the real app.
 *
 * ## 🔴 The property under test is a refusal, not a value
 *
 * Three of these arms exist to prove `unsavedComponents` comes back **`null`** rather than `[]`
 * when the comparison cannot be trusted. `[]` is the shape of "every file is safe to write", and
 * producing it from a baseline map that describes a *different project* is the exact lie §5 names.
 * The distinction is invisible in a green run that only ever asserts the happy case, which is why
 * the unknowable cases outnumber the knowable one here.
 */

/**
 * ⚠️ **`@noodl-models/projectmodel` is the ONE thing mocked here, and it is mocked because it
 * cannot load rather than to make the spec easier.** It pulls in `bugtracker`, which reads
 * `platform.getUserDataPath()` at module scope and is `undefined` outside Electron — the suite
 * fails *to run*, not to pass. Everything the reading actually reasons about is real:
 * `projectStructureService`, its baseline map, and `hashComponent` are the editor's own.
 *
 * 🔴 The mock is therefore the *project holder*, not the *comparison*. If it were the other way
 * round these arms would grade this file's idea of a hash and nothing else.
 */
jest.mock('@noodl-models/projectmodel', () => ({
  ProjectModel: { instance: undefined },
  hasPendingProjectSave: () => mockSavePending
}));

import { collectSessionStatus } from '../../src/editor/src/models/sessionStatus/collect';
import { projectStructureService } from '../../src/editor/src/services/ProjectStructure';
import { hashComponent } from '../../src/editor/src/services/ProjectStructure/ComponentSaver';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ProjectModel } = require('@noodl-models/projectmodel');

/** What the mocked `hasPendingProjectSave` returns, per arm. */
let mockSavePending = false;

/** A ProjectModel stand-in with only the members the reading touches. */
function fakeProject(over: Partial<Record<string, unknown>> = {}) {
  return {
    name: 'Shop',
    _retainedProjectDirectory: '/tmp/shop',
    _projectFormat: 'v2',
    getComponents: () => [],
    ...over
  } as unknown as never;
}

/**
 * A component whose `toJSON` is stable, so its hash is too.
 *
 * ⚠️ **`toJSON()` has to be a real legacy component shape, and the graph has to hang off
 * `graph.roots`.** `hashComponent` serialises through `buildComponentV2Files`, which reads `name`
 * and `id` and takes its node list from `component.graph.roots`. This fixture first varied a
 * top-level `nodes` array — a field the hasher does not look at — so the edited and unedited arms
 * hashed **identically**, and the "a component that moved off its baseline is reported" arm failed.
 * 🔴 It failed in the direction that shows: had the spec been written the other way round
 * ("an untouched component is not reported") the same wrong fixture would have passed it, green,
 * proving nothing. A fixture that varies a field the thing under test ignores is not a fixture.
 */
function fakeComponent(name: string, roots: unknown[] = []) {
  const json = { name, id: 'id-' + name, graph: { roots, connections: [] } };
  return { name, toJSON: () => json };
}

describe('FLD-010 — the reading an editor gives of itself', () => {
  let savedInstance: unknown;
  let savedBaselineDir: string | undefined;

  beforeEach(() => {
    savedInstance = ProjectModel.instance;
    savedBaselineDir = projectStructureService.baselineProjectDirectory;
    mockSavePending = false;
  });

  afterEach(() => {
    ProjectModel.instance = savedInstance;
    setBaselineDir(savedBaselineDir);
    (projectStructureService.saver as unknown as { diskHashes: Map<string, string> }).diskHashes.clear();
  });

  /**
   * ⚠️ Reaching past the getter on purpose, and only here. `baselineProjectDirectory` is read-only
   * by design — the whole point of FLD-009's guard is that nothing sets it by hand — so a spec that
   * needs to place the service in the "baselines describe another project" state has to write the
   * private field. Doing it through a named helper keeps that one cheat in one place.
   */
  function setBaselineDir(dir: string | undefined) {
    (projectStructureService as unknown as { seededProjectDir: string | undefined }).seededProjectDir = dir;
  }

  function setBaseline(path: string, component: { toJSON: () => unknown }) {
    (projectStructureService.saver as unknown as { diskHashes: Map<string, string> }).diskHashes.set(
      path,
      hashComponent(component.toJSON() as never)
    );
  }

  it('says no project is open when none is', () => {
    ProjectModel.instance = undefined;

    const status = collectSessionStatus();

    expect(status.projectOpen).toBe(false);
    expect(status.directory).toBeNull();
    expect(status.currentComponent).toBeNull();
    // 🔴 `null`, not `[]`. "No project open" is not "no unsaved files".
    expect(status.unsavedComponents).toBeNull();
    expect(status.unsavedComponentsUnknownReason).toContain('No project is open');
  });

  it('names the open project and its directory', () => {
    ProjectModel.instance = fakeProject();
    setBaselineDir('/tmp/shop');

    const status = collectSessionStatus();

    expect(status.projectOpen).toBe(true);
    expect(status.directory).toBe('/tmp/shop');
    expect(status.projectName).toBe('Shop');
    expect(status.projectFormat).toBe('v2');
  });

  it('reports a component whose in-memory content has moved off its on-disk baseline', () => {
    const home = fakeComponent('/Pages/Home', [{ id: 'a', type: 'Group' }]);
    setBaseline('Pages/Home', home);
    setBaselineDir('/tmp/shop');
    // The person types into it: same component, different content, baseline untouched.
    const edited = fakeComponent('/Pages/Home', [{ id: 'a', type: 'Group' }, { id: 'b', type: 'Text' }]);
    ProjectModel.instance = fakeProject({ getComponents: () => [edited] });

    const status = collectSessionStatus();

    expect(status.unsavedComponents).toEqual(['Pages/Home']);
  });

  it('reports nothing unsaved when memory matches the baseline', () => {
    const home = fakeComponent('/Pages/Home');
    setBaseline('Pages/Home', home);
    setBaselineDir('/tmp/shop');
    ProjectModel.instance = fakeProject({ getComponents: () => [home] });

    const status = collectSessionStatus();

    expect(status.unsavedComponents).toEqual([]);
  });

  /**
   * A component created since the project was opened has no baseline at all. That is unsaved —
   * genuinely, not unknowably — and it is the one case where a missing baseline is an answer.
   */
  it('counts a component this editor has never written as unsaved', () => {
    setBaselineDir('/tmp/shop');
    ProjectModel.instance = fakeProject({ getComponents: () => [fakeComponent('/Pages/Brand New')] });

    const status = collectSessionStatus();

    expect(status.unsavedComponents).toEqual(['Pages/Brand New']);
  });

  /**
   * 🔴 **The lie this refuses to tell.** Baselines are a module singleton, re-seeded lazily, so
   * between opening a project and its first save they can still describe the previous one — under
   * paths (`App`, `Pages/Home`) that every project has. Diffing against them would report every
   * component of the new project as unsaved, or — worse, if the hashes happened to match — report
   * a dirty project as clean.
   */
  it('refuses to answer at all when the baselines describe a different project', () => {
    const home = fakeComponent('/Pages/Home');
    setBaseline('Pages/Home', home);
    setBaselineDir('/tmp/some-other-project');
    ProjectModel.instance = fakeProject({ getComponents: () => [home] });

    const status = collectSessionStatus();

    expect(status.unsavedComponents).toBeNull();
    expect(status.unsavedComponentsUnknownReason).toContain('baselines');
  });

  it('refuses to answer for a legacy project, which has no per-component baselines', () => {
    ProjectModel.instance = fakeProject({ _projectFormat: 'legacy' });
    setBaselineDir('/tmp/shop');

    const status = collectSessionStatus();

    expect(status.unsavedComponents).toBeNull();
    expect(status.unsavedComponentsUnknownReason).toContain('legacy');
    // And it still points the caller at the field that IS exact for a legacy project.
    expect(status.unsavedComponentsUnknownReason).toContain('unsavedBuffers');
  });

  it('refuses to answer for a project with no directory on disk yet', () => {
    ProjectModel.instance = fakeProject({ _retainedProjectDirectory: undefined });

    const status = collectSessionStatus();

    expect(status.directory).toBeNull();
    expect(status.unsavedComponents).toBeNull();
  });

  /**
   * AC3's spec half. `unsavedBuffers` is the one dirty signal that is exact for **every** project
   * format, which is why the two `null` arms above still point the caller at it.
   */
  it('reports an armed-but-unwritten edit as an unsaved buffer', () => {
    ProjectModel.instance = fakeProject();
    setBaselineDir('/tmp/shop');
    mockSavePending = true;

    expect(collectSessionStatus().unsavedBuffers).toBe(true);

    mockSavePending = false;
    expect(collectSessionStatus().unsavedBuffers).toBe(false);
  });

  /**
   * 🔴 A write still in flight when the project closes is still a write. Answering `false` here
   * because `ProjectModel.instance` has gone would tell an agent the coast was clear during the
   * exact second the editor is flushing to disk.
   */
  it('still reports a pending write when the project has just closed', () => {
    ProjectModel.instance = undefined;
    mockSavePending = true;

    const status = collectSessionStatus();

    expect(status.projectOpen).toBe(false);
    expect(status.unsavedBuffers).toBe(true);
  });

  /**
   * The graph module is not loaded in this environment, so the lazy require inside
   * `currentComponentName` throws — and the answer must be `null` rather than an exception that
   * takes the whole reading out. An editor that cannot say which component is on screen still
   * knows whether a person is in it, and that is the field that matters most.
   */
  it('still answers when the canvas cannot be read', () => {
    ProjectModel.instance = fakeProject();
    setBaselineDir('/tmp/shop');

    const status = collectSessionStatus();

    expect(status.currentComponent).toBeNull();
    expect(status.projectOpen).toBe(true);
  });
});
