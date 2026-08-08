/**
 * BEN-004 — the preview surface's scope model.
 *
 * ⚠️ This is the **preview** canvas (`views/VisualCanvas`), not the node-graph
 * canvas the rest of this directory tests. It lives here because that is where
 * the module lives.
 *
 * What is under test is the half of BEN-004 that a screenshot cannot check:
 * which components may be mounted at all, what the width field does with the
 * junk a text input actually hands back, and what the size read-out claims. The
 * chrome, the stage and R3's live round trip are BEN-007's job, driven.
 */

import {
  APP_SCOPE,
  BENCH_FRAME_PRESETS,
  DEFAULT_BENCH_FRAME,
  MAX_BENCH_WIDTH,
  MIN_BENCH_WIDTH,
  benchSizeLabel,
  benchTargetLabel,
  benchTargets,
  clampBenchWidth,
  isMounted,
  matchingPreset,
  resolveBenchWidth
} from '../../src/editor/src/views/VisualCanvas/previewScope';

const CORPUS = [
  { name: '/Home' },
  { name: '/Components/Card' },
  { name: '/Components/Cards/Header' },
  { name: '/Logic/Get Article From Slug' },
  { name: '/#__cloud__/saveOrder' }
];

describe('BEN-004 which components the bench may be pointed at', () => {
  it('offers every browser component, including ones with no visual root', () => {
    const names = benchTargets(CORPUS).map((target) => target.name);

    // A logic-only component is offered on purpose: BEN-001 mounts it rather
    // than refusing it, and it is the case the outputs read-out exists for.
    expect(names).toContain('/Logic/Get Article From Slug');
    expect(names).toContain('/Home');
    expect(names).toContain('/Components/Card');
  });

  it('excludes cloud functions, because that is a runtime boundary and not tidying', () => {
    // `/#__cloud__/…` executes in the cloud runtime (WFA-001). Mounting one in
    // a browser viewer would fail and look like the component's fault.
    expect(benchTargets(CORPUS).map((t) => t.name)).not.toContain('/#__cloud__/saveOrder');
  });

  it('splits a legacy name into the label and the folder that disambiguates it', () => {
    const card = benchTargets(CORPUS).find((t) => t.name === '/Components/Card');
    expect(card.label).toBe('Card');
    expect(card.folder).toBe('Components');

    const home = benchTargets(CORPUS).find((t) => t.name === '/Home');
    expect(home.label).toBe('Home');
    expect(home.folder).toBe('');
  });

  it('filters on the whole path, so a folder name finds its contents', () => {
    expect(benchTargets(CORPUS, 'components').map((t) => t.name)).toEqual([
      '/Components/Card',
      '/Components/Cards/Header'
    ]);
  });

  it('puts a name match above a path-only match', () => {
    // Typing "card" means the component called Card, not everything under a
    // folder that happens to be called Cards.
    expect(benchTargets(CORPUS, 'card').map((t) => t.name)).toEqual([
      '/Components/Card',
      '/Components/Cards/Header'
    ]);
  });

  it('is case-insensitive and survives a corpus with junk in it', () => {
    expect(benchTargets(CORPUS, 'HOME').map((t) => t.name)).toEqual(['/Home']);
    expect(benchTargets([{ name: '' }, null, undefined] as TSFixme).length).toBe(0);
  });
});

describe('BEN-004 the frame width control', () => {
  it('defaults to a width a component usually still works at, not to zero', () => {
    expect(DEFAULT_BENCH_FRAME.width).toBe(768);
    expect(DEFAULT_BENCH_FRAME.stretch).toBe(false);
    expect(matchingPreset(DEFAULT_BENCH_FRAME.width)).toBe('Medium');
  });

  it('offers three presets and each one matches itself', () => {
    for (const preset of BENCH_FRAME_PRESETS) {
      expect(matchingPreset(preset.width)).toBe(preset.name);
    }
    expect(matchingPreset(913)).toBeUndefined();
  });

  it('keeps the current width when the field holds something that is not a number', () => {
    // The failure this defends is phase-55's: a bad value coerced to NaN,
    // written to a style property as "NaNpx", and the property DELETED — the
    // styling gone with no message. Junk changes nothing instead.
    expect(clampBenchWidth('abc', 400)).toBe(400);
    expect(clampBenchWidth('', 400)).toBe(400);
    expect(clampBenchWidth(null, 400)).toBe(400);
    expect(clampBenchWidth(undefined, 400)).toBe(400);
    expect(clampBenchWidth(NaN, 400)).toBe(400);
    expect(clampBenchWidth(Infinity, 400)).toBe(400);
  });

  it('reads the number out of what a text input actually hands back', () => {
    expect(clampBenchWidth('320', 768)).toBe(320);
    expect(clampBenchWidth(' 320 ', 768)).toBe(320);
    expect(clampBenchWidth('320px', 768)).toBe(320);
    expect(clampBenchWidth(320.6, 768)).toBe(321);
  });

  it('clamps to bounds rather than refusing, so the breaking width stays reachable', () => {
    expect(clampBenchWidth(1, 768)).toBe(MIN_BENCH_WIDTH);
    expect(clampBenchWidth(-500, 768)).toBe(MIN_BENCH_WIDTH);
    expect(clampBenchWidth(99999, 768)).toBe(MAX_BENCH_WIDTH);
  });

  it('resolves to null while stretched, so the stage writes 100% instead of a stale measurement', () => {
    expect(resolveBenchWidth({ width: 320, stretch: false })).toBe(320);
    expect(resolveBenchWidth({ width: 320, stretch: true })).toBeNull();
  });
});

describe('BEN-004 what the surface says it is showing', () => {
  it('reads out the frame in the same format the app preview uses', () => {
    expect(benchSizeLabel({ width: 320, stretch: false }, { width: 320, height: 812 })).toBe('320 × 812');
  });

  it('reports the width it MEASURED, not the width that was asked for', () => {
    // This is the assertion that matters here. A stage with padding, or a frame
    // wider than the stage, does not give the component the number typed into
    // the field — and a read-out that printed the request would be the tool
    // built to catch a wrong width quietly reporting a wrong width.
    expect(benchSizeLabel({ width: 320, stretch: false }, { width: 300, height: 812 })).toBe('300 × 812');
  });

  it('says stretched, and still reports what was measured rather than the stage', () => {
    expect(benchSizeLabel({ width: 320, stretch: true }, { width: 908, height: 780 })).toBe('908 × 780 · stretched');
  });

  it('falls back to the requested width before the first layout, when it is the only number there is', () => {
    expect(benchSizeLabel({ width: 320, stretch: false })).toBe('320 × 0');
  });

  it('names the component by its last segment', () => {
    expect(benchTargetLabel('/Components/Card')).toBe('Card');
    expect(benchTargetLabel('/Home')).toBe('Home');
    expect(benchTargetLabel('Card')).toBe('Card');
  });

  it('knows whether a given component is the one mounted', () => {
    expect(isMounted(APP_SCOPE, '/Components/Card')).toBe(false);
    expect(isMounted({ mode: 'bench', target: '/Components/Card' }, '/Components/Card')).toBe(true);
    expect(isMounted({ mode: 'bench', target: '/Home' }, '/Components/Card')).toBe(false);
  });
});
