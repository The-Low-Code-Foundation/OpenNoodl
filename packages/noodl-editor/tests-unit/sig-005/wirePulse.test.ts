/**
 * SIG-005 — the travelling mark on a wire.
 *
 * These grade the arithmetic the canvas painter used to hold inline, where the
 * only way to check it was to run an app, click something, and watch a wire for
 * under a second in a window that clamps its own timers when it is not in
 * front. The two facts worth protecting are that a signal and a value do not
 * get the same mark, and that the signal mark actually crosses the wire inside
 * the life of the pulse — the version this replaced advanced 1 px per 20 ms and
 * was deleted before it arrived anywhere.
 */
import {
  samplePolyline,
  travellingHeadRange,
  valueDashOffset,
  wirePulseKind,
  WIRE_PULSE
} from '../../src/editor/src/views/nodegrapheditor/wirePulse';

describe('wirePulseKind', () => {
  it('gives a signal wire the signal mark', () => {
    expect(wirePulseKind('signal')).toBe('signal');
  });

  it('gives every other wire the value mark', () => {
    expect(wirePulseKind('string')).toBe('value');
    expect(wirePulseKind('number')).toBe('value');
    expect(wirePulseKind('boolean')).toBe('value');
    expect(wirePulseKind('*')).toBe('value');
  });

  it('treats an unresolved port type as a value rather than throwing', () => {
    // `nameForPortType(undefined)` is reachable: `fromPort` is undefined while a
    // node's ports are still resolving.
    expect(wirePulseKind(undefined)).toBe('value');
  });

  it('does not match on a substring — `signal-error` is its own wire', () => {
    // WFA-004's error edge is red and dashed and is not a signal for this
    // purpose. A `startsWith` here would have quietly given it the bead.
    expect(wirePulseKind('signal-error')).toBe('value');
  });
});

describe('travellingHeadRange', () => {
  it('starts as a zero-length mark at the source', () => {
    expect(travellingHeadRange(0)).toEqual({ from: 0, to: 0 });
  });

  it('grows out of the source rather than appearing at full length', () => {
    const early = travellingHeadRange(WIRE_PULSE.travelMs * 0.05);
    expect(early.from).toBe(0);
    expect(early.to).toBeGreaterThan(0);
    expect(early.to).toBeLessThan(WIRE_PULSE.headSpan);
  });

  it('runs source → target, monotonically', () => {
    const ages = [0, 50, 100, 200, 300, 400];
    const heads = ages.map((a) => travellingHeadRange(a).to);
    for (let i = 1; i < heads.length; i++) {
      expect(heads[i]).toBeGreaterThan(heads[i - 1]);
    }
  });

  it('reaches the target inside the pulse it belongs to', () => {
    // The runtime holds a pulse ~100 ms and the editor fades it over 500 ms, so
    // ~600 ms of visible life. The mark must have arrived well inside that,
    // which is the whole difference from the 50 px/s version.
    expect(WIRE_PULSE.travelMs).toBeLessThan(600);
    expect(travellingHeadRange(WIRE_PULSE.travelMs).to).toBe(1);
  });

  it('comes to rest ON the target instead of sliding off it', () => {
    const late = travellingHeadRange(WIRE_PULSE.travelMs * 4);
    expect(late.to).toBe(1);
    expect(late.from).toBeCloseTo(1 - WIRE_PULSE.headSpan, 6);
  });

  it('clamps an age from before the pulse existed', () => {
    // `performance.now() - created` can go negative across a viewer refresh,
    // which reset the state map under the painter.
    expect(travellingHeadRange(-5000)).toEqual({ from: 0, to: 0 });
  });

  it('degenerates safely if the travel time is zero', () => {
    expect(travellingHeadRange(10, 0).to).toBe(1);
  });
});

describe('valueDashOffset', () => {
  it('drifts forward with age', () => {
    expect(valueDashOffset(0)).toBe(0);
    expect(valueDashOffset(200)).toBeGreaterThan(valueDashOffset(100));
  });

  it('never goes negative, so the dashes never run backwards', () => {
    expect(valueDashOffset(-1000)).toBe(0);
  });
});

describe('samplePolyline', () => {
  const straight = (t: number) => ({ x: 100 * t, y: 0 });

  it('samples the requested span end to end', () => {
    const pts = samplePolyline(straight, 0.2, 0.6, 5);
    expect(pts).toHaveLength(5);
    expect(pts[0].x).toBeCloseTo(20, 6);
    expect(pts[4].x).toBeCloseTo(60, 6);
  });

  it('never returns fewer than the two points a stroke needs', () => {
    expect(samplePolyline(straight, 0, 0.1, 1).length).toBeGreaterThanOrEqual(2);
  });

  it('drops points the curve cannot supply rather than emitting undefined', () => {
    // `pointOnCurve` returns undefined when the connection has no curve yet —
    // one frame after a node is created and before the first relayout.
    const patchy = (t: number) => (t < 0.5 ? undefined : { x: t, y: t });
    const pts = samplePolyline(patchy, 0, 1, 5);
    expect(pts.every((p) => p !== undefined)).toBe(true);
    expect(pts.length).toBeLessThan(5);
  });

  it('produces a zero-length mark as a degenerate point set, not a crash', () => {
    const pts = samplePolyline(straight, 0.4, 0.4, 4);
    expect(pts).toHaveLength(4);
    expect(pts.every((p) => p.x === pts[0].x)).toBe(true);
  });
});

describe('the two marks are distinguishable in a still frame', () => {
  it('the value overlay repeats and the signal mark does not', () => {
    // A dash pattern means "everywhere at once"; a single sampled span means
    // "here, now". This is the assertion that stops a later edit collapsing the
    // two back into one rendering, which is what the phase exists to separate.
    expect(WIRE_PULSE.valueDash.length).toBe(2);
    expect(WIRE_PULSE.valueDash[0]).toBeGreaterThan(0);
    expect(WIRE_PULSE.valueDash[1]).toBeGreaterThan(WIRE_PULSE.valueDash[0]);
  });

  it('both marks are heavier than the wire they run on', () => {
    // The legibility is weight, not colour: measured on composited pixels the
    // pulse colour is only 1.48:1 against a dark-theme wire, so the silhouette
    // is what a reader actually sees.
    expect(WIRE_PULSE.signalWeightBoost).toBeGreaterThan(0);
    expect(WIRE_PULSE.valueWeightBoost).toBeGreaterThan(0);
  });

  it('the signal mark is the heavier of the two', () => {
    expect(WIRE_PULSE.signalWeightBoost).toBeGreaterThan(WIRE_PULSE.valueWeightBoost);
  });

  it("the value dash does not collide with an unhealthy wire's [5] or Deleted's [6, 4]", () => {
    expect(WIRE_PULSE.valueDash).not.toEqual([5]);
    expect(WIRE_PULSE.valueDash).not.toEqual([6, 4]);
  });
});
