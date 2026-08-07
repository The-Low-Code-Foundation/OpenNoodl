/**
 * SUB-006 — Project validation service (editor bridge)
 *
 * Bridges the editor's live `ProjectModel` to the pure `SemanticValidator`. Runs
 * whole-project validation, caches the latest report, and re-validates
 * (debounced) whenever the graph or the active project changes — so the Problems
 * panel and any future consumer stay in sync without polling.
 *
 * The validator itself is framework-agnostic and lives in ../../../validation;
 * this service is the only piece that knows about ProjectModel/EventDispatcher,
 * keeping the rule engine reusable by the CLI and the MCP server.
 *
 * @module noodl-editor/views/panels/ProblemsPanel/ProjectValidationService
 */

import { ProjectModel } from '@noodl-models/projectmodel';
import { Model } from '@noodl-utils/model';

import { SemanticValidator } from '../../../validation/SemanticValidator';
import { fromLegacyProject, LegacyProjectLike } from '../../../validation/normalize';
import { ValidationReport } from '../../../validation/diagnostics';
import { ValidatorOptions } from '../../../validation/rules';
import { EventDispatcher } from '../../../../../shared/utils/EventDispatcher';

export enum ProjectValidationEvent {
  /** Fired whenever a fresh report is available (or cleared). */
  Changed = 'changed'
}

/** Graph/project mutations that should trigger a re-validation. */
const MUTATION_EVENTS = [
  'Model.nodeAdded',
  'Model.nodeRemoved',
  'Model.nodeAttached',
  'Model.nodeDetached',
  'Model.connectionAdded',
  'Model.connectionRemoved',
  'Model.parametersChanged',
  'Model.componentAdded',
  'Model.componentRemoved',
  'Model.componentRenamed'
];

const DEBOUNCE_MS = 300;

export class ProjectValidationService extends Model<ProjectValidationEvent> {
  private static _instance: ProjectValidationService | undefined;

  public static get instance(): ProjectValidationService {
    if (!ProjectValidationService._instance) {
      ProjectValidationService._instance = new ProjectValidationService();
    }
    return ProjectValidationService._instance;
  }

  private readonly validator = new SemanticValidator();
  private readonly group = {};
  private _report: ValidationReport | null = null;
  private _options: ValidatorOptions = {};
  private started = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  /** The most recent report, or null if no project is open / validation failed. */
  get report(): ValidationReport | null {
    return this._report;
  }

  get options(): ValidatorOptions {
    return this._options;
  }

  setOptions(options: ValidatorOptions): void {
    this._options = options;
    this.revalidateNow();
  }

  /**
   * Begin watching the project. Idempotent — safe to call from every panel mount.
   * Runs an initial validation immediately.
   */
  start(): void {
    if (this.started) return;
    this.started = true;

    EventDispatcher.instance.on(MUTATION_EVENTS, () => this.scheduleRevalidate(), this.group);
    // A project open/close/new swaps the ProjectModel instance — validate at once.
    EventDispatcher.instance.on('ProjectModel.instanceHasChanged', () => this.revalidateNow(), this.group);

    this.revalidateNow();
  }

  /** Stop watching (used by tests; the panel leaves the service running). */
  stop(): void {
    EventDispatcher.instance.off(this.group);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = null;
    this.started = false;
  }

  /** Coalesce bursts of edits into a single validation pass. */
  scheduleRevalidate(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.revalidateNow();
    }, DEBOUNCE_MS);
  }

  /** Validate the current project synchronously and notify listeners. */
  revalidateNow(): void {
    this._report = this.computeReport();
    this.notifyListeners(ProjectValidationEvent.Changed);
  }

  private computeReport(): ValidationReport | null {
    const project = ProjectModel.instance;
    if (!project) return null;
    try {
      const json = project.toJSON() as unknown as LegacyProjectLike;
      return this.validator.validate(fromLegacyProject(json), this._options);
    } catch {
      // A malformed in-flight model shouldn't crash the panel; report "unknown".
      return null;
    }
  }
}
