import { find } from 'underscore';

import { NodeLibrary } from '@noodl-models/nodelibrary';
import type {
  NodeLibraryProjectSettings,
  NodeLibraryProjectSettingsPort
} from '@noodl-models/nodelibrary/NodeLibraryData';
import { ProjectModel, ProjectSettings } from '@noodl-models/projectmodel';

import Model from '../../../../../shared/model';
import { EventDispatcher } from '../../../../../shared/utils/EventDispatcher';

/**
 * The `<title>` of the built page, declared as a project-settings port in
 * `noodl-viewer-react/src/project-settings.ts`. PNL-008 promotes it out of the
 * legacy Ports view and into App Identity; see `getPorts()`.
 */
export const HTML_TITLE_PORT = 'htmlTitle';

export class ProjectSettingsModel extends Model {
  private project: ProjectModel;
  /** Memoised result of {@link getPorts}; cleared whenever a parameter is written. */
  private _ports: NodeLibraryProjectSettingsPort[] | undefined;
  /**
   * The port *template* from the node library, not this project's values.
   *
   * Named `type` because the property editor treats a settings model like a node and
   * reads `.type.ports` off it — the same shape a node type presents.
   */
  private type: NodeLibraryProjectSettings;
  /** This project's saved settings, deep-copied so edits do not mutate the project. */
  private parameters: ProjectSettings;

  constructor() {
    super();

    this.project = ProjectModel.instance;

    this.loadSettings();

    const _this = this;
    NodeLibrary.instance.on(
      'libraryUpdated',
      function () {
        _this.loadSettings();
        _this.notifyListeners('settingsChanged');
      },
      this
    );

    this.bindProjectModel();

    EventDispatcher.instance.on(
      'ProjectModel.instanceHasChanged',
      (args) => {
        args.oldInstance && args.oldInstance.off(this);
        if (ProjectModel.instance === undefined) return;

        _this.project = ProjectModel.instance;
        _this.bindProjectModel();

        _this.loadSettings();
        _this.notifyListeners('settingsChanged');
      },
      this
    );
  }

  dispose() {
    NodeLibrary.instance.off(this);
    EventDispatcher.instance.off(this);
    this.project && this.project.off(this);
  }

  bindProjectModel() {
    const _this = this;

    this.project.on(
      'settingsChanged',
      function () {
        _this.loadSettings();
        _this.notifyListeners('settingsChanged');
      },
      this
    );
  }

  loadSettings() {
    this._ports = undefined;
    // NOTE: We are getting the ports here!
    this.type = NodeLibrary.instance.getProjectSettingsPorts();
    this.parameters = JSON.parse(JSON.stringify(this.project.getSettings()));
    //this.parameters.name = this.project.name; // Name of project
  }

  unbind() {
    NodeLibrary.instance.off(this);
  }

  getParameter(name: string): unknown {
    return this.parameters[name] !== undefined ? this.parameters[name] : this.getPort(name).default;
  }

  getPort(name: string): NodeLibraryProjectSettingsPort | undefined {
    const ports = this.getPorts();
    return find(ports, function (p) {
      return p.name === name;
    });
  }

  getPorts(): NodeLibraryProjectSettingsPort[] {
    if (this._ports) return this._ports;

    // Project name
    let ports: NodeLibraryProjectSettingsPort[] = [
      /* {
        type:'string',
        name:'name',
        displayName:'Name',
        group:'General',
      }*/
    ];

    // Static ports
    ports = ports.concat(this.type.ports || []);

    // PNL-008: `htmlTitle` has its own control in the App Identity section, next
    // to the app name it usually mirrors. Leaving it here as well would put two
    // controls on one field in one panel — which is half of the duplication this
    // task exists to remove. Filtered rather than deleted from the port list
    // itself: `exporter/util.ts` and the version-control diff both read
    // `NodeLibrary.getProjectSettingsPorts()` directly and still need the entry
    // (it is where `ignoreInExport` and the "General: Title" label live).
    ports = ports.filter((p) => p.name !== HTML_TITLE_PORT);

    // Dynamic ports
    //var dynamicports = NodeLibrary.instance.getDynamicPortsForNode(this);
    //if(dynamicports) ports = ports.concat(dynamicports);

    this._ports = ports;
    return ports;
  }

  setParameter(name: string, value: unknown) {
    /* if(name === 'name') {
      // Project name changed
      this.project.rename(value);
    }*/

    this.parameters[name] = value;

    // Push to project settings right away
    const settings = JSON.parse(JSON.stringify(this.parameters));
    //delete settings.name; // Remove the project name from settings
    this.project.setSettings(settings);

    this._ports = undefined;
    this.notifyListeners('settingsChanged');
  }

  isEmpty() {
    return this.getPorts().length === 0;
  }

  isPortConnected() {
    return false;
  }
}
