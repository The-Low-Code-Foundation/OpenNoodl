/**
 * VFN-012 — the app's own config variables, as blocks.
 *
 * > *"there's still no global variables from the app config (which should be an option next to
 * > App Arrays or App Objects)"*
 *
 * ## 🔴 The naming collision that decides this whole file
 *
 * The toolbox already had a category called **App Variables**, and it is *not* this. That one
 * generates `Noodl.Variables["name"]` — the runtime bag written by Variable nodes, mutable,
 * created by being used. This one generates `Noodl.Config["key"]` — the variables *declared* in
 * Settings → Project → App Config, typed, and immutable at runtime.
 *
 * Two vocabularies, two lifetimes, and one of them was wearing the other's name.
 *
 * 🔴 **VFN-012 resolved that by renaming the other category to `Runtime Variables`. FIX-005
 * reversed it: `Noodl.Variables` is `App Variables` again**, because every other `Noodl.*` shelf
 * here is `App <something>` and one vocabulary beats one disambiguation. See the note on
 * `ToolboxLabels.noodlVariables` for the argument; do not re-litigate it from this side.
 *
 * ✅ **What tells the two apart now is this file, not a category name**: the flyout names
 * {@link APP_CONFIG_SETTINGS_PATH}, so the declared bag says where it is declared and the
 * runtime bag does not — which is a difference a builder can act on, where two adjectives were
 * not. The settings section was called *Custom Variables* until FIX-005 and is now **App
 * Config**, so all three surfaces say one word.
 *
 * Both renames are copy only: the block type ids `noodl_get_variable` / `noodl_set_variable`
 * are in every saved project and do not change (VFN-012 criterion 5).
 *
 * ## Why everything but the field lives here, with no Blockly import
 *
 * `tests-unit` is a plain-Node runner and this module is reachable from it. Blockly itself is
 * importable there (the LGC-009 specs do exactly that), but `ProjectModel` is not — it drags
 * Electron and editor singletons in with it. So the project is reached through a **provider**
 * that defaults to "no variables", and `BlocklyWorkspace` — which is React and has a project —
 * points it at `ProjectModel.instance.getConfigVariables()`.
 *
 * ## 🔴 Read only, and there is no set block
 *
 * `Noodl.Config` is a frozen proxy whose `set` trap logs an error and returns `false`
 * (`noodl-viewer-react/src/api/config.ts`). A "set app config" block would generate code that
 * silently does nothing, which is the worst shape on offer. Config is configuration.
 *
 * @module BlocklyEditor
 */

import type { ConfigVariable } from '@noodl/runtime/src/config/types';

/** The one block type this feature adds. A value block; there is deliberately no setter. */
export const APP_CONFIG_BLOCK_TYPE = 'noodl_get_config';

/** The dynamic toolbox category id. `buildToolbox` names it; `BlocklyWorkspace` fills it in. */
export const APP_CONFIG_CATEGORY = 'APP_CONFIG';

/**
 * Hue for the category and the block. Blockly derives shading from it.
 *
 * 90 because it is the widest gap left in `BlocklyToolbox.HUE`: My Blocks is 55 and Loops is
 * 120, so this sits ~32° from either neighbour. Every other gap was tighter.
 */
export const APP_CONFIG_HUE = '90';

/** Flyout button callback id, registered on the workspace by `BlocklyWorkspace`. */
export const APP_CONFIG_SETTINGS_BUTTON = 'appConfigOpenSettings';

/**
 * Where a builder goes to declare one. Named, not gestured at — VFN-012 criterion 6.
 *
 * ⚠️ **This string must match the settings panel's own section title**
 * (`SettingsPanel/sections/VariablesSection.tsx`), which FIX-005 renamed from *Custom Variables*
 * to *App Config*. It is a route somebody follows with their eyes; a stale one sends them to a
 * heading that is not there.
 */
export const APP_CONFIG_SETTINGS_PATH = 'Settings → Project → App Config';

/** The dropdown entry shown when the project has declared nothing at all. */
export const NO_CONFIG_VARIABLES_OPTION = '(no app config variables)';

/**
 * The mark on a key that is no longer declared.
 *
 * ⚠️ A *mark*, not a substitution: the stored value stays the key the author wrote. See
 * `appConfigKeyDisplay`.
 */
export const UNKNOWN_KEY_MARK = '⚠ ';

/** What `Blockly.FieldDropdown` calls an option: `[what you read, what is stored]`. */
export type AppConfigKeyOption = [string, string];

export type AppConfigFlyoutItem =
  | { kind: 'label'; text: string }
  | { kind: 'button'; text: string; callbackkey: string }
  | { kind: 'block'; type: string; fields: { KEY: string } };

export type ConfigVariablesProvider = () => ConfigVariable[];

const NO_VARIABLES: ConfigVariablesProvider = () => [];

let provider: ConfigVariablesProvider = NO_VARIABLES;

/**
 * Point the blocks at a project.
 *
 * A module-level seam rather than an import because the block definitions must stay reachable
 * from the plain-Node runner, and `ProjectModel` is not. Idempotent and last-writer-wins: one
 * renderer, one project at a time.
 */
export function setConfigVariablesProvider(next: ConfigVariablesProvider): void {
  provider = typeof next === 'function' ? next : NO_VARIABLES;
}

/** Put the seam back to "this project has no config variables". Used by specs. */
export function resetConfigVariablesProvider(): void {
  provider = NO_VARIABLES;
}

/**
 * The declared config variables, defended against everything `project.json` can actually hold.
 *
 * `getConfigVariables()` reads a field of a JSON document a human and three code paths can
 * write, so: a non-array answers empty, an entry with no string `key` is dropped, and a
 * duplicate key keeps the first — which is what `buildFlatConfig` does when it flattens them
 * into `Noodl.Config`, so the dropdown agrees with the runtime rather than with the file.
 *
 * 🔴 A throwing provider answers empty rather than taking out the flyout. An exception here
 * would surface as a toolbox category that does not open, with no clue why.
 */
export function appConfigVariables(): ConfigVariable[] {
  let raw: unknown;
  try {
    raw = provider();
  } catch {
    return [];
  }
  return normalizeConfigVariables(raw);
}

/** The pure half of {@link appConfigVariables}, so a spec can hand it a malformed document. */
export function normalizeConfigVariables(raw: unknown): ConfigVariable[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const out: ConfigVariable[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const key = (entry as ConfigVariable).key;
    if (typeof key !== 'string' || key === '') continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry as ConfigVariable);
  }

  return out;
}

/** Is this key still declared? */
export function isDeclaredConfigKey(variables: ConfigVariable[], key: string): boolean {
  return variables.some((variable) => variable.key === key);
}

/**
 * The dropdown's options.
 *
 * 🔴 **Never empty.** `FieldDropdown.getOptions` throws a `TypeError` on an empty array, and it
 * is called from the field's own constructor — so a project with no config variables would fail
 * to build the block at all rather than showing an empty one. The placeholder carries the empty
 * key, which the generator refuses to read.
 */
export function appConfigKeyOptions(variables: ConfigVariable[]): AppConfigKeyOption[] {
  if (variables.length === 0) return [[NO_CONFIG_VARIABLES_OPTION, '']];
  return variables.map((variable) => [variable.key, variable.key] as AppConfigKeyOption);
}

/** The key a freshly dragged block starts on: the first declared one, or none. */
export function defaultConfigKey(variables: ConfigVariable[]): string {
  return variables.length > 0 ? variables[0].key : '';
}

/**
 * What the block reads on the canvas.
 *
 * ⚠️ VFN-012 criterion 2, and the reason this feature has a custom field at all. A key that has
 * been renamed or deleted in app settings is shown **as itself, marked** — never snapped to a
 * valid one. Measured, not assumed: a stock `Blockly.FieldDropdown` rewrites the stored value to
 * the first available option on load (Blockly 12.3.1, logged as *"Cannot set the dropdown's
 * value to an unavailable option"* and then doing it anyway), so opening a project would
 * silently change a program. See `configKeyField` in `NoodlBlocks.ts`.
 */
export function appConfigKeyDisplay(variables: ConfigVariable[], key: string): string {
  if (!key) return NO_CONFIG_VARIABLES_OPTION;
  return isDeclaredConfigKey(variables, key) ? key : UNKNOWN_KEY_MARK + key;
}

/** The hover text: what this key is, what type it holds, and — when it is gone — that it is. */
export function appConfigTooltip(variables: ConfigVariable[], key: string): string {
  if (!key) {
    return `This app has no config variables yet. Add them in ${APP_CONFIG_SETTINGS_PATH}.`;
  }

  const variable = variables.find((candidate) => candidate.key === key);
  if (!variable) {
    return `"${key}" is not declared in this app's config any more. The program still reads it, and it will be undefined at runtime. Add it back in ${APP_CONFIG_SETTINGS_PATH}, or pick another key.`;
  }

  const description = typeof variable.description === 'string' && variable.description ? ` — ${variable.description}` : '';
  return `Reads Noodl.Config["${key}"] (${variable.type || 'any'})${description}. Set in ${APP_CONFIG_SETTINGS_PATH}; read only at runtime.`;
}

/**
 * The generated expression.
 *
 * `JSON.stringify` rather than the `"${name}"` the neighbouring generators use: it is identical
 * for every key a settings form will produce and it does not break out of the string for the
 * ones it will not.
 *
 * The empty key is the placeholder from a project with nothing declared. It generates
 * `undefined` with a comment rather than `Noodl.Config[""]`, because the second one reads a key
 * that cannot exist and warns about it on the runtime console on every evaluation.
 */
export function appConfigReadExpression(key: string): string {
  if (!key) return 'undefined /* no app config variable chosen */';
  return `Noodl.Config[${JSON.stringify(key)}]`;
}

/**
 * The dynamic category's contents.
 *
 * Dynamic for `VARIABLE`/`PROCEDURE`/`MY_BLOCKS`' reason: app settings change under an open
 * editor, and Blockly rebuilds a `custom` category on every flyout open.
 *
 * 🔴 **An empty category and a category that failed to build must not look the same.** A project
 * with nothing declared gets labels saying so and naming where to go — never `[]`, which is also
 * what a broken callback returns. `hasAppConfigEmptyState` is the predicate that tells them
 * apart, and the spec asserts it both ways round.
 */
export function appConfigFlyoutContents(variables: ConfigVariable[]): AppConfigFlyoutItem[] {
  const openSettings: AppConfigFlyoutItem = {
    kind: 'button',
    text: 'Open app settings',
    callbackkey: APP_CONFIG_SETTINGS_BUTTON
  };

  if (variables.length === 0) {
    return [
      { kind: 'label', text: 'This app has no config variables yet.' },
      { kind: 'label', text: `Declare them in ${APP_CONFIG_SETTINGS_PATH}.` },
      openSettings
    ];
  }

  const items: AppConfigFlyoutItem[] = [];
  const grouped = groupByCategory(variables);
  const named = grouped.length > 1 || (grouped.length === 1 && grouped[0].category !== '');

  for (const group of grouped) {
    if (named) {
      items.push({ kind: 'label', text: group.category || 'General' });
    }
    for (const variable of group.variables) {
      items.push({ kind: 'block', type: APP_CONFIG_BLOCK_TYPE, fields: { KEY: variable.key } });
    }
  }

  items.push(openSettings);
  return items;
}

/**
 * Does this flyout explain its own emptiness?
 *
 * The negative control for the whole category: `hasAppConfigEmptyState([])` is `false`, so a
 * callback that returned nothing — or threw and was caught somewhere upstream — cannot be
 * mistaken for a project that simply has no config variables.
 */
export function hasAppConfigEmptyState(items: AppConfigFlyoutItem[]): boolean {
  const labels = items.filter((item) => item.kind === 'label');
  return (
    labels.length > 0 &&
    labels.some((item) => (item as { text: string }).text.indexOf(APP_CONFIG_SETTINGS_PATH) !== -1) &&
    !items.some((item) => item.kind === 'block')
  );
}

/** Config variables in declaration order, bucketed by their optional `category`. */
function groupByCategory(variables: ConfigVariable[]): { category: string; variables: ConfigVariable[] }[] {
  const order: string[] = [];
  const buckets = new Map<string, ConfigVariable[]>();

  for (const variable of variables) {
    const category = typeof variable.category === 'string' ? variable.category : '';
    if (!buckets.has(category)) {
      buckets.set(category, []);
      order.push(category);
    }
    buckets.get(category)!.push(variable);
  }

  return order.map((category) => ({ category, variables: buckets.get(category)! }));
}

/**
 * The registered category callback.
 *
 * Takes the variables it will show as an argument-free read so the caller does not have to
 * cache anything: the provider is consulted at flyout-open time, which is the only moment the
 * answer is guaranteed current.
 */
export function appConfigFlyout(read: () => ConfigVariable[] = appConfigVariables) {
  return function (): AppConfigFlyoutItem[] {
    return appConfigFlyoutContents(normalizeConfigVariables(read()));
  };
}
