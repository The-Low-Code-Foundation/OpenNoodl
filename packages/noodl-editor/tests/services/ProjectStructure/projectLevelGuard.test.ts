/**
 * FLD-009 — the editor does not overwrite what an agent wrote, project-level.
 *
 * REL-009a gave component files a re-read before every write and a refusal the
 * user is told about. The project-level files had none of it, while the MCP
 * server writes `nodegx.project.json` through three methods
 * (`writeDesignTokens`, `writeProjectSettings`, `writeCloudServices`). These
 * specs grade the guard that closes that, its reverted arm, and — the one that
 * makes the rest mean anything — the presence controls that say the guard is not
 * simply refusing everything.
 *
 * 🔴 **The first spec records a measurement that contradicts the task file.**
 * FLD-009 AC1 asked for the sequence "agent binds a backend, person touches a
 * component, autosave fires". Measured against HEAD on 2026-09-10, that sequence
 * does NOT lose the binding, because the project-level content built from memory
 * is unchanged and the save skips the file. It would have graded GREEN BEFORE
 * THE WORK. The loss needs an editor change to a project-level file, and the
 * spec below pins both halves so the distinction cannot be lost again.
 */
import { ProjectStructureService, applyProjectLevelSlice } from '../../../src/editor/src/services/ProjectStructure';
import { MemFs } from './memfs';
import { makeProject, makeNode, seedV2Project } from './fixtures';

const DIR = '/proj';
const PROJECT_FILE = '/proj/nodegx.project.json';
const STYLES_FILE = '/proj/nodegx.styles.json';

const BINDING = { instanceId: 'i1', endpoint: 'https://backend.example', appId: 'a1', type: 'noodl' };

function setup(projectOverrides = {}) {
  const fs = new MemFs();
  seedV2Project(fs, DIR, makeProject(projectOverrides));
  return { fs, service: new ProjectStructureService(fs) };
}

/** Exactly what `ProjectStore.writeCloudServices` does: read, merge, write. */
function agentBindsBackend(fs: MemFs): void {
  const raw = JSON.parse(fs.files.get(PROJECT_FILE)!);
  raw.metadata = { ...(raw.metadata ?? {}), cloudservices: { ...BINDING } };
  raw.modified = new Date().toISOString();
  fs.files.set(PROJECT_FILE, JSON.stringify(raw, null, 2));
}

function bindingOnDisk(fs: MemFs) {
  return JSON.parse(fs.files.get(PROJECT_FILE)!)?.metadata?.cloudservices;
}

describe('FLD-009 — what actually triggers the loss', () => {
  it('a component-only edit writes no project-level file at all, so the binding was never at risk there', async () => {
    const { fs, service } = setup();
    const { project } = await service.loadProject(DIR);
    agentBindsBackend(fs);
    const projectFileAfterAgent = fs.files.get(PROJECT_FILE);

    const home = project.components.find((c) => c.name === '/Pages/Home')!;
    home.graph.roots.push(makeNode('added', 'Text'));
    const res = await service.saveProject(DIR, project);

    expect(res.result).toBe('success');
    expect(res.changed).toEqual(['Pages/Home']);
    // Untouched — byte for byte, timestamp included.
    expect(fs.files.get(PROJECT_FILE)).toBe(projectFileAfterAgent);
    expect(bindingOnDisk(fs)).toEqual(BINDING);
    // And the known-firing signal beside the absence: the save DID run and DID
    // write. Without this the spec passes just as well on a save that no-oped.
    expect(res.refusedProjectFiles).toBeUndefined();
  });
});

describe('FLD-009 — the guard on saveProjectLevelFiles', () => {
  it('refuses to write a project file whose disk copy has moved, and reports the refusal', async () => {
    const { fs, service } = setup();
    const { project } = await service.loadProject(DIR);
    agentBindsBackend(fs);

    // The editor's own project-level change: the app root moves.
    (project as TSFixme).rootNodeId = 'home1';
    const res = await service.saveProject(DIR, project);

    expect(res.result).toBe('success');
    expect(res.refusedProjectFiles).toEqual(['nodegx.project.json']);
    expect(bindingOnDisk(fs)).toEqual(BINDING);
    // The person's change is still only in memory — which is exactly why the
    // refusal has to be reported rather than swallowed.
    expect(JSON.parse(fs.files.get(PROJECT_FILE)!).rootNodeId).toBeUndefined();
  });

  it('REVERTED ARM — without the guard, the same save lands over the agent write', async () => {
    const { fs, service } = setup();
    const { project } = await service.loadProject(DIR);
    agentBindsBackend(fs);

    // The one line FLD-009 adds, taken back out.
    (service as TSFixme).projectLevelFileMovedOnDisk = async () => false;

    (project as TSFixme).rootNodeId = 'home1';
    const res = await service.saveProject(DIR, project);

    expect(res.result).toBe('success');
    expect(res.refusedProjectFiles).toBeUndefined();
    expect(bindingOnDisk(fs)).toBeUndefined(); // silently gone — the defect
    expect(JSON.parse(fs.files.get(PROJECT_FILE)!).rootNodeId).toBe('home1');
  });

  it('covers the styles file, not just the project file', async () => {
    const { fs, service } = setup({
      metadata: { styles: { colors: { primary: { value: '#111111' } } } }
    });
    const { project } = await service.loadProject(DIR);

    const raw = JSON.parse(fs.files.get(STYLES_FILE)!);
    raw.colors = { ...raw.colors, agentAdded: { value: '#00ff00' } };
    fs.files.set(STYLES_FILE, JSON.stringify(raw, null, 2));

    (project.metadata as TSFixme).styles.colors.primary = { value: '#222222' };
    const res = await service.saveProject(DIR, project);

    expect(res.refusedProjectFiles).toEqual(['nodegx.styles.json']);
    expect(JSON.parse(fs.files.get(STYLES_FILE)!).colors.agentAdded).toEqual({ value: '#00ff00' });
  });

  it('refuses rather than writes when the file cannot be read — an atomic write may be landing', async () => {
    const { fs, service } = setup();
    const { project } = await service.loadProject(DIR);
    fs.files.set(PROJECT_FILE, '{ "half written');

    (project as TSFixme).rootNodeId = 'home1';
    const res = await service.saveProject(DIR, project);

    expect(res.refusedProjectFiles).toEqual(['nodegx.project.json']);
    expect(fs.files.get(PROJECT_FILE)).toBe('{ "half written');
  });
});

describe('FLD-009 — presence controls', () => {
  // 🔴 A guard that refuses everything looks identical to a guard that works.
  it('an editor-originated project-level change still saves normally', async () => {
    const { fs, service } = setup();
    const { project } = await service.loadProject(DIR);

    (project as TSFixme).rootNodeId = 'home1';
    const res = await service.saveProject(DIR, project);

    expect(res.result).toBe('success');
    expect(res.refusedProjectFiles).toBeUndefined();
    expect(JSON.parse(fs.files.get(PROJECT_FILE)!).rootNodeId).toBe('home1');
  });

  it('and a second one, back to back, on a project whose files were only ever written by us', async () => {
    const { fs, service } = setup();
    const { project } = await service.loadProject(DIR);

    (project as TSFixme).rootNodeId = 'home1';
    await service.saveProject(DIR, project);
    (project as TSFixme).rootNodeId = 'hdr1';
    const res = await service.saveProject(DIR, project);

    expect(res.refusedProjectFiles).toBeUndefined();
    expect(JSON.parse(fs.files.get(PROJECT_FILE)!).rootNodeId).toBe('hdr1');
  });

  // 🔴 The refusal must be a pause, not a wall. If nothing can ever adopt the
  // agent's write, the person's project-level change is refused forever and the
  // guard has replaced silent data loss with silent paralysis.
  it('once the external write has been adopted, the editor change saves and the binding survives', async () => {
    const { fs, service } = setup();
    const { project } = await service.loadProject(DIR);

    // The real sequence, in the order it happens: the agent writes, the watcher
    // fires, the editor adopts — and only then does the person change something.
    agentBindsBackend(fs);

    const { slice, raw, decisions } = await service.readProjectLevelFromDisk(DIR, project);
    expect(decisions.project.action).toBe('reload'); // nothing unsaved here, so adopt
    applyProjectLevelSlice(project as TSFixme, slice, 'project');
    service.markProjectLevelBaseline('project', raw.project ?? null, project);

    (project as TSFixme).rootNodeId = 'home1';
    const res = await service.saveProject(DIR, project);

    expect(res.refusedProjectFiles).toBeUndefined();
    const onDisk = JSON.parse(fs.files.get(PROJECT_FILE)!);
    expect(onDisk.rootNodeId).toBe('home1');
    expect(onDisk.metadata.cloudservices).toEqual(BINDING);
  });

  // 🔴 And the other order, which is a genuine conflict rather than a wall: the
  // person already had an unsaved project-level change when the agent wrote. The
  // editor keeps theirs, refuses, and says so — the component path's answer.
  it('refuses the reload, without advancing the baseline, when the editor has unsaved project changes', async () => {
    const { fs, service } = setup();
    const { project } = await service.loadProject(DIR);

    (project as TSFixme).rootNodeId = 'home1';
    agentBindsBackend(fs);

    const first = await service.readProjectLevelFromDisk(DIR, project);
    expect(first.decisions.project.action).toBe('refuse-dirty');

    // Baseline untouched, so the save still sees the file as moved and declines.
    expect((await service.saveProject(DIR, project)).refusedProjectFiles).toEqual(['nodegx.project.json']);
    expect(bindingOnDisk(fs)).toEqual(BINDING);
  });

  it('reports the file as reloadable, not dirty, when the editor has no project-level change of its own', async () => {
    const { fs, service } = setup();
    const { project } = await service.loadProject(DIR);
    agentBindsBackend(fs);

    const { decisions } = await service.readProjectLevelFromDisk(DIR, project);
    expect(decisions.project.action).toBe('reload');
    expect(decisions.styles.action).toBe('skip-unchanged');
  });

  it('says nothing happened when the disk still holds our own write', async () => {
    const { service } = setup();
    const { project } = await service.loadProject(DIR);

    (project as TSFixme).rootNodeId = 'home1';
    await service.saveProject(DIR, project);

    const { decisions } = await service.readProjectLevelFromDisk(DIR, project);
    expect(decisions.project.action).toBe('skip-unchanged');
  });
});

describe('FLD-009 — the component path is unchanged', () => {
  it('still refuses a component whose file moved, and still reports it under `refused`', async () => {
    const { fs, service } = setup();
    const { project } = await service.loadProject(DIR);

    // The agent's write: an existing node in the component gains a parameter.
    const nodesPath = '/proj/components/Pages/Home/nodes.json';
    const nodes = JSON.parse(fs.files.get(nodesPath)!);
    nodes.nodes[0].parameters = { ...(nodes.nodes[0].parameters ?? {}), text: 'written by the agent' };
    fs.files.set(nodesPath, JSON.stringify(nodes, null, 2));

    const home = project.components.find((c) => c.name === '/Pages/Home')!;
    home.graph.roots.push(makeNode('mine', 'Text'));
    const res = await service.saveProject(DIR, project);

    expect(res.refused).toEqual(['Pages/Home']);
    expect(res.refusedProjectFiles).toBeUndefined();
    expect(JSON.parse(fs.files.get(nodesPath)!).nodes[0].parameters.text).toBe('written by the agent');
  });

  it('and still writes a component nothing else has touched', async () => {
    const { fs, service } = setup();
    const { project } = await service.loadProject(DIR);

    const home = project.components.find((c) => c.name === '/Pages/Home')!;
    home.graph.roots.push(makeNode('mine', 'Text'));
    const res = await service.saveProject(DIR, project);

    expect(res.refused).toBeUndefined();
    expect(res.changed).toEqual(['Pages/Home']);
    const written = JSON.parse(fs.files.get('/proj/components/Pages/Home/nodes.json')!);
    expect(written.nodes.some((n: TSFixme) => n.id === 'mine')).toBe(true);
  });
});
