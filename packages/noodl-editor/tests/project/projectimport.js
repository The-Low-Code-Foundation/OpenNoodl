// LIB-004 wrote this suite as the characterization contract for the import
// engine, driven through the strangler adapter that kept the old checkbox
// popups alive. LIB-005 replaced those popups and deleted the adapter, so the
// suite now drives `analyze` / `plan` / `apply` directly — the same behaviours,
// asserted one layer closer to the code that implements them.
//
// The target-project adapter under test (`createTargetProject`) is the same one
// the import flow uses, so collision detection is verified through the real
// path rather than a test double.
const { analyzeSource, apply, plan } = require('@noodl-utils/import-engine');
const { createTargetProject } = require('../../src/editor/src/views/ImportFlow/model/targetProject');
const FileSystem = require('@noodl-utils/filesystem');
const { ProjectModel } = require('@noodl-models/projectmodel');
const Utils = require('@noodl-utils/utils');
const Process = require('process');
const ncp = require('ncp').ncp;
const fs = require('fs');
const { projectFromDirectory } = require('@noodl-models/projectmodel.editor');

const remote = require('@electron/remote');
const App = remote.app;

/** Everything a source project offers, as an `ImportSelection`. */
function selectEverything(inventory) {
  return {
    components: inventory.components.map((c) => ({ name: c.name })),
    resources: inventory.resources.map((r) => ({ name: r.name })),
    modules: inventory.modules.map((m) => ({ name: m.name })),
    variants: inventory.variants.map((v) => ({ name: v.name, typename: v.typename })),
    styles: {
      colors: inventory.styles.colors.map((c) => ({ name: c.name })),
      text: inventory.styles.text.map((t) => ({ name: t.name }))
    }
  };
}

/** Plan the whole of `sourceDir` into the currently open project. */
async function planEverythingInto(sourceDir, targetProject) {
  const { inventory, project } = await analyzeSource(sourceDir);
  const target = await createTargetProject(targetProject);
  return { inventory, plan: plan(inventory, project, selectEverything(inventory), target) };
}

/** The colliding subset of a plan, counted the way the old dialog counted it. */
function collisionsOf(p) {
  const collides = (items) => items.filter((i) => i.collides);
  return {
    components: collides(p.components),
    resources: collides(p.resources),
    modules: collides(p.modules),
    variants: collides(p.variants),
    styles: { colors: collides(p.styles.colors), text: collides(p.styles.text) }
  };
}

/** Inventory components minus the id, which the legacy listing did not carry. */
function componentShapes(inventory) {
  return inventory.components.map((c) => ({
    name: c.name,
    dependencies: c.dependencies,
    fileDependencies: c.fileDependencies,
    styleDependencies: c.styleDependencies,
    variantDependencies: c.variantDependencies
  }));
}

describe('Project import and export unit tests', function () {
  function expectFilesToExist(direntry, paths, callback) {
    var filesToCheck = paths.length;
    var success = true;

    function done() {
      filesToCheck--;
      if (filesToCheck === 0) callback(success);
    }

    for (var i in paths) {
      FileSystem.instance.fileExists(direntry + '/' + paths[i], function (exists) {
        if (!exists) success = false;
        done();
      });
    }
  }

  it('can import project with styles and variants', async function () {
    const { inventory } = await analyzeSource(Process.cwd() + '/tests/testfs/import_proj5');

    expect(inventory.styles.colors).toEqual([
      { name: 'Primary' },
      { name: 'Light Gray' },
      { name: 'Dark Gray' },
      { name: 'Primary Dark' },
      { name: 'Dark' },
      { name: 'Primary Light' }
    ]);

    expect(inventory.styles.text).toEqual([
      {
        name: 'Body Text',
        fileDependencies: ['fonts/Roboto/Roboto-Regular.ttf']
      },
      {
        name: 'Button Label',
        fileDependencies: ['fonts/Roboto/Roboto-Regular.ttf']
      },
      {
        name: 'Label Text',
        fileDependencies: ['fonts/Roboto/Roboto-Regular.ttf']
      }
    ]);

    expect(inventory.variants).toEqual([
      {
        name: 'Basic',
        typename: 'net.noodl.controls.button',
        fileDependencies: ['fonts/Roboto/Roboto-Medium.ttf'],
        styleDependencies: {
          colors: ['Primary', 'Primary Light', 'Primary Dark', 'Light Gray'],
          text: ['Button Label']
        }
      },
      {
        name: 'Search Field',
        typename: 'net.noodl.controls.textinput',
        fileDependencies: ['fonts/Roboto/Roboto-Medium.ttf'],
        styleDependencies: {
          colors: ['Light Gray', 'Dark', 'Primary'],
          text: ['Body Text', 'Label Text']
        }
      }
    ]);
  });

  it('can check for collissions (with styles and variants)', function (done) {
    projectFromDirectory(Process.cwd() + '/tests/testfs/import_proj5', function (project) {
      ProjectModel.instance = project;

      // Importing a project into itself: everything collides.
      planEverythingInto(Process.cwd() + '/tests/testfs/import_proj5', project).then(({ plan: p }) => {
        const collisions = collisionsOf(p);
        expect(collisions.components.length).toBe(2);
        expect(collisions.modules.length).toBe(1);
        expect(collisions.resources.length).toBe(13);
        expect(collisions.variants.length).toBe(2);
        expect(collisions.styles.colors.length).toBe(6);
        expect(collisions.styles.text.length).toBe(3);
        done();
      });
    });
  });

  it('can list components and dependencies', async function () {
    const { inventory } = await analyzeSource(Process.cwd() + '/tests/testfs/import_proj1');

    expect(componentShapes(inventory)).toEqual([
      {
        name: '/comp1',
        dependencies: [],
        fileDependencies: ['assets/bear.jpg'],
        styleDependencies: {
          text: [],
          colors: []
        },
        variantDependencies: []
      },
      {
        name: '/comp2',
        dependencies: [],
        fileDependencies: [],
        styleDependencies: {
          text: [],
          colors: []
        },
        variantDependencies: []
      },
      {
        name: '/Main',
        dependencies: ['/comp1'],
        fileDependencies: ['Fontfabric - Nexa-Bold.otf'],
        styleDependencies: {
          text: [],
          colors: []
        },
        variantDependencies: []
      }
    ]);

    expect(inventory.styles).toEqual({
      text: [],
      colors: []
    });

    //the order of these are different on mac and windows, so sort them
    const resources = [...inventory.resources].sort((a, b) => a.name.localeCompare(b.name));

    expect(resources).toEqual([
      { name: 'assets/bear.jpg' },
      { name: 'assets/bikeyellowbuilding.jpg' },
      { name: 'bear.jpg' },
      { name: 'Fontfabric - Nexa-Bold.otf' }
    ]);

    expect(inventory.variants).toEqual([]);
    expect(inventory.modules).toEqual([]);
  });

  it('can check for collissions (1)', function (done) {
    projectFromDirectory(Process.cwd() + '/tests/testfs/import_proj1', function (project) {
      ProjectModel.instance = project;

      planEverythingInto(Process.cwd() + '/tests/testfs/import_proj2', project).then(({ plan: p }) => {
        const collisions = collisionsOf(p);
        expect(collisions.components.length).toBe(1);
        expect(collisions.components[0].name).toBe('/Main');

        expect(collisions.resources).toEqual([]);
        expect(collisions.modules).toEqual([]);
        expect(collisions.variants).toEqual([]);
        expect(collisions.styles.colors).toEqual([]);
        expect(collisions.styles.text).toEqual([]);
        done();
      });
    });
  });

  it('can check for collissions (2)', function (done) {
    projectFromDirectory(Process.cwd() + '/tests/testfs/import_proj1', function (project) {
      ProjectModel.instance = project;

      planEverythingInto(Process.cwd() + '/tests/testfs/import_proj3', project).then(({ plan: p }) => {
        const collisions = collisionsOf(p);
        expect(collisions.resources.map((r) => r.name).sort()).toEqual(
          ['Fontfabric - Nexa-Bold.otf', 'assets/bear.jpg'].sort()
        );

        expect(collisions.components).toEqual([]);
        expect(collisions.modules).toEqual([]);
        expect(collisions.variants).toEqual([]);
        expect(collisions.styles.colors).toEqual([]);
        expect(collisions.styles.text).toEqual([]);
        done();
      });
    });
  });

  it('can import project with files', function (done) {
    var tempDir = App.getPath('temp') + '/noodlunittests-' + Utils.guid() + '/';
    FileSystem.instance.makeDirectory(tempDir, function (r) {
      if (r.result !== 'success') {
        throw 'gaah';
      }

      ncp(Process.cwd() + '/tests/testfs/import_proj1', tempDir + '/import_proj1', function (err) {
        if (err) {
          throw err;
        }

        projectFromDirectory(tempDir + '/import_proj1', function (project) {
          ProjectModel.instance = project;

          planEverythingInto(Process.cwd() + '/tests/testfs/import_proj3', project)
            .then(({ plan: p }) => apply(p, ProjectModel.instance))
            .then(() => {
              expect(ProjectModel.instance.getComponentWithName('/Main2')).not.toBe(undefined);

              // Check that files have been copied properly
              expectFilesToExist(
                tempDir + '/import_proj1',
                ['assets/bear.jpg', 'Fontfabric - Nexa-Bold.otf', 'newfile.jpg'],
                function (success) {
                  expect(success).toBe(true);
                  done();
                }
              );
            });
        });
      });
    });
  });

  it('can import project with styles, variants and modules', function (done) {
    var tempDir = App.getPath('temp') + '/noodlunittests-' + Utils.guid() + '/';
    FileSystem.instance.makeDirectory(tempDir, function (r) {
      if (r.result !== 'success') {
        throw 'gaah';
      }

      ncp(Process.cwd() + '/tests/testfs/import_proj1', tempDir + '/import_proj1', function (err) {
        if (err) {
          throw err;
        }

        projectFromDirectory(tempDir + '/import_proj1', function (project) {
          ProjectModel.instance = project;

          planEverythingInto(Process.cwd() + '/tests/testfs/import_proj5', project)
            .then(({ plan: p }) => apply(p, ProjectModel.instance))
            .then(() => {
              const styles = ProjectModel.instance.getMetaData('styles');
              expect(Object.keys(styles.colors).sort()).toEqual([
                'Dark',
                'Dark Gray',
                'Light Gray',
                'Primary',
                'Primary Dark',
                'Primary Light'
              ]);
              expect(Object.keys(styles.text).sort()).toEqual(['Body Text', 'Button Label', 'Label Text']);

              expect(
                ProjectModel.instance.findVariant('Basic', {
                  localName: 'net.noodl.controls.button'
                })
              ).not.toBe(undefined);
              expect(
                ProjectModel.instance.findVariant('Search Field', {
                  localName: 'net.noodl.controls.textinput'
                })
              ).not.toBe(undefined);

              expect(fs.existsSync(tempDir + '/import_proj1/noodl_modules/material-icons')).toBe(true);

              done();
            });
        });
      });
    });
  });

  // ── Characterization: id semantics the import engine v2 must preserve ──────
  // The legacy engine (projectimporter.js:388–398) re-keyed every imported
  // component and its nodes to fresh ids, EXCEPT that an overwrite reused the
  // existing target component's id so references to it keep resolving. Nothing
  // documented or tested this; these pin it as the contract for apply().

  it('overwrite reuses the target component id (characterization)', function (done) {
    // Target: a temp COPY of proj1 (has /Main). Source: proj2 (/Main empty).
    //
    // This used to load `tests/testfs/import_proj1` in place, on the reasoning
    // that a model-only overwrite writes nothing. That reasoning holds for this
    // spec but not for the run: the gutted project stayed in the global
    // `ProjectModel.instance`, and under randomized order a later spec that
    // saves the current project wrote it back over the fixture — after which
    // every spec reading `import_proj1/project.json` from disk failed, in a way
    // that looked like a bug in the import engine. Copy first, like the sibling
    // spec below already does. (LIB-005: found the first time this Electron
    // suite was actually executed.)
    const tempDir = App.getPath('temp') + '/noodlunittests-' + Utils.guid() + '/';
    FileSystem.instance.makeDirectory(tempDir, function () {
      ncp(Process.cwd() + '/tests/testfs/import_proj1', tempDir + '/p', function (err) {
        if (err) throw err;
        projectFromDirectory(tempDir + '/p', function (project) {
          ProjectModel.instance = project;

          const targetMain = ProjectModel.instance.getComponentWithName('/Main');
          targetMain.id = 'TARGET-MAIN-ID';

          planEverythingInto(Process.cwd() + '/tests/testfs/import_proj2', project)
            .then(({ inventory, plan: p }) => {
              expect(inventory.resources).toEqual([]); // guard: proj2 is model-only
              return apply(p, ProjectModel.instance);
            })
            .then((r) => {
              expect(r.result).toBe('success');
              const after = ProjectModel.instance.getComponentWithName('/Main');
              // The overwritten component keeps the TARGET's id, not a fresh one.
              expect(after.id).toBe('TARGET-MAIN-ID');
              done();
            });
        });
      });
    });
  });

  it('re-keys imported node ids while reusing the target component id (characterization)', function (done) {
    // Target: a temp copy of proj2 (/Main empty). Source: proj1 (/Main with 4
    // nodes + resources) — imported into the temp copy so file copies are legal.
    const srcMain = require('../testfs/import_proj1/project.json').components.find((c) => c.name === '/Main');
    const srcNodeIds = [];
    (function walk(nodes) {
      (nodes || []).forEach((n) => {
        srcNodeIds.push(n.id);
        walk(n.children);
      });
    })(srcMain.graph.roots);

    const tempDir = App.getPath('temp') + '/noodlunittests-' + Utils.guid() + '/';
    FileSystem.instance.makeDirectory(tempDir, function () {
      ncp(Process.cwd() + '/tests/testfs/import_proj2', tempDir + '/p', function (err) {
        if (err) throw err;
        projectFromDirectory(tempDir + '/p', function (project) {
          ProjectModel.instance = project;
          const tMain = ProjectModel.instance.getComponentWithName('/Main');
          tMain.id = 'T-ID';

          planEverythingInto(Process.cwd() + '/tests/testfs/import_proj1', project)
            .then(({ plan: p }) => apply(p, ProjectModel.instance))
            .then((r) => {
              expect(r.result).toBe('success');
              const after = ProjectModel.instance.getComponentWithName('/Main');
              expect(after.id).toBe('T-ID'); // overwrite reused the target id

              const afterIds = [];
              // NB the braces: `forEachRecursive` treats a truthy callback
              // return as "stop", and `Array.push` returns the new length — so
              // the arrow-with-implicit-return this spec was written with
              // short-circuited after the FIRST node and made `afterIds.length`
              // permanently 1. The spec never ran (LIB-004's Electron pass was
              // blocked by the worktree trap), so nobody found out.
              after.forEachNodeRecursive((n) => {
                afterIds.push(n.id);
              });
              expect(afterIds.length).toBe(4); // proj1's /Main nodes (1 root + 3 children)
              // ...but every one was re-keyed to a fresh id.
              srcNodeIds.forEach((id) => expect(afterIds.indexOf(id)).toBe(-1));
              done();
            });
        });
      });
    });
  });

  it('ignores .git', async function () {
    const path = Process.cwd() + '/tests/testfs/import_proj4/';

    //add a .git folder with a file inside
    FileSystem.instance.makeDirectorySync(path + '.git');
    FileSystem.instance.writeFileSync(path + '.git/test', 'test');

    const { inventory } = await analyzeSource(path);
    expect(inventory.components.length).toBe(1);
    expect(inventory.resources.length).toBe(0);

    //remove the .git folder
    FileSystem.instance.removeFileSync(path + '.git/test');
    FileSystem.instance.removeDirectoryRecursiveSync(path + '.git');
  });
});
