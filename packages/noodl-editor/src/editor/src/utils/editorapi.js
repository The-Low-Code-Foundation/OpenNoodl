const { ipcRenderer } = require('electron');
const { ProjectModel } = require('../models/projectmodel');
// The pure ProjectTokenCss submodule, never the StyleTokensModel barrel — the
// barrel binds listeners and drags the live editor model in behind it.
const { generateProjectTokenCss } = require('../models/StyleTokensModel/ProjectTokenCss');
const Exporter = require('./exporter');
const { EventDispatcher } = require('../../../shared/utils/EventDispatcher');
const KeyboardHandler = require('@noodl-utils/keyboardhandler');

class EditorAPI {
  keyDown(evt, cb) {
    KeyboardHandler.default.instance.onKeyDown(evt);
    cb();
  }

  inspectNodes(evt, cb) {
    EventDispatcher.instance.emit('inspectNodes', { nodeIds: evt.nodeIds });
    cb();
  }

  projectGetInfo(args, cb) {
    if (ProjectModel.instance) {
      cb({
        id: ProjectModel.instance.id,
        projectDirectory: ProjectModel.instance._retainedProjectDirectory,
        runtimeVersion: ProjectModel.instance.runtimeVersion
      });
    } else {
      cb({ id: null, projectDirectory: null, runtimeVersion: null });
    }
  }

  projectSetMetaData(args, cb) {
    ProjectModel.instance.setMetaData(args.key, args.data);
    cb();
  }

  projectGetMetaData(args, cb) {
    var data = ProjectModel.instance.getMetaData(args.key);
    cb(data);
  }

  projectGetSettings(args, cb) {
    var data = ProjectModel.instance ? ProjectModel.instance.getSettings() : undefined;
    cb(data);
  }

  /**
   * The project's `:root` design-token block, for the preview web server.
   *
   * Three surfaces have to resolve the same `var(--token)` vocabulary, and until
   * now only two did: `PreviewTokenInjector` pushes this CSS into the Electron
   * `<webview>`s it is handed, and `html-processor` stamps it into exported
   * HTML. Anything served over the preview web server — a detached preview
   * window, a phone on the LAN, a browser tab pointed at the dev port — got
   * `static/viewer/index.html`, which carries no tokens at all, so every colour,
   * spacing, radius and shadow written as a token reference silently resolved to
   * nothing. That is not a cosmetic gap for AI-authored pages in particular:
   * the authoring prompt *requires* token references for every such value, so
   * the entire visual result of a build vanished in exactly the window a user is
   * most likely to judge it in.
   *
   * Answered here rather than in main because tokens are per-project (shipped
   * defaults merged with the project's stored overrides) and `ProjectModel`
   * lives in this process.
   */
  projectGetDesignTokenCss(args, cb) {
    cb(ProjectModel.instance ? generateProjectTokenCss(ProjectModel.instance) : '');
  }

  projectGetComponentBundleExport(args, cb) {
    if (!ProjectModel.instance) {
      cb();
      return;
    }

    const root = ProjectModel.instance.getRootNode();
    if (!root) {
      cb({});
    }

    if (!cachedComponentIndex) {
      const rootComponent = root.owner.owner;
      const allComponents = ProjectModel.instance.getComponents();
      cachedComponentIndex = Exporter.getComponentIndex(rootComponent, allComponents);
    }

    const json = JSON.stringify(Exporter.exportComponentBundle(ProjectModel.instance, args.name, cachedComponentIndex));
    cb(json);
  }

  handleRequest(args, fn) {
    EditorAPI.instance[args.api](args.args, function (response) {
      fn({
        api: args.api,
        token: args.token,
        response: response
      });
    });
  }
}

ipcRenderer.on('editor-api-request', function (event, args) {
  EditorAPI.instance.handleRequest(args, function (response) {
    event.sender.send('editor-api-response', response);
  });
});

EditorAPI.instance = new EditorAPI();

//optimization for bundle generation so we don't have to re-generate the component index all the time
let cachedComponentIndex = null;

var ignoreEvents = ['Model.thumbnailChanged', 'Model.warningsChanged', 'Model.myProjectsChanged'];

EventDispatcher.instance.on('Model.*', (e, name) => {
  if (ignoreEvents.includes(name)) return;
  cachedComponentIndex = null;
});

module.exports = EditorAPI;
