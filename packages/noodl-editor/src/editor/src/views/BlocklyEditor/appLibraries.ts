/**
 * VFN-012 §2 — the libraries this app has registered, as blocks.
 *
 * > *"Could we also add handy stuff like 'window' and any imported SDKs or libraries we've added
 * > at the app config?"*
 *
 * A dropdown over the `global` names of the project's registered libraries, generating
 * `window.<global>`. That block plus the existing member-access shapes is enough to reach a
 * library's API from a visual function.
 *
 * This module also owns the toolbox category the §3 `window` block shares with it — see
 * `browserFlyoutContents` and the note on the category name below.
 *
 * ## 🔴 The constraint that decides the whole design: the source is on disk, and async
 *
 * `listRegisteredLibraries()` reads `noodl_modules/` off the filesystem and returns a promise.
 * A Blockly flyout callback and a `FieldDropdown`'s option generator are both **synchronous** and
 * are called during rendering, so neither can await it. The answer has to already be in memory.
 *
 * That is the same shape as `CodeAuthoringContext/install.ts` ("a completion source runs per
 * keystroke and must answer synchronously"), and it carries the same trap, which this repo has
 * already been bitten by: **an async injection sampled early looks like a disposal.** Between the
 * editor opening and the scan landing there is a window in which we do not know what libraries
 * this project has — and in that window the *correct* answer is "I do not know yet", not "there
 * are none". So the cache is a **tri-state snapshot**, never a bare array:
 *
 * | status | means | flyout says |
 * | --- | --- | --- |
 * | `unknown` | the scan has not landed | *Reading this project's libraries…* |
 * | `loaded` | the scan landed, here is the list (possibly empty) | the libraries, or *add some* |
 * | `unavailable` | there is no project directory, or the scan threw | *could not read them*, and why |
 *
 * 🔴 The third state is not defensive padding. `scanModuleManifests(undefined)` returns `[]`
 * (`projectmodules.ts:192`), so a project with no directory on disk is **indistinguishable from a
 * project with no libraries** if you only look at the array — the loader installed by
 * `BlocklyWorkspace` therefore throws rather than passing `undefined` down. This is
 * `hasAppConfigEmptyState`'s lesson from §1 with one more way to be wrong.
 *
 * `hasLibrariesLoadingState` / `hasLibrariesEmptyState` / `hasLibrariesUnavailableState` are the
 * three instruments that tell those apart, and the spec asserts that **exactly one** of them is
 * true for any snapshot — a suite of absences otherwise proves nothing.
 *
 * ## ⚠️ `runtimes`, and the cloud function nobody remembers
 *
 * The Logic Builder node is registered unconditionally in `noodl-runtime.ts` — it is *not* in the
 * `type !== 'cloud'` subtraction — so a visual function can run inside a cloud function, where
 * `sandbox.isolate.js` has no `window` and no injected library script at all. Every library
 * registered through `registerLibrary` is written with `runtimes: ['browser']`. The block is
 * offered anyway (there is no per-runtime toolbox), but it says which runtimes it covers, in the
 * tooltip and in the flyout. See `libraryRuntimeNote`.
 *
 * ## Why a library with no `global` is listed but not offered
 *
 * `listRegisteredLibraries` maps a manifest with no `global` field to `global: ''`. Such a library
 * genuinely cannot be reached by this block — there is no name to read. Dropping it silently
 * produces the worst question in any tool ("my library isn't in the list"), so it is named in the
 * flyout with what to do about it, and it is not a choosable option.
 *
 * @module BlocklyEditor
 */

// Type-only, and it must stay type-only: `projectmodules.ts` imports `fs`, `vm`, `http` and
// `ajv`. `import type` is erased entirely, so this module keeps the property that lets it be
// reached from the plain-Node `tests-unit` runner *and* from `BlocklyToolbox.ts`, which the
// Settings panel imports and which must not drag Blockly or Node built-ins into the main bundle.
import type { RegisteredLibrary } from '../../../../shared/utils/projectmodules';

import { WINDOW_BLOCK_TYPE, WINDOW_CLOUD_WARNING, DEFAULT_WINDOW_PATH } from './windowAccess';

/** The one block type §2 adds. A value block; a library is read, never assigned. */
export const LIBRARY_GLOBAL_BLOCK_TYPE = 'noodl_library_global';

/**
 * The dynamic toolbox category §2 and §3 share.
 *
 * One category, not two, because the report asked for them in one breath and because both
 * generate `window…` — they are the same escape hatch at two levels of ceremony. It sits directly
 * below `App Config`, which is where §1 put itself when it shipped; the task file's original
 * proposal of a single `App & Browser` holding all three was settled by that, not re-opened here.
 */
export const BROWSER_CATEGORY = 'LIBRARIES_BROWSER';

/**
 * Hue for the category and both blocks.
 *
 * 355, by the same arithmetic §1 used for 90. The hues in `BlocklyToolbox.HUE` are now
 * 20, 55, 90, 120, 160, 180, 210, 230, 260, 290 and 330; the widest remaining gap is the wrap
 * from 330 to 20, and 355 is 25° from either neighbour. Every other gap is 20° or less.
 */
export const BROWSER_HUE = '355';

/** Flyout button callback id, registered on the workspace by `BlocklyWorkspace`. */
export const LIBRARIES_SETTINGS_BUTTON = 'appLibrariesOpenSettings';

/** Where a builder goes to register one. Named, not gestured at — VFN-012 criterion 6. */
export const LIBRARIES_SETTINGS_PATH = 'Settings → Project → Libraries';

/** The dropdown entry when this project has registered no reachable library. */
export const NO_LIBRARIES_OPTION = '(no registered libraries)';

/** The dropdown entry while the scan is still in flight. Not the same sentence as the one above. */
export const LOADING_LIBRARIES_OPTION = '(reading libraries…)';

/** The dropdown entry when the libraries could not be read at all. */
export const UNAVAILABLE_LIBRARIES_OPTION = '(libraries unavailable)';

/**
 * The mark on a global this project no longer registers.
 *
 * The same glyph `appConfig.ts` uses, and deliberately a *copy* rather than an import: the two
 * features share a visual language, not a dependency, and a spec pins them equal so the copy
 * cannot drift unnoticed.
 */
export const UNKNOWN_GLOBAL_MARK = '⚠ ';

/** Sentinels the three state predicates key on. Exported so a spec can assert on the text. */
export const LIBRARIES_LOADING_TEXT = "Reading this project's libraries…";
export const LIBRARIES_EMPTY_TEXT = 'This app has no registered libraries yet.';
export const LIBRARIES_UNAVAILABLE_TEXT = "Could not read this project's libraries";

/** The label above the `window` block, so the group is findable by the word in the report. */
export const BROWSER_GROUP_LABEL = 'The browser';

/** What `Blockly.FieldDropdown` calls an option: `[what you read, what is stored]`. */
export type LibraryGlobalOption = [string, string];

export type BrowserFlyoutItem =
  | { kind: 'label'; text: string }
  | { kind: 'button'; text: string; callbackkey: string }
  | { kind: 'block'; type: string; fields: Record<string, string> };

/**
 * What we currently know about this project's registered libraries.
 *
 * 🔴 Three states, and the point of the type is that there is no way to read it without deciding
 * which one you are in. A `RegisteredLibrary[] | null` would have collapsed *unknown* and
 * *unavailable*, which are the two the flyout must not confuse.
 */
export type RegisteredLibrariesSnapshot =
  | { status: 'unknown' }
  | { status: 'loaded'; libraries: RegisteredLibrary[] }
  | { status: 'unavailable'; reason: string };

/** The async read the React layer installs. Throws when there is nothing it can read. */
export type RegisteredLibrariesLoader = () => Promise<unknown>;

const UNKNOWN: RegisteredLibrariesSnapshot = { status: 'unknown' };

let loader: RegisteredLibrariesLoader | null = null;
let snapshot: RegisteredLibrariesSnapshot = UNKNOWN;

/**
 * Guards a slow read from landing on top of a newer one.
 *
 * Bumped by *both* `setRegisteredLibrariesLoader` and `refreshRegisteredLibraries`, so an
 * in-flight scan of the project that was just closed cannot become the answer for the one that
 * just opened. Same device as `CodeAuthoringContext/install.ts`, and for the same reason.
 */
let generation = 0;

/**
 * Point the blocks at a project.
 *
 * Resets the snapshot to `unknown` rather than keeping the previous project's libraries: showing
 * the last project's list while the new one is read is the exact confusion the tri-state exists
 * to prevent.
 */
export function setRegisteredLibrariesLoader(next: RegisteredLibrariesLoader): void {
  loader = typeof next === 'function' ? next : null;
  generation++;
  snapshot = UNKNOWN;
}

/** Put the seam back to "nothing has been read". Used by specs and on project close. */
export function resetRegisteredLibraries(): void {
  loader = null;
  generation++;
  snapshot = UNKNOWN;
}

/** What is known right now — synchronous, because every caller is. */
export function registeredLibrariesSnapshot(): RegisteredLibrariesSnapshot {
  return snapshot;
}

/**
 * Re-read the project's libraries.
 *
 * Resolves with the snapshot that is now current, which is **not** necessarily the one this call
 * produced — a newer read that landed first wins, and this one is discarded. Never rejects: a
 * failed scan is an answer (`unavailable`), not an exception for a flyout callback to swallow.
 */
export async function refreshRegisteredLibraries(): Promise<RegisteredLibrariesSnapshot> {
  const mine = ++generation;

  if (!loader) {
    snapshot = { status: 'unavailable', reason: 'No project is open.' };
    return snapshot;
  }

  let next: RegisteredLibrariesSnapshot;
  try {
    next = { status: 'loaded', libraries: normalizeRegisteredLibraries(await loader()) };
  } catch (error) {
    next = { status: 'unavailable', reason: error instanceof Error ? error.message : String(error) };
  }

  if (mine !== generation) return snapshot;

  snapshot = next;
  return snapshot;
}

/**
 * The pure half of the read, so a spec can hand it whatever `noodl_modules` can hold.
 *
 * `listRegisteredLibraries` already validates manifests against a schema, but it is one read of a
 * directory a human can edit, and it is `await`ed across a seam that erases its type. A non-array
 * answers empty, an entry with no string `moduleName` is dropped, and a duplicate module name
 * keeps the first — folder names are unique on disk, so a duplicate here means the document is
 * not what it claims.
 */
export function normalizeRegisteredLibraries(raw: unknown): RegisteredLibrary[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const out: RegisteredLibrary[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const source = entry as Partial<RegisteredLibrary>;
    if (typeof source.moduleName !== 'string' || source.moduleName === '') continue;
    if (seen.has(source.moduleName)) continue;
    seen.add(source.moduleName);

    out.push({
      moduleName: source.moduleName,
      displayName: typeof source.displayName === 'string' && source.displayName ? source.displayName : source.moduleName,
      global: typeof source.global === 'string' ? source.global.trim() : '',
      dependencies: Array.isArray(source.dependencies) ? source.dependencies : [],
      stylesheets: Array.isArray(source.stylesheets) ? source.stylesheets : [],
      // The manifest schema defaults this to `['browser']` and `listRegisteredLibraries` repeats
      // the default; an empty array here would silently mean "no runtime at all".
      runtimes: Array.isArray(source.runtimes) && source.runtimes.length > 0 ? source.runtimes : ['browser'],
      vendored: source.vendored === true
    });
  }

  return out;
}

/** A valid JavaScript identifier — what `registerLibrary` requires of a global name. */
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** Libraries this block can actually read: the ones that named a global. */
export function reachableLibraries(libraries: RegisteredLibrary[]): RegisteredLibrary[] {
  return libraries.filter((library) => library.global !== '');
}

/** Libraries registered without a global — real, listed, and not readable from here. */
export function unreachableLibraries(libraries: RegisteredLibrary[]): RegisteredLibrary[] {
  return libraries.filter((library) => library.global === '');
}

/** The libraries in a snapshot, or none when there is nothing known to draw on. */
export function librariesIn(snapshot: RegisteredLibrariesSnapshot): RegisteredLibrary[] {
  return snapshot.status === 'loaded' ? snapshot.libraries : [];
}

/** Is this global still registered by some library in the project? */
export function isRegisteredGlobal(snapshot: RegisteredLibrariesSnapshot, global: string): boolean {
  return reachableLibraries(librariesIn(snapshot)).some((library) => library.global === global);
}

/**
 * The dropdown's options.
 *
 * 🔴 **Never empty**, for `appConfigKeyOptions`' reason: `FieldDropdown.getOptions` throws a
 * `TypeError` on an empty array and it is called from the field's own constructor, so an empty
 * list would fail to *build the block* rather than showing an empty one. The placeholder carries
 * the empty global, which the generator refuses to read — and it says which of the three states
 * produced it.
 */
export function libraryGlobalOptions(snapshot: RegisteredLibrariesSnapshot): LibraryGlobalOption[] {
  const seen = new Set<string>();
  const options: LibraryGlobalOption[] = [];

  for (const library of reachableLibraries(librariesIn(snapshot))) {
    if (seen.has(library.global)) continue;
    seen.add(library.global);
    options.push([library.global, library.global]);
  }

  if (options.length > 0) return options;
  return [[emptyOptionText(snapshot), '']];
}

function emptyOptionText(snapshot: RegisteredLibrariesSnapshot): string {
  if (snapshot.status === 'unknown') return LOADING_LIBRARIES_OPTION;
  if (snapshot.status === 'unavailable') return UNAVAILABLE_LIBRARIES_OPTION;
  return NO_LIBRARIES_OPTION;
}

/** The global a freshly dragged block starts on: the first reachable one, or none. */
export function defaultLibraryGlobal(snapshot: RegisteredLibrariesSnapshot): string {
  const reachable = reachableLibraries(librariesIn(snapshot));
  return reachable.length > 0 ? reachable[0].global : '';
}

/**
 * What the block reads on the canvas.
 *
 * 🔴 **The mark is only ever applied against a `loaded` snapshot.** This is the whole async trap
 * in one line: while the scan is in flight we do not know which globals are registered, and
 * marking a perfectly good library `⚠ PocketBase` because a disk read has not returned yet is
 * *exactly* "an async injection sampled early looks like a disposal" — an accusation made from
 * ignorance, on the canvas, in the moment the editor opens. Unknown and unavailable render the
 * global plainly. Only a completed read can say a library is gone.
 */
export function libraryGlobalDisplay(snapshot: RegisteredLibrariesSnapshot, global: string): string {
  if (!global) return emptyOptionText(snapshot);
  if (snapshot.status !== 'loaded') return global;
  return isRegisteredGlobal(snapshot, global) ? global : UNKNOWN_GLOBAL_MARK + global;
}

/**
 * ⚠️ What a library's `runtimes` means for a visual function, in a sentence.
 *
 * Not decoration: the Logic Builder runs in the cloud runtime too, and every library this feature
 * registers is browser-only.
 */
export function libraryRuntimeNote(library: Pick<RegisteredLibrary, 'runtimes'>): string {
  const runtimes = Array.isArray(library.runtimes) && library.runtimes.length > 0 ? library.runtimes : ['browser'];

  if (!runtimes.includes('browser')) {
    return `Not registered for the browser (runtimes: ${runtimes.join(', ')}) — it will not be loaded in the preview.`;
  }
  if (runtimes.length === 1) {
    return 'Browser only — it is not loaded inside a cloud function.';
  }
  return `Runtimes: ${runtimes.join(', ')}.`;
}

/** The hover text: which library this is, where it came from, and — when it is gone — that it is. */
export function libraryTooltip(snapshot: RegisteredLibrariesSnapshot, global: string): string {
  if (!global) {
    if (snapshot.status === 'unknown') return `Reading this project's registered libraries…`;
    if (snapshot.status === 'unavailable') {
      return `Could not read this project's libraries: ${snapshot.reason}`;
    }
    return `This app has no registered libraries yet. Add them in ${LIBRARIES_SETTINGS_PATH}.`;
  }

  if (snapshot.status !== 'loaded') {
    return `Reads window.${global}. This project's libraries have not been read yet, so whether it is still registered is unknown.`;
  }

  const library = reachableLibraries(snapshot.libraries).find((candidate) => candidate.global === global);
  if (!library) {
    return `"${global}" is not registered by any library in this app any more. The program still reads it, and it will be undefined at runtime. Register it again in ${LIBRARIES_SETTINGS_PATH}, or pick another library.`;
  }

  const source = library.vendored ? 'bundled into the project' : 'loaded from its dependency URL';
  return `Reads ${libraryReadExpression(global)} — ${library.displayName}, ${source}. ${libraryRuntimeNote(library)}`;
}

/**
 * The generated expression.
 *
 * `window.<global>` — the spelling the task file asks for, and the spelling that survives a
 * Blockly local variable of the same name, which a bare `PocketBase` would not.
 *
 * A global that is not an identifier cannot be written with a dot, so it falls back to bracket
 * notation. `registerLibrary` rejects those on the way in, but `noodl_modules` is a directory a
 * human can hand-edit and this is the string that ends up in a program.
 */
export function libraryReadExpression(global: string): string {
  if (!global) return 'undefined /* no library chosen */';
  return IDENTIFIER.test(global) ? `window.${global}` : `window[${JSON.stringify(global)}]`;
}

/**
 * The dynamic category's contents: the libraries, then the browser.
 *
 * 🔴 **The `window` block is present in every state.** It has no dependency on the scan, and a
 * builder who came here for `window` must not be told to go and register a library first.
 */
export function browserFlyoutContents(snapshot: RegisteredLibrariesSnapshot): BrowserFlyoutItem[] {
  const items: BrowserFlyoutItem[] = [];

  if (snapshot.status === 'unknown') {
    items.push({ kind: 'label', text: LIBRARIES_LOADING_TEXT });
  } else if (snapshot.status === 'unavailable') {
    items.push({ kind: 'label', text: `${LIBRARIES_UNAVAILABLE_TEXT}: ${snapshot.reason}` });
  } else {
    const reachable = reachableLibraries(snapshot.libraries);
    const unreachable = unreachableLibraries(snapshot.libraries);

    if (reachable.length === 0) {
      items.push({ kind: 'label', text: LIBRARIES_EMPTY_TEXT });
      items.push({ kind: 'label', text: `Add them in ${LIBRARIES_SETTINGS_PATH}.` });
    } else {
      items.push({ kind: 'label', text: 'Registered libraries' });
      const seen = new Set<string>();
      for (const library of reachable) {
        if (seen.has(library.global)) continue;
        seen.add(library.global);
        items.push({ kind: 'block', type: LIBRARY_GLOBAL_BLOCK_TYPE, fields: { GLOBAL: library.global } });
      }
    }

    // Named rather than dropped: "my library isn't in the list" is the question this avoids.
    if (unreachable.length > 0) {
      const names = unreachable.map((library) => library.displayName).join(', ');
      items.push({
        kind: 'label',
        text: `${names} — registered with no global name, so there is nothing to read. Give it one in ${LIBRARIES_SETTINGS_PATH}.`
      });
    }
  }

  items.push({ kind: 'label', text: BROWSER_GROUP_LABEL });
  items.push({ kind: 'block', type: WINDOW_BLOCK_TYPE, fields: { PATH: DEFAULT_WINDOW_PATH } });
  items.push({ kind: 'label', text: WINDOW_CLOUD_WARNING });
  items.push({ kind: 'button', text: 'Open app settings', callbackkey: LIBRARIES_SETTINGS_BUTTON });

  return items;
}

/**
 * The three instruments, and why they are written this way.
 *
 * Each one requires *both* its own sentence **and** the absence of any library block. That second
 * clause is what makes them controls rather than string searches: a flyout that listed libraries
 * *and* said "this app has no registered libraries yet" would fail all three, which is the right
 * answer for a contradiction. The spec asserts exactly one holds for each snapshot state.
 *
 * 🔴 They count `LIBRARY_GLOBAL_BLOCK_TYPE`, not `kind === 'block'`. The `window` block is in
 * every flyout, so a predicate written the lazy way would report *no* empty state, ever.
 */
function hasLibraryBlock(items: BrowserFlyoutItem[]): boolean {
  return items.some((item) => item.kind === 'block' && item.type === LIBRARY_GLOBAL_BLOCK_TYPE);
}

function hasLabelContaining(items: BrowserFlyoutItem[], text: string): boolean {
  return items.some((item) => item.kind === 'label' && (item as { text: string }).text.indexOf(text) !== -1);
}

export function hasLibrariesLoadingState(items: BrowserFlyoutItem[]): boolean {
  return hasLabelContaining(items, LIBRARIES_LOADING_TEXT) && !hasLibraryBlock(items);
}

export function hasLibrariesEmptyState(items: BrowserFlyoutItem[]): boolean {
  return (
    hasLabelContaining(items, LIBRARIES_EMPTY_TEXT) &&
    hasLabelContaining(items, LIBRARIES_SETTINGS_PATH) &&
    !hasLibraryBlock(items)
  );
}

export function hasLibrariesUnavailableState(items: BrowserFlyoutItem[]): boolean {
  return hasLabelContaining(items, LIBRARIES_UNAVAILABLE_TEXT) && !hasLibraryBlock(items);
}

/** Does this flyout offer the `window` escape hatch? True in every state, and asserted so. */
export function hasWindowBlock(items: BrowserFlyoutItem[]): boolean {
  return items.some((item) => item.kind === 'block' && item.type === WINDOW_BLOCK_TYPE);
}

/**
 * The registered category callback.
 *
 * Renders the snapshot **and kicks a fresh read on the way out**. Synchronous rendering of an
 * asynchronous fact means the first open of a freshly-opened project can legitimately say
 * *"reading…"*; the refresh is what guarantees a second open is current, and it is why
 * `BlocklyWorkspace` also calls `refreshRegisteredLibraries()` at injection time — so that in
 * practice the first open is already loaded.
 *
 * 🔴 Fire-and-forget, never awaited, and `refreshRegisteredLibraries` never rejects: an exception
 * escaping here would surface as a toolbox category that does not open, with no clue why.
 */
export function browserFlyout(
  read: () => RegisteredLibrariesSnapshot = registeredLibrariesSnapshot,
  refresh: () => Promise<unknown> = refreshRegisteredLibraries
) {
  return function (): BrowserFlyoutItem[] {
    const items = browserFlyoutContents(read());
    void refresh();
    return items;
  };
}
