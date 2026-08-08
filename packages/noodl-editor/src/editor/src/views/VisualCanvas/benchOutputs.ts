/**
 * BEN-003 — What the benched component *emits*, and how the bench learns it.
 *
 * The rules the outputs read-out runs on, kept out of React for the same reason
 * `benchInputs.ts` is: a rule only a live driver can check is a rule that does
 * not get checked.
 *
 * ## One channel, and why it is the trace
 *
 * BEN-003 planned two — `getPortValues` for values, the trace for signals. The
 * probe (task file, *"The channel, answered"*) settled it on measurements:
 *
 * - **`getPortValues` can never show a signal.** A signal output reads
 *   `"undefined"` before, during and after firing, because a signal has no
 *   state to read. Measured on `/Components/BenchEmitter`'s `Pressed`.
 * - **`getTraceEvents(afterSeq)` is a tail read, not a sample.** Nothing that
 *   happens between two pulls is lost — which is exactly the Risks table's
 *   *"a signal that fires between polls is missed and the rail lies by
 *   omission"*, avoided rather than mitigated. A polling route has that defect
 *   by construction.
 * - It carries **both** kinds, tagged: `kind: 'value'` and `kind: 'signal'`.
 *
 * `getPortValues` is still used, once, to **seed** the value outputs — a value
 * set before the bench armed is in no buffer, and a rail showing "—" for a port
 * that has a value would be its own small lie.
 *
 * ## What a component output looks like on the wire
 *
 * There is no event for "the instance emitted". What the trace records is the
 * edge *inside* the component that lands on its `Component Outputs` node:
 *
 * ```
 * seq=6 kind=signal be-button.onClick       -> be-co.Pressed = true
 * seq=8 kind=value  be-counter.currentCount -> be-co.Count   = 6
 * ```
 *
 * So an emission is an event whose `to.node` is one of the mounted component's
 * `Component Outputs` nodes, and `to.port` is the output's name. The session
 * dictionary supplies that mapping — every node carries the `component` it
 * belongs to.
 *
 * ⚠️ **A component output that nothing is wired to emits nothing, and that is
 * not a bug in this module.** It is the same honest limitation the inputs rail
 * has with `'*'`: the graph is what it is, and the read-out says "nothing yet"
 * rather than inventing an event.
 *
 * @module noodl-editor/views/VisualCanvas/benchOutputs
 */

import type { BenchPort } from '@noodl-models/AiAssistant/authoring';
import { BENCH_NODE_ID } from '@noodl-models/AiAssistant/authoring';

import { portTypeName } from './benchInputs';

/** The `type` a `Component Outputs` node has in the session dictionary. */
const COMPONENT_OUTPUTS_TYPE = 'Component Outputs';

/** How many signal rows the log keeps. Older ones are dropped from the front. */
export const BENCH_SIGNAL_LOG_CAP = 200;

/** A node as `getTraceDictionary` describes it. */
export interface TraceDictionaryNode {
  name?: string;
  type?: string;
  component?: string;
}

export interface TraceDictionaryLike {
  nodes?: Record<string, TraceDictionaryNode>;
}

/** One edge firing, as `getTraceEvents` reports it. */
export interface TraceEventLike {
  seq: number;
  t?: number;
  kind?: string;
  from?: { node?: string; port?: string };
  to?: { node?: string; port?: string };
  value?: unknown;
}

/** One thing the component emitted. */
export interface BenchEmission {
  /** The declared output's name. */
  name: string;
  kind: 'value' | 'signal';
  /** Already a preview string when it arrives — the runtime caps it. */
  value: unknown;
  seq: number;
  /** The runtime's own clock, in ms since its page loaded. Never a wall clock. */
  t: number;
}

/**
 * The ids of the mounted component's `Component Outputs` nodes.
 *
 * Plural deliberately: nothing stops a component having two, and a read-out
 * that silently watched the first one would drop half an interface without
 * saying so.
 *
 * ⚠️ Matched on the dictionary's `component`, not on the harness. The harness
 * (`/#bench`) contains one node — the instance — and no outputs node of its
 * own; the outputs node lives inside the *target*, which is why this takes the
 * target's legacy name rather than deriving anything from {@link BENCH_NODE_ID}.
 */
export function benchOutputNodeIds(dictionary: TraceDictionaryLike | undefined, target: string): string[] {
  const nodes = dictionary?.nodes;
  if (!nodes) return [];

  const ids: string[] = [];
  for (const id of Object.keys(nodes)) {
    const node = nodes[id];
    if (node?.type !== COMPONENT_OUTPUTS_TYPE) continue;
    if (node.component !== target) continue;
    ids.push(id);
  }
  return ids;
}

/**
 * The emissions in a batch of trace events.
 *
 * Everything else in the buffer is the component's internals — genuinely
 * interesting, and genuinely the provenance walk's job rather than this
 * surface's. The bench answers "what came *out*".
 */
export function benchEmissions(events: TraceEventLike[] | undefined, outputNodeIds: string[]): BenchEmission[] {
  if (!Array.isArray(events) || outputNodeIds.length === 0) return [];
  const wanted = new Set(outputNodeIds);

  const emissions: BenchEmission[] = [];
  for (const event of events) {
    const node = event?.to?.node;
    const port = event?.to?.port;
    if (typeof node !== 'string' || typeof port !== 'string' || !wanted.has(node)) continue;

    emissions.push({
      name: port,
      kind: event.kind === 'signal' ? 'signal' : 'value',
      value: event.value,
      seq: event.seq,
      t: typeof event.t === 'number' ? event.t : 0
    });
  }
  return emissions;
}

/** Whether a declared output is a signal, as far as the interface knows. */
export function isSignalPort(port: BenchPort): boolean {
  return portTypeName(port.type) === 'signal';
}

/**
 * The declared outputs, split the way the read-out shows them.
 *
 * The split is by **declared type**, because the rail has to render rows before
 * anything has fired. An output whose type could not be derived (`'*'`, an
 * output wired to nothing on the outside — the common case) is shown as a value
 * row: it has a slot that can hold "nothing yet", where a log has no row at all
 * until something happens, and a component with one untyped output would
 * otherwise look like a component with no outputs.
 */
export function splitBenchOutputs(outputs: BenchPort[] | undefined): { values: BenchPort[]; signals: BenchPort[] } {
  const values: BenchPort[] = [];
  const signals: BenchPort[] = [];
  for (const port of outputs ?? []) {
    (isSignalPort(port) ? signals : values).push(port);
  }
  return { values, signals };
}

/** The `getPortValues` request that seeds the value outputs. */
export function benchOutputPortRefs(
  outputs: BenchPort[] | undefined
): Array<{ node: string; port: string; direction: 'output' }> {
  return (outputs ?? [])
    .filter((port) => !isSignalPort(port))
    .map((port) => ({ node: BENCH_NODE_ID, port: port.name, direction: 'output' as const }));
}

/** What the rail shows for one value output. */
export interface BenchValueState {
  value: unknown;
  /** The `seq` it last changed at, or 0 when it came from the seed. Drives the flash. */
  seq: number;
}

/**
 * Fold new emissions into the current value map.
 *
 * ⚠️ **A signal emission never lands here even if it names a value output.** A
 * signal's payload is the constant `true` that carries the pulse; writing it
 * into a value row would show `true` where a number was, which is the read-out
 * lying about the thing it exists to report.
 */
export function applyValueEmissions(
  current: Record<string, BenchValueState>,
  emissions: BenchEmission[]
): Record<string, BenchValueState> {
  let next = current;
  for (const emission of emissions) {
    if (emission.kind !== 'value') continue;
    if (next === current) next = { ...current };
    next[emission.name] = { value: emission.value, seq: emission.seq };
  }
  return next;
}

/**
 * The runtime's preview dialect for "this port holds nothing".
 *
 * ⚠️ **Not JSON, and this cost a row reading the word `undefined` on screen.**
 * `previewValue` (`tracebuffer.ts`) writes the literal `'undefined'` for an
 * unset value, quotes strings itself, and leaves numbers bare — so everything
 * on this channel arrives as *display text* that happens to look like JSON
 * until it does not. Measured: a bench mounted before its runtime had run a
 * frame seeded `Count` with `"undefined"` and the rail printed it.
 */
const NOTHING_PREVIEW = 'undefined';

/**
 * Seed values from a `getPortValues` reply.
 *
 * An absent port is left out entirely, and so is one whose preview says it
 * holds nothing: the row is rendered from the *declared interface*, not from
 * this reply, so leaving it out shows "nothing yet" rather than the word
 * `undefined` — and a real emission still overwrites it either way.
 */
export function seedValues(
  values: Array<{ port?: string; exists?: boolean; value?: unknown }> | undefined
): Record<string, BenchValueState> {
  const seeded: Record<string, BenchValueState> = {};
  for (const entry of values ?? []) {
    if (!entry?.exists || typeof entry.port !== 'string') continue;
    if (entry.value === NOTHING_PREVIEW) continue;
    seeded[entry.port] = { value: entry.value, seq: 0 };
  }
  return seeded;
}

/** Append signal emissions to the log, newest last, capped. */
export function appendSignals(log: BenchEmission[], emissions: BenchEmission[]): BenchEmission[] {
  const fresh = emissions.filter((emission) => emission.kind === 'signal');
  if (fresh.length === 0) return log;
  const next = log.concat(fresh);
  return next.length > BENCH_SIGNAL_LOG_CAP ? next.slice(next.length - BENCH_SIGNAL_LOG_CAP) : next;
}

/**
 * How long after the first thing the bench saw an emission happened.
 *
 * ⚠️ **Deliberately not a wall clock.** The runtime's `t` is its own
 * `performance.now()` — ms since *its* page loaded — and there is no message
 * that relates it to the editor's clock. BEN-003 §2 sketches `12:04:31 ·
 * onSubmit`; rendering that from an arrival time would present "when the editor
 * noticed" as "when it fired", up to a poll interval wrong, which is precisely
 * the `fake-is-an-unchecked-claim` failure. A relative offset is exact, comes
 * from the runtime, and claims nothing it cannot support.
 */
export function benchRelativeTime(t: number, origin: number): string {
  const seconds = Math.max(0, (t - origin) / 1000);
  if (seconds < 10) return `+${seconds.toFixed(1)}s`;
  if (seconds < 600) return `+${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  return `+${minutes}m${String(Math.round(seconds - minutes * 60)).padStart(2, '0')}s`;
}

/**
 * What a value reads as in the rail.
 *
 * ⚠️ Everything on this channel has already been through the runtime's
 * `previewValue`, which is a **display** dialect and not JSON:
 *
 * | the value | on the wire |
 * |---|---|
 * | `undefined` | `undefined` |
 * | `null` | `null` |
 * | `'emitter'` | `"emitter"` |
 * | `6` | `6` |
 *
 * So a string arrives already wrapped in quotes it did not have, and an unset
 * port arrives as the *word*. Both were measured on a running bench. Stripping
 * the quotes is what makes a text output read like the text it is; keeping
 * `null` is right, because a port holding `null` is not a port holding nothing.
 */
export function benchValueText(value: unknown): string {
  if (value === undefined || value === null || value === NOTHING_PREVIEW) return '—';
  if (typeof value !== 'string') return JSON.stringify(value);
  if (value === '') return '—';
  // A preview-quoted string. Only when both ends are there — a value that
  // merely starts with a quote is not one.
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    const inner = value.slice(1, -1);
    return inner === '' ? '""' : inner;
  }
  return value;
}

/** The read-out's empty state, when the component has outputs but none has fired. */
export const NOTHING_EMITTED_HINT = 'Nothing emitted yet — interact with the component, or fire an input signal.';

/**
 * Why an outputs rail is empty, when the component declares none.
 *
 * The mirror of the inputs rail's `backwards` message, and the same LAS-001
 * inversion seen from the other end: a port declared on a `Component Outputs`
 * node with plug `"output"` publishes as a component **input**.
 */
export const NO_OUTPUTS_HINT = 'This component declares no outputs — nothing it does is visible from outside.';
