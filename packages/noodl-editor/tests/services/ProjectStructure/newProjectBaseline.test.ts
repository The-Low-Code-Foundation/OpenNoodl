/**
 * A NEW PROJECT'S FIRST SAVE IS REFUSED, AND THE WORK IS LOST.
 *
 * Richard, 2026-09-06, on a fresh 0.2.2 build: *"as soon as I open it it throws
 * this message, and throws it again every node I add … when I exit and reenter
 * the project, all my changes are gone, but this time I can add nodes and they
 * save correctly."* The message is REL-009a arm C's:
 *
 *   Not saved: App, Pages/Home changed on disk outside the editor.
 *
 * Nothing had touched those files. The refusal is manufactured by the editor
 * itself, and here is the chain:
 *
 * 🔴 **`projectStructureService` IS A MODULE SINGLETON AND ITS BASELINE MAP
 * OUTLIVES THE PROJECT IT DESCRIBES.** `ComponentSaver.diskHashes` is cleared in
 * exactly two places — `seedFromProject` (via `loadProject`) and
 * `restoreSnapshot`. Closing a project clears nothing.
 *
 * 🔴 **AND A NEWLY CREATED PROJECT NEVER CALLS `loadProject`.**
 * `LocalProjectsModel.newProject` builds the project from a *legacy* template,
 * saves it legacy, then converts it in place with `ProjectMigrator.migrate()`,
 * which writes the v2 component files straight to disk and tells the saver
 * nothing. So the first v2 save of project B is diffed against the baselines of
 * project A — and `App` / `Pages/Home` are paths that exist in *every*
 * project, so they collide by name and differ by content.
 *
 * `findExternallyChanged` then does exactly what it was built to do: the
 * baseline is present, the disk does not match it, and the disk is not what this
 * save would write either (the user just added a node), so it concludes another
 * writer owns the file and refuses. Every save. Nothing is ever persisted, and
 * reopening — which finally runs `loadProject` — both fixes the baseline and
 * reveals that the work was never written.
 *
 * ⚠️ **WHY NO EXISTING TEST SEES THIS.** Every spec in this directory builds a
 * fresh `new ProjectStructureService(fs)`, which is the one thing production
 * never does. The contamination needs a service that has already loaded a
 * different project — so that is what this file builds.
 */
import { ProjectStructureService } from '../../../src/editor/src/services/ProjectStructure';
import { makeComponent, makeNode, makeProject, seedV2Project } from './fixtures';
import { MemFs } from './memfs';

const DIR_A = '/projA';
const DIR_B = '/projB';

/**
 * A project whose component NAMES are the ones every project has, with content
 * particular to it. Two of these differ exactly as two real projects do.
 */
function projectWithSharedNames(id: string, textNodeId: string) {
  return makeProject({
    name: id,
    id,
    components: [
      makeComponent('/%rootcomponent', {
        graph: { roots: [makeNode('root_' + id, 'Group')], connections: [] }
      }),
      makeComponent('/Pages/Home', {
        graph: { roots: [makeNode(textNodeId, 'Text')], connections: [] }
      })
    ]
  });
}

describe('a newly created project saves, even when another project was open first', () => {
  it('does not refuse the first save of a project the saver has never loaded', async () => {
    const fs = new MemFs();
    const service = new ProjectStructureService(fs);

    // 1. The user opens a project. This seeds baselines for '/%rootcomponent'
    //    and '/Pages/Home' — the names every project uses.
    seedV2Project(fs, DIR_A, projectWithSharedNames('projA', 'a_text'));
    await service.loadProject(DIR_A);

    // 2. They create a new project. It is born legacy and converted in place by
    //    ProjectMigrator, which writes the v2 files without going through the
    //    saver — modelled here by seeding the files directly, as the migrator
    //    does. Crucially: NO loadProject.
    const projectB = projectWithSharedNames('projB', 'b_text');
    seedV2Project(fs, DIR_B, projectB);

    // 3. They add a node, so memory and disk genuinely differ — the ordinary
    //    state of an edited project, and the state in which a stale baseline
    //    turns into a refusal.
    const home = projectB.components.find((c) => c.name === '/Pages/Home')!;
    home.graph.roots.push(makeNode('b_added', 'Group'));

    const res = await service.saveProject(DIR_B, projectB);

    expect(res.result).toBe('success');
    // The whole defect in one assertion: nothing external touched projB.
    expect(res.refused ?? []).toEqual([]);

    // And the consequence the user actually feels — the edit reached the disk.
    const nodesPath = fs.join(DIR_B, 'components/Pages/Home/nodes.json');
    const onDisk = JSON.stringify(await fs.readJson(nodesPath));
    expect(onDisk).toContain('b_added');
  });

  it('still refuses a genuine external write after the fix', async () => {
    // The control. Whatever clears the stale baseline must NOT disarm REL-009a:
    // a real external writer must still be caught, or the fix trades a false
    // refusal for silent data loss — which is the defect REL-009a exists for.
    const fs = new MemFs();
    const service = new ProjectStructureService(fs);

    const project = projectWithSharedNames('projA', 'a_text');
    seedV2Project(fs, DIR_A, project);
    const { project: loaded } = await service.loadProject(DIR_A);

    // Something else rewrites Home on disk while we hold it open.
    const external = projectWithSharedNames('projA', 'a_text');
    const externalHome = external.components.find((c) => c.name === '/Pages/Home')!;
    externalHome.graph.roots.push(makeNode('someone_elses_node', 'Group'));
    seedV2Project(fs, DIR_A, external);

    // Meanwhile the user edits the same component here.
    const home = loaded.components.find((c) => c.name === '/Pages/Home')!;
    home.graph.roots.push(makeNode('my_node', 'Group'));

    const res = await service.saveProject(DIR_A, loaded);

    expect(res.result).toBe('success');
    expect(res.refused ?? []).toContain('Pages/Home');
  });
});
