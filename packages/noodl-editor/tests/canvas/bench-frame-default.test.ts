/**
 * FIX-011 — the size a component opens on the bench at.
 *
 * ⚠️ This is the **preview** canvas (`views/VisualCanvas`), not the node-graph
 * canvas most of this directory tests. It lives here because that is where the
 * module lives, beside `preview-scope` and `bench-scenarios`.
 *
 * What is under test is the half a screenshot cannot check: what reaches
 * `project.json` and what comes back out of it. The gesture that calls it — a
 * button and never a drag — is `VisualCanvas`'s, and is driven.
 */

import {
  BENCH_FRAME_KEY,
  benchFrameStore,
  readBenchFrameDefault
} from '../../src/editor/src/views/VisualCanvas/benchFrameDefault';
import { DEFAULT_BENCH_FRAME } from '../../src/editor/src/views/VisualCanvas/previewScope';

describe('FIX-011 what a stored default size is allowed to contain', () => {
  it('is namespaced beside the scenarios key', () => {
    // Component metadata is a flat bag shared with everything that has ever
    // hung something off a component, and the runtime is handed every key
    // verbatim. An unnamespaced `frame` would be a collision waiting to happen.
    expect(BENCH_FRAME_KEY).toBe('bench.frame');
  });

  it('writes only the halves that differ from what no record already means', () => {
    // Fill-the-stage and not-stretched are exactly what a component with no
    // stored default gets, so writing them would put keys in `project.json`
    // that change nothing.
    expect(benchFrameStore({ width: 360, stretch: false, height: null })).toEqual({ width: 360 });
    expect(benchFrameStore({ width: 360, stretch: false, height: 900 })).toEqual({ width: 360, height: 900 });
    expect(benchFrameStore({ width: 360, stretch: true, height: null })).toEqual({ width: 360, stretch: true });
  });

  it('clears the key entirely rather than storing an empty record', () => {
    // Same courtesy `benchScenarioStore` pays a component whose last scenario
    // was deleted: no key, no diff, nothing for a reviewer to wonder about.
    expect(benchFrameStore(undefined)).toBeUndefined();
  });

  it('round-trips a frame through what actually reaches disk', () => {
    const frame = { width: 360, stretch: true, height: 900 };
    expect(readBenchFrameDefault(benchFrameStore(frame))).toEqual(frame);

    const filled = { width: 360, stretch: false, height: null };
    expect(readBenchFrameDefault(benchFrameStore(filled))).toEqual(filled);
  });
});

describe('FIX-011 reading a default size off a component', () => {
  it('is undefined when there is nothing usable, and never throws', () => {
    // This reads JSON a human can edit, version control can merge and an MCP
    // write path can rewrite. The failure mode of a throw is a preview surface
    // that will not open at all, for a feature nobody asked to use.
    expect(readBenchFrameDefault(undefined)).toBeUndefined();
    expect(readBenchFrameDefault(null)).toBeUndefined();
    expect(readBenchFrameDefault('360')).toBeUndefined();
    expect(readBenchFrameDefault([360])).toBeUndefined();
    expect(readBenchFrameDefault({})).toBeUndefined();
  });

  it('refuses a record with no usable width, because half a frame is not a default', () => {
    // ⚠️ Every frame has a width — there is no "unset" for it, unlike the
    // height — so a record without one is a record this cannot honour.
    expect(readBenchFrameDefault({ height: 900 })).toBeUndefined();
    expect(readBenchFrameDefault({ width: 'wide' })).toBeUndefined();
    expect(readBenchFrameDefault({ width: Number.NaN })).toBeUndefined();
  });

  it('takes a width alone as fill-the-stage and not stretched', () => {
    expect(readBenchFrameDefault({ width: 360 })).toEqual({ width: 360, stretch: false, height: null });
  });

  it('clamps a hand-edited value on the way IN', () => {
    // Not merely on the way out: a stored `40` would otherwise reach the strip
    // as a frame the control itself refuses to produce, and the field would
    // then be reading a number it cannot get back to.
    expect(readBenchFrameDefault({ width: 2, height: 4 })).toEqual({ width: 80, stretch: false, height: 80 });
    expect(readBenchFrameDefault({ width: 99999, height: 99999 })).toEqual({
      width: 4096,
      stretch: false,
      height: 4096
    });
  });

  it('drops a junk height rather than refusing the whole default', () => {
    expect(readBenchFrameDefault({ width: 360, height: 'tall' })).toEqual({
      width: 360,
      stretch: false,
      height: null
    });
  });

  it('produces the shipped default when the shipped default is what was stored', () => {
    // The control that keeps the two ends of this honest: whatever
    // `DEFAULT_BENCH_FRAME` becomes, a stored copy of it still reads back as
    // itself rather than as something the surface would then have to reconcile.
    expect(readBenchFrameDefault(benchFrameStore(DEFAULT_BENCH_FRAME))).toEqual(DEFAULT_BENCH_FRAME);
  });
});
