/**
 * VFN-012 §1 — the projection from a project's app config into the toolbox category.
 *
 * > *"there's still no global variables from the app config (which should be an option next to
 * > App Arrays or App Objects)"*
 *
 * No Blockly in this file: everything here is a pure function of what `project.json` holds, and
 * grading it that way is what makes the malformed-document cases reachable at all.
 *
 * ## 🔴 The negative control, and why this suite would otherwise prove nothing
 *
 * A category with no blocks in it and a category that **failed to build** are the same shape —
 * both are "no blocks appeared". A suite that only asserted absences could not tell them apart,
 * and would pass just as happily against a callback that threw and was swallowed upstream. So
 * `hasAppConfigEmptyState` is the instrument, and it is checked *both ways round*: true for a
 * project with nothing declared, false for `[]`. The `[]` case is the control, and it goes red
 * the moment the empty state stops explaining itself.
 */
import type { ConfigVariable } from '@noodl/runtime/src/config/types';

import {
  appConfigFlyout,
  appConfigFlyoutContents,
  appConfigKeyDisplay,
  appConfigKeyOptions,
  appConfigTooltip,
  appConfigVariables,
  defaultConfigKey,
  hasAppConfigEmptyState,
  isDeclaredConfigKey,
  normalizeConfigVariables,
  resetConfigVariablesProvider,
  setConfigVariablesProvider,
  APP_CONFIG_BLOCK_TYPE,
  APP_CONFIG_SETTINGS_BUTTON,
  APP_CONFIG_SETTINGS_PATH,
  NO_CONFIG_VARIABLES_OPTION,
  UNKNOWN_KEY_MARK,
  type AppConfigFlyoutItem
} from '../../src/editor/src/views/BlocklyEditor/appConfig';

function variable(key: string, extra: Partial<ConfigVariable> = {}): ConfigVariable {
  return { key, type: 'string', value: '', ...extra };
}

const THREE: ConfigVariable[] = [
  variable('apiUrl', { type: 'string', value: 'https://example.test', description: 'Where the API lives' }),
  variable('maxItems', { type: 'number', value: 20 }),
  variable('debug', { type: 'boolean', value: false })
];

function blocksIn(items: AppConfigFlyoutItem[]): { type: string; fields: { KEY: string } }[] {
  return items.filter((item) => item.kind === 'block') as { type: string; fields: { KEY: string } }[];
}

function labelsIn(items: AppConfigFlyoutItem[]): string[] {
  return items.filter((item) => item.kind === 'label').map((item) => (item as { text: string }).text);
}

afterEach(() => {
  resetConfigVariablesProvider();
});

describe('VFN-012 — a declared config variable becomes a block', () => {
  it('puts one block per declared variable in the category, carrying its key', () => {
    const items = appConfigFlyoutContents(THREE);

    expect(blocksIn(items).map((block) => block.fields.KEY)).toEqual(['apiUrl', 'maxItems', 'debug']);
    expect(blocksIn(items).every((block) => block.type === APP_CONFIG_BLOCK_TYPE)).toBe(true);
  });

  it('offers no setter — Noodl.Config is immutable, so one block is the whole feature', () => {
    const types = new Set(blocksIn(appConfigFlyoutContents(THREE)).map((block) => block.type));

    expect([...types]).toEqual([APP_CONFIG_BLOCK_TYPE]);
  });

  it('keeps declaration order, so the flyout reads like the settings panel', () => {
    const reversed = [...THREE].reverse();

    expect(blocksIn(appConfigFlyoutContents(reversed)).map((b) => b.fields.KEY)).toEqual([
      'debug',
      'maxItems',
      'apiUrl'
    ]);
  });

  it('groups by the optional category, and does not invent headings when nobody used one', () => {
    const grouped = [
      variable('apiUrl', { category: 'Network' }),
      variable('debug', { category: 'Developer' }),
      variable('retries', { category: 'Network' })
    ];

    expect(labelsIn(appConfigFlyoutContents(grouped))).toEqual(['Network', 'Developer']);
    expect(blocksIn(appConfigFlyoutContents(grouped)).map((b) => b.fields.KEY)).toEqual([
      'apiUrl',
      'retries',
      'debug'
    ]);

    // None of the three carries a category, so there is nothing to head.
    expect(labelsIn(appConfigFlyoutContents(THREE))).toEqual([]);
  });

  it('always offers the door to app settings, empty or not', () => {
    for (const items of [appConfigFlyoutContents(THREE), appConfigFlyoutContents([])]) {
      const buttons = items.filter((item) => item.kind === 'button') as { callbackkey: string }[];
      expect(buttons.length).toBe(1);
      expect(buttons[0].callbackkey).toBe(APP_CONFIG_SETTINGS_BUTTON);
    }
  });
});

describe('VFN-012 criterion 6 — the empty category explains itself', () => {
  it('says there are none, and names where to declare one', () => {
    const items = appConfigFlyoutContents([]);

    expect(blocksIn(items).length).toBe(0);
    expect(labelsIn(items).length).toBeGreaterThan(0);
    expect(labelsIn(items).join(' ')).toContain(APP_CONFIG_SETTINGS_PATH);
  });

  it('🔴 negative control: an empty category and a category that never built are told apart', () => {
    // What a project with no config variables produces.
    expect(hasAppConfigEmptyState(appConfigFlyoutContents([]))).toBe(true);

    // What an unregistered callback, a swallowed throw, or a category that failed to build
    // produces. If this ever answers `true`, the assertion above has stopped meaning anything.
    expect(hasAppConfigEmptyState([])).toBe(false);
    expect(hasAppConfigEmptyState([{ kind: 'label', text: 'something else entirely' }])).toBe(false);

    // And a *populated* category is not an empty state either.
    expect(hasAppConfigEmptyState(appConfigFlyoutContents(THREE))).toBe(false);
  });
});

describe('VFN-012 — the dropdown options', () => {
  it('offers exactly the declared keys', () => {
    expect(appConfigKeyOptions(THREE)).toEqual([
      ['apiUrl', 'apiUrl'],
      ['maxItems', 'maxItems'],
      ['debug', 'debug']
    ]);
  });

  it('🔴 is never empty — Blockly throws on an empty option list, from the field constructor', () => {
    const options = appConfigKeyOptions([]);

    expect(options.length).toBe(1);
    expect(options[0][0]).toBe(NO_CONFIG_VARIABLES_OPTION);
    // The placeholder stores no key, so the generator can refuse to read it.
    expect(options[0][1]).toBe('');
  });

  it('starts a fresh block on the first declared key, and on nothing when there are none', () => {
    expect(defaultConfigKey(THREE)).toBe('apiUrl');
    expect(defaultConfigKey([])).toBe('');
  });
});

describe('VFN-012 criterion 2 — a renamed or deleted key is shown as itself, marked', () => {
  it('renders a declared key plainly', () => {
    expect(appConfigKeyDisplay(THREE, 'maxItems')).toBe('maxItems');
  });

  it('🔴 renders a key app settings no longer declares as itself, with a mark', () => {
    const afterDelete = THREE.filter((v) => v.key !== 'maxItems');

    expect(appConfigKeyDisplay(afterDelete, 'maxItems')).toBe(UNKNOWN_KEY_MARK + 'maxItems');
    // The thing the task forbids: snapping to a valid option. The old key must still be in there.
    expect(appConfigKeyDisplay(afterDelete, 'maxItems')).toContain('maxItems');
    expect(appConfigKeyDisplay(afterDelete, 'maxItems')).not.toBe('apiUrl');
  });

  it('says so in the tooltip too, and names the way back', () => {
    const afterDelete = THREE.filter((v) => v.key !== 'maxItems');

    expect(appConfigTooltip(afterDelete, 'maxItems')).toContain('not declared');
    expect(appConfigTooltip(afterDelete, 'maxItems')).toContain(APP_CONFIG_SETTINGS_PATH);
    // A declared one describes what it is instead.
    expect(appConfigTooltip(THREE, 'apiUrl')).toContain('Where the API lives');
    expect(appConfigTooltip(THREE, 'maxItems')).toContain('number');
  });

  it('answers the empty key with the "declare one first" tooltip, not with a phantom variable', () => {
    expect(appConfigTooltip([], '')).toContain(APP_CONFIG_SETTINGS_PATH);
    expect(isDeclaredConfigKey([], '')).toBe(false);
  });
});

describe('VFN-012 — what a real project.json can actually hold', () => {
  it('answers empty for a project that has never opened app settings', () => {
    expect(normalizeConfigVariables(undefined)).toEqual([]);
    expect(normalizeConfigVariables(null)).toEqual([]);
    expect(normalizeConfigVariables({})).toEqual([]);
    expect(normalizeConfigVariables('nope')).toEqual([]);
  });

  it('drops entries with no usable key rather than putting a nameless block on the shelf', () => {
    const messy = [variable('good'), { type: 'string', value: 1 }, null, { key: 42 }, { key: '' }] as unknown[];

    expect(normalizeConfigVariables(messy).map((v) => v.key)).toEqual(['good']);
  });

  it('keeps the first of a duplicated key, which is the one Noodl.Config would resolve to', () => {
    const dupes = [variable('apiUrl', { value: 'first' }), variable('apiUrl', { value: 'second' })];

    expect(normalizeConfigVariables(dupes).map((v) => v.value)).toEqual(['first']);
  });
});

describe('VFN-012 — the provider seam', () => {
  it('is empty until a project is pointed at it, so the plain-Node runner sees no project', () => {
    expect(appConfigVariables()).toEqual([]);
  });

  it('reads the project live, on every call — a flyout opened after an edit sees the edit', () => {
    let declared = [variable('apiUrl')];
    setConfigVariablesProvider(() => declared);

    expect(appConfigVariables().map((v) => v.key)).toEqual(['apiUrl']);

    declared = [variable('apiUrl'), variable('theme')];
    expect(appConfigVariables().map((v) => v.key)).toEqual(['apiUrl', 'theme']);
  });

  it('🔴 a throwing provider costs the category its contents, never its ability to open', () => {
    setConfigVariablesProvider(() => {
      throw new Error('no project open');
    });

    expect(appConfigVariables()).toEqual([]);
    // …and the flyout that reads it still explains itself rather than coming back bare.
    expect(hasAppConfigEmptyState(appConfigFlyout(appConfigVariables)())).toBe(true);
  });

  it('normalises whatever the provider hands the flyout, not just whatever a spec hands it', () => {
    setConfigVariablesProvider(() => [variable('ok'), { key: '' }] as ConfigVariable[]);

    expect(blocksIn(appConfigFlyout(appConfigVariables)()).map((b) => b.fields.KEY)).toEqual(['ok']);
  });
});
