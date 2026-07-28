/**
 * What a step's `ref` points at (WFA-006 §2).
 *
 * One function, used by the card, the property editor and the descent, so all
 * three can never disagree about whether a step is broken.
 *
 * TWO FACTS, NOT ONE. A workflow step and a cloud function live in different
 * places — the step in a backend's data directory, the function in the project —
 * and the whole point of this task is that those two stores can disagree:
 *
 *   inProject   ProjectModel has `/#__cloud__/<ref>`         true | false
 *   deployed    <ref> is in `GET /admin/workflows.functions`  true | false | null
 *
 * `deployed` is three-valued for the reason WFA-005's `isTargetResolved` is:
 * **"the backend could not be asked" must never be reported as "it is not
 * there"**, because a wrong warning about a working step is worse than no
 * warning. "Deployed" and "in the project" are never collapsed into one boolean,
 * because the difference between them is exactly what the user needs to see —
 * the push is hash-gated and on-save (WFA-001), so a backend legitimately lags
 * the project.
 *
 * Resolution is PER BACKEND. Two backends can be running with different function
 * sets, so every message this module produces names the backend it is about.
 *
 * @module models/workflow/functionRefResolution
 */

import { ProjectModel } from '@noodl-models/projectmodel';
import { ipcInvoke } from '@noodl-utils/ipc';

import { CLOUD_COMPONENT_PREFIX, getCloudFunctionNames } from '../../utils/exporter/cloudFunctions';

export { CLOUD_COMPONENT_PREFIX };

/**
 * `step.ref` is a bare name; the component is `/#__cloud__/<name>`.
 *
 * The prefix is stripped on deploy, so every comparison has to normalise. This
 * is the convention `nodegrapheditor.drag.ts:118` already uses
 * (`component.name.slice('/#__cloud__/'.length)`) rather than a second one.
 */
export function componentNameForRef(ref: string): string {
  return CLOUD_COMPONENT_PREFIX + ref;
}

/** The inverse: `/#__cloud__/saveOrder` → `saveOrder`. `null` if not a cloud component. */
export function refFromComponentName(name: string): string | null {
  return name && name.startsWith(CLOUD_COMPONENT_PREFIX) ? name.slice(CLOUD_COMPONENT_PREFIX.length) : null;
}

export type RefResolutionState =
  /** In the open project. Descend into it. */
  | 'resolved-in-project'
  /** The backend has it; this project does not. Reported, never resolved. */
  | 'deployed-only'
  /** Neither. The step is broken. */
  | 'unresolved'
  /** The backend could not be asked. Never a warning. */
  | 'unknown'
  /** The step does not name a function at all. */
  | 'unnamed';

export interface RefResolution {
  ref: string;
  state: RefResolutionState;
  /** Does the OPEN PROJECT have this function? Always knowable. */
  inProject: boolean;
  /** Does the BACKEND have it? `null` = could not be asked. */
  deployed: boolean | null;
  /** `/#__cloud__/<ref>` when in the project, so a caller need not rebuild it. */
  componentName: string | null;
  /** The backend this answer is about. There is no "the" backend. */
  backendName: string;
  /** One short line for a card or a row. */
  summary: string;
  /** The honest sentence, for the descent and the property editor. */
  message: string;
}

/** What the backend says it is serving. `known: false` = it could not be asked. */
export interface DeployedFunctions {
  names: string[];
  known: boolean;
}

/**
 * The deployed function names, out of `GET /admin/workflows`.
 *
 * **F54.** That endpoint answers `functions: {name, workflow}[]`
 * (`WorkflowRunnerStatus`), and `fetchTriggerTargets` read it as
 * `status.functions.map(String)` — which yields `["[object Object]"]`, so
 * WFA-005's target picker listed a placeholder and `isTargetResolved` answered
 * *false for a deployed function*: the wrong warning about a working trigger
 * that its own three-valued answer exists to prevent. Invisible in WFA-005's
 * live pass because that backend had no functions deployed at all.
 *
 * One reader for both surfaces, tolerant of the plain-string shape in case an
 * older backend ever served one.
 */
export function deployedFunctionNames(status: unknown): DeployedFunctions {
  const s = status as { initialized?: boolean; functions?: unknown } | null | undefined;
  if (!s || !s.initialized || !Array.isArray(s.functions)) return { names: [], known: false };

  const names = s.functions
    .map((f) => (typeof f === 'string' ? f : (f as { name?: unknown })?.name))
    .filter((n): n is string => typeof n === 'string' && n.length > 0);

  return { names, known: true };
}

/** Ask ONE backend what it is serving. Never throws: an unreachable backend is `known: false`. */
export async function fetchDeployedFunctions(backendId: string): Promise<DeployedFunctions> {
  try {
    return deployedFunctionNames(await ipcInvoke('backend:workflow-status', backendId));
  } catch {
    return { names: [], known: false };
  }
}

/** The cloud functions in the open project — the same list the deployer pushes. */
export function projectFunctionNames(): string[] {
  return ProjectModel.instance ? getCloudFunctionNames(ProjectModel.instance) : [];
}

export interface ResolveArgs {
  /** Cloud function names in the open project, unprefixed. */
  inProject: string[];
  /** What the backend is serving. */
  deployed: DeployedFunctions;
  backendName: string;
}

/**
 * `ref` → one of the five states.
 *
 * The order of the branches is the order the answers matter in: being in the
 * project is what makes a descent possible, so it is asked first and it wins
 * even when the backend has not been asked at all.
 */
export function resolveFunctionRef(ref: unknown, args: ResolveArgs): RefResolution {
  const name = typeof ref === 'string' ? ref.trim() : '';
  const backendName = args.backendName || 'this backend';
  const deployed = args.deployed.known ? args.deployed.names.includes(name) : null;

  const base = {
    ref: name,
    inProject: false,
    deployed,
    componentName: null as string | null,
    backendName
  };

  if (!name) {
    return {
      ...base,
      deployed: null,
      state: 'unnamed',
      summary: 'no function',
      message:
        'This step does not name a cloud function yet. Set its Function field — the backend refuses to ' +
        'save a step of this kind without one.'
    };
  }

  if (args.inProject.includes(name)) {
    const notDeployed = deployed === false;
    return {
      ...base,
      inProject: true,
      componentName: componentNameForRef(name),
      state: 'resolved-in-project',
      summary: notDeployed ? 'in this project · not deployed yet' : 'in this project',
      message: notDeployed
        ? `"${name}" is in this project but ${backendName} is not serving it yet. Deploy it, or run it and the ` +
          `step will fail with a missing function.`
        : `"${name}" is in this project and deployed on ${backendName}.`
    };
  }

  if (deployed === true) {
    return {
      ...base,
      state: 'deployed-only',
      summary: 'deployed, not in this project',
      message:
        `"${name}" is deployed on ${backendName} but is not part of this project — it was pushed from a ` +
        `different project, an older version of this one, or by an agent. There is no graph here to open.`
    };
  }

  if (deployed === null) {
    return {
      ...base,
      state: 'unknown',
      summary: 'cannot check',
      message:
        `"${name}" is not in this project, and ${backendName} could not be asked whether it is deployed. ` +
        `This step may be perfectly fine.`
    };
  }

  return {
    ...base,
    state: 'unresolved',
    summary: 'not found',
    message:
      `"${name}" is not in this project and is not deployed on ${backendName}. This step will fail when it ` +
      `runs — the run reports a missing function.`
  };
}

/** Is this state one a user should see as wrong on the canvas, with no interaction? */
export function isBrokenState(state: RefResolutionState): boolean {
  return state === 'unresolved' || state === 'unnamed';
}
