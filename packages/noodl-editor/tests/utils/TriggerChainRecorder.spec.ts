/**
 * Smoke tests for the Trigger Chain Debugger recorder path (DEBT-012).
 *
 * These pin the two directions the old 5ms wall-clock dedup got wrong:
 *   1. No dupe flood — a single real pulse lingers in the runtime's snapshot set
 *      for ~100ms and reappears in many consecutive `connectiondebugpulse`
 *      snapshots; it must be recorded ONCE, not once per snapshot.
 *   2. No dropped legit step — a genuine repeat on the same wire (the wire leaves
 *      the pulse set and later returns) must be recorded again, not swallowed as
 *      a "duplicate".
 *
 * The scenario below is a hand-traced button-click cascade. See DEBT-012 and
 * `utils/triggerChain/snapshotDiff.ts` for the reasoning.
 *
 * describe/it/expect are Jasmine globals — the editor suite runs under the
 * Electron/Jasmine runner (importing @jest/globals throws at module load).
 *
 * @module noodl-editor/tests/utils
 */

import {
  TriggerChainRecorder,
  buildChainFromEvents,
  groupByInteraction,
  collapseSameFrame,
  diffPulseSnapshot,
  TriggerEvent
} from '../../src/editor/src/utils/triggerChain';

// Distinct, real-looking connection ids. Runtime format concatenates
// outputOwnerId + outputName + targetNodeId + inputPortName; the recorder pulls
// the first UUID out as the node id. Each of these is a different wire.
const WIRE_A = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaaonClickbbbbbbbb-2222-4222-8222-bbbbbbbbbbbbhovered';
const WIRE_B = 'cccccccc-3333-4333-8333-ccccccccccccvaluedddddddd-4444-4444-8444-ddddddddddddtext';
const WIRE_C = 'eeeeeeee-5555-4555-8555-eeeeeeeeeeeetriggerffffffff-6666-4666-8666-ffffffffffffnavigate';

function makeEvent(over: Partial<TriggerEvent>): TriggerEvent {
  return {
    id: `evt_${Math.random().toString(36).slice(2)}`,
    timestamp: 0,
    type: 'signal',
    nodeId: 'node',
    nodeType: 'Button',
    nodeLabel: 'Button',
    componentName: 'Home',
    componentPath: ['Home'],
    ...over
  };
}

describe('TriggerChainRecorder — snapshot edge detection (DEBT-012)', () => {
  let recorder: TriggerChainRecorder;

  beforeEach(() => {
    recorder = TriggerChainRecorder.getInstance();
    recorder.reset();
  });

  afterEach(() => {
    recorder.reset();
  });

  it('records one event per pulse even though the pulse lingers across many snapshots (no dupe flood)', () => {
    recorder.startRecording();

    // A button click firing 3 wires in a cascade. Each snapshot is the FULL set
    // of currently-pulsing wires — pulses linger for ~100ms, so the same wire
    // reappears frame after frame. The old recorder logged one row per membership
    // (~11 rows for these 3 pulses); edge detection must log exactly 3.
    recorder.captureConnectionSnapshot([WIRE_A]); // A starts
    recorder.captureConnectionSnapshot([WIRE_A, WIRE_B]); // B starts, A lingers
    recorder.captureConnectionSnapshot([WIRE_A, WIRE_B, WIRE_C]); // C starts, A/B linger
    recorder.captureConnectionSnapshot([WIRE_A, WIRE_B, WIRE_C]); // all lingering
    recorder.captureConnectionSnapshot([WIRE_B, WIRE_C]); // A expired
    recorder.captureConnectionSnapshot([]); // all expired

    const events = recorder.stopRecording();

    expect(events.length).toBe(3);
    // One event per distinct wire, in the order they rose.
    expect(events[0].nodeId).toBe('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa');
    expect(events[1].nodeId).toBe('cccccccc-3333-4333-8333-cccccccccccc');
    expect(events[2].nodeId).toBe('eeeeeeee-5555-4555-8555-eeeeeeeeeeee');
  });

  it('records a genuine repeat on the same wire after it leaves and re-enters the pulse set (no dropped step)', () => {
    recorder.startRecording();

    recorder.captureConnectionSnapshot([WIRE_A]); // A pulses
    recorder.captureConnectionSnapshot([]); // A expires
    recorder.captureConnectionSnapshot([WIRE_A]); // A pulses AGAIN — legit repeat

    const events = recorder.stopRecording();

    // Two separate firings of the same wire must both be present.
    expect(events.length).toBe(2);
    expect(events[0].nodeId).toBe(events[1].nodeId);
  });

  it('collapses duplicate ids within a single snapshot (fan-out flattening)', () => {
    recorder.startRecording();
    recorder.captureConnectionSnapshot([WIRE_A, WIRE_A, WIRE_B]);
    const events = recorder.stopRecording();
    expect(events.length).toBe(2);
  });

  it('captures nothing when not recording', () => {
    recorder.captureConnectionSnapshot([WIRE_A, WIRE_B]);
    expect(recorder.getEventCount()).toBe(0);
  });
});

describe('diffPulseSnapshot — pure rising-edge detection', () => {
  it('reports only newly-present ids as edges', () => {
    const { edges, active } = diffPulseSnapshot(new Set(['x']), ['x', 'y', 'z']);
    expect(edges).toEqual(['y', 'z']);
    expect(active.has('x')).toBe(true);
    expect(active.size).toBe(3);
  });

  it('reports nothing when the snapshot is unchanged', () => {
    const { edges } = diffPulseSnapshot(new Set(['x', 'y']), ['x', 'y']);
    expect(edges.length).toBe(0);
  });

  it('treats a re-appearance after absence as a new edge', () => {
    // x dropped out of the previous set, so its return is a fresh pulse.
    const { edges } = diffPulseSnapshot(new Set(['y']), ['x', 'y']);
    expect(edges).toEqual(['x']);
  });
});

describe('groupByInteraction — readable button-click grouping (DEBT-012 noise filter)', () => {
  it('splits events into interactions on a quiet gap', () => {
    const events: TriggerEvent[] = [
      makeEvent({ timestamp: 100, nodeId: 'a' }),
      makeEvent({ timestamp: 110, nodeId: 'b' }),
      makeEvent({ timestamp: 120, nodeId: 'c' }),
      // >250ms gap => second interaction
      makeEvent({ timestamp: 900, nodeId: 'd' }),
      makeEvent({ timestamp: 905, nodeId: 'e' })
    ];

    const groups = groupByInteraction(events);
    expect(groups.length).toBe(2);
    expect(groups[0].events.length).toBe(3);
    expect(groups[1].events.length).toBe(2);
    expect(groups[0].index).toBe(1);
    expect(groups[1].index).toBe(2);
  });

  it('keeps one propagation cascade as a single interaction (not ~40 rows)', () => {
    const events: TriggerEvent[] = Array.from({ length: 12 }, (_, i) =>
      makeEvent({ timestamp: 100 + i * 3, nodeId: `n${i}` })
    );
    const groups = groupByInteraction(events);
    expect(groups.length).toBe(1);
  });

  it('collapses identical same-frame repeats into one row with a count', () => {
    const events: TriggerEvent[] = [
      makeEvent({ timestamp: 100, nodeId: 'a', nodeType: 'Button', port: 'onClick' }),
      makeEvent({ timestamp: 104, nodeId: 'a', nodeType: 'Button', port: 'onClick' }),
      makeEvent({ timestamp: 108, nodeId: 'a', nodeType: 'Button', port: 'onClick' })
    ];
    const collapsed = collapseSameFrame(events);
    expect(collapsed.length).toBe(1);
    expect(collapsed[0].repeatCount).toBe(3);
  });

  it('does not collapse different nodes fired in the same frame', () => {
    const events: TriggerEvent[] = [
      makeEvent({ timestamp: 100, nodeId: 'a' }),
      makeEvent({ timestamp: 103, nodeId: 'b' })
    ];
    expect(collapseSameFrame(events).length).toBe(2);
  });
});

describe('buildChainFromEvents — surfaces interactions', () => {
  it('exposes interaction groups on the built chain', () => {
    const events: TriggerEvent[] = [
      makeEvent({ timestamp: 100, nodeId: 'a' }),
      makeEvent({ timestamp: 110, nodeId: 'b' })
    ];
    const chain = buildChainFromEvents(events);
    expect(chain.interactions.length).toBe(1);
    expect(chain.eventCount).toBe(2);
  });
});
