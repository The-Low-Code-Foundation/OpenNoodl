/**
 * VIB-007 AC3 / M3 — **the gate fires on poverty, not only excess.**
 *
 * ## What this is grading
 *
 * Register **V10**: every render and authoring gate in the product detects
 * excess or breakage, and **nothing anywhere fires on poverty**. The whole
 * VIB-001 baseline is the consequence — nine pages ruled SHITTY by Richard, and
 * the render report called every one of them clean. AC1 made a render mandatory
 * before a page can be reported done; until M3 exists, what that mandatory
 * render is silent about is the exact failure the baseline is made of.
 *
 * ## 🔴 Both arms, and the fixtures are REAL RENDERS of the two named artefacts
 *
 * AC3's own words: *"at least three poverty findings fire on the VIB-001
 * baseline artefacts **and are silent on the VIB-006 page**. Both arms are
 * required — a finding that fires on everything is noise, and a control that
 * only ever passes has not been shown to work."*
 *
 * `vib001-members-join-door.json` and `vib006-landing-worthy.json` are the raw
 * measurements a real Chrome returned for `templates/members-area` at `/join`
 * (door state, nobody signed in) and for the VIB-006 landing page, both with
 * the starter assets installed as `installStarterAssets` installs them.
 * Recorded by `nodegx-backend/tests/vib007-m3-measure.look.ts`, which is also
 * the thing to re-run when either artefact moves — ⚠️ a frozen fixture answers
 * the question its subject asked on the day it was recorded.
 *
 * ## 🔴 The thresholds are the RUBRIC'S, and the corpus is the check on them
 *
 * Each of the three is one of the WordPress-starter tells README §2 lists
 * verbatim, and `DISPLAY_TYPE_MIN_PX` is that section's own *"~48px on
 * desktop"*. The seven `phase55-*` / `ecommerce-example` fixtures are four
 * independent authors' real builds and every one of them tops out at 48 or
 * 60px — so the number sits in a gap the corpus put there rather than one
 * fitted to the two artefacts under test. That check runs below, on the corpus
 * that already exists.
 */
import * as fs from 'fs';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  summarise,
  RenderFinding,
  DISPLAY_TYPE_MIN_PX,
  MIN_DISTINCT_GROUNDS,
  POVERTY_MIN_TEXTS
} = require(path.resolve(__dirname, '..', '..', '..', 'scripts', 'devtools', 'render-report.js'));

interface Finding {
  code: string;
  severity: 'error' | 'warning' | 'info';
  viewport: string;
  message: string;
}

const FIXTURES = path.join(__dirname, 'fixtures', 'render');

function measurements(name: string): Record<string, any> {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, `${name}.json`), 'utf8'));
}

const POVERTY = [RenderFinding.NoImagery, RenderFinding.NoDisplayType, RenderFinding.SingleGround];

function povertyCodes(measured: Record<string, unknown>, viewport?: string): string[] {
  return (summarise(measured).findings as Finding[])
    .filter((f) => POVERTY.includes(f.code))
    .filter((f) => !viewport || f.viewport === viewport)
    .map((f) => f.code);
}

/** A deep copy, so a mutation cannot leak into the next expectation. */
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe('AC3 arm 1 — the poverty findings fire on the VIB-001 baseline artefact', () => {
  const baseline = measurements('vib001-members-join-door');

  it('🔴 raises all three on the desktop render of a page Richard ruled SHITTY', () => {
    // 9 texts, largest 30px, no images, no icons, one ground. Every structural
    // check in the report passes on it — that is the point of the finding set.
    expect(povertyCodes(baseline, 'desktop').sort()).toEqual(
      [RenderFinding.NoDisplayType, RenderFinding.NoImagery, RenderFinding.SingleGround].sort()
    );
  });

  it('leaves every one of them a warning — poverty reports, it does not refuse', () => {
    // 🔴 The blocking family is severity `error` (VIB-007 M1). README §2 exempts
    // app-chrome pages from the marketing tells these encode, and this
    // instrument cannot tell a landing page from a settings page — so refusing
    // to certify on them would be the gate being confidently wrong on every
    // honest project. Promotion is a separate decision with its own evidence.
    const poverty = (summarise(baseline).findings as Finding[]).filter((f) => POVERTY.includes(f.code));
    expect(poverty.length).toBeGreaterThan(0);
    for (const f of poverty) expect(f.severity).toBe('warning');
  });

  it('says what it measured, in the numbers a reader can check', () => {
    const byCode = new Map(
      (summarise(baseline).findings as Finding[]).filter((f) => f.viewport === 'desktop').map((f) => [f.code, f.message])
    );
    expect(byCode.get(RenderFinding.NoDisplayType)).toContain('30px');
    expect(byCode.get(RenderFinding.NoDisplayType)).toContain(String(DISPLAY_TYPE_MIN_PX));
    expect(byCode.get(RenderFinding.NoImagery)).toContain('no images, no icons');
  });
});

describe('AC3 arm 2 — and are silent on the VIB-006 page, the phase’s only WORTHY', () => {
  const worthy = measurements('vib006-landing-worthy');

  it('🔴 raises NONE of the three, at either viewport', () => {
    // The control. A finding that fires on everything is noise, and this is the
    // only artefact in the repo a person has ruled WORTHY.
    expect(povertyCodes(worthy)).toEqual([]);
  });

  it('is a control that could have failed — it is rich by every axis the three read', () => {
    // 🔴 An arm that passes proves nothing unless the thing it is passing on is
    // the thing being measured. Asserted, so a fixture that quietly lost its
    // photographs would redden here rather than turn arm 2 into a tautology.
    const d = worthy.desktop;
    expect(d.images.total).toBeGreaterThan(0);
    expect(d.images.icons).toBeGreaterThan(0);
    expect(d.text.largestFontSize).toBeGreaterThanOrEqual(DISPLAY_TYPE_MIN_PX);
    expect(d.grounds.distinct).toBeGreaterThanOrEqual(MIN_DISTINCT_GROUNDS);
  });
});

describe('the mutations — each finding reds on its own axis and only its own', () => {
  const worthy = measurements('vib006-landing-worthy');

  it('strip the pictures AND the glyphs → no-imagery, and nothing else', () => {
    const m = clone(worthy);
    m.desktop.images.total = 0;
    m.desktop.images.icons = 0;
    expect(povertyCodes(m, 'desktop')).toEqual([RenderFinding.NoImagery]);
  });

  it('🔴 strip only the photographs and the glyphs still answer the question', () => {
    // The half a selector written from IconGlyph's source constant would have
    // got wrong: the font branch renders `span.lucide.icon-sprout` with no
    // `ndl-icon-glyph` class on it. A page of ten glyphs and no photographs is
    // not a page with no iconography.
    const m = clone(worthy);
    m.desktop.images.total = 0;
    expect(povertyCodes(m, 'desktop')).toEqual([]);
  });

  it('shrink the headline below the rubric’s number → no-display-type, and nothing else', () => {
    const m = clone(worthy);
    m.desktop.text.largestFontSize = DISPLAY_TYPE_MIN_PX - 1;
    expect(povertyCodes(m, 'desktop')).toEqual([RenderFinding.NoDisplayType]);
  });

  it('leaves a headline exactly at the threshold alone — the boundary is not off by one', () => {
    const m = clone(worthy);
    m.desktop.text.largestFontSize = DISPLAY_TYPE_MIN_PX;
    expect(povertyCodes(m, 'desktop')).toEqual([]);
  });

  it('paint every band the same → single-ground, and nothing else', () => {
    const m = clone(worthy);
    m.desktop.grounds = { distinct: 1, values: [{ ground: 'rgb(255, 255, 255)', count: 8 }] };
    expect(povertyCodes(m, 'desktop')).toEqual([RenderFinding.SingleGround]);
  });
});

describe('🔴 an unmeasured field is UNKNOWN, never zero', () => {
  const worthy = measurements('vib006-landing-worthy');

  it('claims nothing about imagery when the icon count was never taken', () => {
    // The seven recorded fixtures predate `images.icons` and `grounds`. A
    // predicate reading `undefined` as "none" would report "no imagery" about
    // builds that ship sixteen photographs — an absence asserted from a
    // measurement that was never requested.
    const m = clone(worthy);
    m.desktop.images.total = 0;
    delete m.desktop.images.icons;
    expect(povertyCodes(m, 'desktop')).toEqual([]);
  });

  it('claims nothing about grounds when grounds were never measured', () => {
    const m = clone(worthy);
    delete m.desktop.grounds;
    expect(povertyCodes(m, 'desktop')).toEqual([]);
  });

  it('holds on every fixture recorded before these fields existed', () => {
    // 🔴 Run over the corpus that already exists, not only over the two
    // artefacts under test.
    const older = [
      'phase55-replay-haiku',
      'phase55-replay-sonnet',
      'phase55-s6-haiku',
      'phase55-s6-sonnet',
      'phase55-s8-kimi-k3-rerun',
      'ecommerce-example'
    ];
    for (const name of older) {
      const codes = povertyCodes(measurements(name));
      expect([name, codes.includes(RenderFinding.NoImagery)]).toEqual([name, false]);
      expect([name, codes.includes(RenderFinding.SingleGround)]).toEqual([name, false]);
    }
  });
});

describe('🔴 the display-type threshold is not fitted to the two artefacts', () => {
  it('is silent on every real build in the corpus, all of which clear it', () => {
    // Four independent authors. haiku, sonnet and kimi all top out at exactly
    // 48px and ecommerce-example at 60 — so 48 sits in a gap the corpus put
    // there, and the two SHITTY templates sit at 30 on the other side of it.
    for (const name of ['phase55-replay-haiku', 'phase55-replay-sonnet', 'phase55-s6-sonnet', 'phase55-s8-kimi-k3-rerun', 'ecommerce-example']) {
      const measured = measurements(name);
      const largest = Math.max(...Object.keys(measured.desktop.text.fontSizes).map((px: string) => parseFloat(px)));
      expect([name, largest >= DISPLAY_TYPE_MIN_PX]).toEqual([name, true]);
      expect([name, povertyCodes(measured).includes(RenderFinding.NoDisplayType)]).toEqual([name, false]);
    }
  });

  it('abstains on a page that rendered nothing — blank-render owns that', () => {
    // deepseek-v4-pro rendered 0 texts. A poverty finding on a blank page is a
    // second sentence about one defect, aimed at the wrong subsystem.
    const blank = measurements('phase55-s8-deepseek-v4-pro');
    expect(blank.desktop.text.elements).toBeLessThan(POVERTY_MIN_TEXTS);
    expect(povertyCodes(blank)).toEqual([]);
  });
});

describe('🔴 M3 reaches the door — a done page cannot claim clean while measuring as a template', () => {
  // The verdict layer AC1 shipped. Imported here rather than in a spec of its
  // own because the claim under test spans both: M3 is only a mechanism if the
  // door says it.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { verdictFor, povertyFindings } = require('../src/renderVerdict');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { completionPayload } = require('../src/tools/completion');

  const reportFrom = (fixture: string) => {
    const measured = measurements(fixture);
    return { findings: summarise(measured).findings, pages: [] };
  };

  it('still says done — poverty does not refuse', () => {
    // 🔴 The arm that keeps this honest. M1's own argument is that a model is
    // good at iterating against a signal and a door that refuses destroys the
    // loop; and README §2 exempts app-chrome pages from the marketing tells.
    // A gate that never accepts is indistinguishable from a gate that is broken.
    const verdict = verdictFor(reportFrom('vib001-members-join-door'));
    expect(verdict.blocking).toEqual([]);
    expect(verdict.done).toBe(true);
  });

  it('🔴 but its reason names the tells, instead of the word "clean"', () => {
    const verdict = verdictFor(reportFrom('vib001-members-join-door'));
    expect(verdict.reason).not.toContain('the render is clean');
    expect(verdict.reason).toContain('default template');
    expect(verdict.poverty.length).toBeGreaterThan(0);
  });

  it('puts the tells on the done payload, where a model reading only the top level sees them', () => {
    const payload = completionPayload(verdictFor(reportFrom('vib001-members-join-door'))) as {
      done: boolean;
      looksLike?: { tells: { code: string }[]; blocking: boolean };
    };
    expect(payload.done).toBe(true);
    expect(payload.looksLike).toBeDefined();
    expect(payload.looksLike!.blocking).toBe(false);
    // Deduped by code — three codes across two viewports is six findings and
    // three sentences worth reading.
    expect(payload.looksLike!.tells.map((t) => t.code).sort()).toEqual(
      [RenderFinding.NoDisplayType, RenderFinding.NoImagery, RenderFinding.SingleGround].sort()
    );
  });

  it('🔴 and says the old sentence, with no looksLike at all, on the WORTHY page', () => {
    // The accepts arm. Without it, "the reason names the tells" is satisfied by
    // a verdict that names them on every project there is.
    const verdict = verdictFor(reportFrom('vib006-landing-worthy'));
    expect(povertyFindings(reportFrom('vib006-landing-worthy'))).toEqual([]);
    expect(verdict.reason).toContain('the render is clean');
    expect(completionPayload(verdict)).not.toHaveProperty('looksLike');
  });
});

describe('🔴 the defect AC3 found on the way — a fallback an instance supplies is not a dead fallback', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { overriddenDefaults } = require(path.resolve(__dirname, '..', '..', '..', 'scripts', 'devtools', 'render-report.js'));

  const VIB006 = path.resolve(
    __dirname, '..', '..', '..',
    'dev-docs', 'tasks', 'phase-81-the-look-is-the-product', 'demo', 'vib-006-landing'
  );

  it('does not call "0" a placeholder when a StatTile instance deliberately sets it', () => {
    // "0 air miles in the boxes" — a real statistic, and the same pixel as the
    // component's own fallback. `dead-placeholder-text` is an ERROR and VIB-007
    // M1 blocks `done` on that severity, so this false positive made the
    // phase's only WORTHY page permanently uncertifiable.
    expect([...overriddenDefaults(VIB006).keys()]).not.toContain('0');
  });

  it('🔴 still reports the fallbacks no instance ever supplies — the control', () => {
    // Without this, "0 is gone" is equally satisfied by a function that returns
    // nothing at all. These are real hardcoded fallbacks on ports fed by a
    // Component Inputs node in the same project, and every one must survive.
    const keys = [...overriddenDefaults(VIB006).keys()];
    for (const kept of ['Title', 'Body', 'Quote', 'Name', 'Heading']) {
      expect([kept, keys.includes(kept)]).toEqual([kept, true]);
    }
  });

  it('names where each surviving fallback lives, so the report can point at it', () => {
    const sites = overriddenDefaults(VIB006).get('Quote').sites;
    expect(sites.length).toBeGreaterThan(0);
    expect(sites[0]).toEqual(expect.objectContaining({ component: expect.any(String), port: expect.any(String) }));
  });
});
