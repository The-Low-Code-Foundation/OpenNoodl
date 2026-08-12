/**
 * Where the two shelves actually live (LGC-007 §2).
 *
 * `myblocks/store.ts` owns every rule and no persistence; this file owns the persistence and
 * no rules. The split is not tidiness — it is what keeps the cycle guard, the format and the
 * inliner in a plain-Node runner, because this file reaches `ProjectModel` and
 * `EditorSettings` and nothing that imports it can be tested without Electron.
 *
 * - **This project** — a key in the project's settings bag, so it is inside `project.json`,
 *   travels with the project and reaches a collaborator through git. §2 asks for exactly that.
 * - **My backpack** — a key in `EditorSettings`, which is the editor's own JSON on disk, so it
 *   follows the builder between projects. Scratch's backpack is account-scoped and online-only;
 *   §2 notes that last part is a limitation we do not have to copy, and this does not.
 *
 * ⚠️ **Two persistence traps, both real, both worked around here.**
 *
 * 1. `ProjectModel.setSetting` bails out on `this.settings[name] === value` — *reference*
 *    equality. Mutating a library in place and handing back the same object would be a silent
 *    no-op, so `write` always passes a fresh clone.
 * 2. `EditorSettings.set` debounces its disk write by **1000 ms**. The registers already carry
 *    a one-second quit window losing data, and this is the same window. A backpack save
 *    immediately before a quit can be lost. Not fixable from here — `EditorSettings` owns the
 *    debounce — and written down rather than left to be rediscovered.
 *
 * @module BlocklyEditor
 */

import { EditorSettings } from '@noodl-utils/editorsettings';

import { ProjectModel } from '../../models/projectmodel';
import { cloneJson, emptyLibrary, validateLibrary, type MyBlocksLibrary } from './myblocks/format';
import { MyBlocksStore, type MyBlocksShelf, type MyBlocksScope } from './myblocks/store';

/** The project-settings key. Namespaced, because that bag is shared with every other feature. */
export const PROJECT_LIBRARY_SETTING = 'myBlocks.library';

/** The editor-settings key for the user's backpack. */
export const USER_LIBRARY_SETTING = 'myBlocks.backpack';

class ProjectShelf implements MyBlocksShelf {
  readonly scope: MyBlocksScope = 'project';

  read(): MyBlocksLibrary {
    const project = ProjectModel.instance;
    if (!project) return emptyLibrary();
    // One malformed definition must not cost the whole shelf; `validateLibrary` drops the bad
    // entry and keeps the rest.
    return validateLibrary(project.getSettings()[PROJECT_LIBRARY_SETTING]).library;
  }

  write(library: MyBlocksLibrary): void {
    const project = ProjectModel.instance;
    if (!project) return;
    // A fresh object every time: see trap 1 in the header.
    project.setSetting(PROJECT_LIBRARY_SETTING, cloneJson(library));
  }
}

class UserShelf implements MyBlocksShelf {
  readonly scope: MyBlocksScope = 'user';

  read(): MyBlocksLibrary {
    return validateLibrary(EditorSettings.instance.get(USER_LIBRARY_SETTING)).library;
  }

  write(library: MyBlocksLibrary): void {
    EditorSettings.instance.set(USER_LIBRARY_SETTING, cloneJson(library));
  }
}

let store: MyBlocksStore | null = null;

/**
 * The one store the editor uses.
 *
 * A singleton because the shelves are singletons underneath: two stores would read the same
 * `ProjectModel` and the same `EditorSettings` and would differ only in how stale they were.
 * Neither shelf caches — every `read()` goes to the model — so the project switching under it
 * is not a problem this has to solve.
 */
export function myBlocksStore(): MyBlocksStore {
  if (!store) {
    store = new MyBlocksStore({ project: new ProjectShelf(), user: new UserShelf() });
  }
  return store;
}
