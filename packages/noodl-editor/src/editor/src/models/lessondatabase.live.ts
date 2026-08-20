/**
 * TUT-002 AC3 — the live half of the database snapshot: Electron IPC, the open project's
 * binding, and nothing else.
 *
 * 🔴 WHY THIS IS A SEPARATE FILE
 * ------------------------------
 * Same reason `lessonevalconditions.live.ts` is, and the reason is worth repeating because the
 * cheap version of it has already failed here once: **a lazy `require` defers execution, not
 * resolution.** `lessondatabase.ts` is on `noodl-mcp`'s bundle path through `editor-deps.ts`,
 * so a `require('./projectmodel')` tucked inside a function in that file would still drag the
 * node graph, React and `.scss` into an esbuild bundle. Everything that reaches a singleton or
 * an `ipcRenderer` lives here instead, and nothing outside the renderer may import this module.
 *
 * WHAT IT ADDS OVER THE PURE HALF
 * -------------------------------
 * Two things, and deliberately only two: the **transport** (three IPC channels) and the
 * **binding resolution** (which managed backend, if any, this project's endpoint names). The
 * decisions — refuse / unavailable / ok, and how a count that is not a number is treated — are
 * all in `lessondatabase.ts`, where the sidecar reads them from the same source.
 *
 * @module noodl-editor/models/lessondatabase.live
 */

import type { BackendType } from '@noodl/backend-contract';

import { matchEndpointToManaged } from './BackendServices/backendList';
import { getPreset } from './BackendServices/presets';
import { classifyLessonBackend, ipcLessonReader, readLessonDatabaseSnapshot } from './lessondatabase';
import { ProjectModel } from './projectmodel';
import { getCloudServices } from './projectmodel.editor';
import type { LessonDatabaseSnapshot } from '../views/lessons/lessonevalconditions';
import { getIpc } from '../utils/ipc';

/** One managed backend, as `backend:list` describes it. */
interface LocalBackendHandle {
  id: string;
  name?: string;
  port: number;
  running?: boolean;
}

/**
 * Read the open project's built-in database, or say why not. Never throws.
 *
 * ⚠️ Call this only when the lesson actually grades against the database
 * (`lessonObservesDatabase`). It is three IPC round trips plus one per collection, and a lesson
 * with no data verb in it must not put that on the machine every time a step re-evaluates.
 */
export async function liveLessonDatabaseSnapshot(): Promise<LessonDatabaseSnapshot> {
  const project = ProjectModel.instance;
  if (!project) {
    return { status: 'unavailable', reason: 'no project is open' };
  }

  const ipc = getIpc();
  if (!ipc) {
    // No Electron around us — the jasmine suite, or a renderer-less runner. "Could not read",
    // never "there is nothing there": the second would tick a `collectionExists: false` step.
    return { status: 'unavailable', reason: 'this build has no connection to the backend manager' };
  }

  const cloud = getCloudServices(project);

  let managed: LocalBackendHandle | undefined;
  try {
    const list = ((await ipc.invoke('backend:list')) as LocalBackendHandle[] | undefined) ?? [];
    // 🔴 The one rule about what counts as one of ours, read from where it already lives.
    const match = matchEndpointToManaged(cloud, list);
    if (match) {
      // `backend:list` carries `running` on some builds and not on others; ask the channel that
      // is *defined* to answer it rather than trusting a field that may be absent — an absent
      // `running` read as false would report a live backend as stopped.
      const status = (await ipc.invoke('backend:status', match.id)) as { running?: boolean } | undefined;
      managed = { ...match, running: status?.running === true };
    }
  } catch (e) {
    return { status: 'unavailable', reason: `the backend manager could not be reached: ${messageOf(e)}` };
  }

  const target = classifyLessonBackend({
    endpoint: cloud?.endpoint,
    type: cloud?.type,
    ...(managed ? { managed: { id: managed.id, name: managed.name, running: managed.running } } : {}),
    ...(bindingLabel(cloud?.type) ? { label: bindingLabel(cloud?.type) as string } : {})
  });

  if (target.kind === 'refused') return { status: 'refused', binding: target.binding };
  if (target.kind === 'unavailable') return { status: 'unavailable', reason: target.reason };

  // 🔴 The transport is `lessondatabase.ts`'s, not this file's: the two channel choices in it
  // are the trap this task documented, and they are only gradeable where a plain-Node runner can
  // reach them. This module supplies `ipc` and nothing else.
  return readLessonDatabaseSnapshot(ipcLessonReader((channel, ...args) => ipc.invoke(channel, ...args), target.backendId));
}

/** The preset's display name for a foreign binding, so a refusal says "Parse", not "parse". */
function bindingLabel(type: string | undefined): string | undefined {
  if (!type) return undefined;
  try {
    return getPreset(type as BackendType)?.displayName;
  } catch {
    return undefined;
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
