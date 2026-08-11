/**
 * DSG-007/F30 — a project's `id` must survive load → `toJSON()` → v2 save.
 *
 * `ProjectModel` declared `public id?: string` and then dropped it at both ends:
 * the constructor read `name`/`settings`/`version`/`runtimeVersion`/`metadata`
 * and never `args.id`, and `toJSON()` did not emit it. Since the v2 save path is
 * `toDirectory` → `saveProject(dir, this.toJSON())` → `buildProjectV2File`, that
 * made `ProjectExporter`'s `if (project.id !== undefined) file.id = project.id`
 * dead code on **every** save — so each save DELETED the field from
 * `nodegx.project.json`.
 *
 * The consequence was not cosmetic. `BackendServices/provisionBackend.ts` reads
 * `project.id` as the ownership half of `findReusableBackend`, so after any
 * reload a project could not prove it owned its backend: it silently got a
 * second one, stamped `projectIds: []` and reusable by nobody, forever. Four
 * such directories accumulated under `~/.noodl/backends` before anyone noticed.
 *
 * ⚠️ The second block is as important as the first. The fix must **not** start
 * minting ids on load — that would write a fresh identity into every legacy
 * project the editor opens, and two copies of one project would then diverge
 * silently, which is the opposite of what an ownership key is for. Minting stays
 * at creation (`LocalProjectsModel._addProject`).
 */

import { buildProjectV2File, LegacyProject } from '../../src/editor/src/io/ProjectExporter';
import { ProjectModel } from '../../src/editor/src/models/projectmodel';

describe('ProjectModel identity — the id a backend is bound to', () => {
  const NOW = '2026-08-11T00:00:00.000Z';
  const ID = '1de70885-d841-4d29-9966-59d2a0e15df8';

  it('reads `id` off the project file it was constructed from', () => {
    expect(new ProjectModel({ name: 'Stock Cupboard', id: ID }).id).toBe(ID);
  });

  it('emits `id` from toJSON, which is what the v2 save is given', () => {
    const project = new ProjectModel({ name: 'Stock Cupboard', id: ID });
    expect((project.toJSON() as unknown as LegacyProject).id).toBe(ID);
  });

  it('⭐ survives the whole round trip: file → model → toJSON → nodegx.project.json', () => {
    // Exactly the chain `toDirectory` runs, with nothing stubbed in the middle.
    const onDisk = { name: 'Stock Cupboard', id: ID, version: '4' };
    const project = ProjectModel.fromJSON(onDisk);
    const written = buildProjectV2File(project.toJSON() as unknown as LegacyProject, NOW);

    expect(written.id).toBe(ID);
    // The point of the whole exercise: reload what was written and it is still
    // the same project. Before the fix this was `undefined` at the second step.
    expect(ProjectModel.fromJSON(written).id).toBe(ID);
  });

  it('survives a second save, which is the one that used to delete it', () => {
    // F30's actual signature on disk: the file kept its id until the editor
    // saved once, and every save after that wrote it away again.
    let project = ProjectModel.fromJSON({ name: 'Stock Cupboard', id: ID, version: '4' });
    for (let i = 0; i < 3; i++) {
      project = ProjectModel.fromJSON(buildProjectV2File(project.toJSON() as unknown as LegacyProject, NOW));
    }
    expect(project.id).toBe(ID);
  });
});

describe('ProjectModel identity — a project with no id does not acquire one', () => {
  const NOW = '2026-08-11T00:00:00.000Z';

  it('is undefined when the project file carries no id', () => {
    expect(new ProjectModel({ name: 'Tutorial project' }).id).toBeUndefined();
    expect(new ProjectModel().id).toBeUndefined();
  });

  it('⭐ toJSON omits the KEY rather than writing a null', () => {
    const json = new ProjectModel({ name: 'Tutorial project' }).toJSON();
    // `undefined` must serialise to an absent key: a legacy project that has
    // never had an identity has to round-trip to a byte-identical file, or
    // opening it in the editor becomes a diff in everyone's version control.
    expect(JSON.parse(JSON.stringify(json)).hasOwnProperty('id')).toBe(false);
  });

  it('⭐ the v2 file gets no `id`, so opening a legacy project mints nothing', () => {
    const project = ProjectModel.fromJSON({ name: 'Tutorial project', version: '4' });
    const written = buildProjectV2File(project.toJSON() as unknown as LegacyProject, NOW);
    expect(written.id).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(written, 'id')).toBe(false);
  });

  it('an id assigned after construction still reaches the file', () => {
    // This is `LocalProjectsModel._addProject`'s only route to disk: it mints
    // onto the live model and relies on the next save to persist it. That is
    // precisely what did not work.
    const project = new ProjectModel({ name: 'New app' });
    project.id = 'minted-at-creation';
    expect(buildProjectV2File(project.toJSON() as unknown as LegacyProject, NOW).id).toBe('minted-at-creation');
  });
});
