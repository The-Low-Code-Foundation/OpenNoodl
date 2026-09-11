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
  MAX_BENCH_HEIGHT,
  MAX_BENCH_WIDTH,
  MIN_BENCH_HEIGHT,
  MIN_BENCH_WIDTH,
  benchSizeLabel,
  benchTargetLabel,
  benchTargets,
  clampBenchHeight,
  clampBenchWidth,
  isDivergedFromCanvas,
  isMounted,
  matchingPreset,
  resolveBenchWidth,
  type PreviewScope
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
    expect(resolveBenchWidth({ width: 320, stretch: false, height: null })).toBe(320);
    expect(resolveBenchWidth({ width: 320, stretch: true, height: null })).toBeNull();
  });
});

describe('BEN-004 what the surface says it is showing', () => {
  it('reads out the frame in the same format the app preview uses', () => {
    expect(benchSizeLabel({ width: 320, stretch: false, height: null }, { width: 320, height: 812 })).toBe('320 × 812');
  });

  it('reports the width it MEASURED, not the width that was asked for', () => {
    // This is the assertion that matters here. A stage with padding, or a frame
    // wider than the stage, does not give the component the number typed into
    // the field — and a read-out that printed the request would be the tool
    // built to catch a wrong width quietly reporting a wrong width.
    expect(benchSizeLabel({ width: 320, stretch: false, height: null }, { width: 300, height: 812 })).toBe('300 × 812');
  });

  it('says stretched, and still reports what was measured rather than the stage', () => {
    expect(benchSizeLabel({ width: 320, stretch: true, height: null }, { width: 908, height: 780 })).toBe('908 × 780 · stretched');
  });

  it('falls back to the requested width before the first layout, when it is the only number there is', () => {
    expect(benchSizeLabel({ width: 320, stretch: false, height: null })).toBe('320 × 0');
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

describe('FIX-011 the height the frame never had', () => {
  it('defaults to filling the stage, which is the reported bug', () => {
    // 🔴 The whole defect in one assertion. There was no height in `BenchFrame`
    // at all, so nothing sized the frame box and the `<webview>`'s UA default
    // replaced-element height (150px) leaked through — the "couple of hundred
    // pixels" every benched component opened at. `null` is what makes the
    // surface write no `height` and let `align-self: stretch` do it.
    expect(DEFAULT_BENCH_FRAME.height).toBeNull();
  });

  it('reads an emptied field as "fill the stage" rather than as junk', () => {
    // This is the only way back from a pinned height — the 30px strip had no
    // room for a second Stretch toggle, so clearing the field is the gesture.
    expect(clampBenchHeight('', 400)).toBeNull();
    // A text input hands back a space when someone clears a field with the
    // space bar, and that is the same intent.
    expect(clampBenchHeight('   ', 400)).toBeNull();
  });

  it('keeps the current height for junk, exactly as the width field does', () => {
    // The phase-55 `"NaNpx"` rule: a NaN reaching a style property is a value
    // that silently deletes the styling. Junk is not an instruction.
    expect(clampBenchHeight('abc', 400)).toBe(400);
    expect(clampBenchHeight(undefined, 400)).toBe(400);
    // ⚠️ Including when the current height is "fill" — junk must not pin one.
    expect(clampBenchHeight('abc', null)).toBeNull();
  });

  it('clamps to bounds, and a number never reads as the empty string', () => {
    expect(clampBenchHeight(1, null)).toBe(MIN_BENCH_HEIGHT);
    expect(clampBenchHeight(99999, null)).toBe(MAX_BENCH_HEIGHT);
    expect(clampBenchHeight('320px', null)).toBe(320);
    // A drag always pins a height, and this is why: it hands over a number.
    expect(clampBenchHeight(0, null)).toBe(MIN_BENCH_HEIGHT);
  });
});

describe('FIX-019 saying when the canvas and the bench have come apart', () => {
  const BENCH: PreviewScope = { mode: 'bench', target: '/Components/Card' };

  it('is a divergence when the node graph is on a different component', () => {
    expect(isDivergedFromCanvas(BENCH, '/Home')).toBe(true);
  });

  it('is NOT a divergence when the canvas is on the benched component', () => {
    // The control for the assertive ruling: the chip appears only on
    // divergence, so this case has to cost the strip nothing.
    expect(isDivergedFromCanvas(BENCH, '/Components/Card')).toBe(false);
  });

  it('is never a divergence in app mode', () => {
    expect(isDivergedFromCanvas(APP_SCOPE, '/Home')).toBe(false);
  });

  it('treats an unknown canvas component as nothing to diverge from', () => {
    // ⚠️ The detached preview window has no node graph at all
    // (`NodeGraphContextTmp.nodeGraph` is null), and so does the moment before
    // the first `activeComponentChanged`. A chip offering to navigate a canvas
    // that is not there is worse than no chip.
    expect(isDivergedFromCanvas(BENCH, undefined)).toBe(false);
  });
});
