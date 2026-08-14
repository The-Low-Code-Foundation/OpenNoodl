/**
 * BEN-005 — Scenarios: the one thing on this surface that is allowed to persist.
 *
 * Everything else in the bench is ephemeral by rule (R5) — the frame, the
 * signed-in toggle, BEN-006's records, and every value the inputs rail sends.
 * A scenario is the deliberate exception, and the argument is that **a set of
 * input values is authored intent, not preview state**: `Empty`, `Loaded`,
 * `Long name`, `Error` are what the component claims to survive, and they are
 * worth writing down next to it.
 *
 * The rules live here rather than in the bar for the reason `benchInputs.ts` and
 * `previewScope.ts` do: a rule only a live driver can check is a rule that does
 * not get checked, and these decide what reaches `project.json`.
 *
 * ## The rule that must not bend
 *
 * **Typing does not save.** Selecting a scenario does not save, changing the
 * frame does not save, closing the bench does not save. {@link benchScenarioStore}
 * is the only value in this module that is ever handed to `setMetaData`, and
 * `ComponentBench` calls it from exactly one place — the Save handler.
 *
 * That matters more here than it reads, because a component's `setMetaData`
 * raises `Model.metadataChanged`, which **is** in `projectSaveTriggers`
 * (`projectmodel.ts`). So one write arms the 1s autosave and reaches disk. The
 * mechanism a save needs is already live; the discipline is entirely about not
 * calling it by accident.
 *
 * ## Why the values are checked before they are stored
 *
 * The rail's controls cannot produce a `NaN` (`coerceBenchValue` refuses one, for
 * the phase-55 `"NaNpx"` reason) — but `JSON.stringify` turns a `NaN` into
 * `null`, a `Date` into a string and a function into nothing at all, silently. A
 * scenario that reloaded as a *different* scenario would be the same
 * mechanism-with-no-consequence failure this phase keeps finding, one save later
 * and much harder to see. So a value that would not survive the round trip is
 * refused at save time with a message, not stored and mangled.
 *
 * @module noodl-editor/views/VisualCanvas/benchScenarios
 */

import type { BenchInterface } from '@noodl-models/AiAssistant/authoring';

import type { BenchFrame } from './previewScope';

/**
 * The component-metadata key scenarios are stored under.
 *
 * Namespaced because component metadata is a flat bag shared with everything
 * else that has ever wanted to hang something off a component, and because the
 * runtime is handed every key verbatim (`componentMetadataChanged` →
 * `ComponentModel.setMetadata`, which stores it and does nothing else).
 */
export const BENCH_SCENARIOS_KEY = 'bench.scenarios';

export interface BenchScenario {
  name: string;
  /** Input values by declared port name. Absent key = unset, as everywhere else. */
  inputs: Record<string, unknown>;
  /**
   * The frame the state was saved at.
   *
   * Carried because "renders correctly at 320" is part of what a scenario is
   * claiming. Optional so a scenario written by anything else still applies.
   *
   * FIX-011: `height` joined it, and it is **absent for "fill the stage"**
   * rather than stored as `null`. That is what makes every scenario written
   * before FIX-011 keep its meaning — such a scenario has no `height` key,
   * absent reads as fill, and fill is what those scenarios actually got.
   * Storing `null` would have said the same thing while putting a new key in
   * `project.json` for every scenario that had never heard of height.
   */
  frame?: { width: number; height?: number };
  stretch?: boolean;
}

/** What is stored under {@link BENCH_SCENARIOS_KEY}. */
export interface BenchScenarioStore {
  scenarios: BenchScenario[];
}

/**
 * Scenarios as read off a component, normalised.
 *
 * Tolerant on purpose and in one direction only: anything that is not a usable
 * scenario is dropped, and nothing here throws. This reads a JSON file a human
 * can edit, that version control can merge, and that an MCP write path can
 * rewrite — the failure mode of a throw is a preview surface that will not open,
 * for a feature nobody asked to use.
 */
export function readBenchScenarios(stored: unknown): BenchScenario[] {
  const list = (stored as BenchScenarioStore | undefined)?.scenarios;
  if (!Array.isArray(list)) return [];

  const scenarios: BenchScenario[] = [];
  const seen = new Set<string>();

  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const candidate = entry as Partial<BenchScenario>;

    const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
    if (!name || seen.has(name)) continue;
    seen.add(name);

    const inputs =
      candidate.inputs && typeof candidate.inputs === 'object' && !Array.isArray(candidate.inputs)
        ? { ...(candidate.inputs as Record<string, unknown>) }
        : {};

    const scenario: BenchScenario = { name, inputs };

    const storedFrame = candidate.frame as { width?: unknown; height?: unknown } | undefined;
    const width = storedFrame?.width;
    if (typeof width === 'number' && Number.isFinite(width)) {
      scenario.frame = { width };
      // Dropped rather than defaulted when it is not a usable number, which is
      // the same one-directional tolerance the rest of this reader has: a
      // scenario with a junk height is a scenario with no height claim, and no
      // height claim is the default this whole file already degrades to.
      const height = storedFrame?.height;
      if (typeof height === 'number' && Number.isFinite(height)) scenario.frame.height = height;
    }
    if (typeof candidate.stretch === 'boolean') scenario.stretch = candidate.stretch;

    scenarios.push(scenario);
  }

  return scenarios;
}

/**
 * The value handed to `setMetaData`, and the only one.
 *
 * An empty list stores `undefined` rather than `{ scenarios: [] }`, so deleting
 * the last scenario leaves the component exactly as it was before anyone opened
 * the bench — no key, no diff, nothing for a reviewer to wonder about.
 */
export function benchScenarioStore(scenarios: BenchScenario[]): BenchScenarioStore | undefined {
  return scenarios.length > 0 ? { scenarios } : undefined;
}

/**
 * Whether a value survives `JSON.stringify` → `JSON.parse` as itself.
 *
 * Walks, rather than round-tripping and comparing, so the *reason* is available
 * to the message. `seen` catches a cycle, which `JSON.stringify` would throw on
 * — and a throw inside a Save handler is a Save button that does nothing.
 */
function jsonSafeValue(value: unknown, seen: Set<object>): boolean {
  if (value === null) return true;

  switch (typeof value) {
    case 'string':
    case 'boolean':
      return true;
    case 'number':
      // `JSON.stringify(NaN)` is `"null"`. Storing it would turn a refused value
      // into a stored one of a different type, one reload later.
      return Number.isFinite(value);
    case 'object':
      break;
    default:
      // undefined, function, symbol, bigint — `stringify` drops or throws.
      return false;
  }

  const object = value as object;
  if (seen.has(object)) return false;
  seen.add(object);

  try {
    if (Array.isArray(object)) {
      return object.every((entry) => jsonSafeValue(entry, seen));
    }
    // A Date, a Map, a class instance: `stringify` emits something, but not
    // something that parses back as what it was.
    if (Object.getPrototypeOf(object) !== Object.prototype && Object.getPrototypeOf(object) !== null) return false;
    return Object.values(object as Record<string, unknown>).every((entry) => jsonSafeValue(entry, seen));
  } finally {
    seen.delete(object);
  }
}

export interface BenchScenarioDraft {
  scenario?: BenchScenario;
  /** Why nothing was saved. Shown on the bar; never thrown. */
  error?: string;
}

/**
 * A scenario from what is currently on the bench, or the reason there isn't one.
 *
 * `undefined` values are dropped rather than refused: an absent key already
 * means *unset* everywhere else in the bench, so a scenario that stores one
 * would be storing the absence of a value, which is what the absence of the key
 * already says.
 */
export function benchScenarioFrom(name: string, values: Record<string, unknown>, frame?: BenchFrame): BenchScenarioDraft {
  const trimmed = name.trim();
  if (!trimmed) return { error: 'Give the scenario a name.' };

  const inputs: Record<string, unknown> = {};
  const refused: string[] = [];

  for (const [key, value] of Object.entries(values ?? {})) {
    if (value === undefined) continue;
    if (jsonSafeValue(value, new Set())) inputs[key] = value;
    else refused.push(key);
  }

  if (refused.length > 0) {
    return {
      error: `${refused.join(', ')} ${refused.length === 1 ? 'holds a value' : 'hold values'} that cannot be saved.`
    };
  }

  const scenario: BenchScenario = { name: trimmed, inputs };
  if (frame) {
    scenario.frame = { width: frame.width };
    // Absent means "fill the stage" — see `BenchScenario.frame`. Writing the
    // key only when there is a pinned height is also what keeps this function
    // agreeing with `benchScenarioIsModified`, which compares what a save
    // *would* produce rather than the raw state.
    if (frame.height !== null) scenario.frame.height = frame.height;
    scenario.stretch = frame.stretch;
  }
  return { scenario };
}

/** A name no existing scenario has, derived from the one that was asked for. */
export function uniqueBenchScenarioName(existing: string[], proposed: string): string {
  const taken = new Set(existing);
  const base = proposed.trim() || 'Scenario';
  if (!taken.has(base)) return base;

  // `taken` is finite, so this terminates without a bound — and a bound here
  // would have to invent a fallback name, which is a second naming rule for a
  // case that cannot happen.
  for (let n = 2; ; n++) {
    const candidate = `${base} ${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export interface BenchScenarioApplication {
  /** What the rail should hold — only the names the component still declares. */
  inputs: Record<string, unknown>;
  /** Names the scenario sets that are no longer inputs of this component. */
  missing: string[];
}

/**
 * What a scenario means *now*, against the interface the component has today.
 *
 * A component outlives its scenarios: a port gets renamed, an input is removed,
 * and a scenario that was accurate in March names something that no longer
 * exists. Applying what still resolves and saying what did not is the same rule
 * `benchParameters` uses for an unknown key (BEN-001 §2) — passing it through
 * would set a parameter on a port that does not exist, which renders nothing and
 * reports nothing, inside the tool built to expose exactly that.
 *
 * With no interface yet (the first render, before `getPorts` has been read) the
 * scenario is applied whole rather than emptied: the rail's own filtering is the
 * backstop, and an empty apply would look like a scenario that had lost its
 * values.
 */
export function applyBenchScenario(scenario: BenchScenario, iface?: BenchInterface): BenchScenarioApplication {
  const stored = scenario.inputs ?? {};
  if (!iface) return { inputs: { ...stored }, missing: [] };

  const declared = new Set(iface.inputs.map((port) => port.name));
  const inputs: Record<string, unknown> = {};
  const missing: string[] = [];

  for (const [name, value] of Object.entries(stored)) {
    if (declared.has(name)) inputs[name] = value;
    else missing.push(name);
  }

  return { inputs, missing };
}

/** What the bar says when a scenario no longer matches the component. Absent when it does. */
export function benchScenarioApplyNotice(missing: string[]): string | undefined {
  if (missing.length === 0) return undefined;
  return `${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} no longer an input of this component, so ${
    missing.length === 1 ? 'it was' : 'they were'
  } skipped.`;
}

/** The frame a scenario asks for, or the current one when it carries none. */
export function benchScenarioFrame(scenario: BenchScenario, current: BenchFrame): BenchFrame {
  if (!scenario.frame) return current;
  return {
    width: scenario.frame.width,
    stretch: scenario.stretch ?? false,
    // A scenario that records a frame but no height claims the default, and
    // gets it. Falling back to `current.height` instead would let a height
    // pinned on the *previous* scenario survive into this one, which is the
    // "renders correctly at 320" claim quietly not being honoured.
    height: scenario.frame.height ?? null
  };
}

/**
 * Whether the bench has drifted from the scenario it is showing.
 *
 * Compared against what a *save* would produce rather than against the raw
 * state, so the two agree by construction: an `undefined` value is not a
 * difference, because saving would drop it too. Otherwise Save would be offered
 * for a change that saving cannot record, and pressing it would leave the dot
 * exactly where it was.
 */
export function benchScenarioIsModified(
  scenario: BenchScenario,
  values: Record<string, unknown>,
  frame?: BenchFrame
): boolean {
  const draft = benchScenarioFrom(scenario.name, values, frame);
  // A value that cannot be saved is certainly a change from one that was.
  if (!draft.scenario) return true;

  if (!sameInputs(scenario.inputs ?? {}, draft.scenario.inputs)) return true;

  // A scenario with no frame recorded makes no claim about width, so a width
  // change is not drift from it — and neither is one the caller did not offer a
  // frame to compare against.
  if (!scenario.frame || !frame) return false;
  if (scenario.frame.width !== frame.width || (scenario.stretch ?? false) !== frame.stretch) return true;
  // Absent reads as `null` on both sides, so a pre-FIX-011 scenario is *not*
  // drifted merely for predating the height field — it is drifted once someone
  // pins a height it does not record, which is a real difference and one that
  // pressing Save can actually record.
  return (scenario.frame.height ?? null) !== frame.height;
}

/**
 * Key-order-insensitive comparison of two input sets.
 *
 * `JSON.stringify` on the whole object would call `{ a, b }` different from
 * `{ b, a }`, and the rail writes keys in whatever order the user touched the
 * rows — so the dot would appear for having set the same values in a different
 * order. Per-value stringify is order-insensitive at the top level, which is the
 * level the ordering varies at.
 */
function sameInputs(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every(
    (key) => Object.prototype.hasOwnProperty.call(b, key) && JSON.stringify(a[key]) === JSON.stringify(b[key])
  );
}

/** Replace the scenario with this one's name, or append it. Order is otherwise kept. */
export function upsertBenchScenario(scenarios: BenchScenario[], scenario: BenchScenario): BenchScenario[] {
  const index = scenarios.findIndex((candidate) => candidate.name === scenario.name);
  if (index === -1) return [...scenarios, scenario];

  const next = [...scenarios];
  next[index] = scenario;
  return next;
}

export function removeBenchScenario(scenarios: BenchScenario[], name: string): BenchScenario[] {
  return scenarios.filter((scenario) => scenario.name !== name);
}

/**
 * Rename in place. A collision keeps the old name rather than merging two
 * scenarios into one — silently losing a saved state is the worse outcome.
 */
export function renameBenchScenario(scenarios: BenchScenario[], from: string, to: string): BenchScenario[] {
  const trimmed = to.trim();
  if (!trimmed || trimmed === from) return scenarios;
  if (scenarios.some((scenario) => scenario.name === trimmed)) return scenarios;

  return scenarios.map((scenario) => (scenario.name === from ? { ...scenario, name: trimmed } : scenario));
}

/** Move one scenario by `delta` places, clamped. The overflow menu's reorder. */
export function moveBenchScenario(scenarios: BenchScenario[], name: string, delta: number): BenchScenario[] {
  const index = scenarios.findIndex((scenario) => scenario.name === name);
  if (index === -1) return scenarios;

  const target = Math.min(scenarios.length - 1, Math.max(0, index + delta));
  if (target === index) return scenarios;

  const next = [...scenarios];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  return next;
}
