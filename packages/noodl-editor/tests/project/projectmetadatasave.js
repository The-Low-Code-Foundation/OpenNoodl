// F44 — the app name must reach project.json when you set it, not one edit later.
//
// PNL-008's L5 round trip wrote the App name, polled project.json for 15s and
// still saw the old value; writing the *Browser tab title* then made the app name
// appear alongside it. The lag was exactly one step, twice.
//
// The cause was not the instrument and not a debounce. `ProjectModel.setMetaData`
// dispatched `ProjectModel.metadataChanged`, and `EventDispatcher`'s wildcard
// match requires the first dot-component to be identical — so the `Model.*`
// autosave listener, the editor's ONLY autosave, never heard it. Every write to
// `metadata` (the whole app config: name, description, SEO, PWA, config
// variables, plus styles and design tokens) mutated memory and scheduled nothing.
// `toJSON()` serialises `metadata` unconditionally, so the pending value went out
// with the next save some *other* change happened to trigger. Hence lag-by-one.
//
// Asserted here end-to-end, against a real project on disk, because the corpus
// check that found it runs against a live editor this suite cannot launch.
const FileSystem = require('@noodl-utils/filesystem');
const { ProjectModel } = require('@noodl-models/projectmodel');
const { projectFromDirectory } = require('@noodl-models/projectmodel.editor');
const Utils = require('@noodl-utils/utils');
const Process = require('process');
const ncp = require('ncp').ncp;
const fs = require('fs');
const path = require('path');

const remote = require('@electron/remote');
const App = remote.app;

const FIXTURE = Process.cwd() + '/tests/testfs/import_collide_target';

/** The autosave debounce is 1000ms; give it room without sleeping a guess. */
const SAVE_DEBOUNCE_MS = 1000;
const POLL_BUDGET_MS = 8000;
const POLL_INTERVAL_MS = 100;

/**
 * Open a temp COPY of a fixture as the current project. Always a copy — this
 * spec's whole point is that something gets written to disk.
 */
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

describe('F44 project metadata reaches disk', function () {
  it('writes the app name to project.json without a second edit', function (done) {
    withProjectCopy(function (project, dir) {
      // Diverge the browser tab title FIRST and let that save settle. This is
      // what made the defect visible: while the title is empty or still equal to
      // the old app name, `ProjectSettingsTab` also calls `setSetting`, which
      // fires a real `Model.settingsChanged` and drags the app name along. Once
      // the two have diverged on purpose, the app-name write is on its own.
      project.setSetting('htmlTitle', 'A Deliberately Different Tab Title');

      onDiskWhen(dir, (json) => json.settings && json.settings.htmlTitle === 'A Deliberately Different Tab Title')
        .then((afterTitle) => {
          expect(afterTitle).not.toBe(null);

          // Now the app name, and NOTHING else.
          project.updateAppConfig({ identity: { appName: 'F44 Renamed App' } });

          return onDiskWhen(
            dir,
            (json) =>
              json.metadata && json.metadata.appConfig && json.metadata.appConfig.identity.appName === 'F44 Renamed App'
          );
        })
        .then((json) => {
          expect(json).not.toBe(null);
          expect(json.metadata.appConfig.identity.appName).toBe('F44 Renamed App');
          // ...and the tab title it must not have clobbered.
          expect(json.settings.htmlTitle).toBe('A Deliberately Different Tab Title');
          done();
        })
        .catch(done.fail);
    });
  });

  it('writes any other metadata key (styles, tokens, SEO) on its own too', function (done) {
    withProjectCopy(function (project, dir) {
      // Same gap, wider blast radius: StylesModel, StyleTokensModel and every
      // `updateAppConfig` caller all persist through `setMetaData`.
      project.setMetaData('f44probe', { written: true });

      onDiskWhen(dir, (json) => json.metadata && json.metadata.f44probe && json.metadata.f44probe.written === true)
        .then((json) => {
          expect(json).not.toBe(null);
          done();
        })
        .catch(done.fail);
    });
  });

  it('mergeMetadata also schedules a save', function (done) {
    withProjectCopy(function (project, dir) {
      project.mergeMetadata({ f44merge: { colors: { Brand: '#FF00AA' } } });

      onDiskWhen(
        dir,
        (json) => json.metadata && json.metadata.f44merge && json.metadata.f44merge.colors.Brand === '#FF00AA'
      )
        .then((json) => {
          expect(json).not.toBe(null);
          done();
        })
        .catch(done.fail);
    });
  });

  it('respects setSaveOnModelChange(false) — a metadata write during a bulk op saves nothing', function (done) {
    withProjectCopy(function (project, dir) {
      ProjectModel.setSaveOnModelChange(false);
      project.setMetaData('f44suppressed', { written: true });

      // Give the debounce more than its window to prove nothing was armed.
      setTimeout(function () {
        ProjectModel.setSaveOnModelChange(true);
        const json = JSON.parse(fs.readFileSync(path.join(dir, 'project.json'), 'utf8'));
        expect(json.metadata.f44suppressed).toBe(undefined);
        done();
      }, SAVE_DEBOUNCE_MS + 500);
    });
  });
});
