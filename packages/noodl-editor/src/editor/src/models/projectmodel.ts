import _ from 'underscore';
import { filesystem } from '@noodl/platform';

import { UndoQueue, UndoActionGroup } from '@noodl-models/undo-queue-model';
import { WarningsModel } from '@noodl-models/warningsmodel';
import { verifyJsonFile } from '@noodl-utils/verifyJson';

import Model from '../../../shared/model';
import { EventDispatcher } from '../../../shared/utils/EventDispatcher';
import type { IconSetDescriptor } from '../../../shared/utils/iconsets';
import Utils from '../utils/utils';
import { ComponentModel } from './componentmodel';
import LessonModel from './lessonmodel';
import { NodeGraphModel, NodeGraphNode } from './nodegraphmodel';
import { NodeLibrary } from './nodelibrary';
import {
  listProjectIconSets,
  listProjectModules,
  ProjectModule,
  ProjectModuleManifest,
  readProjectModules
} from './projectmodel.modules';
import { VariantModel } from './VariantModel';
import { projectStructureService, projectMigrator } from '../services/ProjectStructure';
import type { PreflightReport, MigrationResult } from '../services/ProjectStructure';
import { isV2FormatEnabled } from '../services/ProjectStructure/featureFlags';

/** Which on-disk format a loaded project uses. Set at load; drives the save path. */
export type ProjectFormatKind = 'legacy' | 'v2';

/**
 * WF-007: discriminates whether the endpoint this pointer targets is known
 * to be a NodeGX backend (`nodegx-backend`, local or deployed — implements
 * the Parse-wire subset *and* NodeGX-specific extensions like the realtime/
 * SSE transport) versus an `'external'` Parse-wire-compatible server we
 * cannot assume anything beyond the base protocol for. `undefined` means
 * unknown (pre-existing projects saved before this field existed).
 */
export type CloudServiceType = 'nodegx' | 'external';

export interface CloudServiceMetadata {
  id: string;
  endpoint: string;
  appId: string;
  type?: CloudServiceType;

  /** @deprecated use `endpoint` instead. */
  url?: string;
}

export interface CloudServiceMetadataDataFormat {
  instanceId: string;
  endpoint: string;
  appId: string;
  type?: CloudServiceType;
}

export type ProjectSettings =
  | {
      bodyScroll?: boolean;
      headCode?: string;
      htmlTitle?: string;
      navigationPathType?: string;
    } & Record<string, any>;

export class ProjectModel extends Model {
  public static readonly version = '1';
  public static readonly Upgraders = {
    0: function (project) {
      // Upgrade project from 0 to 1, inferred types are removed and = should become * on
      // node instance ports
      project.forEachComponent(function (c) {
        c.forEachNode(function (n) {
          _.each(n.ports, function (p) {
            if (p.type === '=') p.type = '*';
            else if (p.type.name === '=') p.type.name = '*';
          });
        });
      });

      // Project upgraded to version 1
      project.version = '1';
    },
    1: function (project) {
      // Upgrade to version 2 (support for variants, state parameters and transitions)
      project.version = '2';
    },
    2: function (project) {
      // Upgrade to version 2 (support for comments)
      project.version = '3';
    },
    3: function (project) {
      // Upgrade event senders to use string lists instead of PortEditor
      project.version = '4';
    }
  };

  // Track when the current project instance is changed, keep track of changes on the instance
  private static _instance: ProjectModel | undefined = undefined;
  public static get instance() {
    return ProjectModel._instance;
  }
  public static set instance(project: ProjectModel | undefined) {
    if (ProjectModel._instance !== project) {
      //unload old project
      if (ProjectModel._instance) {
        EventDispatcher.instance.notifyListeners('ProjectModel.instanceWillChange');
        NodeLibrary.instance.unregisterModule(ProjectModel._instance);
      }

      //and load new one, if any
      project !== undefined && NodeLibrary.instance.registerModule(project);

      const _oldInstance = ProjectModel._instance;
      ProjectModel._instance = project;
      EventDispatcher.instance.notifyListeners('ProjectModel.instanceHasChanged', {
        oldInstance: _oldInstance
      });
    }
  }

  public id?: string;
  public name?: string;
  public version?: string;
  public runtimeVersion?: 'react17' | 'react19';
  public _retainedProjectDirectory?: string;
  public _isReadOnly?: boolean; // Flag for read-only mode (legacy projects)
  /** On-disk format this project was loaded from. Determines the save path. Defaults to legacy. */
  public _projectFormat?: ProjectFormatKind;
  public settings?: ProjectSettings;
  public metadata?: TSFixme;
  public components: ComponentModel[];
  public variants: TSFixme[];
  public modules: ProjectModule[] = [];
  public lesson: TSFixme;
  public rootNode: NodeGraphNode;
  public evaluatehealthScheduled: TSFixme;
  public componentAnnotations: TSFixme;
  public previews: TSFixme;
  public thumbnailURI: TSFixme;

  constructor(args?: TSFixme) {
    super();

    this.components = [];
    this.variants = [];
    this.settings = {};
    if (args) {
      this.name = args.name;
      this.settings = args.settings;
      // this.thumbnailURI = args.thumbnailURI;
      this.version = args.version;
      this.runtimeVersion = args.runtimeVersion;
      this.metadata = args.metadata;
      // this.deviceSettings = args.deviceSettings;
    }

    // NOTE: runtimeVersion is NOT auto-defaulted here!
    // - New projects: Explicitly set to 'react19' in LocalProjectsModel.newProject()
    // - Old projects: Left undefined, detected by runtime scanner
    // - This prevents corrupting legacy projects when they're loaded

    NodeLibrary.instance.on(
      ['moduleRegistered', 'moduleUnregistered', 'libraryUpdated'],
      () => {
        this.scheduleEvaluateHealth();
      },
      this
    );
  }

  // Load project json from directory
  static readJSONFromDirectory(retainedProjectDirectory: string, callback) {
    filesystem
      .readJson(retainedProjectDirectory + '/project.json')
      .then(callback)
      .catch((error) => {
        console.error(error);
        callback();
      });
  }

  // From local storage
  static fromLocalStorage() {
    let _this;

    const json = localStorage['project'];
    if (json) _this = ProjectModel.fromJSON(JSON.parse(json));
    else _this = new ProjectModel();

    return _this;
  }

  static fromJSON(json) {
    const _this = new ProjectModel(json);

    if (json.lesson) _this.lesson = LessonModel.fromJSON(json.lesson);

    for (const i in json.components) {
      _this.addComponent(ComponentModel.fromJSON(json.components[i]));
    }

    if (json.variants !== undefined) _this.variants = json.variants.map((v) => VariantModel.fromJSON(v));

    if (json.rootNodeId) _this.rootNode = _this.findNodeWithId(json.rootNodeId);

    // Handle rootComponent from templates (name of component instead of node ID)
    if (json.rootComponent && !_this.rootNode) {
      const rootComponent = _this.getComponentWithName(json.rootComponent);
      if (rootComponent) {
        _this.setRootComponent(rootComponent);
      }
    }

    // Upgrade project if necessary
    ProjectModel.upgrade(_this);

    return _this;
  }

  static setSaveOnModelChange(enabled) {
    saveOnModelChange = enabled;

    if (!saveOnModelChange) {
      // The queued write is held, not abandoned — `savePending` survives the
      // disable, so the branch below re-arms it. Callers turn saving off for a
      // short critical section (a component reload from disk, the v2
      // migration) and turn it back on; without the re-arm, an edit that was
      // already waiting on the timer when the section began simply never
      // reached disk. Same family of defect as the quit path.
      clearTimeout(saveTimeout);
    } else if (savePending) {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(saveProject, 1000);
    }
  }

  static upgrade(project) {
    if (!project.version) project.version = '0';

    let upgrader;
    while ((upgrader = ProjectModel.Upgraders[project.version])) {
      upgrader(project);
    }
  }

  dispose() {
    for (const c in this.components) this.components[c].dispose();

    NodeLibrary.instance.off(this);
  }

  // Sets the root
  setRootNode(node: NodeGraphNode) {
    this.rootNode = node;

    this.notifyListeners('rootNodeChanged', {
      model: node
    });
  }

  setRootComponent(component: ComponentModel) {
    // First first node that can be export root
    const root = _.find(component.graph.roots, function (n) {
      return n.type.allowAsExportRoot;
    });
    if (root) this.setRootNode(root);
  }

  // Returns root
  getRootNode() {
    return this.rootNode;
  }

  public getRootComponent(): ComponentModel {
    const root = this.getRootNode();
    if (!root) {
      return;
    }

    return root.owner?.owner;
  }

  // Returns all components of the project
  getComponents(): ComponentModel[] {
    return this.components;
  }

  // Add a component to this project
  addComponent(component, args?: TSFixme) {
    const _this = this;
    component.owner = this;

    if (args && args.undo && typeof args.undo !== 'object')
      var undoGroup = (args.undo = new UndoActionGroup({
        label: args.label || 'add component'
      }));

    this.components.push(component);
    this.notifyListeners('componentAdded', {
      model: component,
      undo: args ? args.undo : undefined
    });

    NodeLibrary.instance.notifyListeners('typeAdded', {
      model: component
    });

    // Undo
    if (args && args.undo) {
      const undo = typeof args.undo === 'object' ? args.undo : UndoQueue.instance;

      undo.push({
        label: args.label,
        do: function () {
          _this.addComponent(component);
        },
        undo: function () {
          _this.removeComponent(component);
        }
      });

      undoGroup && UndoQueue.instance.push(undoGroup); // Push undo group if it was created
    }
  }

  duplicateComponent(component: ComponentModel, newComponentName: string, args) {
    if (args && args.undo && typeof args.undo !== 'object')
      var undoGroup = (args.undo = new UndoActionGroup({
        label: args.label || 'duplicate component'
      }));

    const newComponent = new ComponentModel({
      name: newComponentName,
      graph: NodeGraphModel.fromJSON(JSON.parse(JSON.stringify(component.graph.toJSON()))),
      id: Utils.guid()
    });

    newComponent.rekeyAllIds();
    if (args.rerouteComponentRefs) {
      newComponent.rerouteComponentRefs(
        args.rerouteComponentRefs.oldPathPrefix,
        args.rerouteComponentRefs.newPathPrefix
      );
    }

    this.addComponent(newComponent, args);
    this.notifyListeners('componentDuplicated', {
      source: component,
      duplicate: newComponent,
      undo: args ? args.undo : undefined
    });

    undoGroup && UndoQueue.instance.push(undoGroup); // Push undo group if it was created
  }

  // Remove a component from this project
  removeComponent(component: ComponentModel, args?: TSFixme) {
    const _this = this;
    const idx = this.components.indexOf(component);
    if (idx !== -1) {
      if (args && args.undo && typeof args.undo !== 'object')
        // Create undo group if none is provided already
        var undoGroup = (args.undo = new UndoActionGroup({
          label: args.label || 'remove component'
        }));

      WarningsModel.instance.clearAllWarningsForComponent(component);

      component.owner = undefined;
      this.components.splice(idx, 1);

      //reset the root node if we're deleting the root component
      if (this.rootNode?.owner?.owner === component) {
        this.setRootNode(null);
      }

      this.notifyListeners('componentRemoved', {
        model: component,
        undo: args ? args.undo : undefined
      });

      NodeLibrary.instance.notifyListeners('typeRemoved', {
        model: component
      });
      component.off(this);

      // Undo
      if (args && args.undo) {
        const undo = typeof args.undo === 'object' ? args.undo : UndoQueue.instance;

        undo.push({
          label: args.label,
          do: function () {
            _this.removeComponent(component);
          },
          undo: function () {
            _this.addComponent(component);
          }
        });

        undoGroup && UndoQueue.instance.push(undoGroup); // Push undo group if it was created
      }

      return true;
    }
  }

  /**
   * Returns a component with a specific name
   * @param name
   * @returns
   */
  getComponentWithName(name: string): ComponentModel {
    for (const i in this.components) {
      const c = this.components[i];
      if (c.name === name) return c;
    }
    return undefined;
  }

  forEachComponent(callback: (component: ComponentModel) => void) {
    for (const i in this.components) callback(this.components[i]);
  }

  findNodeWithId(id: string): NodeGraphNode {
    for (const i in this.components) {
      const c = this.components[i];
      const node = c.graph.findNodeWithId(id);
      if (node) return node;
    }
  }

  getNodesWithType(typename: string): NodeGraphNode[] {
    const nodes = [];
    this.forEachComponent((c) => {
      c.forEachNode((n) => {
        if (n.typename === typename) nodes.push(n);
      });
    });
    return nodes;
  }

  // Rename a component of the project
  renameComponent(component: ComponentModel, newname: string, args?: TSFixme) {
    const oldName = component.name;
    component.rename(newname);

    this.notifyListeners('componentRenamed', {
      model: component,
      oldName: oldName
    });

    // Undo
    if (args && args.undo) {
      const undo = typeof args.undo === 'object' ? args.undo : UndoQueue.instance;

      const _this = this;
      undo.push({
        label: args.label,
        do: function () {
          _this.renameComponent(component, newname);
        },
        undo: function () {
          _this.renameComponent(component, oldName);
        }
      });
    }
  }

  // Rename a component with a given name
  renameComponentWithName(oldname: string, newname: string, args) {
    if (this.getComponentWithName(newname)) return false;

    const c = this.getComponentWithName(oldname);
    this.renameComponent(c, newname, args);

    return true;
  }

  // Returns all components that start with the specified path
  getComponentsWithPath(path): ComponentModel[] {
    return _.filter(this.components, function (c) {
      return c.name.indexOf(path) === 0;
    });
  }

  // Moves all components that start with the specified path oldpath to
  // the new path
  moveComponentsToNewPath(oldpath: string, newpath: string, args?) {
    const _this = this;

    _.each(this.getComponentsWithPath(oldpath), function (c) {
      const newname = newpath + c.name.substring(oldpath.length);
      _this.renameComponent(c, newname, args);
    });
  }

  applySettingsPatch(p) {
    const settings = this.getSettings();
    for (const name in p) {
      const value = p[name];
      if (value === null) settings[name] = undefined;
      else settings[name] = value;
    }
    this.setSettings(settings);
  }

  // Applies a patch to the project, optionally asks user for permission
  // or notifies user
  /* applyPatch(patch) {
    var _this = this;

    function applyPatch(confirmed) {
      // Apply the regular or dismiss patches depending on if the user confirmed or not
      var patches = confirmed ? patch.nodePatches : patch.dismissPatches;
      for (var i in patches) {
        var p = patches[i];
        var node = _this.findNodeWithId(p.nodeId);
        node && node.applyPatch(p);
      }

      if (patch.settingsPatch) _this.applySettingsPatch(patch.settingsPatch);
    }

    if (patch.notifyUser) {
      // Apply the patch but and notify the user
      applyPatch(true);
      WarningsModel.instance.setWarning(
        {
          key: 'patch-' + patch.key
        },
        {
          type: 'patch-notify',
          title: 'The project has been patched',
          message: patch.message,
          onPatch: function () {
            WarningsModel.instance.setWarning(
              {
                key: 'patch-' + patch.key
              },
              undefined
            );
            applyPatch(true);
          }
        }
      );
    } else if (patch.askPermission) {
      // Ask permission, if the user declines then the dismiss patches will be applied
      // instead
      WarningsModel.instance.setWarning(
        {
          key: 'patch-' + patch.key
        },
        {
          type: 'patch-confirm',
          title: 'The project has been patched',
          message: patch.message,
          onPatch: function () {
            WarningsModel.instance.setWarning(
              {
                key: 'patch-' + patch.key
              },
              undefined
            );
            applyPatch(true);
          },
          onDismiss: function () {
            WarningsModel.instance.setWarning(
              {
                key: 'patch-' + patch.key
              },
              undefined
            );
            applyPatch(false);
          }
        }
      );
    } else {
      // Simply apply the patches
      applyPatch(true);
    }
  }*/

  // Settings
  getSettings(): ProjectSettings {
    return this.settings ? this.settings : {};
  }

  setSettings(settings) {
    this.settings = settings;
    this.notifyListeners('settingsChanged');
  }

  setSetting(name, value) {
    // The constructor takes `args.settings` verbatim, so a project saved without
    // a settings block loads with `settings === undefined` — writing must heal that.
    if (!this.settings) {
      this.settings = {};
    }

    if (this.settings[name] === value) {
      return;
    }

    if (value === undefined) {
      delete this.settings[name];
    } else {
      this.settings[name] = value;
    }

    this.notifyListeners('settingsChanged');
  }

  /**
   * Select which runtime React pair this project gets (RUN-001). 'react19'
   * opts into the React 19 globals; undefined clears the marker so the project
   * returns to the default (React 18.3.1) pair. Persisted via the regular
   * autosave (the notify below reaches the global Model.* save listener).
   */
  setRuntimeVersion(version: 'react17' | 'react19' | undefined) {
    if (this.runtimeVersion === version) {
      return;
    }
    this.runtimeVersion = version;
    this.notifyListeners('runtimeVersionChanged', { version });
  }

  resolveColor(color: string) {
    const styles = this.getMetaData('styles');
    return styles && styles.colors && styles.colors[color] ? styles.colors[color] : color;
  }

  // Name
  rename(name) {
    this.name = name;
    this.notifyListeners('renamed', {
      oldName: name
    });
  }

  // Thumbnail URI
  getThumbnailURI() {
    return this.thumbnailURI;
  }

  setThumbnailFromDataURI(uri) {
    this.thumbnailURI = uri;
    this.notifyListeners('thumbnailChanged');
  }

  // Save to directory
  toDirectory(retainedProjectDirectory, callback) {
    // v2 decomposed format: write only the components (and project-level files)
    // that actually changed, atomically, via the ProjectStructure service. The
    // saver strips child node positions per-component itself, mirroring the
    // legacy path's stripNodeChildPositions.
    if (this._projectFormat === 'v2' && isV2FormatEnabled()) {
      projectStructureService
        .saveProject(retainedProjectDirectory, this.toJSON())
        .then((res) => {
          if (res.result === 'success') {
            callback && callback({ result: 'success' });
          } else {
            callback && callback({ result: 'failure', message: res.message || 'Error writing project files.' });
          }
        })
        .catch((err) => {
          callback &&
            callback({
              result: 'failure',
              message: err instanceof Error ? err.message : 'Error writing project files.'
            });
        });
      return;
    }

    // This function stores the project in project json
    // First it writes to a tmp file, make sure it is correctly written and then moves it to project.json
    // This is to avoid project files becomming corrupted in the case of a process exit
    const projectJson = this.toJSON();

    //optimize the file by removing child x,y since they're calculated from the root positions during layout
    //reduces the amount of differences between versions _alot_ as well
    stripNodeChildPositions(projectJson);

    const tmpProjectPath = retainedProjectDirectory + '/project-tmp.json';

    filesystem
      .writeJson(tmpProjectPath, projectJson)
      // Make sure tmp file was written correctly
      .then(() => verifyJsonFile(tmpProjectPath))
      .then((validJson) => {
        if (!validJson) {
          callback &&
            callback({
              result: 'failure',
              message: 'Error writing project file.'
            });
          filesystem.removeFile(tmpProjectPath);
          return;
        }

        // Move tmp file to project.json
        filesystem
          .renameFile(tmpProjectPath, retainedProjectDirectory + '/project.json')
          .then(() => {
            callback &&
              callback({
                result: 'success'
              });
          })
          .catch(() => {
            callback &&
              callback({
                result: 'failure',
                message: 'Error writing project file.'
              });
          });
      })
      .catch(() => {
        callback &&
          callback({
            result: 'failure',
            message: 'Error writing project file.'
          });
      });
  }

  /**
   * Reloads a single component from disk and swaps it into the project in place,
   * without disturbing other components' unsaved state.
   *
   * This is the surgical-reload seam for file-watch and future live-collab: when
   * a component's files change underneath us (a peer's edit synced in), call this
   * to refresh just that component. The ProjectStructure service updates its
   * save baseline for the component, so the next autosave neither clobbers nor
   * echoes the external change.
   *
   * v2 projects only; a no-op (resolves false) otherwise. Autosave is suspended
   * during the swap so the reload itself does not schedule a save-back.
   *
   * @param componentPath Registry path of the component (e.g. "Pages/Home").
   * @returns true if a component was reloaded and swapped in.
   */
  async reloadComponentFromDisk(componentPath: string): Promise<boolean> {
    if (this._projectFormat !== 'v2' || !this._retainedProjectDirectory) return false;

    const legacyComponent = await projectStructureService.reloadComponent(
      this._retainedProjectDirectory,
      componentPath
    );
    const newModel = ComponentModel.fromJSON(legacyComponent);
    const existing = this.getComponentWithName(legacyComponent.name);

    const wasSaving = saveOnModelChange;
    ProjectModel.setSaveOnModelChange(false);
    try {
      if (existing) this.removeComponent(existing);
      this.addComponent(newModel);
    } finally {
      ProjectModel.setSaveOnModelChange(wasSaving);
    }

    this.notifyListeners('componentReloadedFromDisk', { component: newModel });
    return true;
  }

  // ── v2 migration (SUB-003) ──────────────────────────────────────────────────
  //
  // The seam the migration wizard drives. `analyzeMigration` reports what a
  // migration would do (no writes); `migrateToV2` performs it safely — backup,
  // convert, verify, and roll back automatically on any failure. Both operate on
  // the currently-open project directory.

  /**
   * True when the open project is a legacy monolithic project that could be
   * migrated to the v2 decomposed format. Cheap; drives whether to offer migration.
   */
  canOfferMigration(): boolean {
    return this._projectFormat === 'legacy' && !!this._retainedProjectDirectory;
  }

  /** Pre-flight analysis of the open project (no writes). */
  async analyzeMigration(): Promise<PreflightReport | undefined> {
    if (!this._retainedProjectDirectory) return undefined;
    return projectMigrator.analyze(this._retainedProjectDirectory);
  }

  /**
   * Migrates the open project to the v2 format. Safe and reversible: a full
   * backup is taken first, the result is verified against the in-memory project,
   * and any failure rolls back to the backup. Returns a structured result rather
   * than throwing.
   */
  async migrateToV2(): Promise<MigrationResult> {
    if (!this._retainedProjectDirectory) {
      return { result: 'failure', message: 'No project directory is open.' };
    }
    const result = await projectMigrator.migrate(this._retainedProjectDirectory);
    if (result.result === 'success') {
      this._projectFormat = 'v2';
      this.notifyListeners('projectMigratedToV2', { backupPath: result.backupPath });
    }
    return result;
  }

  // Project lessons
  isLesson() {
    return this.lesson !== undefined;
  }

  getLessonModel() {
    return this.lesson;
  }

  // Copy to folder
  copyFileToProjectDirectory(file, callback) {
    if (this._retainedProjectDirectory === undefined) return;

    const target = this._retainedProjectDirectory + '/' + file.name;
    filesystem
      .makeDirectory(filesystem.dirname(target))
      .then(() => {
        filesystem
          .copyFile(file.fullPath, target)
          .then(() => {
            callback &&
              callback({
                result: 'success'
              }); // Write ended with success
          })
          .catch(() => {
            callback &&
              callback({
                result: 'failure',
                message: 'Error copying file to project directory.'
              });
          });
      })
      .catch(() => {
        callback &&
          callback({
            result: 'failure',
            message: 'Error copying file to project directory.'
          });
      });
  }

  // For each file in folder
  /*  ProjectModel.prototype._forEachFileInDirectory = function(dirEntry,callback,types) {
    var _this = this;

    var reader = dirEntry.createReader();
    reader.readEntries(function(results) {
      for(var i in results) {
        var fileEntry = results[i];

        if(fileEntry.isDirectory) {
          // Recurse into directory
          _this._forEachFileInDirectory(fileEntry,callback,types);
        }
        else {
          // Check the file ending then return the entry
          var parts = fileEntry.name.split('.');
          if(parts.length>0&&(types===undefined||types.indexOf(parts[parts.length-1].toLowerCase())!==-1)) {
            callback&&callback(fileEntry);
          }
        }
      }

    },function() {
      callback&&callback({result:'failure',message:'Failed to read project directory'});
    });
  }

  ProjectModel.prototype.forEachFileInProjectDirectory = function(callback,types) {
    var _this = this;

    if(this._retainedProjectDirectory === undefined) return;

    FileSystem.instance.restoreEntry(this._retainedProjectDirectory,function(projectDirectoryEntry) {
      _this._forEachFileInDirectory(projectDirectoryEntry,callback,types);
    });
  }*/

  _listFilesInDirectory(dirEntry, callback, args, _files?: TSFixme) {
    const _this = this;
    let files = _files ? _files : [];

    filesystem
      .listDirectory(dirEntry)
      .then((results) => {
        let dirs = 0;
        for (const i in results) {
          const fileEntry = results[i];
          if (args && args.ignoreFullPath && args.ignoreFullPath.indexOf(fileEntry.fullPath) !== -1) continue; // Ignore files if specifed

          if (fileEntry.isDirectory) {
            // Recurse into directory
            dirs++;
            _this._listFilesInDirectory(
              fileEntry.fullPath,
              function (directoryFiles) {
                if (directoryFiles) files = files.concat(directoryFiles);

                dirs--;
                if (dirs === 0) callback(files);
              },
              args
            );
          } else {
            // Check the file ending then return the entry
            const parts = fileEntry.name.split('.');
            if (
              parts.length > 0 &&
              (args === undefined ||
                args.types === undefined ||
                args.types.indexOf(parts[parts.length - 1].toLowerCase()) !== -1)
            ) {
              files.push(fileEntry);
            }
          }
        }
        if (dirs === 0) callback(files);
      })
      .catch(() => callback());
  }

  listFilesInProjectDirectory(callback, types?: TSFixme, ignoreFullPath?: TSFixme) {
    const _this = this;

    if (this._retainedProjectDirectory === undefined) return;

    _this._listFilesInDirectory(this._retainedProjectDirectory, callback, {
      types,
      ignoreFullPath
    });
  }

  listModules(callback: (modules?: ProjectModuleManifest[]) => void) {
    listProjectModules(this)
      .then(callback)
      .catch((error) => {
        console.error(error);
        callback();
      });
  }

  /** Installed icon sets, normalised — NDA-007 §2. See `shared/utils/iconsets`. */
  listIconSets(callback: (sets: IconSetDescriptor[]) => void) {
    listProjectIconSets(this)
      .then(callback)
      .catch((error) => {
        console.error(error);
        callback([]);
      });
  }

  readModules(callback: (modules?: ProjectModule[]) => void) {
    readProjectModules(this)
      .then(callback)
      .catch((error) => {
        console.error(error);
        callback();
      });
  }

  getModuleAnnotationsForComponentWithName(name) {
    if (!this.componentAnnotations) return;
    return this.componentAnnotations[name];
  }

  /** TODO: Delete me? */
  getModulePreviews() {
    return this.previews && this.previews.length > 0 ? this.previews : undefined;
  }

  deleteComponentAllowed(component: ComponentModel): { canBeDelete: boolean; reason?: string } {
    const annotationDoesntAllow =
      this.componentAnnotations &&
      this.componentAnnotations[component.fullName] &&
      this.componentAnnotations[component.fullName].deleteAllowed === false;

    if (annotationDoesntAllow) {
      return {
        canBeDelete: false,
        reason: "This component can't be deleted"
      };
    }

    const isRootComponent = this.getRootComponent() === component;

    if (isRootComponent) {
      return {
        canBeDelete: false,
        reason: "Home component can't be deleted"
      };
    }

    return {
      canBeDelete: true
    };
  }

  renameComponentAllowed(name) {
    if (
      this.componentAnnotations &&
      this.componentAnnotations[name] &&
      this.componentAnnotations[name].renameAllowed === false
    ) {
      return false;
    }
    return true;
  }

  isComponentHidden(name) {
    if (
      this.componentAnnotations &&
      this.componentAnnotations[name] &&
      this.componentAnnotations[name].hidden === true
    ) {
      return true;
    }
    return false;
  }

  setMetaData(key: string, data) {
    if (!this.metadata) this.metadata = {};

    this.metadata[key] = data;

    EventDispatcher.instance.notifyListeners('ProjectModel.metadataChanged', {
      key,
      data
    });

    // F44: `metadata` is serialised by `toJSON`, but this event is dispatched
    // under the `ProjectModel.` namespace and so never reaches the `Model.*`
    // autosave listener. Arm the save here rather than renaming the event —
    // `Model.metadataChanged` is already taken by `ComponentModel.setMetaData`
    // and forwarded to the viewer, and this is a *project* change.
    scheduleProjectSave();
  }

  getMetaData(key: string) {
    if (!this.metadata) this.metadata = {};

    return this.metadata[key];
  }

  mergeMetadata(newData) {
    if (!this.metadata) this.metadata = {};

    const merge = (target, source) => {
      // Iterate through `source` properties and if an `Object` set property to merge of `target` and `source` properties
      for (const key of Object.keys(source)) {
        if (source[key] instanceof Object && key in target) Object.assign(source[key], merge(target[key], source[key]));
      }

      // Join `target` and modified `source`
      Object.assign(target || {}, source);
      return target;
    };

    merge(this.metadata, newData);

    for (const key in newData) {
      EventDispatcher.instance.notifyListeners('ProjectModel.metadataChanged', {
        key,
        data: this.metadata[key]
      });
    }

    // F44: same gap as `setMetaData` — see the note there.
    scheduleProjectSave();
  }

  // App Configuration Methods
  /**
   * Gets the app configuration from project metadata.
   * @returns The app config object
   */
  getAppConfig() {
    // Import types dynamically to avoid circular dependencies
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { DEFAULT_APP_CONFIG } = require('@noodl/runtime/src/config/types');
    return this.getMetaData('appConfig') || DEFAULT_APP_CONFIG;
  }

  /**
   * Sets the app configuration in project metadata.
   * @param config - The app config to save
   */
  setAppConfig(config) {
    this.setMetaData('appConfig', config);
  }

  /**
   * Updates the app configuration with partial values.
   * @param updates - Partial app config updates
   */
  updateAppConfig(updates) {
    const current = this.getAppConfig();
    this.setAppConfig({
      ...current,
      ...updates,
      identity: {
        ...current.identity,
        ...(updates.identity || {})
      },
      seo: {
        ...current.seo,
        ...(updates.seo || {})
      },
      pwa: updates.pwa ? { ...current.pwa, ...updates.pwa } : current.pwa
    });
  }

  /**
   * Gets all config variables.
   * @returns Array of config variables
   */
  getConfigVariables() {
    return this.getAppConfig().variables || [];
  }

  /**
   * Sets or updates a config variable.
   * @param variable - The config variable to set
   */
  setConfigVariable(variable) {
    const config = this.getAppConfig();
    const index = config.variables.findIndex((v) => v.key === variable.key);

    if (index >= 0) {
      config.variables[index] = variable;
    } else {
      config.variables.push(variable);
    }

    this.setAppConfig(config);
  }

  /**
   * Removes a config variable by key.
   * @param key - The variable key to remove
   */
  removeConfigVariable(key: string) {
    const config = this.getAppConfig();
    config.variables = config.variables.filter((v) => v.key !== key);
    this.setAppConfig(config);
  }

  createNewVariant(name, node) {
    let variant = this.variants.find((v) => v.name === name && v.typename === node.type.localName);

    if (variant !== undefined) return; // Variant already exists

    variant = new VariantModel({
      name: name,
      typename: node.type.localName
    });

    if (node.variant !== undefined) {
      // Node has a variant already, copy params
      variant.updateFromVariant(node.variant);
    }

    variant.updateFromNode(node);
    this.variants.push(variant);
    this.notifyListeners('variantCreated', {
      variant: variant
    });

    return variant;
  }

  updateVariant(name, node) {
    const variant = this.variants.find((v) => v.name === name && v.typename === node.type.localName);

    if (variant === undefined) return false; // Variant does not exist

    variant.updateFromNode(node);
    this.notifyListeners('variantUpdated', {
      variant: variant
    });

    return variant;
  }

  isVariantUsed(variant) {
    let isUsed = false;
    this.forEachComponent((c) => {
      c.forEachNode((n) => {
        if (n.variant === variant) isUsed = true;
      });
    });
    return isUsed;
  }

  addVariant(variant, args?: TSFixme) {
    const _v = this.variants.find((v) => v.name === variant.name && v.typename === variant.typename);
    if (_v !== undefined) return false; // Variant already exists

    this.variants.push(variant);
    this.notifyListeners('variantAdded', {
      variant: variant
    });

    // Undo
    if (args && args.undo) {
      const undo = typeof args.undo === 'object' ? args.undo : UndoQueue.instance;

      undo.push({
        label: 'add variant',
        do: () => {
          this.addVariant(variant);
        },
        undo: () => {
          const idx = this.variants.indexOf(variant);
          this.variants.splice(idx, 1);
          this.notifyListeners('variantDeleted', {
            variant: variant
          });
        }
      });
    }

    return true;
  }

  deleteVariant(variant, args?: TSFixme) {
    const variantIdx = this.variants.findIndex((v) => v === variant);
    if (variantIdx !== -1) {
      this.variants.splice(variantIdx, 1);
      this.notifyListeners('variantDeleted', {
        variant: variant
      });

      // Undo
      if (args && args.undo) {
        const undo = typeof args.undo === 'object' ? args.undo : UndoQueue.instance;

        undo.push({
          label: 'rename variant',
          do: () => {
            this.deleteVariant(variant);
          },
          undo: () => {
            this.variants.push(variant);
            this.notifyListeners('variantCreated', {
              variant: variant
            });
          }
        });
      }
    }
  }

  renameVariant(variant, newName, args?: TSFixme) {
    const oldName = variant.name;
    variant.name = newName;

    this.notifyListeners('variantRenamed', {
      variant: variant,
      oldName: oldName
    });

    // Undo
    if (args && args.undo) {
      const undo = typeof args.undo === 'object' ? args.undo : UndoQueue.instance;

      undo.push({
        label: 'rename variant',
        do: () => {
          this.renameVariant(variant, newName);
        },
        undo: () => {
          this.renameVariant(variant, oldName);
        }
      });
    }
  }

  findVariant(name, nodetype) {
    return this.variants.find((v) => v.name === name && v.typename === nodetype.localName);
  }

  findVariantsForNodeType(nodetype) {
    return this.variants.filter((v) => v.typename === nodetype.localName && v.name !== undefined);
  }

  getAllVariants() {
    return this.variants;
  }

  scheduleEvaluateHealth() {
    const _this = this;

    if (this.evaluatehealthScheduled) return;
    this.evaluatehealthScheduled = true;

    setTimeout(function () {
      _this.evaluatehealthScheduled && _this.evaluateHealth();
      _this.evaluatehealthScheduled = false;
    }, 2000);
  }

  evaluateHealth() {
    if (!NodeLibrary.instance.isLoaded()) return;
    if (this !== ProjectModel.instance) return; // Only evaluate health for main project

    //  if (!NodeLibrary.instance.isModuleRegistered(this)) return; // This module is not registered in the node library, no need to eval health
    if (this.variants !== undefined) this.variants.forEach((v) => v.evaluateHealth());

    //Check for duplicate IDs
    //Note: can happen in older projects where a component might be missing an id and it's renamed and later merged with version control
    const allNodesIds = new Set<string>();
    const duplicates: [ComponentModel, NodeGraphNode][] = [];

    for (const component of this.getComponents()) {
      component.forEachNode((node) => {
        if (allNodesIds.has(node.id)) {
          duplicates.push([component, node]);
        } else {
          allNodesIds.add(node.id);
        }
      });
    }

    if (duplicates.length) {
      console.group(
        'WARNING: The project has nodes that share the same ID, which will cause severe issues. Duplicates:'
      );
      for (const [component, node] of duplicates) {
        console.log(`Node Id: ${node.id}. Component: ${component.fullName}`);
      }
      console.groupEnd();
    }
  }

  // to - from JSON
  toJSON() {
    const json = {
      name: this.name,
      components: [],
      settings: this.settings,
      rootNodeId: this.rootNode ? this.rootNode.id : undefined,
      // thumbnailURI:this.thumbnailURI,
      version: this.version,
      runtimeVersion: this.runtimeVersion,
      lesson: this.lesson ? this.lesson.toJSON() : undefined,
      metadata: this.metadata,
      variants: this.variants.map((v) => v.toJSON())
      //   deviceSettings:this.deviceSettings,
    };
    for (const i in this.components) {
      json.components.push(this.components[i].toJSON());
    }

    //sort so the git diff is as small as possible (sometimes components get re-arranged in the array)
    json.components.sort((a, b) => a.name.localeCompare(b.name));

    return json;
  }
}

// Watch if the project root is removed
EventDispatcher.instance.on(
  'Model.nodeRemoved',
  function (e) {
    if (ProjectModel.instance && ProjectModel.instance.getRootNode() === e.args.model) {
      ProjectModel.instance.setRootNode(undefined);
    }
  },
  null
);

function stripNodeChildPositions(json) {
  function recurse(node) {
    if (!node.children) return;

    for (const child of node.children) {
      delete child.x;
      delete child.y;

      recurse(child);
    }
  }

  if (!json) return;

  json.components &&
    json.components.forEach((comp) => {
      comp.graph &&
        comp.graph.roots &&
        comp.graph.roots.forEach((root) => {
          recurse(root);
        });
    });
}

// Project saver, saves current project when a change to a model occurs
let saveOnModelChange = true;
let saveTimeout;

/**
 * True from the moment an edit arms the debounce until that edit has actually
 * reached disk. It is what `flushPendingProjectSave()` reads to decide whether
 * there is anything to drain, and it deliberately outlives `saveTimeout` — the
 * timer having fired is not the same as the write having landed, and
 * `setSaveOnModelChange(false)` clears the timer without the edit being written.
 */
let savePending = false;
/**
 * The events that mean *the project's serialised content changed*.
 *
 * This was a 22-name **denylist**, and the design was the bug. Every `Model.*`
 * event raised anywhere in the app armed a project save unless someone had
 * previously noticed that particular event and excluded it — so each new event
 * type in any model silently became a save trigger. There are 116 distinct
 * `Model.*` events in the editor, which left ~94 of them writing `project.json`.
 * Measured on a cold start with zero user input: **two complete project writes in
 * twenty seconds**, none of them caused by a change to project content.
 * `Model.templatesChanged` is the launcher's *lesson template list* loading;
 * `Model.viewerClientsChanged` means a preview client connected. Neither has
 * anything to do with the project, and both wrote it to disk.
 *
 * Adding those two names to the denylist would have fixed the symptom and kept
 * the design. So the list is inverted: an event has to be *named here* to reach
 * disk, and the membership rule is `ProjectModel.toJSON()` — `name`,
 * `components[]`, `settings`, `rootNodeId`, `runtimeVersion`, `lesson`,
 * `metadata`, `variants[]`. Anything a save would not write is not here.
 *
 * `metadata` needs no entry: `setMetaData` calls `scheduleProjectSave()` itself,
 * which is what covers app config, styles and style tokens.
 *
 * Notable *exclusions*, each previously a trigger: `thumbnailChanged` (the
 * thumbnail is commented out of `toJSON`), `folderCreated`/`folderRenamed`/
 * `folderDeleted`/`folderReordered` (launcher folders, persisted to the
 * launcher's own store), `dirtyChanged`/`stepChanged`/`triggersChanged`/
 * `entryChanged` (workflow documents, which live in a backend's data directory),
 * `tokensChanged` (reaches disk via `setMetaData`), and `instancePortsChanged`
 * (derived from parameters, which are themselves a trigger).
 */
const projectSaveTriggers = new Set(
  [
    /**
     * `Model.prototype.set` — the base-class assign-and-notify. This is how
     * **dragging a node** persists: `commitMoveNode` does `node.model.set({x, y})`.
     * It is also the reason the ownership gate below is not optional. `set` is on
     * every Model in the app, so allowing this name alone would re-admit most of
     * what the denylist let through.
     */
    'change',

    // ProjectModel — the project's own shape.
    'renamed',
    'settingsChanged',
    'runtimeVersionChanged',
    'rootNodeChanged',
    'componentAdded',
    'componentRemoved',
    'componentRenamed',
    'componentDuplicated',
    'cloudServicesChanged',
    'projectMigratedToV2',
    'variantAdded',
    'variantCreated',
    'variantUpdated',
    'variantDeleted',
    'variantRenamed',

    // ComponentModel.
    'metadataChanged',
    /**
     * Binding a graph onto a component. Two callers reach this with a project
     * component: the load path — already silent, `projectFromDirectory` holds
     * `Model._listenersEnabled = false` across `fromJSON` — and version
     * control's "reset component to a previous version", which replaces the
     * graph wholesale and is a genuine edit that must reach disk. The third
     * caller is `WorkflowComponentModel`, and the ownership gate is what
     * separates it.
     */
    'graphModelBound',

    // NodeGraphModel — nodes, wires, and parent/child.
    'nodeAdded',
    'nodeRemoved',
    'nodeAttached',
    'nodeDetached',
    'connectionAdded',
    'connectionRemoved',
    /** A wire's own fields — its label and where that label sits (CAN-001/002). */
    'connectionUpdated',
    'connectionPortChanged',
    'nodePortRenamed',
    'nodePortRearranged',

    // NodeGraphNode — parameters, label, variant, states, ports.
    'parametersChanged',
    'labelChanged',
    'variantChanged',
    'stateTransitionsChanged',
    'defaultStateTransitionChanged',
    'commentChanged',
    'portAdded',
    'portRemoved',
    'portRenamed',
    'portRearranged',
    'modelParameterUndo',
    'modelParameterRedo',

    // VariantModel — variants serialise into the project.
    'variantParametersChanged',
    'variantStateTransitionsChanged',
    'variantDefaultStateTransitionChanged',

    // CommentsModel.
    'commentAdded',
    'commentsChanged',

    /**
     * StylesModel. Redundant in principle — `store()` goes through `setMetaData`,
     * which schedules a save directly — and named anyway, so that a style edit
     * does not depend on that one call staying where it is.
     */
    'stylesChanged',
    'styleChanged',
    'styleRenamed'
  ].map((event) => 'Model.' + event)
);

/** node → graph → component → project is three; the rest is headroom. */
const MAX_OWNER_HOPS = 6;

/**
 * Whether the model that raised an event is part of the project we would save.
 *
 * The allowlist cannot answer this on its own, because the same event names are
 * raised by graphs that are **not in the project at all**.
 * `WorkflowComponentModel extends ComponentModel`, so opening a workflow tab runs
 * `ComponentModel`'s constructor — `bindGraph`, then a `nodeAdded` per step and a
 * `connectionAdded` per wire, then `graphModelBound`. Every one of those armed a
 * full `project.json` write for a document that lives in a backend's data
 * directory. That burst, arriving straight after the node library, is what the
 * cold-start measurement caught and attributed to load-time reconstruction; the
 * project's own load is in fact already silent, because `projectFromDirectory`
 * holds `Model._listenersEnabled = false` across `fromJSON`.
 *
 * So the discriminator is structural rather than a load/edit state flag: walk the
 * `owner` chain and require it to reach `ProjectModel.instance`. A flag has to be
 * set and cleared correctly by every future caller; ownership is already true or
 * false at the moment the event fires.
 *
 * Applied **only** to the three classes whose chain is known to terminate at the
 * project (`ComponentModel` → `NodeGraphModel` → `NodeGraphNode`). `VariantModel`,
 * `StylesModel` and `CommentsModel` have no `owner` at all, so judging them this
 * way would read "unowned" as "foreign" and quietly stop saving. Everything else
 * is left to the allowlist — the bias throughout is that a redundant write is
 * cheap and a dropped edit is not.
 */
function emitterIsForeignToProject(emitter: unknown): boolean {
  const project: unknown = ProjectModel.instance;
  if (!project || !emitter) return false; // Cannot tell — let the save through.

  const isGraphTreeModel =
    emitter instanceof ComponentModel || emitter instanceof NodeGraphModel || emitter instanceof NodeGraphNode;
  if (!isGraphTreeModel) return false;

  let current: unknown = emitter;
  for (let hops = 0; current && hops <= MAX_OWNER_HOPS; hops++) {
    if (current === project) return false;
    current = (current as { owner?: unknown }).owner;
  }

  return true;
}
/**
 * F44: the one place that arms the autosave.
 *
 * It used to be inlined in the `Model.*` listener below, which meant the *only*
 * way to get a project written to disk was to emit an event through
 * `Model.notifyListeners` — `EventDispatcher`'s wildcard match requires the
 * first dot-component to be identical, so anything dispatched under another
 * namespace was silently unsaved. `setMetaData` dispatches
 * `ProjectModel.metadataChanged`, so every write to `metadata` (the app config:
 * app name, description, SEO, PWA, config variables) mutated memory and
 * scheduled nothing. It reached `project.json` only when some *other* change
 * fired a real `Model.*` event and `toJSON()` swept the pending metadata along
 * with it — which is why the app name appeared to lag exactly one edit behind.
 */
function scheduleProjectSave() {
  if (!saveOnModelChange) return;

  savePending = true;
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveProject, 1000);
}

EventDispatcher.instance.on(
  'Model.*',
  function (event, eventName) {
    if (!projectSaveTriggers.has(eventName)) return;

    // `Model.notifyListeners` dispatches `{ model: <emitter>, args }`, so the
    // model that raised the event is available here without any extra plumbing.
    if (emitterIsForeignToProject(event?.model)) return;

    scheduleProjectSave();
  },
  null
);

type SaveOutcome =
  /** Written to the project directory. The only case that emits `projectSavedToDisk`. */
  | { status: 'saved' }
  /** Nothing to write, or written somewhere that is not the project directory. */
  | { status: 'skipped' }
  | { status: 'failed'; message: string };

/**
 * Serialises writes. `toDirectory` is async and there are now two callers —
 * the debounced timer and `flushPendingProjectSave()` — so a flush can arrive
 * while a save is already mid-write. Two concurrent directory writes of the
 * same project can interleave, so each write waits for the previous one to
 * settle (hence `onSettled` on both arms) before starting.
 */
let saveChain: Promise<SaveOutcome> = Promise.resolve({ status: 'skipped' });

function writeProjectToDisk(): Promise<SaveOutcome> {
  const onSettled = () => doWriteProjectToDisk();
  const next = saveChain.then(onSettled, onSettled);
  saveChain = next;
  return next;
}

function doWriteProjectToDisk(): Promise<SaveOutcome> {
  return new Promise<SaveOutcome>((resolve) => {
    const project = ProjectModel.instance;
    if (!project) return resolve({ status: 'skipped' });

    // CRITICAL: Do not save read-only projects (e.g., legacy projects opened for inspection)
    if (project._isReadOnly) {
      console.log('⚠️  Skipping auto-save: Project is in read-only mode');
      return resolve({ status: 'skipped' });
    }

    if (!project._retainedProjectDirectory) {
      // The project is not loaded from a directory, store to local store
      localStorage['project'] = JSON.stringify(project.toJSON(), null, 3);
      console.log('Project stored to local storage ' + new Date());
      return resolve({ status: 'skipped' });
    }

    // Project is loaded from directory, save it
    project.toDirectory(project._retainedProjectDirectory, function (r) {
      resolve(r.result === 'success' ? { status: 'saved' } : { status: 'failed', message: r.message });
    });
  });
}

function saveProject() {
  writeProjectToDisk().then((outcome) => {
    if (outcome.status === 'failed') {
      console.log(outcome.message);
      //retry in 3 seconds — `savePending` stays true, so a quit in the meantime
      //still flushes rather than dropping the edit on the floor.
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(saveProject, 3000);
      EventDispatcher.instance.emit('ProjectModel.saveFailedRetryScheduled');
      return;
    }

    savePending = false;

    if (outcome.status === 'saved') {
      console.log('Project saved ' + new Date()); // Project is saved to disk, start the watch timer
      EventDispatcher.instance.emit('ProjectModel.projectSavedToDisk');
      //startWatchTimeOut();
    }
  });
}

/**
 * Write any pending edit *now* and resolve once it has landed.
 *
 * `scheduleProjectSave()` debounces by a second, and until this existed nothing
 * ever asked the renderer to drain that timer before the app went away:
 * `app.on('before-quit')` awaited `backendManager.stopAll()` and nothing else,
 * so an edit followed by ⌘Q inside the debounce reached memory, never disk, and
 * failed silently. Two callers wire it up in `src/editor/index.ts` — the main
 * process's quit handshake, and window `blur`.
 *
 * It resolves rather than rejects when the write fails. Both callers are on
 * their way out, a retry timer would never get to run, and a rejection would
 * only risk wedging the quit it was added to protect — so a failure is logged
 * as loudly as this layer can and `savePending` is left set.
 */
export function flushPendingProjectSave(): Promise<void> {
  if (!savePending) return Promise.resolve();

  clearTimeout(saveTimeout);

  return writeProjectToDisk().then((outcome) => {
    if (outcome.status === 'failed') {
      console.error('Project save FAILED while flushing before exit — changes may be lost: ' + outcome.message);
      return;
    }

    savePending = false;

    if (outcome.status === 'saved') {
      console.log('Pending project save flushed to disk ' + new Date());
      EventDispatcher.instance.emit('ProjectModel.projectSavedToDisk');
    }
  });
}
