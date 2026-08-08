/**
 * BEN-002 — What control an input gets, and what the thing you typed becomes.
 *
 * The rules the inputs rail runs on, kept out of React for the reason
 * `previewScope.ts` and `sandboxDataDraft.ts` are: a rule only a live driver can
 * check is a rule that does not get checked, and these decide what a user sees
 * and what the runtime is handed.
 *
 * ## The honest limitation, inherited
 *
 * A component port's `type` is **derived from its connections**
 * (`ComponentModel._deriveType`), so an input wired to nothing arrives as `'*'`
 * with no default. On a real corpus that is the normal path, not the edge case.
 * The rail therefore has a genuine untyped control and labels it as one: a guess
 * presented as a type is how the bench starts lying, which is the failure this
 * whole phase exists to prevent.
 *
 * ## Where this deviates from the task file, and why
 *
 * BEN-002 §1 maps `stringlist` to a select. It cannot be one: `stringlist` is a
 * comma-separated *string*, it enumerates nothing, and there is no option set to
 * populate a select from. A select over no options is an empty dropdown that
 * looks broken. It gets a text field, and the row's type hint says `stringlist`
 * so the comma convention is at least visible. See register B11.
 *
 * @module noodl-editor/views/VisualCanvas/benchInputs
 */

import { BENCH_COMPONENT_NAME, BENCH_NODE_ID, type BenchPort } from '@noodl-models/AiAssistant/authoring';

/** The controls the rail can render. One per row. */
export type BenchControlKind = 'text' | 'number' | 'boolean' | 'color' | 'enum' | 'json' | 'signal' | 'untyped';

/**
 * The port type as a plain name.
 *
 * A Noodl port type is either a string (`'string'`) or an object carrying the
 * name plus extras (`{ name: 'enum', enums: [...] }`, `{ name: 'number', units
 * }`). Both spellings mean the same thing to everything downstream, so they are
 * flattened here once rather than at seven call sites.
 */
export function portTypeName(type: unknown): string {
  if (typeof type === 'string') return type;
  if (type && typeof type === 'object') {
    const name = (type as { name?: unknown }).name;
    if (typeof name === 'string') return name;
  }
  return '*';
}

/**
 * The control for a port.
 *
 * An unrecognised *named* type falls to a text field rather than to `untyped`:
 * the port does have a type, this module simply has no richer editor for it, and
 * calling it untyped would be a second kind of lie. The row shows the type name
 * either way, so what the bench knows is on screen.
 */
export function benchControlKind(port: BenchPort): BenchControlKind {
  const name = portTypeName(port.type);
  switch (name) {
    case 'signal':
      return 'signal';
    case 'boolean':
      return 'boolean';
    case 'number':
      return 'number';
    case 'enum':
      return 'enum';
    case 'color':
      return 'color';
    case 'object':
    case 'array':
      return 'json';
    case '*':
      return 'untyped';
    default:
      return 'text';
  }
}

export interface BenchEnumOption {
  label: string;
  value: string;
}

/**
 * The options for an enum port.
 *
 * Both shapes the library uses are accepted — `['a', 'b']` and
 * `[{ label, value }]` — because both appear in `noodl-runtime`'s own node
 * definitions and a rail that handled one would render an empty dropdown for
 * half the corpus.
 */
export function benchEnumOptions(port: BenchPort): BenchEnumOption[] {
  const type = port.type;
  if (!type || typeof type !== 'object') return [];

  const enums = (type as { enums?: unknown }).enums;
  if (!Array.isArray(enums)) return [];

  return enums
    .map((entry): BenchEnumOption | undefined => {
      if (typeof entry === 'string') return { label: entry, value: entry };
      if (entry && typeof entry === 'object') {
        const value = (entry as { value?: unknown }).value;
        const label = (entry as { label?: unknown }).label;
        if (typeof value === 'string' || typeof value === 'number') {
          return { label: typeof label === 'string' ? label : String(value), value: String(value) };
        }
      }
      return undefined;
    })
    .filter((option): option is BenchEnumOption => option !== undefined);
}

export interface BenchInputGroup {
  /** The port group, or `''` for the ungrouped ones. Rendered without a header when empty. */
  name: string;
  inputs: BenchPort[];
}

/**
 * The rail's rows, grouped.
 *
 * Order is preserved rather than re-sorted: `getPorts()` already sorts by
 * `index`, which is the order the component's author put the ports in, and
 * re-sorting here would silently disagree with the component ports panel about
 * what order this component's interface is in. Groups appear in the order they
 * are first met, and the ungrouped rows stay at the top where they were.
 */
export function benchInputGroups(inputs: BenchPort[]): BenchInputGroup[] {
  const groups: BenchInputGroup[] = [];
  const byName = new Map<string, BenchInputGroup>();

  for (const port of inputs) {
    const name = typeof port.group === 'string' ? port.group : '';
    let group = byName.get(name);
    if (!group) {
      group = { name, inputs: [] };
      byName.set(name, group);
      groups.push(group);
    }
    group.inputs.push(port);
  }

  return groups;
}

/** What a control hands back: a value to send, or a reason it was not sent. */
export interface BenchValueResult {
  /** `undefined` means *unset* — the runtime falls back to the port's default. */
  value?: unknown;
  /** Set when the input could not be turned into a value. Nothing is sent. */
  error?: string;
}

/**
 * Turn what was typed into what the runtime is handed.
 *
 * ⚠️ **A `NaN` is never returned as a value.** Phase-55 found a `var()` token
 * reaching a coercing port as `"NaNpx"` and the property being *deleted* — the
 * styling vanished with no message. A number field that cannot parse reports an
 * error and sends nothing, so the preview keeps the last good value and the row
 * says why.
 *
 * An empty *text* field is an empty string, not an absence: "show me this with
 * no title" is a state worth previewing, and Reset is how you go back to unset.
 * An empty *number* is an absence, because there is no such number.
 */
export function coerceBenchValue(kind: BenchControlKind, raw: unknown): BenchValueResult {
  if (kind === 'boolean') return { value: Boolean(raw) };

  const text = raw === undefined || raw === null ? '' : String(raw);

  switch (kind) {
    case 'number': {
      if (text.trim() === '') return { value: undefined };
      const parsed = Number(text.trim());
      if (!Number.isFinite(parsed)) return { error: `“${text}” is not a number` };
      return { value: parsed };
    }

    case 'json': {
      if (text.trim() === '') return { value: undefined };
      try {
        return { value: JSON.parse(text) };
      } catch (error) {
        return { error: error instanceof Error ? error.message : 'Not valid JSON' };
      }
    }

    /**
     * The bench is guessing here and says so in the UI. JSON first so `12`,
     * `true` and `["a"]` reach the component as the things they look like;
     * anything that does not parse is passed through as the string it is,
     * which is what an unwired port most often wants.
     */
    case 'untyped': {
      if (text === '') return { value: undefined };
      try {
        return { value: JSON.parse(text) };
      } catch {
        return { value: text };
      }
    }

    default:
      return { value: text };
  }
}

/**
 * The `modelUpdate` payload that sets one input on the mounted component.
 *
 * Named after the harness rather than the target: the parameter is set on the
 * *instance node* inside `/#bench` (BEN-001), which is the end the runtime feeds
 * a component's inputs from. `parameterValue: undefined` is how a port is unset
 * — `JSON.stringify` drops the key, the runtime's `setParameter` deletes the
 * parameter, and the node falls back to its default. That is Reset.
 */
export function benchParameterContent(parameterName: string, parameterValue: unknown) {
  return {
    type: 'parameterChanged',
    componentName: BENCH_COMPONENT_NAME,
    nodeId: BENCH_NODE_ID,
    parameterName,
    parameterValue
  };
}

/**
 * A signal is a pulse, and a pulse is two values.
 *
 * The runtime turns a queued `SIGNAL_PULSE` into `setInputValue(true)` followed
 * by `setInputValue(false)` in one pass, but that constant only exists on a
 * connection. Coming in as a parameter, the rising and falling edges have to be
 * sent as two updates — send only the `true` and the signal fires once and then
 * never rearms.
 */
export function benchSignalContents(parameterName: string) {
  return [benchParameterContent(parameterName, true), benchParameterContent(parameterName, false)];
}

/** The row's type hint. What the bench thinks this port is, in the user's words. */
export function benchTypeLabel(port: BenchPort): string {
  const name = portTypeName(port.type);
  return name === '*' ? 'untyped' : name;
}

/**
 * Why an untyped row is untyped, and what would fix it.
 *
 * Shown on the row rather than in a tooltip: the user is looking at a control
 * the bench is guessing about, and the fix — wire the port to something — is not
 * one they would arrive at on their own.
 */
export const UNTYPED_HINT = 'No type — this input is wired to nothing, so the bench is guessing. Wire it to give it one.';
