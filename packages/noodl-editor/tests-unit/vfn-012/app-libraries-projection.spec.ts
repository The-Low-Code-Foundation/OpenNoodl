/**
 * VFN-012 §2 — the projection from `noodl_modules/` into the toolbox category.
 *
 * No Blockly here: everything is a pure function of what the library scan returned, and grading
 * it that way is what makes the malformed-document and the *not-yet-read* cases reachable at all.
 *
 * ## 🔴 The three states, and why a two-state design would have been a lie
 *
 * `listRegisteredLibraries` reads the filesystem and is async; a flyout callback is synchronous.
 * So there is a real window — the first tick of every session — in which the honest answer is
 * **"I have not looked yet"**. Collapse that into "there are none" and two things happen, both
 * silent:
 *
 * 1. the flyout tells a project with five libraries that it has none, and names a settings page
 *    the author has already used;
 * 2. every block on the canvas holding a global renders `⚠ PocketBase` — an accusation of
 *    deletion, made from ignorance, in the moment the editor opens.
 *
 * That second one is this repo's *"an async injection sampled early looks like a disposal"*
 * written out in a new place, and it is the defect this suite is mostly about. `hasLibrariesLoadingState`
 * / `hasLibrariesEmptyState` / `hasLibrariesUnavailableState` are the instruments, and the first
 * test below asserts **exactly one** of the three holds in each state — so a predicate that
 * quietly stopped discriminating fails rather than passing three times over.
 */
import type { RegisteredLibrary } from '../../src/shared/utils/projectmodules';

import { UNKNOWN_KEY_MARK } from '../../src/editor/src/views/BlocklyEditor/appConfig';
import {
  browserFlyout,
  browserFlyoutContents,
  defaultLibraryGlobal,
  hasLibrariesEmptyState,
  hasLibrariesLoadingState,
  hasLibrariesUnavailableState,
  hasWindowBlock,
  isRegisteredGlobal,
  libraryGlobalDisplay,
  libraryGlobalOptions,
  libraryReadExpression,
  libraryRuntimeNote,
  libraryTooltip,
  normalizeRegisteredLibraries,
  reachableLibraries,
  refreshRegisteredLibraries,
  registeredLibrariesSnapshot,
  resetRegisteredLibraries,
  setRegisteredLibrariesLoader,
  unreachableLibraries,
  LIBRARIES_SETTINGS_PATH,
  LIBRARY_GLOBAL_BLOCK_TYPE,
  LOADING_LIBRARIES_OPTION,
  NO_LIBRARIES_OPTION,
  UNAVAILABLE_LIBRARIES_OPTION,
  UNKNOWN_GLOBAL_MARK,
  type BrowserFlyoutItem,
  type RegisteredLibrariesSnapshot
} from '../../src/editor/src/views/BlocklyEditor/appLibraries';
import { WINDOW_BLOCK_TYPE } from '../../src/editor/src/views/BlocklyEditor/windowAccess';

function library(global: string, extra: Partial<RegisteredLibrary> = {}): RegisteredLibrary {
  return {
    moduleName: global.toLowerCase() || 'unnamed',
    displayName: global || 'Unnamed',
    global,
    dependencies: [],
    stylesheets: [],
    runtimes: ['browser'],
    vendored: false,
    ...extra
  };
}

const UNKNOWN: RegisteredLibrariesSnapshot = { status: 'unknown' };
const NONE: RegisteredLibrariesSnapshot = { status: 'loaded', libraries: [] };
const BROKEN: RegisteredLibrariesSnapshot = { status: 'unavailable', reason: 'permission denied' };
function loaded(...libraries: RegisteredLibrary[]): RegisteredLibrariesSnapshot {
  return { status: 'loaded', libraries };
}

const POCKETBASE = library('PocketBase', { displayName: 'PocketBase', vendored: true });
const TINYMCE = library('tinymce', { displayName: 'tinyMCE' });

function labelsIn(items: BrowserFlyoutItem[]): string[] {
  return items.filter((item) => item.kind === 'label').map((item) => (item as { text: string }).text);
}

function libraryBlocksIn(items: BrowserFlyoutItem[]): string[] {
  return items
    .filter((item) => item.kind === 'block' && (item as { type: string }).type === LIBRARY_GLOBAL_BLOCK_TYPE)
    .map((item) => (item as { fields: Record<string, string> }).fields.GLOBAL);
}

afterEach(() => {
  resetRegisteredLibraries();
});

describe('VFN-012 §2 — 🔴 the three states are three states', () => {
  const CASES: { name: string; snapshot: RegisteredLibrariesSnapshot; expected: [boolean, boolean, boolean] }[] = [
    { name: 'not read yet', snapshot: UNKNOWN, expected: [true, false, false] },
    { name: 'read, and there are none', snapshot: NONE, expected: [false, true, false] },
    { name: 'could not be read', snapshot: BROKEN, expected: [false, false, true] },
    { name: 'read, and there are some', snapshot: loaded(POCKETBASE), expected: [false, false, false] }
  ];

  for (const testCase of CASES) {
    it(`tells "${testCase.name}" apart from the other two`, () => {
      const items = browserFlyoutContents(testCase.snapshot);
      expect([
        hasLibrariesLoadingState(items),
        hasLibrariesEmptyState(items),
        hasLibrariesUnavailableState(items)
      ]).toEqual(testCase.expected);
    });
  }

  it('🔴 negative control: an empty flyout satisfies none of the three', () => {
    // The shape a callback that threw upstream, or was never registered, produces. If any
    // predicate matched it, every "the category explains itself" test above would pass vacuously.
    expect(hasLibrariesLoadingState([])).toBe(false);
    expect(hasLibrariesEmptyState([])).toBe(false);
    expect(hasLibrariesUnavailableState([])).toBe(false);
  });

  it('🔴 negative control: a flyout that both lists libraries and claims there are none is no state at all', () => {
    const contradiction: BrowserFlyoutItem[] = [
      ...browserFlyoutContents(NONE),
      { kind: 'block', type: LIBRARY_GLOBAL_BLOCK_TYPE, fields: { GLOBAL: 'PocketBase' } }
    ];
    expect(hasLibrariesEmptyState(contradiction)).toBe(false);
  });

  it('the loading sentence and the empty sentence are not the same sentence', () => {
    expect(labelsIn(browserFlyoutContents(UNKNOWN))).not.toEqual(labelsIn(browserFlyoutContents(NONE)));
    expect(LOADING_LIBRARIES_OPTION).not.toBe(NO_LIBRARIES_OPTION);
    expect(UNAVAILABLE_LIBRARIES_OPTION).not.toBe(NO_LIBRARIES_OPTION);
  });

  it('the unavailable state says why, because "could not read" alone is not actionable', () => {
    expect(labelsIn(browserFlyoutContents(BROKEN)).join(' ')).toContain('permission denied');
  });
});

describe('VFN-012 §2 — 🔴 a scan in flight is not a deleted library', () => {
  /**
   * The single most important behaviour in this half. A block saved on `PocketBase` renders the
   * moment the editor opens — before any disk read has returned. Marking it then would tell the
   * author their library is gone, on the strength of having not looked.
   */
  it('does not mark a global while the libraries are still being read', () => {
    expect(libraryGlobalDisplay(UNKNOWN, 'PocketBase')).toBe('PocketBase');
    expect(libraryGlobalDisplay(UNKNOWN, 'PocketBase')).not.toContain(UNKNOWN_GLOBAL_MARK);
  });

  it('does not mark a global when the libraries could not be read at all', () => {
    expect(libraryGlobalDisplay(BROKEN, 'PocketBase')).toBe('PocketBase');
  });

  it('🔴 does mark it once a completed read says it is gone — the instrument can see the opposite', () => {
    expect(libraryGlobalDisplay(loaded(TINYMCE), 'PocketBase')).toBe(UNKNOWN_GLOBAL_MARK + 'PocketBase');
    expect(libraryGlobalDisplay(NONE, 'PocketBase')).toBe(UNKNOWN_GLOBAL_MARK + 'PocketBase');
  });

  it('leaves a registered global unmarked', () => {
    expect(libraryGlobalDisplay(loaded(POCKETBASE, TINYMCE), 'PocketBase')).toBe('PocketBase');
  });

  it('says which state produced an empty field, rather than one word for all three', () => {
    expect(libraryGlobalDisplay(UNKNOWN, '')).toBe(LOADING_LIBRARIES_OPTION);
    expect(libraryGlobalDisplay(NONE, '')).toBe(NO_LIBRARIES_OPTION);
    expect(libraryGlobalDisplay(BROKEN, '')).toBe(UNAVAILABLE_LIBRARIES_OPTION);
  });

  it('the tooltip is honest about not knowing, too', () => {
    expect(libraryTooltip(UNKNOWN, 'PocketBase')).toContain('not been read yet');
    expect(libraryTooltip(loaded(TINYMCE), 'PocketBase')).toContain('not registered by any library');
    expect(libraryTooltip(loaded(POCKETBASE), 'PocketBase')).toContain('PocketBase');
  });

  it('uses the same mark §1 uses — one visual language, pinned so the copy cannot drift', () => {
    expect(UNKNOWN_GLOBAL_MARK).toBe(UNKNOWN_KEY_MARK);
  });
});

describe('VFN-012 §2 — the flyout', () => {
  it('lists a block per reachable library, in declaration order', () => {
    expect(libraryBlocksIn(browserFlyoutContents(loaded(POCKETBASE, TINYMCE)))).toEqual(['PocketBase', 'tinymce']);
  });

  it('names a library registered with no global instead of dropping it', () => {
    const nameless = library('', { moduleName: 'chart-js', displayName: 'Chart.js' });
    const labels = labelsIn(browserFlyoutContents(loaded(POCKETBASE, nameless))).join(' ');

    expect(libraryBlocksIn(browserFlyoutContents(loaded(POCKETBASE, nameless)))).toEqual(['PocketBase']);
    expect(labels).toContain('Chart.js');
    expect(labels).toContain('no global name');
    expect(labels).toContain(LIBRARIES_SETTINGS_PATH);
  });

  it('🔴 offers `window` in every state, including the one that says there are no libraries', () => {
    for (const snapshot of [UNKNOWN, NONE, BROKEN, loaded(POCKETBASE)]) {
      expect(hasWindowBlock(browserFlyoutContents(snapshot))).toBe(true);
    }
  });

  it('🔴 negative control: `hasWindowBlock` can say no', () => {
    expect(hasWindowBlock([])).toBe(false);
    expect(hasWindowBlock([{ kind: 'block', type: LIBRARY_GLOBAL_BLOCK_TYPE, fields: { GLOBAL: 'x' } }])).toBe(false);
  });

  it('gives the window block a path to start on, so it does not open on a bare `window`', () => {
    const windowBlock = browserFlyoutContents(NONE).find(
      (item) => item.kind === 'block' && item.type === WINDOW_BLOCK_TYPE
    ) as { fields: Record<string, string> };
    expect(windowBlock.fields.PATH).toBe('location.href');
  });

  it('names where to register a library, in every state — it is the only signpost back', () => {
    for (const snapshot of [UNKNOWN, NONE, BROKEN, loaded(POCKETBASE)]) {
      const items = browserFlyoutContents(snapshot);
      expect(items.some((item) => item.kind === 'button')).toBe(true);
    }
    expect(labelsIn(browserFlyoutContents(NONE)).join(' ')).toContain(LIBRARIES_SETTINGS_PATH);
  });

  it('shows one block per global when two libraries claim the same one', () => {
    const first = library('PocketBase', { moduleName: 'pb-a', displayName: 'PocketBase A' });
    const second = library('PocketBase', { moduleName: 'pb-b', displayName: 'PocketBase B' });
    expect(libraryBlocksIn(browserFlyoutContents(loaded(first, second)))).toEqual(['PocketBase']);
  });
});

describe('VFN-012 §2 — the dropdown options', () => {
  it('🔴 is never empty — `FieldDropdown.getOptions` throws on an empty array from its constructor', () => {
    for (const snapshot of [UNKNOWN, NONE, BROKEN]) {
      expect(libraryGlobalOptions(snapshot).length).toBeGreaterThan(0);
    }
  });

  it('carries the empty global on the placeholder, which the generator refuses to read', () => {
    expect(libraryGlobalOptions(NONE)).toEqual([[NO_LIBRARIES_OPTION, '']]);
    expect(libraryGlobalOptions(UNKNOWN)).toEqual([[LOADING_LIBRARIES_OPTION, '']]);
    expect(libraryGlobalOptions(BROKEN)).toEqual([[UNAVAILABLE_LIBRARIES_OPTION, '']]);
  });

  it('offers the reachable globals, deduplicated, and never the unreachable ones', () => {
    const nameless = library('', { moduleName: 'chart-js', displayName: 'Chart.js' });
    expect(libraryGlobalOptions(loaded(POCKETBASE, nameless, TINYMCE))).toEqual([
      ['PocketBase', 'PocketBase'],
      ['tinymce', 'tinymce']
    ]);
  });

  it('opens a freshly dragged block on the first reachable library, or on nothing', () => {
    expect(defaultLibraryGlobal(loaded(POCKETBASE, TINYMCE))).toBe('PocketBase');
    expect(defaultLibraryGlobal(loaded(library(''), TINYMCE))).toBe('tinymce');
    expect(defaultLibraryGlobal(NONE)).toBe('');
    expect(defaultLibraryGlobal(UNKNOWN)).toBe('');
  });
});

describe('VFN-012 §2 — the generated expression', () => {
  it('generates `window.<global>` for an identifier', () => {
    expect(libraryReadExpression('PocketBase')).toBe('window.PocketBase');
    expect(libraryReadExpression('$')).toBe('window.$');
  });

  it('falls back to bracket notation for a global a hand-edited manifest could hold', () => {
    expect(libraryReadExpression('my lib')).toBe('window["my lib"]');
    expect(libraryReadExpression('2fast')).toBe('window["2fast"]');
    expect(libraryReadExpression('a"b')).toBe('window["a\\"b"]');
  });

  it('refuses to read the empty global rather than generating `window[""]`', () => {
    expect(libraryReadExpression('')).toBe('undefined /* no library chosen */');
  });
});

describe('VFN-012 §2 — ⚠️ runtimes, and the cloud function nobody remembers', () => {
  it('says a browser-only library is not there in a cloud function', () => {
    expect(libraryRuntimeNote({ runtimes: ['browser'] })).toContain('not loaded inside a cloud function');
  });

  it('says a library registered for neither browser nor anything useful will not be in the preview', () => {
    expect(libraryRuntimeNote({ runtimes: ['cloud'] })).toContain('Not registered for the browser');
  });

  it('lists the runtimes when there is more than one', () => {
    expect(libraryRuntimeNote({ runtimes: ['browser', 'cloud'] })).toBe('Runtimes: browser, cloud.');
  });

  it('treats an absent list as the manifest default rather than "no runtime at all"', () => {
    expect(libraryRuntimeNote({ runtimes: [] })).toContain('Browser only');
  });

  it('the tooltip carries it, which is where a builder will actually meet it', () => {
    expect(libraryTooltip(loaded(POCKETBASE), 'PocketBase')).toContain('not loaded inside a cloud function');
    expect(libraryTooltip(loaded(POCKETBASE), 'PocketBase')).toContain('bundled into the project');
    expect(libraryTooltip(loaded(TINYMCE), 'tinymce')).toContain('dependency URL');
  });
});

describe('VFN-012 §2 — what `noodl_modules` can actually hold', () => {
  it('answers empty for anything that is not a list', () => {
    expect(normalizeRegisteredLibraries(undefined)).toEqual([]);
    expect(normalizeRegisteredLibraries(null)).toEqual([]);
    expect(normalizeRegisteredLibraries({ moduleName: 'x' })).toEqual([]);
    expect(normalizeRegisteredLibraries('pocketbase')).toEqual([]);
  });

  it('drops entries with no module name and keeps the first of a duplicate', () => {
    const raw = [
      { moduleName: 'pb', global: 'PocketBase' },
      { moduleName: '', global: 'Nope' },
      null,
      'nope',
      { global: 'AlsoNope' },
      { moduleName: 'pb', global: 'Second' }
    ];
    expect(normalizeRegisteredLibraries(raw).map((l) => l.global)).toEqual(['PocketBase']);
  });

  it('fills in the shape the rest of the module relies on', () => {
    const [only] = normalizeRegisteredLibraries([{ moduleName: 'pb' }]);
    expect(only).toEqual({
      moduleName: 'pb',
      displayName: 'pb',
      global: '',
      dependencies: [],
      stylesheets: [],
      runtimes: ['browser'],
      vendored: false
    });
  });

  it('trims a global, because a trailing space would generate `window[" X"]`', () => {
    expect(normalizeRegisteredLibraries([{ moduleName: 'pb', global: '  PocketBase ' }])[0].global).toBe('PocketBase');
  });

  it('splits reachable from unreachable on whether there is a name to read', () => {
    const libraries = normalizeRegisteredLibraries([
      { moduleName: 'pb', global: 'PocketBase' },
      { moduleName: 'chart', global: '' }
    ]);
    expect(reachableLibraries(libraries).map((l) => l.moduleName)).toEqual(['pb']);
    expect(unreachableLibraries(libraries).map((l) => l.moduleName)).toEqual(['chart']);
    expect(isRegisteredGlobal(loaded(...libraries), 'PocketBase')).toBe(true);
    expect(isRegisteredGlobal(loaded(...libraries), '')).toBe(false);
  });
});

describe('VFN-012 §2 — 🔴 the asynchronous seam', () => {
  it('starts not knowing, and only a completed read changes that', async () => {
    setRegisteredLibrariesLoader(async () => [{ moduleName: 'pb', global: 'PocketBase' }]);

    // Sampled *before* awaiting: this is the state a flyout opened in the first tick sees.
    expect(registeredLibrariesSnapshot()).toEqual({ status: 'unknown' });

    await refreshRegisteredLibraries();
    expect(registeredLibrariesSnapshot().status).toBe('loaded');
    expect(libraryGlobalOptions(registeredLibrariesSnapshot())).toEqual([['PocketBase', 'PocketBase']]);
  });

  it('🔴 a loader that throws produces `unavailable`, never `loaded: []`', async () => {
    setRegisteredLibrariesLoader(async () => {
      throw new Error('this project has no directory on disk yet.');
    });

    const snapshot = await refreshRegisteredLibraries();
    expect(snapshot.status).toBe('unavailable');
    expect((snapshot as { reason: string }).reason).toBe('this project has no directory on disk yet.');
    expect(hasLibrariesUnavailableState(browserFlyoutContents(snapshot))).toBe(true);
    expect(hasLibrariesEmptyState(browserFlyoutContents(snapshot))).toBe(false);
  });

  it('never rejects — an exception out of here is a category that will not open', async () => {
    setRegisteredLibrariesLoader(() => Promise.reject('a string, not an Error'));
    await expect(refreshRegisteredLibraries()).resolves.toEqual({
      status: 'unavailable',
      reason: 'a string, not an Error'
    });
  });

  it('with no loader installed, says so rather than inventing an empty project', async () => {
    resetRegisteredLibraries();
    expect((await refreshRegisteredLibraries()).status).toBe('unavailable');
  });

  it('forgets the previous project rather than showing its libraries against the new one', async () => {
    setRegisteredLibrariesLoader(async () => [{ moduleName: 'pb', global: 'PocketBase' }]);
    await refreshRegisteredLibraries();
    expect(registeredLibrariesSnapshot().status).toBe('loaded');

    setRegisteredLibrariesLoader(async () => [{ moduleName: 'tiny', global: 'tinymce' }]);
    expect(registeredLibrariesSnapshot()).toEqual({ status: 'unknown' });
  });

  it('🔴 a slow read cannot land on top of a newer one', async () => {
    let releaseSlow: (value: unknown) => void = () => undefined;
    const slow = new Promise((resolve) => {
      releaseSlow = resolve;
    });

    setRegisteredLibrariesLoader(async () => {
      await slow;
      return [{ moduleName: 'old', global: 'FromTheOldProject' }];
    });
    const slowRefresh = refreshRegisteredLibraries();

    setRegisteredLibrariesLoader(async () => [{ moduleName: 'new', global: 'FromTheNewProject' }]);
    await refreshRegisteredLibraries();
    expect(libraryGlobalOptions(registeredLibrariesSnapshot())).toEqual([
      ['FromTheNewProject', 'FromTheNewProject']
    ]);

    releaseSlow(undefined);
    await slowRefresh;

    // The stale read resolved last and was discarded, not applied.
    expect(libraryGlobalOptions(registeredLibrariesSnapshot())).toEqual([
      ['FromTheNewProject', 'FromTheNewProject']
    ]);
  });

  it('🔴 the flyout polls: opening it asks for a fresh read rather than trusting one sample', async () => {
    let reads = 0;
    setRegisteredLibrariesLoader(async () => {
      reads += 1;
      return [{ moduleName: 'pb', global: 'PocketBase' }];
    });

    const flyout = browserFlyout();

    // First open: nothing has landed, so it says so — and asks.
    expect(hasLibrariesLoadingState(flyout())).toBe(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(reads).toBe(1);

    // Second open: the answer is there.
    expect(libraryBlocksIn(flyout())).toEqual(['PocketBase']);
    expect(reads).toBe(2);
  });

  it('🔴 negative control: a flyout wired to a snapshot that never advances stays in the loading state', () => {
    // If `browserFlyout` rendered from anything other than the snapshot it is handed, this would
    // show libraries anyway and the poll test above would be measuring nothing.
    const stuck = browserFlyout(
      () => UNKNOWN,
      () => Promise.resolve()
    );
    expect(hasLibrariesLoadingState(stuck())).toBe(true);
    expect(libraryBlocksIn(stuck())).toEqual([]);
  });
});
