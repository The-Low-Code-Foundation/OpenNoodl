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

/**
 * REL-009a arm C — the saver must not write its in-memory copy of a component
 * over a version somebody else put on disk while we held the project.
 *
 * Driven end-to-end on 2026-09-03 (a real editor + a real MCP server over stdio):
 * with an agent editing `Pages/Home` and the human editing a *different node in
 * the same component*, the agent's change was reverted with no conflict, no
 * prompt and no diagnostic. These grade the guard that stops it.
 */
describe('ProjectStructureService.saveProject — external writes (REL-009a arm C)', () => {
  /** Simulates an agent writing one node's label straight to the component's files. */
  function writeExternally(fs: MemFs, componentPath: string, marker: string) {
    const p = `${DIR}/components/${componentPath}/nodes.json`;
    const nodes = JSON.parse(fs.files.get(p)!);
    nodes.nodes[0].label = marker;
    fs.files.set(p, JSON.stringify(nodes, null, 2));
  }

  it('refuses to overwrite a component that changed on disk, and says which', async () => {
    const { fs, service } = setup();
    const { project } = await service.loadProject(DIR);

    // The human edits Home in the editor…
    const home = project.components.find((c) => c.name === '/Pages/Home')!;
    home.graph.roots.push(makeNode('added', 'Text'));
    // …and an agent writes Home on disk underneath.
    writeExternally(fs, 'Pages/Home', 'WRITTEN-BY-SOMEONE-ELSE');

    const before = new Map(fs.files);
    const res = await service.saveProject(DIR, project);

    expect(res.result).toBe('success');
    expect(res.refused).toEqual(['Pages/Home']);
    expect(res.changed).toEqual([]);

    // The other writer's content is still there, byte for byte.
    expect(fs.files.get(`${DIR}/components/Pages/Home/nodes.json`)).toBe(
      before.get(`${DIR}/components/Pages/Home/nodes.json`)
    );
    expect(fs.files.get(`${DIR}/components/Pages/Home/nodes.json`)).toContain('WRITTEN-BY-SOMEONE-ELSE');
  });

  it('leaves the baseline alone, so the next save retries rather than forgetting', async () => {
    const { fs, service } = setup();
    const { project } = await service.loadProject(DIR);

    const home = project.components.find((c) => c.name === '/Pages/Home')!;
    home.graph.roots.push(makeNode('added', 'Text'));
    writeExternally(fs, 'Pages/Home', 'WRITTEN-BY-SOMEONE-ELSE');

    const first = await service.saveProject(DIR, project);
    expect(first.refused).toEqual(['Pages/Home']);

    // The disagreement is resolved (the reader caught up), and the very next
    // save must still know Home is dirty.
    await service.reloadComponent(DIR, 'Pages/Home');
    const second = await service.saveProject(DIR, project);
    expect(second.refused).toBeUndefined();
    expect(second.changed).toEqual(['Pages/Home']);
  });

  it('refuses only the component that moved — the rest of the save still lands', async () => {
    const { fs, service } = setup();
    const { project } = await service.loadProject(DIR);

    const home = project.components.find((c) => c.name === '/Pages/Home')!;
    const header = project.components.find((c) => c.name === '/Header')!;
    home.graph.roots.push(makeNode('added-home', 'Text'));
    header.graph.roots.push(makeNode('added-header', 'Text'));

    writeExternally(fs, 'Pages/Home', 'WRITTEN-BY-SOMEONE-ELSE');

    const res = await service.saveProject(DIR, project);

    expect(res.refused).toEqual(['Pages/Home']);
    expect(res.changed).toEqual(['Header']);
    expect(fs.files.get(`${DIR}/components/Pages/Home/nodes.json`)).toContain('WRITTEN-BY-SOMEONE-ELSE');
    expect(fs.files.get(`${DIR}/components/Header/nodes.json`)).toContain('added-header');
  });

  it('does not refuse an ordinary save — the guard is silent when nothing moved', async () => {
    const { fs, service } = setup();
    const { project } = await service.loadProject(DIR);

    const home = project.components.find((c) => c.name === '/Pages/Home')!;
    home.graph.roots.push(makeNode('added', 'Text'));

    const res = await service.saveProject(DIR, project);

    expect(res.refused).toBeUndefined();
    expect(res.changed).toEqual(['Pages/Home']);
    expect(fs.files.get(`${DIR}/components/Pages/Home/nodes.json`)).toContain('added');
  });

  it('writes a component the editor created that has no file yet', async () => {
    const { fs, service } = setup();
    const { project } = await service.loadProject(DIR);

    project.components.push({
      name: '/Pages/Brand New',
      graph: { roots: [makeNode('brandnew', 'Text')], connections: [] }
    } as never);

    const res = await service.saveProject(DIR, project);

    expect(res.refused).toBeUndefined();
    expect(res.changed).toEqual(['Pages/Brand New']);
    expect(fs.files.get(`${DIR}/components/Pages/Brand New/nodes.json`)).toContain('brandnew');
  });
});

/**
 * The guard added for arm C must not mistake OUR OWN write for somebody else's.
 * `saveProject` deliberately rewinds baselines when a save fails part-way, so the
 * retry redoes the write — which means, on that retry, the files on disk do not
 * match the baseline. This is the case the pre-existing mid-save-rollback spec
 * caught when the guard was first written, and it is why the guard has a second
 * clause. Graded here directly so a future edit cannot quietly drop it.
 */
describe('ProjectStructureService.saveProject — the guard vs our own rolled-back write', () => {
  it('retries a rolled-back save instead of refusing it as an external change', async () => {
    const { fs, service } = setup();
    const { project } = await service.loadProject(DIR);

    const home = project.components.find((c) => c.name === '/Pages/Home')!;
    home.graph.roots.push(makeNode('added', 'Text'));

    // The component files land, the registry commit dies, baselines are rewound.
    fs.failOn = { op: 'rename', path: `${DIR}/components/_registry.json` };
    expect((await service.saveProject(DIR, project)).result).toBe('failure');

    // Disk now holds OUR content and disagrees with the (rewound) baseline.
    const retry = await service.saveProject(DIR, project);

    expect(retry.refused).toBeUndefined();
    expect(retry.changed).toEqual(['Pages/Home']);
  });
});

/**
 * REL-009b — the read/apply split, and the one property that makes a refused
 * reload worth anything.
 *
 * The watcher has to decide whether to apply an external change BEFORE the save
 * baseline moves. If reading advanced the baseline, then a reload refused
 * because the human has unsaved edits would leave the saver believing the disk
 * holds what the editor loaded — and REL-009a's `findExternallyChanged` would
 * stop seeing the conflict, so the very next autosave would clobber the file the
 * reload had just declined to apply. The refusal would have DISARMED the guard
 * that makes refusing worthwhile.
 */
describe('ProjectStructureService — reading a component without advancing the baseline (REL-009b)', () => {
  /** Another writer changes Pages/Home on disk, the way an agent over MCP would. */
  async function writeExternally(fs: MemFs, text: string) {
    const other = new ProjectStructureService(fs);
    const { project } = await other.loadProject(DIR);
    const home = project.components.find((c) => c.name === '/Pages/Home')!;
    home.graph.roots.push(makeNode(text, 'Text'));
    const res = await other.saveProject(DIR, project);
    expect(res.result).toBe('success');
  }

  it('reports the disk hash and the baseline, and leaves the baseline where it was', async () => {
    const { fs, service } = setup();
    await service.loadProject(DIR);

    const baselineAtLoad = service.saver.getDiskHash('Pages/Home');
    await writeExternally(fs, 'from-the-agent');

    const read = await service.readComponentFromDisk(DIR, 'Pages/Home');

    expect(read.baselineHash).toBe(baselineAtLoad);
    expect(read.diskHash).not.toBe(baselineAtLoad);
    // The read is a question, not a decision.
    expect(service.saver.getDiskHash('Pages/Home')).toBe(baselineAtLoad);
  });

  it('advances the baseline only when the change is actually applied', async () => {
    const { fs, service } = setup();
    await service.loadProject(DIR);
    const baselineAtLoad = service.saver.getDiskHash('Pages/Home');

    await writeExternally(fs, 'from-the-agent');
    const read = await service.readComponentFromDisk(DIR, 'Pages/Home');
    service.markComponentBaseline('Pages/Home', read.component);

    expect(service.saver.getDiskHash('Pages/Home')).toBe(read.diskHash);
    expect(service.saver.getDiskHash('Pages/Home')).not.toBe(baselineAtLoad);
  });

  it('reloadComponent still reads and applies in one call, unchanged', async () => {
    const { fs, service } = setup();
    await service.loadProject(DIR);
    await writeExternally(fs, 'from-the-agent');

    const component = await service.reloadComponent(DIR, 'Pages/Home');

    expect(JSON.stringify(component)).toContain('from-the-agent');
    expect(service.saver.getDiskHash('Pages/Home')).toBe(
      (await service.readComponentFromDisk(DIR, 'Pages/Home')).diskHash
    );
  });

  /**
   * 🔴 The pair that matters. Same external write, same dirty in-memory
   * component; the ONLY difference is whether the reload was applied.
   */
  it('a REFUSED reload leaves REL-009a\'s guard armed — the next save still refuses', async () => {
    const { fs, service } = setup();
    const { project } = await service.loadProject(DIR);

    // The human has unsaved edits to Pages/Home.
    const home = project.components.find((c) => c.name === '/Pages/Home')!;
    home.graph.roots.push(makeNode('the-humans-edit', 'Text'));

    await writeExternally(fs, 'from-the-agent');

    // The watcher reads, decides "refuse-dirty", and applies nothing.
    await service.readComponentFromDisk(DIR, 'Pages/Home');

    const res = await service.saveProject(DIR, project);

    expect(res.refused).toEqual(['Pages/Home']);
    expect(res.changed).not.toContain('Pages/Home');
    // The agent's work is still on disk, untouched.
    expect(fs.files.get(`${DIR}/components/Pages/Home/nodes.json`)).toContain('from-the-agent');
    expect(fs.files.get(`${DIR}/components/Pages/Home/nodes.json`)).not.toContain('the-humans-edit');
  });

  it('the control: an APPLIED reload disarms it, because there is no longer a conflict', async () => {
    const { fs, service } = setup();
    const { project } = await service.loadProject(DIR);

    await writeExternally(fs, 'from-the-agent');

    const read = await service.readComponentFromDisk(DIR, 'Pages/Home');
    service.markComponentBaseline('Pages/Home', read.component);

    // Applying the reload means the in-memory project takes the disk copy too.
    const idx = project.components.findIndex((c) => c.name === '/Pages/Home');
    project.components[idx] = read.component;
    // ...and then the human edits it.
    project.components[idx].graph.roots.push(makeNode('edited-after-reload', 'Text'));

    const res = await service.saveProject(DIR, project);

    expect(res.refused).toBeUndefined();
    expect(res.changed).toEqual(['Pages/Home']);
    expect(fs.files.get(`${DIR}/components/Pages/Home/nodes.json`)).toContain('edited-after-reload');
    // And the agent's work survived, because the reload took it into memory first.
    expect(fs.files.get(`${DIR}/components/Pages/Home/nodes.json`)).toContain('from-the-agent');
  });
});
