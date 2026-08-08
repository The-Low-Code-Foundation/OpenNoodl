/**
 * BEN-003 — the outputs read-out's rules.
 *
 * Every fixture here is shaped after output the probe actually captured from a
 * running bench on 2026-08-08 (see the task file), not after what the wire
 * *ought* to look like. The two differed on the point that mattered: a
 * component output is not an event about the instance, it is an edge landing on
 * the component's `Component Outputs` node.
 *
 * What a spec cannot decide — that a click in the benched component appends a
 * row, that polling stops when the bench is hidden — is BEN-003's own live
 * criterion.
 */

import type { BenchPort } from '../../src/editor/src/models/AiAssistant/authoring/componentBench';
import { BENCH_NODE_ID } from '../../src/editor/src/models/AiAssistant/authoring/componentBench';
import {
  BENCH_SIGNAL_LOG_CAP,
  appendSignals,
  applyValueEmissions,
  benchEmissions,
  benchOutputNodeIds,
  benchOutputPortRefs,
  benchRelativeTime,
  benchValueText,
  seedValues,
  splitBenchOutputs,
  type BenchEmission
} from '../../src/editor/src/views/VisualCanvas/benchOutputs';

function port(name: string, type: unknown = '*'): BenchPort {
  return { name, type };
}

/** The dictionary the probe captured, trimmed to what this module reads. */
const DICTIONARY = {
  nodes: {
    'bench-subject': { name: '/Components/BenchEmitter', type: '/Components/BenchEmitter', component: '/Components/BenchEmitter' },
    'be-ci': { name: 'Component Inputs', type: 'Component Inputs', component: '/Components/BenchEmitter' },
    'be-counter': { name: 'Counter', type: 'Counter', component: '/Components/BenchEmitter' },
    'be-co': { name: 'Component Outputs', type: 'Component Outputs', component: '/Components/BenchEmitter' },
    'other-co': { name: 'Component Outputs', type: 'Component Outputs', component: '/Components/PuppyCard' }
  }
};

/** Verbatim shape from the probe, including the `kind` split. */
const EVENTS = [
  { seq: 1, t: 1000, kind: 'value', from: { node: 'be-ci', port: 'Bump' }, to: { node: 'be-counter', port: 'increase' }, value: 'true' },
  { seq: 4, t: 1100, kind: 'value', from: { node: 'be-counter', port: 'currentCount' }, to: { node: 'be-co', port: 'Count' }, value: 5 },
  { seq: 6, t: 1200, kind: 'signal', from: { node: 'be-button', port: 'onClick' }, to: { node: 'be-co', port: 'Pressed' }, value: true },
  { seq: 8, t: 1300, kind: 'value', from: { node: 'be-counter', port: 'currentCount' }, to: { node: 'be-co', port: 'Count' }, value: 6 }
];

describe('BEN-003: finding the component’s outputs node', () => {
  it('matches on the component, so another component’s outputs node is not watched', () => {
    expect(benchOutputNodeIds(DICTIONARY, '/Components/BenchEmitter')).toEqual(['be-co']);
  });

  it('finds every outputs node, because nothing stops a component having two', () => {
    const two = {
      nodes: {
        a: { type: 'Component Outputs', component: '/X' },
        b: { type: 'Component Outputs', component: '/X' }
      }
    };
    expect(benchOutputNodeIds(two, '/X').sort()).toEqual(['a', 'b']);
  });

  it('answers empty rather than throwing before the dictionary has arrived', () => {
    expect(benchOutputNodeIds(undefined, '/X')).toEqual([]);
    expect(benchOutputNodeIds({}, '/X')).toEqual([]);
  });
});

describe('BEN-003: reading emissions out of the trace', () => {
  it('keeps only the edges that land on the outputs node', () => {
    // seq 1 is the component's own internals — the walk's business, not the
    // bench's. Letting it through would report "Bump" as something the
    // component emitted, which is the opposite direction.
    const emissions = benchEmissions(EVENTS, ['be-co']);
    expect(emissions.map((e) => `${e.name}@${e.seq}`)).toEqual(['Count@4', 'Pressed@6', 'Count@8']);
  });

  it('carries the runtime’s kind through, because a signal is not a value', () => {
    const emissions = benchEmissions(EVENTS, ['be-co']);
    expect(emissions.find((e) => e.name === 'Pressed').kind).toBe('signal');
    expect(emissions.find((e) => e.name === 'Count').kind).toBe('value');
  });

  it('reports nothing when no outputs node is known yet', () => {
    expect(benchEmissions(EVENTS, [])).toEqual([]);
  });
});

describe('BEN-003: the value rows', () => {
  it('takes the latest value, so a burst between two pulls settles on the last one', () => {
    const values = applyValueEmissions({}, benchEmissions(EVENTS, ['be-co']));
    expect(values.Count.value).toBe(6);
    expect(values.Count.seq).toBe(8);
  });

  it('⚠️ never lets a signal write a value row', () => {
    // A signal's payload is the `true` that carries the pulse. Writing it into
    // `Pressed`'s row would show `true` where the read-out claims to show what
    // the component emitted — the surface lying about its own subject.
    const values = applyValueEmissions({}, benchEmissions(EVENTS, ['be-co']));
    expect('Pressed' in values).toBe(false);
  });

  it('returns the same object when nothing changed, so a row does not re-render for free', () => {
    const before = {};
    expect(applyValueEmissions(before, [])).toBe(before);
  });

  it('seeds from getPortValues and leaves an absent port out entirely', () => {
    // Verbatim from the probe: an undeclared port comes back `exists: false`.
    const seeded = seedValues([
      { port: 'Count', exists: true, value: '0' },
      { port: 'Nope', exists: false }
    ]);
    expect(seeded.Count.value).toBe('0');
    expect('Nope' in seeded).toBe(false);
  });

  it('⚠️ does not seed the runtime’s word for "nothing"', () => {
    // Measured on a running bench: a component seeded before its runtime had
    // run a frame reported `{ exists: true, value: "undefined" }`, and the rail
    // printed the word `undefined` in the value column. `previewValue` writes
    // that literal — this channel is display text, not JSON.
    const seeded = seedValues([
      { port: 'Count', exists: true, value: 'undefined' },
      { port: 'Pressed', exists: true, value: 'undefined' }
    ]);
    expect(Object.keys(seeded)).toEqual([]);
  });
});

describe('BEN-003: the signal log', () => {
  it('appends newest last and keeps only signals', () => {
    const log = appendSignals([], benchEmissions(EVENTS, ['be-co']));
    expect(log.map((e) => e.name)).toEqual(['Pressed']);
  });

  it('returns the same array when a batch held no signals', () => {
    const log: BenchEmission[] = [];
    expect(appendSignals(log, [{ name: 'Count', kind: 'value', value: 1, seq: 1, t: 0 }])).toBe(log);
  });

  it('caps from the front, so a long-running bench keeps the recent end', () => {
    const many: BenchEmission[] = [];
    for (let i = 0; i < BENCH_SIGNAL_LOG_CAP + 20; i++) {
      many.push({ name: 'onTick', kind: 'signal', value: true, seq: i, t: i });
    }
    const log = appendSignals([], many);
    expect(log.length).toBe(BENCH_SIGNAL_LOG_CAP);
    expect(log[log.length - 1].seq).toBe(BENCH_SIGNAL_LOG_CAP + 19);
  });
});

describe('BEN-003: what gets a row, and what gets asked for', () => {
  it('splits by declared type, and an underived output gets a value row', () => {
    // `'*'` is the common case on a real corpus. A log has no row until
    // something fires, so an untyped output would make a component with one
    // output look like a component with none.
    const { values, signals } = splitBenchOutputs([port('Count', 'number'), port('Pressed', 'signal'), port('Mystery')]);
    expect(values.map((p) => p.name)).toEqual(['Count', 'Mystery']);
    expect(signals.map((p) => p.name)).toEqual(['Pressed']);
  });

  it('seeds only the value outputs, addressed at the harness instance', () => {
    // ⚠️ Two different nodes name the same port: the seed reads the *instance*
    // (`bench-subject`), the trace reads the edge into the outputs node. Asking
    // for a signal here would be asking for a value that cannot exist —
    // measured: `Pressed` reads "undefined" before, during and after firing.
    const refs = benchOutputPortRefs([port('Count', 'number'), port('Pressed', 'signal')]);
    expect(refs).toEqual([{ node: BENCH_NODE_ID, port: 'Count', direction: 'output' }]);
  });
});

describe('BEN-003: how a time and a value read', () => {
  it('is relative to the first thing seen, never a wall clock', () => {
    // The runtime's `t` is its own performance.now(). Nothing relates it to the
    // editor's clock, so `12:04:31` would be a claim this cannot support.
    expect(benchRelativeTime(1200, 1000)).toBe('+0.2s');
    expect(benchRelativeTime(46000, 1000)).toBe('+45s');
    expect(benchRelativeTime(1000, 5000)).toBe('+0.0s');
  });

  it('reads minutes past ten of them', () => {
    expect(benchRelativeTime(1000 + 605000, 1000)).toBe('+10m05s');
  });

  it('speaks the runtime’s preview dialect, which is not JSON', () => {
    // Each row is a shape the probe actually captured. `previewValue` quotes
    // strings itself and writes the *word* for an unset value.
    expect(benchValueText('undefined')).toBe('—');
    expect(benchValueText(undefined)).toBe('—');
    expect(benchValueText('"emitter"')).toBe('emitter');
    expect(benchValueText('"probed at 20:23:26"')).toBe('probed at 20:23:26');
    expect(benchValueText('6')).toBe('6');
    expect(benchValueText(6)).toBe('6');
  });

  it('keeps null, because a port holding null is not a port holding nothing', () => {
    expect(benchValueText('null')).toBe('null');
  });

  it('does not unwrap something that merely begins with a quote', () => {
    expect(benchValueText('"unterminated')).toBe('"unterminated');
    expect(benchValueText('""')).toBe('""');
  });
});
