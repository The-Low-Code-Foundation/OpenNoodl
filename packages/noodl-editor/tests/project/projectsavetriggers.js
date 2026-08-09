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
// BEN-005. Imported rather than spelled out: a scenario reaching disk under a
// key nothing reads back is the failure this case exists to catch, and a
// literal here would keep passing through exactly that rename.
const {
  BENCH_SCENARIOS_KEY,
  benchScenarioStore
} = require('../../src/editor/src/views/VisualCanvas/benchScenarios');
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
/**
 * How long a write that IS coming is allowed to take, and why it is not
 * `PAST_DEBOUNCE_MS`.
 *
 * The two kinds of claim here need two different instruments. "Does not write"
 * is an *absence*: it cannot be polled for, so a fixed wait past the debounce is
 * the only way to observe it. "DOES write" is a *presence*, and sampling a
 * presence at one fixed instant asserts a deadline nobody meant to claim — the
 * claim is that an edit reaches disk, not that it reaches disk within 800ms of
 * the debounce firing.
 *
 * The distinction matters because a missed deadline and a dropped edit produce
 * the identical `Expected true to be false`, on the one suite whose whole job is
 * to catch a silently dropped user edit. Measured on an idle machine, the write
 * lands 1132ms and 1122ms after the edit — ~130ms past the debounce, against
 * 800ms of slack, so the deadline is not tight today. It is simply measuring
 * something other than the claim.
 *
 * Matches `projectsaveflush.js`'s POLL_BUDGET_MS, whose header states the same
 * principle: every assertion there is timing-free on purpose.
 */
const WRITE_BUDGET_MS = 8000;
const POLL_INTERVAL_MS = 50;

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
      let current;
      try {
        current = JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch (e) {
        // Caught the file mid-replace. That is evidence a save is in flight, not
        // evidence the sentinel is gone — so report it as surviving and let the
        // caller look again. Unguarded, this threw a JSON parse error in place of
        // whichever assertion was being made.
        return true;
      }
      return (current.metadata || {}).diskOnlySentinel === true;
    };
  }

  /** Assert an ABSENCE. Nothing may be written, so there is nothing to wait for. */
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

  /**
   * Assert a PRESENCE: the edit reached disk. Polls rather than sampling, and
   * says what it was claiming when it gives up — `Expected true to be false`
   * named neither the claim nor which of the two ways it can fail.
   */
  function expectTheProjectIsWritten(what, sentinelSurvives, done) {
    const started = Date.now();

    (function poll() {
      if (!sentinelSurvives()) return done();

      const waited = Date.now() - started;
      if (waited >= WRITE_BUDGET_MS) {
        return done.fail(
          new Error(
            `${what} did not write the project within ${WRITE_BUDGET_MS}ms. The ` +
              'disk-only sentinel survived, so no save serialised it away — the ' +
              'autosave allowlist dropped the edit. (An edit that merely arrived ' +
              'late would have cleared the sentinel before this budget expired; ' +
              'a write takes ~130ms past the 1000ms debounce on an idle machine.)'
          )
        );
      }
      setTimeout(poll, POLL_INTERVAL_MS);
    })();
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

    expectTheProjectIsWritten('moving a node', sentinelSurvives, done);
  });

  it('changing a node parameter in the project DOES rewrite the project', function (done) {
    const sentinelSurvives = plantDiskOnlySentinel();

    const component = project.getComponentWithName('/Home');
    const node = component.graph.roots[0];
    node.setParameter('paddingLeft', { value: 17, unit: 'px' });

    expectTheProjectIsWritten('changing a node parameter', sentinelSurvives, done);
  });

  /**
   * BEN-005 — saving a bench scenario is the *only* thing on the component
   * bench that is allowed to reach disk (R5), and it reaches it through this
   * listener rather than through a save call of its own:
   * `ComponentModel.setMetaData` raises `Model.metadataChanged`, which is a
   * member of the allowlist above.
   *
   * So the feature's whole persistence story is one allowlist entry, and an
   * allowlist can only fail by omission. This is the case that would notice.
   */
  it('saving a bench scenario on a component DOES rewrite the project, with the scenario in it', function (done) {
    const sentinelSurvives = plantDiskOnlySentinel();

    const component = project.getComponentWithName('/Home');
    component.setMetaData(BENCH_SCENARIOS_KEY, benchScenarioStore([{ name: 'Loaded', inputs: { title: 'Rex' } }]));

    // `expectTheProjectIsWritten` calls this on success and `.fail` on timeout,
    // so the continuation has to carry `fail` the way a Jasmine `done` does.
    const written = function () {
      try {
        // The write happened; the acceptance criterion is that the scenario is
        // *in* it. `toJSON` carries `metadata` per component, and a round trip
        // that dropped it would leave a green save and an empty scenario list on
        // the next open — which is exactly how this would fail silently.
        const json = JSON.parse(fs.readFileSync(path.join(projectDir, 'project.json'), 'utf8'));
        const saved = json.components.find(function (c) {
          return c.name === '/Home';
        });

        expect(saved.metadata[BENCH_SCENARIOS_KEY]).toEqual({
          scenarios: [{ name: 'Loaded', inputs: { title: 'Rex' } }]
        });
        done();
      } catch (e) {
        done.fail(e);
      }
    };
    written.fail = done.fail;

    expectTheProjectIsWritten('saving a bench scenario', sentinelSurvives, written);
  });
});
