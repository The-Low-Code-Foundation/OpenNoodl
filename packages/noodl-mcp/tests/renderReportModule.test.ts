/**
 * LAS-005 — what the numbers mean, pinned against the numbers themselves.
 *
 * `summarise()` is the half of the render report that makes a judgement, and a
 * judgement is where a threshold quietly drifts. The fixtures in
 * `fixtures/render/` are **real recorded measurements** — the exact per-viewport
 * output of `scripts/devtools/measure-from-disk.js` against the three builds
 * phase 55 is calibrated on, captured 2026-08-08 — so these specs assert what
 * the tool said about pages this project has actually shipped, not about a DOM
 * someone invented to make a rule look right.
 *
 * The three builds are chosen because they disagree:
 *
 *  - `phase55-replay-haiku` — architecturally correct, renders dead. It is the
 *    page this whole phase exists to catch, and the audit found its three
 *    defects by hand. The first spec is that the report finds all three without
 *    a human.
 *  - `phase55-replay-sonnet` — the build this phase calls correct. Anything that
 *    fires here is a false positive, and the first version of the grid rule fired
 *    four times (register F18).
 *  - `ecommerce-example` — phase 54's reference build, which is neither.
 *
 * The module is plain JS under `scripts/` on purpose (see its header); requiring
 * it by path is how the CLI and this suite share one implementation rather than
 * two that agree until they do not.
 */
import * as fs from 'fs';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { summarise, placeholderStrings, measureExpression, RenderFinding } = require(
  path.resolve(__dirname, '..', '..', '..', 'scripts', 'devtools', 'render-report.js')
);

interface Finding {
  code: string;
  severity: 'error' | 'warning' | 'info';
  viewport: string;
  message: string;
  relatedDiagnostic?: string;
  evidence?: unknown;
}

function measurements(name: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'render', `${name}.json`), 'utf8'));
}

function report(name: string): { findings: Finding[]; summary: string } {
  return summarise(measurements(name));
}

const codes = (findings: Finding[], severity?: string) =>
  findings.filter((f) => !severity || f.severity === severity).map((f) => f.code);

describe('the placeholder strings come from the catalog, not from memory', () => {
  it('is exactly the visible-text defaults the node library ships', () => {
    // Three, and each is a real port default: Text.text, six controls' `label`,
    // two text inputs' `placeholder`. If a fourth appears, a node gained a
    // visible default and the report should say so — this spec is the notice.
    expect(placeholderStrings().sort()).toEqual(['Label', 'Text', 'Type here...']);
  });

  it('bakes them into the expression the page evaluates', () => {
    expect(measureExpression(['Text'])).toContain('const PLACEHOLDERS = ["Text"]');
  });
});

describe('phase55-replay-haiku — the page this phase exists to catch', () => {
  const { findings, summary } = report('phase55-replay-haiku');

  it('re-finds all three defects the audit found by hand, from the numbers alone', () => {
    const desktop = findings.filter((f) => f.viewport === 'desktop');

    // 1. Four ProductCard instances setting parameters the component has no
    //    Component Inputs for: every text renders the node-type default.
    const dead = desktop.find((f) => f.code === RenderFinding.DeadPlaceholderText);
    expect(dead?.severity).toBe('error');
    expect(dead?.message).toContain('29 elements');
    expect(dead?.message).toContain('"Text"');

    // 2. Five of five images fail to load.
    const images = desktop.find((f) => f.code === RenderFinding.BrokenImage);
    expect(images?.severity).toBe('error');
    expect(images?.message).toContain('5 images of 5');

    // 3. The grid is one column at 1280px — and it is a Columns node, so the
    //    author asked for a grid in the one node that makes them.
    const grid = desktop.filter((f) => f.code === RenderFinding.SingleColumnGrid);
    expect(grid).toHaveLength(2);
    expect(grid[0].severity).toBe('warning');
    expect(grid[0].message).toContain('4 repeated items are stacked in one column at 1280px');
    expect(grid[0].message).toContain('layoutString');
  });

  it('also names the 768px floor the page will not collapse below', () => {
    const floor = findings.find((f) => f.code === RenderFinding.MinimumLayoutWidth);
    expect(floor?.viewport).toBe('phone');
    expect(floor?.message).toContain('cannot lay out below 768px');
  });

  it('points the dead-text finding at its graph-side name, so one vocabulary keys both', () => {
    // LAS-007 attaches examples on `code`. A render finding that describes the
    // same defect as a diagnostic says which, rather than inventing a synonym.
    const dead = findings.find((f) => f.code === RenderFinding.DeadPlaceholderText);
    expect(dead?.relatedDiagnostic).toBe('interfaceless-instance');
    expect(dead?.message).toContain('interfaceless-instance');
  });

  it('leads with the errors and says the shape in one line', () => {
    expect(codes(findings, 'error')).toEqual(
      expect.arrayContaining([RenderFinding.DeadPlaceholderText, RenderFinding.BrokenImage])
    );
    expect(findings[0].severity).toBe('error');
    expect(summary).toContain('4 errors');
    expect(summary).toContain('63 texts');
  });
});

describe('phase55-replay-sonnet — the build this phase calls correct', () => {
  const { findings, summary } = report('phase55-replay-sonnet');

  it('draws no errors and no warnings', () => {
    // Register F18: the first grid predicate fired four times here, all of them
    // footer link lists and full-bleed banners. A gate that cries wolf on the
    // good build is a gate the next agent learns to skip.
    expect(codes(findings, 'error')).toEqual([]);
    expect(codes(findings, 'warning')).toEqual([]);
    expect(summary).toContain('Rendered clean');
  });

  it('still records the stacked banners as an observation, not a complaint', () => {
    const observations = findings.filter((f) => f.severity === 'info');
    expect(codes(observations)).toEqual([RenderFinding.SingleColumnGrid]);
    expect(observations[0].message).toContain('if they are meant to be full-width bands, this is right');
  });

  it('reflows to 390px, which is what haiku does not do', () => {
    expect(codes(findings)).not.toContain(RenderFinding.MinimumLayoutWidth);
  });
});

describe('ecommerce-example — phase 54’s reference build', () => {
  const { findings } = report('ecommerce-example');

  it('reports one honest thing: it will not collapse below 525px', () => {
    expect(codes(findings, 'error')).toEqual([]);
    expect(codes(findings, 'warning')).toEqual([RenderFinding.MinimumLayoutWidth]);
    expect(findings[0].message).toContain('525px');
  });
});

describe('the shapes no real build produced', () => {
  const viewport = (over: Record<string, unknown>) => ({
    desktop: {
      requested: { width: 1280, height: 900 },
      layoutWidth: 1280,
      clientWidth: 1280,
      scrollWidth: 1280,
      pageHeight: 900,
      overflowing: [],
      overflowingCount: 0,
      text: { elements: 20, fontWeights: { '400': 12, '700': 8 }, distinctFontSizes: 5, bodyFontFamily: 'Inter' },
      placeholders: { count: 0, byText: {}, samples: [] },
      images: { total: 0, broken: 0, brokenSources: [] },
      emptyDecoratedBoxes: { count: 0, samples: [] },
      repeatedGroups: [],
      ...over
    }
  });

  it('a page that rendered nothing says so, and says nothing else', () => {
    const { findings } = summarise(
      viewport({
        text: { elements: 0, fontWeights: {}, distinctFontSizes: 0, bodyFontFamily: 'Inter' },
        images: { total: 0, broken: 0, brokenSources: [] },
        emptyDecoratedBoxes: { count: 4, samples: [] }
      })
    );
    // One cause, one finding: a blank page has no type scale worth commenting on.
    expect(codes(findings)).toEqual([RenderFinding.BlankRender]);
    expect(findings[0].message).toContain('Page node');
  });

  it('one font weight across twenty texts is the unstyled signature', () => {
    const { findings } = summarise(
      viewport({ text: { elements: 20, fontWeights: { '400': 20 }, distinctFontSizes: 4, bodyFontFamily: 'Inter' } })
    );
    expect(codes(findings)).toContain(RenderFinding.FlatTypeScale);
  });

  it('says nothing about the type scale of a nine-element page', () => {
    // A login form legitimately has one weight. The threshold exists so the
    // report does not nag a small page into a type system it does not need.
    const { findings } = summarise(
      viewport({ text: { elements: 9, fontWeights: { '400': 9 }, distinctFontSizes: 1, bodyFontFamily: 'Inter' } })
    );
    expect(codes(findings)).not.toContain(RenderFinding.FlatTypeScale);
  });

  it('reports sideways scrolling only when the page did not widen its own viewport', () => {
    // The two are the same defect seen at different severities of failure, and
    // reporting both would have an agent chasing two causes for one symptom.
    const both = summarise(viewport({ layoutWidth: 1400, scrollWidth: 1600 }));
    expect(codes(both.findings)).toEqual([RenderFinding.MinimumLayoutWidth]);

    const overflowOnly = summarise(viewport({ scrollWidth: 1600, overflowingCount: 2 }));
    expect(codes(overflowOnly.findings)).toEqual([RenderFinding.HorizontalOverflow]);
  });

  it('collapses three identically-worded findings into one', () => {
    const three = Array.from({ length: 3 }, () => ({
      kind: 'siblings',
      count: 3,
      columns: 1,
      rows: 3,
      itemWidth: 800,
      itemHeight: 200,
      parentWidth: 800,
      tag: 'DIV',
      cls: ''
    }));
    const { findings } = summarise(viewport({ repeatedGroups: three }));
    expect(findings.filter((f: Finding) => f.code === RenderFinding.SingleColumnGrid)).toHaveLength(1);
  });
});
