/**
 * FLD-010 — "is a person in here, and are they mid-edit?", answered by the editor itself.
 *
 * ## What #41 asked for, and what R6 ruled
 *
 * [#41] asked for three things: a `session_status` reading, an advisory lock the editor
 * surfaces, and a reverse channel announcing a human save. **R6 ruled the lock out** (2026-09-11)
 * and this module is why the ruling is cheap to live with: FLD-009 already refuses to reload over
 * a dirty buffer and re-reads before autosaving, so an agent does not need to *hold* anything —
 * it needs to *know*. A lock the editor honours and a guard the editor applies are the same
 * protection; the guard is already built, cannot go stale, and needs no release.
 *
 * ## Transport it does not own
 *
 * 🔴 **No relay change was needed for this, and that is the finding.** FLD-010's own §2 says the
 * relay's routing "is wrong for this use" because an `editor` peer fans only to `viewer` peers.
 * That is true of *broadcast* and irrelevant here: `target` routing matches on `clientId` and
 * ignores peer type entirely, and HLS-009 has been carrying an agent→editor command over it since
 * it shipped. `relay-server.js` is untouched by this task — which is also what keeps AC5 (the
 * `nodegx-observe` fan-out) true by construction rather than by assertion.
 *
 * Installed from `router.tsx` beside `installExternalProjectOpen`, for the same reason: one
 * window, one subscription, and the window is its lifetime.
 *
 * The reading itself. `index.ts` is the relay half.
 *
 * @module models/sessionStatus/collect
 */

import { hasPendingProjectSave, ProjectModel } from '@noodl-models/projectmodel';

import { legacyNameToPath } from '../../io/ProjectExporter';
import { hashComponent } from '../../services/ProjectStructure/ComponentSaver';
import { projectStructureService } from '../../services/ProjectStructure';

/**
 * What one editor window knows about itself.
 *
 * ⚠️ **`null` means "not knowable", and every field that can be unknowable is nullable.** The
 * task's §5 trap — *a status tool that lies is worse than no status tool* — bites hardest here,
 * because the shape of the lie is a confident `false`. `unsavedComponents: null` is the answer
 * when the baselines cannot be trusted for this project; it is not the same as `[]`.
 */
export interface EditorSessionStatus {
  /** Whether a project is loaded in this window at all. The window can be up with none. */
  projectOpen: boolean;
  /** Absolute path of the open project, or `null`. */
  directory: string | null;
  projectName: string | null;
  /** `'v2'`, `'legacy'`, or `null` when nothing is open. */
  projectFormat: string | null;
  /**
   * The component the person is looking at, as its legacy name (`"/Pages/Home"`) — the same
   * identifier a node instantiating it uses, so it is directly comparable to MCP output.
   */
  currentComponent: string | null;
  /**
   * An edit is in memory and has not reached disk. Conservative by construction: it is armed the
   * moment an edit does and stays set until the write lands, so it covers the debounce second.
   */
  unsavedBuffers: boolean;
  /**
   * Which components differ from what this editor last read from or wrote to disk — the exact
   * set FLD-009's reload guard would refuse to overwrite.
   *
   * 🔴 **`null` rather than `[]` whenever the comparison cannot be trusted**: a legacy project
   * (no per-component baselines exist) or baselines that still describe the previously open
   * project. Reporting `[]` there would tell an agent every file was safe to write.
   */
  unsavedComponents: string[] | null;
  /** Why `unsavedComponents` is `null`, when it is. */
  unsavedComponentsUnknownReason?: string;
}

/**
 * Read this window's state. Pure — it takes no locks and changes nothing.
 *
 * Exported for its spec: `tests-unit/fld010/session-status.test.ts` drives it against real
 * `ProjectModel` instances, which is the half of FLD-010 the MCP suite deliberately fakes.
 */
export function collectSessionStatus(): EditorSessionStatus {
  const project = ProjectModel.instance;

  if (!project) {
    return {
      projectOpen: false,
      directory: null,
      projectName: null,
      projectFormat: null,
      currentComponent: null,
      // Nothing is open, so nothing is pending *for a project* — but a stale timer from a
      // project that has just closed is still a write in flight, so the flag is read rather
      // than assumed false.
      unsavedBuffers: hasPendingProjectSave(),
      unsavedComponents: null,
      unsavedComponentsUnknownReason: 'No project is open in the editor.'
    };
  }

  const directory = project._retainedProjectDirectory ?? null;
  const format = project._projectFormat ?? null;

  return {
    projectOpen: true,
    directory,
    projectName: project.name ?? null,
    projectFormat: format,
    currentComponent: currentComponentName(),
    unsavedBuffers: hasPendingProjectSave(),
    ...unsavedComponentsFor(project, directory, format)
  };
}

/**
 * The component on screen.
 *
 * `NodeGraphContextTmp` is the singleton the React context publishes itself on *for code that
 * cannot reach the context* — this file's exact situation. It is `null` before the graph mounts
 * and after it unmounts, and `null` is the honest answer in both.
 */
function currentComponentName(): string | null {
  try {
    // 🔴 Required lazily, and not for load order. `NodeGraphContext.tsx` pulls in React and the
    // whole `nodegrapheditor` view; a top-level import would make every spec that merely reads
    // this module pay for the canvas, and `session-status.test.ts` would then be grading the
    // editor's render tree instead of its answer. In the app the require is resolved once, on the
    // first call, by which time the graph has long since mounted.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { NodeGraphContextTmp } = require('@noodl-contexts/NodeGraphContext/NodeGraphContext');
    return NodeGraphContextTmp?.nodeGraph?.activeComponent?.name ?? null;
  } catch {
    // Nothing is on screen if the canvas module is not there at all. `null` is the honest answer
    // and it is the same one an unmounted graph gives.
    return null;
  }
}

function unsavedComponentsFor(
  project: ProjectModel,
  directory: string | null,
  format: string | null
): Pick<EditorSessionStatus, 'unsavedComponents' | 'unsavedComponentsUnknownReason'> {
  if (format !== 'v2') {
    return {
      unsavedComponents: null,
      unsavedComponentsUnknownReason:
        'This is a legacy-format project. It is saved as one file, so there are no per-component ' +
        'baselines to compare against — read unsavedBuffers instead.'
    };
  }

  if (!directory) {
    return {
      unsavedComponents: null,
      unsavedComponentsUnknownReason: 'The open project has no directory on disk yet.'
    };
  }

  // 🔴 The guard that keeps this from lying. Baselines are a module singleton re-seeded lazily,
  // so between opening a project and its first save they can still describe the previous one —
  // against which every component of the new project hashes differently. See
  // `ProjectStructureService.baselineProjectDirectory`.
  if (projectStructureService.baselineProjectDirectory !== directory) {
    return {
      unsavedComponents: null,
      unsavedComponentsUnknownReason:
        'The editor has not yet recorded on-disk baselines for this project, so it cannot tell ' +
        'which components differ from disk. unsavedBuffers is still exact.'
    };
  }

  const unsaved: string[] = [];
  for (const component of project.getComponents()) {
    const path = legacyNameToPath(component.name);
    const baseline = projectStructureService.saver.getDiskHash(path);
    // No baseline means this editor has never seen the path on disk — a component created since
    // the project was opened. That is unsaved, not unknown.
    if (baseline === undefined || baseline !== hashComponent(component.toJSON())) unsaved.push(path);
  }
  return { unsavedComponents: unsaved };
}

