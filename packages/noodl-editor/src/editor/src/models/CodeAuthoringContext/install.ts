/**
 * FH-019 slice 1 — boot wiring for what the code editor knows.
 *
 * Installed from `router.setup.ts` alongside `installProjectDocs()`, and for
 * the same reason it is: the code popout is constructed the first time somebody
 * clicks a code port, which is long after the project opened, and a
 * panel-mounted subscription would mean the first editor opened after a project
 * change completes against the previous project — or against nothing.
 *
 * This is the whole editor→`noodl-core-ui` seam for FH-019. `noodl-core-ui`
 * holds no project model and imports none; it holds a plain-data surface
 * (`code-editor/authoringContext.ts`) that this file fills in.
 *
 * ## Why it pushes rather than the editor pulling
 *
 * A completion source runs per keystroke and must answer synchronously.
 * `listRegisteredLibraries` reads `noodl_modules` off disk and is async, so it
 * cannot be called from one — the surface has to be assembled ahead of time and
 * left somewhere synchronous.
 *
 * @module CodeAuthoringContext
 */

import { setCodeAuthoringContext } from '@noodl-core-ui/components/code-editor';

import { EventDispatcher } from '../../../../shared/utils/EventDispatcher';
import { listRegisteredLibraries } from '../../../../shared/utils/projectmodules';
import { ProjectModel } from '../projectmodel';
import { collectProjectNames } from './collect';

/**
 * How long to wait after a graph change before re-reading the project.
 *
 * `Model.parametersChanged` fires per keystroke in a property field, and
 * renaming a variable is exactly the case that must end up in the completion
 * list — so this cannot be "on project open only". It also must not walk the
 * whole project per character. A refresh that lands a beat after you stop
 * typing is both.
 */
const REFRESH_DEBOUNCE_MS = 400;

let installed = false;
let pending: ReturnType<typeof setTimeout> | undefined;
/** Guards against an in-flight disk read landing after a newer one. */
let generation = 0;

async function refresh(): Promise<void> {
  const mine = ++generation;
  const project = ProjectModel.instance;

  if (!project) {
    setCodeAuthoringContext(null);
    return;
  }

  const names = collectProjectNames(project);

  // Publish the graph half immediately. The names are what most completions
  // need, and making them wait on a directory scan would mean an editor opened
  // in the first moments of a project completing nothing.
  setCodeAuthoringContext({ libraries: [], ...names });

  let libraries: { name: string; global: string }[] = [];
  try {
    const registered = await listRegisteredLibraries(project._retainedProjectDirectory);
    libraries = registered
      .filter((library) => library.global && library.global.trim())
      .map((library) => ({ name: library.displayName, global: library.global }));
  } catch (error) {
    // A project without a directory on disk, or an unreadable `noodl_modules`.
    // Completing no libraries is the correct answer; failing to complete
    // anything else because of it would not be.
    console.warn('[code-editor] could not read registered libraries:', error);
  }

  if (mine !== generation) return;

  setCodeAuthoringContext({ libraries, ...names });
}

function scheduleRefresh(): void {
  if (pending) clearTimeout(pending);
  pending = setTimeout(() => {
    pending = undefined;
    void refresh();
  }, REFRESH_DEBOUNCE_MS);
}

/**
 * Keep the code editor's view of the project up to date. Idempotent.
 */
export function installCodeAuthoringContext(): void {
  if (installed) return;
  installed = true;

  // A project opening or an import completing replaces everything; do not wait
  // out the debounce for it.
  EventDispatcher.instance.on(
    ['ProjectModel.instanceHasChanged', 'ProjectModel.importComplete'],
    () => void refresh(),
    'code-authoring-context'
  );

  // A variable is renamed by editing a parameter, and a node holding
  // `Noodl.Variables.x` is added and removed like any other.
  EventDispatcher.instance.on(
    ['Model.parametersChanged', 'Model.nodeAdded', 'Model.nodeRemoved'],
    scheduleRefresh,
    'code-authoring-context'
  );

  // A project may already be open when this runs (HMR, or a boot order change).
  if (ProjectModel.instance) void refresh();
}
