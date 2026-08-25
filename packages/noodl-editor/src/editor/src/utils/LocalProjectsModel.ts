import { GitStore } from '@noodl-store/GitStore';
import Store from 'electron-store';
import { isEqual } from 'underscore';
import { getTopLevelWorkingDirectory } from '@noodl/git/src/core/open';
import { setRequestGitAccount } from '@noodl/git/src/core/trampoline/trampoline-askpass-handler';
import { filesystem, platform } from '@noodl/platform';

import { ProjectModel } from '@noodl-models/projectmodel';
import { templateRegistry } from '@noodl-utils/forge';

import Model from '../../../shared/model';
import { detectRuntimeVersion } from '../models/migration/ProjectScanner';
import { RuntimeVersionInfo } from '../models/migration/types';
import { projectFromDirectory, unzipIntoDirectory } from '../models/projectmodel.editor';
import { backfillProjectAgentConfig, installProjectAgentConfig } from '../models/template/installAgentConfig';
import { createProjectFromTemplate } from '../models/template/createFromTemplate';
import { installStarterAssets } from '../models/template/starterAssets';
import { GitHubOAuthService } from '../services/GitHubOAuthService';
import { isV2FormatEnabled } from '../services/ProjectStructure/featureFlags';
import { tracker } from './tracker';
import { guid } from './utils';

export interface ProjectItem {
  id: string;
  name: string;
  latestAccessed: number;
  thumbURI: string;
  retainedProjectDirectory: string;
}

/**
 * Extended project item with runtime version info (not persisted)
 */
export interface ProjectItemWithRuntime extends ProjectItem {
  runtimeInfo?: RuntimeVersionInfo;
  runtimeDetectionPending?: boolean;
}
export class LocalProjectsModel extends Model {
  public static instance = new LocalProjectsModel();

  projectEntries: ProjectItem[] = [];

  private recentProjectsStore = new Store({
    name: 'recently_opened_project'
  });

  /**
   * Persistent store for runtime version cache
   * Survives app restarts to avoid re-detecting runtime on every launch
   */
  private runtimeCacheStore = new Store({
    name: 'project_runtime_cache'
  });

  /**
   * Cache for runtime version info - keyed by project directory path
   * Loaded from persistent store on init, saved on updates
   */
  private runtimeInfoCache: Map<string, RuntimeVersionInfo> = new Map();

  /**
   * Set of project directories currently being detected
   */
  private detectingProjects: Set<string> = new Set();

  async fetch() {
    // Load runtime cache from persistent store
    this.loadRuntimeCache();

    // Fetch projects from local storage and verify project folders
    const folders = (this.recentProjectsStore.get('recentProjects') || []) as ProjectItem[];

    const existingFolders = folders.filter((x) => filesystem.exists(x.retainedProjectDirectory));

    existingFolders.sort((a, b) => b.latestAccessed - a.latestAccessed);

    if (!this.projectEntries || (this.projectEntries && !isEqual(this.projectEntries, existingFolders))) {
      this.projectEntries = existingFolders;
      this.store();

      this.notifyListeners('myProjectsChanged');
    }
  }

  // Store model to local storage
  store() {
    if (!this.projectEntries) return; // Don't store if projects are not loaded
    this.recentProjectsStore.set('recentProjects', this.projectEntries);
  }

  containsProjectWithId(id) {
    return !!this.projectEntries.find((p) => p.id === id);
  }

  // Get all project directories, sorted
  getProjects() {
    return this.projectEntries;
  }

  getProjectEntryWithId(id: string): ProjectItem {
    return this.projectEntries.find((p) => p.id === id);
  }

  // Update latests accessed time for project
  touchProject(projectEntry: ProjectItem) {
    projectEntry.latestAccessed = Date.now();
    this.store();
    this.notifyListeners('myProjectsChanged');
  }

  // Load a project
  loadProject(projectEntry: ProjectItem) {
    tracker.track('Load Local Project');

    return new Promise<ProjectModel>((resolve) => {
      projectFromDirectory(projectEntry.retainedProjectDirectory, (project) => {
        if (!project) {
          resolve(null);
          return;
        }
        project.id = projectEntry.id; // Assign the project the id stored in the project dir entry
        project.name = projectEntry.name; // Also assign the name
        this.touchProject(projectEntry);
        this.bindProject(project);

        // Initialize Git authentication for this project
        this.setCurrentGlobalGitAuth(projectEntry.id);

        resolve(project);
      });
    });
  }

  // Bind to a loaded project, update model when renamed of when the thumbnail is updated
  bindProject(project: ProjectModel) {
    // FIX-008 B — the one seam every open route crosses. `loadProject` (the launcher rows, the
    // recents list, a freshly cloned repo) and `_addProject` (a new project, an unzipped one, a
    // folder opened from disk) both land here, and so does EditorPage's reload — which is why the
    // backfill sits on this method rather than on any of them. Deliberately not awaited: opening a
    // project must not wait on a filesystem write it does not need.
    void this.backfillAgentConfigFor(project);

    project
      .off(this)
      .on(
        'renamed',
        () => {
          const projectdir = this.getProjectEntryWithId(project.id);

          if (projectdir) {
            this.renameProject(project.id, project.name ? project.name : 'Untitled');
            project._retainedProjectDirectory = projectdir.retainedProjectDirectory;
          }
        },
        this
      )
      .on(
        'thumbnailChanged',
        () => {
          const projectdir = this.getProjectEntryWithId(project.id);
          if (projectdir) projectdir.thumbURI = project.getThumbnailURI();
          this.store();
        },
        this
      );
  }

  renameProject(id: string, name: string) {
    const projectEntry = this.getProjectEntryWithId(id);
    if (!projectEntry) return;

    projectEntry.name = name;
    this.store();
    this.notifyListeners('myProjectsChanged');
  }

  // Create a new project dir entry
  _addProject(project: ProjectModel) {
    if (!project._retainedProjectDirectory) return;

    // Push directory entry
    const id = guid();
    this.projectEntries.push({
      retainedProjectDirectory: project._retainedProjectDirectory,
      latestAccessed: Date.now(),
      id: id, // Generate a new project id (will be used internally to store project specific local settings)
      name: project.name ? project.name : 'Untitled',
      thumbURI: project.getThumbnailURI()
    });
    project.id = id;

    // Store the project model
    this.bindProject(project);

    this.store();
    this.notifyListeners('myProjectsChanged');
  }

  removeProject(projectId: string) {
    const idx = this.projectEntries.findIndex((p) => p.id === projectId);
    if (idx !== -1) {
      this.projectEntries.splice(idx, 1);
      this.store();
      this.notifyListeners('myProjectsChanged');
    }
  }

  // Given a path to the project zip file locally, unzip it and launch the
  // editor
  _unzipAndLaunchProject(path, dirEntry, fn, options) {
    unzipIntoDirectory(
      path,
      dirEntry,
      (r) => {
        if (r.result !== 'success') {
          fn(r);
          return;
        }

        // Project successfully created
        r.project.name = options.name || 'Untitled';
        this._addProject(r.project);
        fn(r.project);
      },
      { noAuth: true }
    );
  }

  /**
   * BST-005 — the two files that tell the *next* agent what this folder is.
   *
   * ⚠️ **After the template and never overwriting**, exactly like
   * `installStarterAssets` beside it: a downloaded template that ships its own
   * `CLAUDE.md` keeps it, and a template's `.gitignore` is appended to rather
   * than replaced. Called from both branches because a project made from a
   * template and one made from the embedded default must carry the same files —
   * otherwise "why doesn't my agent know about this project?" answers "depends
   * how you made it", which the user can neither check nor fix.
   *
   * Never fatal: it reports instead of throwing. The user asked for a project,
   * and a project whose agent configuration could not be written is still one.
   */
  private async writeAgentConfigFor(projectDirectory: string, projectName: string) {
    const report = await installProjectAgentConfig({ projectDirectory, projectName });
    for (const file of report.files) {
      if (file.outcome === 'skipped') console.warn(`Agent configuration: ${file.path} — ${file.reason}`);
    }
  }

  /**
   * FIX-008 B — give a project that already existed the same two files a new one gets.
   *
   * 🔴 **This writes into a folder the user merely opened**, which reverses BST-005's deliberate
   * create-only posture (ruled 2026-08-14). The case for it is the measurement: 43 of 44 projects on
   * the reporter's disk had no `.mcp.json`, so every one of them opened in Claude Code showing only
   * the user-scope servers — including one hard-wired to somebody else's project, which is the
   * "bound to a different project" half of report 5. Both files are machine-local and git-ignored,
   * and neither is ever overwritten.
   *
   * ⚠️ **It can modify a tracked `.gitignore`.** Writing `.mcp.json` adds an ignore line for it,
   * because a committed `.mcp.json` points a teammate's agent at absolute paths on *this* machine.
   * That is a real diff appearing in a repo the user did not edit — accepted knowingly: the
   * alternative is a machine-specific file that gets committed.
   *
   * Never awaited and never fatal. A project whose agent configuration could not be written is
   * still a project, so this reports to the console and gets out of the way.
   */
  private async backfillAgentConfigFor(project: ProjectModel) {
    try {
      const projectDirectory = project._retainedProjectDirectory;
      if (!projectDirectory) return;

      const report = await backfillProjectAgentConfig({
        projectDirectory,
        projectName: project.name || 'Untitled'
      });

      // Only the write is worth a line. A `kept-existing` on every open would be noise, and a
      // `skipped` for a legacy project is the expected answer rather than a problem.
      if (report.written.length) {
        console.log(`Agent configuration written for this project: ${report.written.join(', ')}`);
      }
    } catch (err) {
      console.warn('Could not backfill the project’s agent configuration', err);
    }
  }

  /**
   * Create a new project on disk from a template and load it.
   *
   * 🔴 **Every new project comes from a template** — there is no "blank project" path and
   * never was. Until FB-005 T1 this method had two branches that both claimed to be one:
   * an `if (projectTemplate)` branch that went through `templateRegistry`, and an `else`
   * that constructed `new EmbeddedTemplateProvider()` directly and bypassed it. The one
   * caller passes `projectTemplate: ''`, so the registry branch never executed — which is
   * why four registered template providers were green, typechecked, and reached by nobody.
   * `resolveTemplateUrl` now turns "unspecified" into the default and there is one branch.
   *
   * `fn` is called with the project, or with nothing if it could not be created. It is
   * called on **every** path: the caller does not await this method, so a rejection used
   * to leave its "Creating new project" toast spinning over a creation that had stopped.
   */
  async newProject(
    fn,
    options: {
      name?: string;
      projectTemplate?: string;
      path?: string;
    }
  ) {
    tracker.track('New Local Project');

    const name = options?.name || 'Untitled';
    const dirEntry = options?.path || filesystem.makeUniquePath(platform.getDocumentsPath() + name);

    const outcome = await createProjectFromTemplate(
      { templateUrl: options?.projectTemplate, destination: dirEntry, projectName: name },
      {
        makeDirectory: (directory) => filesystem.makeDirectory(directory),
        installTemplate: (templateUrl, destination) => templateRegistry.install(templateUrl, destination),
        installStarterAssets: (destination) => installStarterAssets(destination),
        writeAgentConfig: (destination, projectName) => this.writeAgentConfigFor(destination, projectName)
      }
    );

    if (outcome.status === 'refused') {
      console.error(`Could not create a project from template '${outcome.templateUrl}': ${outcome.reason}`);
      fn();
      return;
    }

    // Load the newly created project
    projectFromDirectory(dirEntry, (project) => {
      if (!project) {
        console.error('Failed to create project from template');
        fn();
        return;
      }

      project.name = name; //update the name from the template
      project.runtimeVersion = 'react19'; // NEW projects default to React 19

      // Store the project, this will make it a unique project by
      // forcing it to generate a project id
      this._addProject(project);
      project.toDirectory(project._retainedProjectDirectory, (res) => {
        if (res.result !== 'success') {
          console.error('Failed to save project to directory');
          fn();
          return;
        }
        this._adoptV2Format(project).then(() => {
          console.log('Project created successfully:', name);
          fn(project);
        });
      });
    });
  }

  /**
   * Converts a freshly-created project to the v2 decomposed format — one file per
   * component instead of a single monolithic `project.json`.
   *
   * Templates (embedded and downloaded alike) ship as legacy single-file projects,
   * so a new project is born legacy and converted here, immediately after its
   * first save. Doing it at creation is the only point where the conversion is
   * risk-free: the project is a template with no user work in it yet.
   *
   * Non-fatal by construction. The migrator restores the legacy project on any
   * failure, so a project that cannot be converted is still a perfectly good
   * legacy project — the user gets their project either way, and the reason lands
   * in the console rather than in a dialog they cannot act on.
   */
  private async _adoptV2Format(project: ProjectModel): Promise<void> {
    if (!isV2FormatEnabled()) return;

    try {
      const result = await project.initializeAsV2();
      if (result.result === 'failure') {
        console.warn(`[v2] New project kept the legacy format: ${result.message}`);
      }
    } catch (err) {
      console.warn('[v2] New project kept the legacy format:', err);
    }
  }

  openProjectFromFolder(direntry: string): Promise<ProjectModel> {
    //check if this project is already in the list and if so just open it
    const projectEntry = this.projectEntries.find((p) => p.retainedProjectDirectory === direntry);
    if (projectEntry) {
      return this.loadProject(projectEntry);
    }

    //project isn't in the list, add it
    return new Promise((resolve, reject) => {
      projectFromDirectory(direntry, (project) => {
        if (!project) {
          reject(null);
          return;
        }

        this._addProject(project);
        resolve(project);
      });
    });
  }

  /**
   * Check if this project is in a git repository.
   *
   * @param project
   * @returns
   */
  async isGitProject(project: ProjectModel): Promise<boolean> {
    const gitPath = await getTopLevelWorkingDirectory(project._retainedProjectDirectory);
    return gitPath !== null;
  }

  setCurrentGlobalGitAuth(projectId: string) {
    const func = async (endpoint: string) => {
      if (endpoint.includes('github.com')) {
        // Priority 1: Check for global OAuth token from GitHubOAuthService
        try {
          const token = await GitHubOAuthService.instance.getToken();
          const user = GitHubOAuthService.instance.getCurrentUser();
          if (token) {
            console.log('[Git Auth] Using GitHub OAuth token for:', endpoint, 'user:', user?.login);
            return {
              username: user?.login || 'oauth',
              password: token
            };
          }
        } catch (err) {
          console.warn('[Git Auth] Failed to get OAuth token:', err);
        }

        // Priority 2: Fall back to project-specific PAT
        const config = await GitStore.get('github', projectId);
        if (config?.password) {
          console.log('[Git Auth] Using project PAT for:', endpoint);
          return {
            username: 'noodl',
            password: config.password
          };
        }

        // No credentials available
        console.warn('[Git Auth] No GitHub credentials found for:', endpoint);
        return {
          username: 'noodl',
          password: ''
        };
      } else {
        // Non-GitHub providers use project-specific credentials only
        const config = await GitStore.get('unknown', projectId);
        return {
          username: config?.username,
          password: config?.password
        };
      }
    };

    setRequestGitAccount(func);
  }

  // =========================================================================
  // Runtime Version Detection Methods
  // =========================================================================

  /**
   * Load runtime cache from persistent store
   */
  private loadRuntimeCache(): void {
    try {
      const cached = this.runtimeCacheStore.get('cache') as Record<string, RuntimeVersionInfo> | undefined;
      if (cached) {
        this.runtimeInfoCache = new Map(Object.entries(cached));
      }
    } catch (error) {
      console.warn('Failed to load runtime cache:', error);
      this.runtimeInfoCache = new Map();
    }
  }

  /**
   * Save runtime cache to persistent store
   */
  private saveRuntimeCache(): void {
    try {
      const cacheObject = Object.fromEntries(this.runtimeInfoCache.entries());
      this.runtimeCacheStore.set('cache', cacheObject);
    } catch (error) {
      console.error('Failed to save runtime cache:', error);
    }
  }

  /**
   * Get cached runtime info for a project, or null if not yet detected
   * @param projectPath - The project directory path
   */
  getRuntimeInfo(projectPath: string): RuntimeVersionInfo | null {
    return this.runtimeInfoCache.get(projectPath) || null;
  }

  /**
   * Check if runtime detection is currently in progress for a project
   * @param projectPath - The project directory path
   */
  isDetectingRuntime(projectPath: string): boolean {
    return this.detectingProjects.has(projectPath);
  }

  /**
   * Get projects with their runtime info (extended interface)
   * Returns projects enriched with cached runtime detection status
   */
  getProjectsWithRuntime(): ProjectItemWithRuntime[] {
    return this.projectEntries.map((project) => ({
      ...project,
      runtimeInfo: this.getRuntimeInfo(project.retainedProjectDirectory),
      runtimeDetectionPending: this.isDetectingRuntime(project.retainedProjectDirectory)
    }));
  }

  /**
   * Detect runtime version for a single project.
   * Results are cached and listeners are notified.
   * @param projectPath - Path to the project directory
   * @returns The detected runtime version info
   */
  async detectProjectRuntime(projectPath: string): Promise<RuntimeVersionInfo> {
    // Return cached result if available
    const cached = this.runtimeInfoCache.get(projectPath);
    if (cached) {
      return cached;
    }

    // Skip if already detecting
    if (this.detectingProjects.has(projectPath)) {
      // Wait for existing detection to complete by polling
      return new Promise((resolve) => {
        const checkCached = () => {
          const result = this.runtimeInfoCache.get(projectPath);
          if (result) {
            resolve(result);
          } else if (this.detectingProjects.has(projectPath)) {
            setTimeout(checkCached, 100);
          } else {
            // Detection finished but no result - return unknown
            resolve({ version: 'unknown', confidence: 'low', indicators: ['Detection failed'] });
          }
        };
        checkCached();
      });
    }

    // Mark as detecting
    this.detectingProjects.add(projectPath);
    this.notifyListeners('runtimeDetectionStarted', projectPath);

    try {
      const runtimeInfo = await detectRuntimeVersion(projectPath);
      this.runtimeInfoCache.set(projectPath, runtimeInfo);
      this.saveRuntimeCache(); // Persist to disk
      this.notifyListeners('runtimeDetectionComplete', projectPath, runtimeInfo);
      return runtimeInfo;
    } catch (error) {
      console.error(`Failed to detect runtime for ${projectPath}:`, error);
      const fallback: RuntimeVersionInfo = {
        version: 'unknown',
        confidence: 'low',
        indicators: ['Detection error: ' + (error instanceof Error ? error.message : 'Unknown error')]
      };
      this.runtimeInfoCache.set(projectPath, fallback);
      this.saveRuntimeCache(); // Persist to disk
      this.notifyListeners('runtimeDetectionComplete', projectPath, fallback);
      return fallback;
    } finally {
      this.detectingProjects.delete(projectPath);
    }
  }

  /**
   * Detect runtime version for all projects in the list (background)
   * Useful for pre-populating the cache when the projects view loads
   */
  async detectAllProjectRuntimes(): Promise<void> {
    const projects = this.getProjects();

    // Detect in parallel but don't wait for all to complete
    // Instead, trigger detection and let events update the UI
    for (const project of projects) {
      // Don't await - let them run in background
      this.detectProjectRuntime(project.retainedProjectDirectory).catch(() => {
        // Errors are handled in detectProjectRuntime
      });
    }
  }

  /**
   * Check if a project is a legacy project (React 17)
   * @param projectPath - Path to the project directory
   * @returns True if project is detected as React 17
   */
  isLegacyProject(projectPath: string): boolean {
    const info = this.getRuntimeInfo(projectPath);
    return info?.version === 'react17';
  }

  /**
   * Clear runtime cache for a specific project (e.g., after migration)
   * @param projectPath - Path to the project directory
   */
  clearRuntimeCache(projectPath: string): void {
    this.runtimeInfoCache.delete(projectPath);
    this.saveRuntimeCache(); // Persist the change
    this.notifyListeners('runtimeCacheCleared', projectPath);
  }

  /**
   * Clear all runtime cache (useful for debugging or forcing re-detection)
   */
  clearAllRuntimeCache(): void {
    this.runtimeInfoCache.clear();
    this.saveRuntimeCache();
    this.notifyListeners('allRuntimeCacheCleared');
  }
}
