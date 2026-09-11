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
  WIRE_PULSE,
  arrivalGlow,
  beadRange,
  beadTaper,
  samplePolyline,
  travellingHeadRange,
  valueDashOffset,
  wirePulseKind
} from '../../src/editor/src/views/nodegrapheditor/wirePulse';
import { HOVER_MARK_CYCLE_MS } from '../../src/editor/src/views/nodegrapheditor/wireEndpoints';

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

/**
 * The arrival, and the shape of the mark (SIG-006 R8).
 *
 * Richard, shown the shipped hover mark: *"it stopping abruptly is a bit weird,
 * and the triangle at the end not lighting up white is inconsistent… I'd have
 * expected something a bit more 'electric', rounded and faded, not a white
 * rectangle."*
 *
 * All three are the same omission — the mark modelled the *crossing* and nothing
 * about landing. `travellingHeadRange` is unchanged and still grades the
 * crossing; these grade what happens at the end of it.
 */
describe('SIG-006 R8 — the mark arrives instead of stopping', () => {
  it('runs the tail in after the head lands, so the mark is consumed by the target', () => {
    // Before: the head clamped at 1 and the tail stayed headSpan behind it, so a
    // full-length bar parked on the end of the wire and then blinked out.
    const parked = travellingHeadRange(WIRE_PULSE.travelMs + WIRE_PULSE.dissipateMs);
    expect(parked.to - parked.from).toBeCloseTo(WIRE_PULSE.headSpan, 5);

    const landing = beadRange(WIRE_PULSE.travelMs + WIRE_PULSE.dissipateMs / 2);
    expect(landing.to).toBe(1);
    expect(landing.to - landing.from).toBeLessThan(WIRE_PULSE.headSpan);
    expect(landing.to - landing.from).toBeGreaterThan(0);
  });

  it('leaves nothing behind once it has arrived', () => {
    const done = beadRange(WIRE_PULSE.travelMs + WIRE_PULSE.dissipateMs);
    expect(done.to - done.from).toBeCloseTo(0, 5);
  });

  it('is the crossing, unchanged, until the head lands', () => {
    for (const age of [0, 100, WIRE_PULSE.travelMs / 2, WIRE_PULSE.travelMs]) {
      expect(beadRange(age)).toEqual(travellingHeadRange(age));
    }
  });

  it('shrinks monotonically as it arrives — it never grows back', () => {
    let previous = Infinity;
    for (let age = WIRE_PULSE.travelMs; age <= WIRE_PULSE.travelMs + WIRE_PULSE.dissipateMs; age += 10) {
      const { from, to } = beadRange(age);
      expect(to - from).toBeLessThanOrEqual(previous + 1e-9);
      previous = to - from;
    }
  });

  it('lights the target glyph at the moment the mark lands, and not before', () => {
    expect(arrivalGlow(0)).toBe(0);
    expect(arrivalGlow(WIRE_PULSE.travelMs - 1)).toBe(0);
    expect(arrivalGlow(WIRE_PULSE.travelMs)).toBe(1);
  });

  it('decays the glow to nothing, so a hovered wire does not sit lit', () => {
    const half = arrivalGlow(WIRE_PULSE.travelMs + WIRE_PULSE.arrivalGlowMs / 2);
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(1);
    expect(arrivalGlow(WIRE_PULSE.travelMs + WIRE_PULSE.arrivalGlowMs)).toBe(0);
    expect(arrivalGlow(WIRE_PULSE.travelMs + WIRE_PULSE.arrivalGlowMs * 2)).toBe(0);
  });

  it('finishes the glow inside one hover cycle, so the flash reads as one event', () => {
    // Otherwise the next pass would start while the last arrival was still lit.
    expect(WIRE_PULSE.travelMs + WIRE_PULSE.arrivalGlowMs).toBeLessThan(HOVER_MARK_CYCLE_MS);
  });

  it('tapers and fades from tail to head, rather than being a uniform bar', () => {
    const tail = beadTaper(0);
    const middle = beadTaper(0.5);
    const head = beadTaper(1);

    expect(tail.alpha).toBe(0);
    expect(head.alpha).toBe(1);
    expect(middle.alpha).toBeGreaterThan(tail.alpha);
    expect(middle.alpha).toBeLessThan(head.alpha);

    expect(head.widthScale).toBe(1);
    expect(tail.widthScale).toBeLessThan(head.widthScale);
    expect(middle.widthScale).toBeGreaterThan(tail.widthScale);
  });

  it('keeps the tail thin but never zero-width, so it does not break into dashes', () => {
    expect(beadTaper(0).widthScale).toBeGreaterThan(0);
    expect(beadTaper(0).widthScale).toBeLessThan(0.25);
  });

  it('clamps a fraction outside the mark rather than inverting it', () => {
    expect(beadTaper(-1)).toEqual(beadTaper(0));
    expect(beadTaper(2)).toEqual(beadTaper(1));
  });

  it('draws a halo wider and dimmer than the core — the glow, not a second bar', () => {
    expect(WIRE_PULSE.beadHaloScale).toBeGreaterThan(1);
    expect(WIRE_PULSE.beadHaloAlpha).toBeGreaterThan(0);
    expect(WIRE_PULSE.beadHaloAlpha).toBeLessThan(1);
  });

  it('samples the mark finely enough for the taper to read as a gradient', () => {
    expect(WIRE_PULSE.beadSegments).toBeGreaterThanOrEqual(WIRE_PULSE.headSamples);
  });
});
