/**
 * ProjectStructureService integration tests — SUB-001
 *
 * Exercises the full load → edit → save → reload cycle against an in-memory FS.
 */
import { ProjectStructureService } from '../../../src/editor/src/services/ProjectStructure';
import { MemFs } from './memfs';
import { makeProject, makeNode, seedV2Project } from './fixtures';

const DIR = '/proj';

/** Paths whose content changed (or was created) between two file snapshots. */
function changedPaths(before: Map<string, string>, after: Map<string, string>): string[] {
  const out: string[] = [];
  for (const [k, v] of after) {
    if (before.get(k) !== v) out.push(k);
  }
  return out.sort();
}

function setup() {
  const fs = new MemFs();
  seedV2Project(fs, DIR, makeProject());
  return { fs, service: new ProjectStructureService(fs) };
}

describe('ProjectStructureService.loadProject', () => {
  it('reconstructs the full legacy project from the decomposed files', async () => {
    const { service } = setup();
    const { project, warnings } = await service.loadProject(DIR);

    expect(warnings).toEqual([]);
    expect(project.name).toBe('Test Project');
    const names = project.components.map((c) => c.name).sort();
    expect(names).toEqual(['/%rootcomponent', '/Header', '/Pages/Home']);

    const home = project.components.find((c) => c.name === '/Pages/Home')!;
    expect(home.graph.roots[0].children[0].id).toBe('home2');
    expect(home.graph.connections.length).toBe(1);
  });
});

describe('ProjectStructureService.saveProject', () => {
  it('writes nothing on a no-op save', async () => {
    const { fs, service } = setup();
    const { project } = await service.loadProject(DIR);

    const before = new Map(fs.files);
    const res = await service.saveProject(DIR, project);

    expect(res.result).toBe('success');
    expect(changedPaths(before, fs.files)).toEqual([]);
  });

  it('rewrites only the edited component plus the registry', async () => {
    const { fs, service } = setup();
    const { project } = await service.loadProject(DIR);

    const home = project.components.find((c) => c.name === '/Pages/Home')!;
    home.graph.roots.push(makeNode('added', 'Text'));

    const before = new Map(fs.files);
    const res = await service.saveProject(DIR, project);

    expect(res.result).toBe('success');
    expect(res.changed).toEqual(['Pages/Home']);

    // Only the edited component's own files and the registry may change on disk —
    // never another component. (connections.json is identical bytes here, so it
    // won't appear in a content diff even though the component was rewritten.)
    const changed = changedPaths(before, fs.files);
    for (const p of changed) {
      const ok = p === `${DIR}/components/_registry.json` || p.startsWith(`${DIR}/components/Pages/Home/`);
      expect(ok).toBe(true);
    }
    expect(changed).toContain(`${DIR}/components/Pages/Home/nodes.json`);
    expect(changed).toContain(`${DIR}/components/_registry.json`);
    // Header untouched.
    expect(before.get(`${DIR}/components/Header/nodes.json`)).toBe(
      fs.files.get(`${DIR}/components/Header/nodes.json`)
    );
  });

  it('rewrites nodegx.project.json (only) when project metadata changes', async () => {
    const { fs, service } = setup();
    const { project } = await service.loadProject(DIR);

    project.name = 'Renamed Project';

    const before = new Map(fs.files);
    const res = await service.saveProject(DIR, project);

    expect(res.result).toBe('success');
    expect(res.changed).toEqual([]);
    expect(changedPaths(before, fs.files)).toEqual([`${DIR}/nodegx.project.json`]);
  });

  it('round-trips edits: reload after save reflects the change', async () => {
    const { fs, service } = setup();
    const { project } = await service.loadProject(DIR);

    const home = project.components.find((c) => c.name === '/Pages/Home')!;
    home.graph.roots.push(makeNode('added', 'Text'));
    await service.saveProject(DIR, project);

    // Fresh service + fresh load = disk is the only source of truth.
    const reopened = await new ProjectStructureService(fs).loadProject(DIR);
    const reloadedHome = reopened.project.components.find((c) => c.name === '/Pages/Home')!;
    const rootIds = reloadedHome.graph.roots.map((r) => r.id).sort();
    expect(rootIds).toEqual(['added', 'home1']);
  });

  it('rolls back baselines on a mid-save failure so a retry redoes everything', async () => {
    const { fs, service } = setup();
    const { project } = await service.loadProject(DIR);

    const home = project.components.find((c) => c.name === '/Pages/Home')!;
    home.graph.roots.push(makeNode('added', 'Text'));

    // Fail the registry commit — components get written, but the index write dies.
    fs.failOn = { op: 'rename', path: `${DIR}/components/_registry.json` };
    const failed = await service.saveProject(DIR, project);
    expect(failed.result).toBe('failure');

    // A retry (fault cleared) must still see the edit as pending and rewrite it +
    // the registry — not silently skip it because a baseline advanced.
    const retry = await service.saveProject(DIR, project);
    expect(retry.result).toBe('success');
    expect(retry.changed).toEqual(['Pages/Home']);

    const registry = await fs.readJson<{ components: Record<string, { nodeCount?: number }> }>(
      `${DIR}/components/_registry.json`
    );
    expect(registry.components['Pages/Home'].nodeCount).toBe(3); // home1 + home2 + added
  });

  it('removes a deleted component from disk and the registry', async () => {
    const { fs, service } = setup();
    const { project } = await service.loadProject(DIR);

    project.components = project.components.filter((c) => c.name !== '/Header');
    const res = await service.saveProject(DIR, project);

    expect(res.removed).toEqual(['Header']);
    expect(fs.pathsUnder(`${DIR}/components/Header`)).toEqual([]);
    const registry = await fs.readJson<{ components: Record<string, unknown> }>(
      `${DIR}/components/_registry.json`
    );
    expect(registry.components['Header']).toBeUndefined();
  });
});

describe('ProjectStructureService.reloadComponent', () => {
  it('re-reads a single component and marks its baseline current', async () => {
    const { fs, service } = setup();
    await service.loadProject(DIR);

    // Simulate an external (peer) change to Header on disk.
    const external = {
      name: '/Header',
      id: 'comp__Header',
      graph: { roots: [makeNode('hdr1'), makeNode('peerAdded', 'Text')], connections: [] }
    };
    seedV2Project(fs, DIR, {
      name: 'Test Project',
      id: 'proj_test',
      version: '4',
      variants: [],
      components: [external]
    });

    const reloaded = await service.reloadComponent(DIR, 'Header');
    expect(reloaded.graph.roots.map((r) => r.id).sort()).toEqual(['hdr1', 'peerAdded']);

    // Baseline updated → a save of that same content is a no-op for Header.
    const cs = service.saver.getChangedComponents({
      name: 'Test Project',
      version: '4',
      components: [reloaded]
    });
    expect(cs.changed.length).toBe(0);
  });
});
