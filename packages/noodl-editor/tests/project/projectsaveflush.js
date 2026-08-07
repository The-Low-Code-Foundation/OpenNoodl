// Pending project saves must not be droppable.
//
// `scheduleProjectSave()` debounces writes by a second, and nothing ever asked
// the renderer to drain that timer before the app went away: `before-quit` in
// main.js awaited `backendManager.stopAll()` and nothing else. So an edit
// followed by ⌘Q inside the debounce reached memory, never disk, and failed
// silently — on every edit path, metadata and every node/connection/component
// change alike. Observed three times against a live editor with the model
// confirmed holding the value and project.json confirmed not.
//
// The fix is a flush the main process can ask for and wait on
// (`flushPendingProjectSave`), plus a `blur` listener, both wired in
// src/editor/index.ts. This suite cannot quit an app, so what is asserted here
// is the renderer half — the part that has to be correct for the handshake in
// main.js to mean anything.
//
// Every assertion below is timing-free on purpose. `flushPendingProjectSave()`
// resolving is itself the claim: it does its own write rather than waiting on
// the timer, so a *synchronous* read of project.json straight after it resolves
// can only pass if the flush is what wrote the file.
const FileSystem = require('@noodl-utils/filesystem');
const { ProjectModel, flushPendingProjectSave } = require('@noodl-models/projectmodel');
const { projectFromDirectory } = require('@noodl-models/projectmodel.editor');
const Utils = require('@noodl-utils/utils');
const Process = require('process');
const ncp = require('ncp').ncp;
const fs = require('fs');
const path = require('path');

const remote = require('@electron/remote');
const App = remote.app;

const FIXTURE = Process.cwd() + '/tests/testfs/import_collide_target';

/** The autosave debounce is 1000ms. */
const SAVE_DEBOUNCE_MS = 1000;
const POLL_BUDGET_MS = 8000;
const POLL_INTERVAL_MS = 100;

/** Open a temp COPY of a fixture as the current project — this spec writes. */
function withProjectCopy(callback) {
  const tempDir = App.getPath('temp') + '/noodlunittests-' + Utils.guid() + '/';
  FileSystem.instance.makeDirectory(tempDir, function () {
    ncp(FIXTURE, tempDir + '/p', function (err) {
      if (err) throw err;
      projectFromDirectory(tempDir + '/p', function (project) {
        ProjectModel.instance = project;
        callback(project, tempDir + '/p');
      });
    });
  });
}

function readProjectJson(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, 'project.json'), 'utf8'));
}

/**
 * The fixture's project.json has no `metadata` until something writes one, so
 * every read here goes through this — otherwise the "nothing was written yet"
 * assertions throw instead of failing.
 */
function metaOf(json) {
  return json.metadata || {};
}

/** Poll project.json until `predicate(json)` holds, or give up. */
function onDiskWhen(dir, predicate) {
  const file = path.join(dir, 'project.json');
  const deadline = Date.now() + POLL_BUDGET_MS;

  return new Promise((resolve) => {
    (function poll() {
      let json = null;
      try {
        json = JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch (e) {
        json = null; // mid-write, or not there yet
      }
      if (json && predicate(json)) return resolve(json);
      if (Date.now() > deadline) return resolve(null);
      setTimeout(poll, POLL_INTERVAL_MS);
    })();
  });
}

describe('pending project saves survive the way out', function () {
  // `saveOnModelChange`, `savePending` and `ProjectModel.instance` are module
  // globals. Leaving any of them dirty makes the NEXT spec file's result depend
  // on execution order, which is exactly how the import spec came to be wrong.
  let previousInstance;

  beforeEach(function () {
    previousInstance = ProjectModel.instance;
  });

  afterEach(function (done) {
    ProjectModel.setSaveOnModelChange(true);
    // Drain anything this spec left armed, so it cannot land in the middle of
    // the next one, then hand the singleton back exactly as it was found.
    flushPendingProjectSave().then(function () {
      ProjectModel.instance = previousInstance;
      done();
    }, done.fail);
  });

  it('writes a pending edit as soon as it is asked, without waiting for the debounce', function (done) {
    withProjectCopy(function (project, dir) {
      project.setMetaData('flushprobe', { written: true });

      // Nothing has been given a chance to fire: the timer was armed a moment
      // ago and has ~1000ms left to run.
      expect(metaOf(readProjectJson(dir)).flushprobe).toBe(undefined);

      flushPendingProjectSave()
        .then(function () {
          // Synchronous read. If the flush had merely waited for the debounce,
          // this promise would not have resolved yet.
          expect(metaOf(readProjectJson(dir)).flushprobe.written).toBe(true);
          done();
        })
        .catch(done.fail);
    });
  });

  it('flushes an edit whose timer a bulk op cleared, rather than dropping it', function (done) {
    withProjectCopy(function (project, dir) {
      project.setMetaData('flushsuppressed', { written: true });

      // `setSaveOnModelChange(false)` clears the timer. Before this fix that
      // was the end of the edit — nothing would ever write it.
      ProjectModel.setSaveOnModelChange(false);

      flushPendingProjectSave()
        .then(function () {
          expect(metaOf(readProjectJson(dir)).flushsuppressed.written).toBe(true);
          done();
        })
        .catch(done.fail);
    });
  });

  it('re-arms a held save when saving is switched back on', function (done) {
    withProjectCopy(function (project, dir) {
      project.setMetaData('flushrearm', { written: true });
      ProjectModel.setSaveOnModelChange(false);

      // Prove the suppression is real before relying on the re-arm.
      setTimeout(function () {
        expect(metaOf(readProjectJson(dir)).flushrearm).toBe(undefined);

        ProjectModel.setSaveOnModelChange(true);

        onDiskWhen(dir, (json) => json.metadata && json.metadata.flushrearm && json.metadata.flushrearm.written === true)
          .then(function (json) {
            expect(json).not.toBe(null);
            done();
          })
          .catch(done.fail);
      }, SAVE_DEBOUNCE_MS + 500);
    });
  });

  it('does not write when there is nothing pending', function (done) {
    withProjectCopy(function (project, dir) {
      // Order matters. Closing the door first means nothing can arm a *new*
      // save while this spec is running — opening a project fires model events
      // of its own, and without this the sentinel below would be racing them.
      // Then drain whatever was already armed, so the state under test is
      // genuinely "nothing pending" rather than "something not yet noticed".
      // (`afterEach` puts saving back on.)
      ProjectModel.setSaveOnModelChange(false);

      flushPendingProjectSave()
        .then(function () {
          // A sentinel that exists ONLY on disk. The model has never heard of
          // it, so any save at all would serialise it away.
          const file = path.join(dir, 'project.json');
          const json = readProjectJson(dir);
          json.metadata = json.metadata || {};
          json.metadata.diskOnlySentinel = true;
          fs.writeFileSync(file, JSON.stringify(json, null, 2));

          return flushPendingProjectSave();
        })
        .then(function () {
          expect(metaOf(readProjectJson(dir)).diskOnlySentinel).toBe(true);
          done();
        })
        .catch(done.fail);
    });
  });
});
