import path from 'node:path';
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
import { GitHubAuth } from '../services/github';
import FileSystem from './filesystem';
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

  async newProject(
    fn,
    options: {
      name?: string;
      projectTemplate: string;
      path?: string;
    }
  ) {
    tracker.track('New Local Project');

    const name = options?.name || 'Untitled';
    const dirEntry = options?.path || filesystem.makeUniquePath(platform.getDocumentsPath() + name);

    await filesystem.makeDirectory(dirEntry);

    const projectTemplate = options?.projectTemplate;
    if (projectTemplate) {
      const templatePath = await templateRegistry.download({ templateUrl: projectTemplate });

      // Copy unzipped project template
      FileSystem.instance.copyRecursiveSync(templatePath, dirEntry, {
        filter(src) {
          //ignore all files in .git/
          return !src.includes(path.sep + '.git' + path.sep);
        }
      });

      // Project extracted successfully, load it
      projectFromDirectory(dirEntry, (project) => {
        if (!project) {
          fn();
          return;
        }

        project.name = name; //update the name from the template

        // Store the project, this will make it a unique project by
        // forcing it to generate a project id
        this._addProject(project);
        project.toDirectory(project._retainedProjectDirectory, (res) => {
          if (res.result === 'success') {
            fn(project);
          } else {
            fn();
          }
        });
      });
    } else {
      // No template specified - use default embedded Hello World template
      // This uses the template system implemented in TASK-009
      const defaultTemplate = 'embedded://hello-world';

      // For embedded templates, write directly to the project directory
      // (no need for temporary folder + copy)
      const { EmbeddedTemplateProvider } = await import('../models/template/EmbeddedTemplateProvider');
      const embeddedProvider = new EmbeddedTemplateProvider();

      await embeddedProvider.download(defaultTemplate, dirEntry);

      // Load the newly created project
      projectFromDirectory(dirEntry, (project) => {
        if (!project) {
          console.error('Failed to create project from template');
          fn();
          return;
        }

        project.name = name;
        this._addProject(project);
        project.toDirectory(project._retainedProjectDirectory, (res) => {
          if (res.result === 'success') {
            console.log('Project created successfully:', name);
            fn(project);
          } else {
            console.error('Failed to save project to directory');
            fn();
          }
        });
      });
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
        // Priority 1: Check for global OAuth token
        const authState = GitHubAuth.getAuthState();
        if (authState.isAuthenticated && authState.token) {
          console.log('[Git Auth] Using GitHub OAuth token for:', endpoint);
          return {
            username: authState.username || 'oauth',
            password: authState.token.access_token // Extract actual access token string
          };
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
