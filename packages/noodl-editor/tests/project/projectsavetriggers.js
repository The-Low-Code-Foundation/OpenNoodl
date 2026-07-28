// Only a change to the project may write the project.
//
// `project.json` used to be rewritten in response to any `Model.*` event raised
// anywhere in the app, minus a 22-name denylist. There are 116 distinct `Model.*`
// events in the editor, so ~94 of them armed a save. Measured on a cold start with
// zero user input: two complete project writes in twenty seconds — the launcher's
// lesson-template list loading, and a preview client connecting.
//
// The listener now takes an allowlist plus an ownership check, and this suite is
// the pair of claims that has to hold for that to be right:
//
//   1. an event that is not a project edit must not write the project, and
//   2. an event that IS a project edit still must.
//
// (2) is the one that matters most. An allowlist can only fail by omission, and
// the failure mode of omission is a silently dropped edit — the exact bug the
// quit-flush work fixed in `projectsaveflush.js`.
//
// How the observation works, in both directions: write a sentinel that exists ONLY
// on disk, then raise the event. The model has never heard of the sentinel, so any
// save at all serialises it away. Sentinel survives => nothing was written.
// Sentinel gone => the project was written. No spying on internals, and no
// assertion about *when*.
const FileSystem = require('@noodl-utils/filesystem');
const { ProjectModel, flushPendingProjectSave } = require('@noodl-models/projectmodel');
const { projectFromDirectory } = require('@noodl-models/projectmodel.editor');
const { ComponentModel } = require('@noodl-models/componentmodel');
const { NodeGraphModel } = require('@noodl-models/nodegraphmodel');
const Model = require('../../src/shared/model');
const Utils = require('@noodl-utils/utils');
const Process = require('process');
const ncp = require('ncp').ncp;
const fs = require('fs');
const path = require('path');

const remote = require('@electron/remote');
const App = remote.app;

const FIXTURE = Process.cwd() + '/tests/testfs/import_collide_target';

/** The autosave debounce is 1000ms; wait past it before concluding anything. */
const PAST_DEBOUNCE_MS = 1800;
/** Opening a project raises events of its own. Let them settle before measuring. */
const SETTLE_MS = 1500;

describe('only a project edit writes the project', function () {
  let previousInstance;
  let projectDir;
  let project;

  beforeEach(function (done) {
    previousInstance = ProjectModel.instance;

    const tempDir = App.getPath('temp') + '/noodlunittests-' + Utils.guid() + '/';
    FileSystem.instance.makeDirectory(tempDir, function () {
      ncp(FIXTURE, tempDir + '/p', function (err) {
        if (err) throw err;
        projectFromDirectory(tempDir + '/p', function (p) {
          ProjectModel.instance = p;
          project = p;
          projectDir = tempDir + '/p';

          // Let the open settle, then drain anything it armed, so the state under
          // test is genuinely quiescent rather than "not yet noticed".
          setTimeout(function () {
            flushPendingProjectSave().then(function () {
              done();
            }, done.fail);
          }, SETTLE_MS);
        });
      });
    });
  });

  afterEach(function (done) {
    ProjectModel.setSaveOnModelChange(true);
    flushPendingProjectSave().then(function () {
      ProjectModel.instance = previousInstance;
      done();
    }, done.fail);
  });

  /** Plant a value that exists only in the file, and return a reader for it. */
  function plantDiskOnlySentinel() {
    const file = path.join(projectDir, 'project.json');
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    json.metadata = json.metadata || {};
    json.metadata.diskOnlySentinel = true;
    fs.writeFileSync(file, JSON.stringify(json, null, 2));

    return function sentinelSurvives() {
      const current = JSON.parse(fs.readFileSync(file, 'utf8'));
      return (current.metadata || {}).diskOnlySentinel === true;
    };
  }

  function afterDebounce(assert, done) {
    setTimeout(function () {
      try {
        assert();
        done();
      } catch (e) {
        done.fail(e);
      }
    }, PAST_DEBOUNCE_MS);
  }

  it('a preview client connecting does not rewrite the project', function (done) {
    const sentinelSurvives = plantDiskOnlySentinel();

    // What `ViewerConnection` raises when a preview attaches. It is a singleton
    // with no relationship to the project, and this was save #1 of the two
    // measured on a cold start.
    new Model().notifyListeners('viewerClientsChanged');

    afterDebounce(function () {
      expect(sentinelSurvives()).toBe(true);
    }, done);
  });

  it('the launcher template list loading does not rewrite the project', function (done) {
    const sentinelSurvives = plantDiskOnlySentinel();

    // `lessontemplatesmodel` raises this, and it fires before a project is even
    // in place.
    new Model().notifyListeners('templatesChanged');

    afterDebounce(function () {
      expect(sentinelSurvives()).toBe(true);
    }, done);
  });

  it('a graph that is not part of the project does not rewrite the project', function (done) {
    const sentinelSurvives = plantDiskOnlySentinel();

    // The shape `WorkflowComponentModel` has: a ComponentModel holding a real
    // NodeGraphModel, but never added to a project, so `owner` is undefined.
    // Constructing it runs `bindGraph` and raises `graphModelBound` — and the
    // graph raises `nodeAdded` per node. All of those names ARE project edits
    // when a project component raises them, which is why the event name alone
    // cannot decide this and ownership has to.
    const foreign = new ComponentModel({
      name: 'workflow:not-in-the-project',
      id: 'workflow:test:not-in-the-project',
      graph: NodeGraphModel.fromJSON({
        roots: [{ id: 'foreign-step', type: 'Group', x: 10, y: 20, parameters: {}, children: [] }],
        connections: []
      })
    });
    expect(foreign.owner).toBe(undefined);

    // And the same again after construction, on a graph the project does not own.
    foreign.graph.notifyListeners('connectionAdded', { model: { fromId: 'a', toId: 'b' } });

    afterDebounce(function () {
      expect(sentinelSurvives()).toBe(true);
    }, done);
  });

  it('moving a node in the project DOES rewrite the project', function (done) {
    const sentinelSurvives = plantDiskOnlySentinel();

    // How a drag persists: `commitMoveNode` does `node.model.set({x, y})`, and
    // `Model.prototype.set` raises `change`. The most common edit there is, and
    // the one an allowlist is most likely to drop.
    const component = project.getComponentWithName('/Home');
    const node = component.graph.roots[0];
    node.set({ x: node.x + 64, y: node.y + 32 });

    afterDebounce(function () {
      expect(sentinelSurvives()).toBe(false);
    }, done);
  });

  it('changing a node parameter in the project DOES rewrite the project', function (done) {
    const sentinelSurvives = plantDiskOnlySentinel();

    const component = project.getComponentWithName('/Home');
    const node = component.graph.roots[0];
    node.setParameter('paddingLeft', { value: 17, unit: 'px' });

    afterDebounce(function () {
      expect(sentinelSurvives()).toBe(false);
    }, done);
  });
});
