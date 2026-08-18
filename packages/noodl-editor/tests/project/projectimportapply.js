// LIB-005: the apply path.
//
// Everything up to the point of applying was verified live; nothing past it was.
// The three things the live checklist (LIB-005-NOTES §7 QA-2.5/2.6/2.7) could
// not settle are all model-level, so they are pinned here rather than left to a
// one-off click-through:
//
//   1. The DONE stage's payload — the `ImportResult` the summary renders from.
//   2. The single-undo-step contract, INCLUDING the part of it that is not true:
//      styles merge through `mergeMetadata`, which is deliberately outside the
//      undo group (legacy parity), and files on disk are never undone. The
//      checklist says "every imported component/variant/style disappears in one
//      step"; that is right for components and variants and wrong for styles,
//      and a spec is the right place for that distinction to stop being folklore.
//   3. Whether references inside imported components still resolve after a
//      rename — i.e. that `rerouteComponentRefs` fired across the imported set.
//
// The fixtures are a deliberate collision pair (`import_collide_target` /
// `import_collide_source`): one component collides and is referenced by another
// incoming component, one colour style collides, one text style collides and
// carries a font behind it.
const { analyzeSource, apply, plan } = require('@noodl-utils/import-engine');
const { createTargetProject } = require('../../src/editor/src/views/ImportFlow/model/targetProject');
const FileSystem = require('@noodl-utils/filesystem');
const { ProjectModel } = require('@noodl-models/projectmodel');
const { UndoQueue } = require('@noodl-models/undo-queue-model');
const Utils = require('@noodl-utils/utils');
const Process = require('process');
const ncp = require('ncp').ncp;
const fs = require('fs');
const { projectFromDirectory } = require('@noodl-models/projectmodel.editor');

const remote = require('@electron/remote');
const App = remote.app;

const SOURCE = Process.cwd() + '/tests/testfs/import_collide_source';
const TARGET = Process.cwd() + '/tests/testfs/import_collide_target';

/**
 * Open a temp COPY of the target fixture as the current project. Always a copy:
 * apply writes files, and a spec that leaves a fixture-backed project in the
 * global `ProjectModel.instance` is how the suite contaminated itself before
 * (see the note on 'overwrite reuses the target component id').
 */
function withTargetCopy(callback) {
  const tempDir = App.getPath('temp') + '/noodlunittests-' + Utils.guid() + '/';
  FileSystem.instance.makeDirectory(tempDir, function () {
    ncp(TARGET, tempDir + '/p', function (err) {
      if (err) throw err;
      projectFromDirectory(tempDir + '/p', function (project) {
        ProjectModel.instance = project;
        callback(project, tempDir + '/p');
      });
    });
  });
}

/**
 * Select `/Cards/ProfileCard` plus the two colliding styles, and let the closure
 * pull the rest — the same selection the live QA drove. `resolutions` maps a
 * component name to an {@link ItemPolicy}.
 */
async function planProfileCard(targetProject, resolutions) {
  // CN-017: origin is a required plan field; this fixture is a directory on disk.
  const { inventory, project } = await analyzeSource(SOURCE);
  const target = await createTargetProject(targetProject);
  const selection = {
    components: [{ name: '/Cards/ProfileCard' }],
    resources: [],
    modules: [],
    variants: [],
    styles: { colors: [{ name: 'Brand' }], text: [{ name: 'Heading' }] }
  };
  return plan(inventory, project, selection, target, { origin: { kind: 'local-project' }, ...resolutions });
}

/**
 * Every node typename reachable from a component. NB the braces:
 * `forEachRecursive` treats a truthy callback return as "stop" and
 * `Array.push` returns the new length, so an implicit-return arrow here would
 * short-circuit after the first node (LIB-005-NOTES §4b).
 */
function nodeTypesOf(component) {
  const types = [];
  component.forEachNodeRecursive((n) => {
    types.push(n.typename);
  });
  return types;
}

/** The root node of a component's graph. */
function rootOf(component) {
  return component.graph.getRoots()[0];
}

describe('LIB-005 import apply path', function () {
  beforeEach(function () {
    UndoQueue.instance.clear();
  });

  it('reports what landed, for the DONE stage to summarise', function (done) {
    withTargetCopy(function (project) {
      planProfileCard(project)
        .then((p) => apply(p, ProjectModel.instance))
        .then((r) => {
          expect(r.result).toBe('success');

          // The closure pulled Badge and Button along with ProfileCard.
          expect(r.componentsImported.sort()).toEqual(['/Cards/ProfileCard', '/Shared/Badge', '/Shared/Button']);

          // Accent arrives via the closure (both incoming components use it);
          // Brand was picked explicitly and collides.
          expect(r.stylesImported.colors.sort()).toEqual(['Accent', 'Brand']);
          expect(r.stylesImported.text).toEqual(['Heading']);

          // The image is a port-type dependency of ProfileCard; the font is a
          // dependency of the Heading text style — the style→file edge LIB-005
          // added. Both must be copied, or the import arrives unrendered.
          expect(r.filesCopied.sort()).toEqual(['assets/qa-image.png', 'fonts/QASource.ttf']);

          expect(r.warnings).toEqual([]);
          done();
        });
    });
  });

  it('applies the whole import as ONE undo group', function (done) {
    withTargetCopy(function (project) {
      planProfileCard(project)
        .then((p) => apply(p, ProjectModel.instance))
        .then(() => {
          // Exactly one entry on the queue, however many components moved.
          expect(UndoQueue.instance.getHistory().length).toBe(1);
          expect(UndoQueue.instance.getHistoryLocation()).toBe(1);
          done();
        });
    });
  });

  it('one undo removes every imported component in a single step', function (done) {
    withTargetCopy(function (project) {
      planProfileCard(project)
        .then((p) => apply(p, ProjectModel.instance))
        .then(() => {
          const m = ProjectModel.instance;
          expect(m.getComponentWithName('/Cards/ProfileCard')).toBeTruthy();
          expect(m.getComponentWithName('/Shared/Badge')).toBeTruthy();

          UndoQueue.instance.undo();

          expect(m.getComponentWithName('/Cards/ProfileCard')).toBeFalsy();
          expect(m.getComponentWithName('/Shared/Badge')).toBeFalsy();
          // The overwritten one comes back rather than vanishing — the target
          // had its own /Shared/Button before the import.
          expect(m.getComponentWithName('/Shared/Button')).toBeTruthy();
          // ...and it is the target's version again, not the source's.
          expect(rootOf(m.getComponentWithName('/Shared/Button')).parameters.backgroundColor).toBe('Brand');

          // Still one step: the pointer is back at the start of the queue.
          expect(UndoQueue.instance.getHistoryLocation()).toBe(0);
          done();
        });
    });
  });

  it('does NOT undo style merges or file copies (documented, not a bug)', function (done) {
    withTargetCopy(function (project, dir) {
      planProfileCard(project)
        .then((p) => apply(p, ProjectModel.instance))
        .then(() => {
          UndoQueue.instance.undo();

          // Styles merge through `mergeMetadata`, which deliberately does not
          // enroll in the undo group (legacy parity, apply.ts `mergeStyles`).
          // So the source's Brand survives the undo, overwriting the target's.
          const styles = ProjectModel.instance.getMetaData('styles');
          expect(styles.colors.Brand).toBe('#FF00AA');
          expect(styles.colors.Accent).toBe('#00AAFF');
          expect(styles.text.Heading.fontFamily).toBe('fonts/QASource.ttf');

          // And the files stay on disk — the DONE stage says so in as many words
          // ("Files on disk remain").
          expect(fs.existsSync(dir + '/assets/qa-image.png')).toBe(true);
          expect(fs.existsSync(dir + '/fonts/QASource.ttf')).toBe(true);
          done();
        });
    });
  });

  it('re-points references inside imported components when one is renamed', function (done) {
    withTargetCopy(function (project) {
      // Rename the colliding component instead of overwriting it. ProfileCard
      // instantiates /Shared/Button, so its node type must follow the rename or
      // the import lands with a dangling reference — Success Criterion 3.
      planProfileCard(project, { renames: { '/Shared/Button': '/Shared/ButtonV2' } })
        .then((p) => {
          const renamed = p.components.find((c) => c.name === '/Shared/Button');
          expect(renamed.policy.action).toBe('rename');
          // Renamed onto a free name, so the plan must not report a collision.
          expect(renamed.collides).toBeFalsy();
          return apply(p, ProjectModel.instance);
        })
        .then((r) => {
          expect(r.result).toBe('success');
          const m = ProjectModel.instance;

          // Both survive: the target's original Button was NOT overwritten.
          expect(m.getComponentWithName('/Shared/ButtonV2')).toBeTruthy();
          expect(m.getComponentWithName('/Shared/Button')).toBeTruthy();
          expect(rootOf(m.getComponentWithName('/Shared/Button')).parameters.backgroundColor).toBe('Brand');

          // The reference inside the imported component followed the rename.
          const types = nodeTypesOf(m.getComponentWithName('/Cards/ProfileCard'));
          expect(types).toContain('/Shared/ButtonV2');
          expect(types).not.toContain('/Shared/Button');
          done();
        });
    });
  });

  it('honours "keep mine" — a skipped collision leaves the target untouched', function (done) {
    withTargetCopy(function (project) {
      planProfileCard(project, { skip: { components: ['/Shared/Button'], colors: ['Brand'] } })
        .then((p) => apply(p, ProjectModel.instance))
        .then((r) => {
          expect(r.componentsImported).not.toContain('/Shared/Button');
          expect(r.stylesImported.colors).not.toContain('Brand');

          const m = ProjectModel.instance;
          // The target's own Button and Brand are exactly as they were.
          expect(rootOf(m.getComponentWithName('/Shared/Button')).parameters.backgroundColor).toBe('Brand');
          expect(m.getMetaData('styles').colors.Brand).toBe('#111111');

          // ...but the reference from the imported ProfileCard still resolves,
          // because "keep mine" means the name exists by definition.
          expect(nodeTypesOf(m.getComponentWithName('/Cards/ProfileCard'))).toContain('/Shared/Button');
          done();
        });
    });
  });
});
