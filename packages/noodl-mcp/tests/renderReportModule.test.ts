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
const {
  summarise,
  placeholderStrings,
  measureExpression,
  listProbes,
  blankDiagnosis,
  overriddenDefaults,
  readComponents,
  rootNodes,
  projectVisualPredicate,
  BlankCause,
  RenderFinding
} = require(path.resolve(__dirname, '..', '..', '..', 'scripts', 'devtools', 'render-report.js'));

import { deriveVisualRootIds } from '../src/visualRoots';

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
    // Two, and each is a real port default: Text.text and six controls' `label`.
    // If a third appears, a node gained a visible default and the report should
    // say so — this spec is the notice.
    //
    // 🔴 It was three until REL-002a. `Type here...` was the two text inputs'
    // `placeholder` default, and it SHIPPED: 17 of the members-area template's 18
    // fields rendered it, under labels that already named them. The default is now
    // empty, so the string the report used to hunt for is one the product no longer
    // puts there. See `nodes/controls/text-input.ts`.
    expect(placeholderStrings().sort()).toEqual(['Label', 'Text']);
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

    // AWP-003 — and with no project to walk, it says what it measured and stops.
    // This assertion used to be `toContain('Page node')`, which is the guess the
    // task removed: DeepSeek V4 Pro had a correct Page node and a Router that
    // listed it, and the sentence sent it to the wrong subsystem for 18 turns.
    expect(findings[0].message).toContain('rendered nothing at all');
    expect(findings[0].message).not.toContain('Page node');
    expect(findings[0].message).not.toContain('Router');
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

/**
 * LAS-012 §3 — the shape this report was structurally unable to see.
 *
 * Every other finding is about content **present and wrong**: a dead
 * placeholder, a broken image, a decorated box with nothing in it. A repeater
 * that instantiates nothing emits no elements, so there was nothing to count.
 * Haiku's session-6 build reported `0 errors, 1 warning` with three of its five
 * sections missing; qwen's reported *"Rendered clean"* on a page carrying one
 * text element.
 *
 * The two fixtures here are recorded measurements of the two session-6 builds
 * that disagree — `phase55-s6-haiku`, whose repeaters drew nothing, and
 * `phase55-s6-sonnet`, whose repeater drew correctly from a `Static Data` node.
 */
describe('LAS-012 §3 — an empty list, which the report could not see before', () => {
  it("names haiku's dead product list, at both viewports", () => {
    const { findings, summary } = report('phase55-s6-haiku');
    const empty = findings.filter((f) => f.code === RenderFinding.EmptyList);
    expect(empty.map((f) => f.viewport).sort()).toEqual(['desktop', 'phone']);
    expect(empty[0].severity).toBe('error');
    expect(empty[0].message).toContain('/Components/FeaturedProducts');
    expect(empty[0].message).toContain('Handmade Ceramic Bowl');
    expect(empty[0].relatedDiagnostic).toBe('repeater-without-template');
    // The summary is the line a human and an agent both read first. It used to
    // say "0 errors, 1 warning" for this page.
    expect(summary).toContain('empty-list');
    expect(summary).not.toContain('Rendered clean');
  });

  it("says nothing about sonnet's list, which drew from a Static Data node", () => {
    const { findings } = report('phase55-s6-sonnet');
    expect(codes(findings)).not.toContain(RenderFinding.EmptyList);
  });

  it('abstains rather than guesses when a partial match is possible', () => {
    // Sonnet's probe found 5 of its 6 strings — the sixth is an image `alt`
    // that is never rendered as text. `found === 0` is the predicate precisely
    // so a template that renders a subset of an item's fields is not a defect.
    const desktop = measurements('phase55-s6-sonnet').desktop as { lists: Array<{ found: number }> };
    expect(desktop.lists[0].found).toBeGreaterThan(0);
    expect(desktop.lists[0].found).toBeLessThan(6);
  });

  it('leaves a report with no probes exactly as it was', () => {
    // Every fixture recorded before this check carries no `lists` field, and a
    // project whose lists are query-fed produces no probes. Neither may change
    // what the report says.
    expect(codes(report('phase55-replay-sonnet').findings)).not.toContain(RenderFinding.EmptyList);
    expect(codes(report('ecommerce-example').findings)).not.toContain(RenderFinding.EmptyList);
  });
});

/**
 * LAS-012 §3, the other half: which lists are knowable off disk at all.
 *
 * `fixtures/render/probe-project` is a four-repeater v2 project carrying one of
 * each case, written to make the abstentions visible rather than inferred. The
 * strings are haiku's and sonnet's real ones so the shapes are the measured
 * ones, but the project is vendored — the two builds themselves live outside the
 * repo and a spec that reads them passes on one machine.
 */
describe('LAS-012 §3 — which lists are knowable off disk at all', () => {
  const probes: Array<{ component: string; label: string; source: string; rows: number; strings: string[] }> =
    listProbes(path.join(__dirname, 'fixtures', 'render', 'probe-project'));

  it('probes exactly the two lists whose rows are both knowable and distinctive', () => {
    expect(probes.map((p) => p.label)).toEqual(['Product repeater', 'Direct list']);
  });

  it('reads an inline items array off the repeater itself', () => {
    const inline = probes[0];
    expect(inline.source).toBe('inline items');
    expect(inline.rows).toBe(2);
    expect(inline.strings).toEqual(['Handmade Ceramic Bowl', 'Specialty Coffee Blend']);
    // Not "£35.00": a string with no letters is a price, a date or an id, and
    // matching one proves nothing about whether a row drew.
    expect(inline.strings).not.toContain('£35.00');
  });

  it('follows a Static Data node wired straight into items, parsing its json', () => {
    const fromData = probes[1];
    expect(fromData.source).toContain('Static Data');
    expect(fromData.strings).toContain('Stoneware Dinner Bowl');
  });

  it('abstains on a list whose rows are all single common words', () => {
    // "Shop", "Home", "Help". Matching these found them in the page's own nav and
    // reported two genuinely empty lists as rendered — the measurement that put
    // the distinctiveness rule here in the first place.
    expect(probes.map((p) => p.label)).not.toContain('Tab strip');
  });

  it('abstains on a list fed through a transform', () => {
    // A Filter Collection that matches nothing is a legitimately empty list and
    // a Map Collection may rewrite every string. One hop, no transform, or
    // nothing — a probe that guesses reports a working page as broken.
    expect(probes.map((p) => p.label)).not.toContain('Filtered list');
  });

  it('returns nothing for a directory that is not a project', () => {
    expect(listProbes(path.resolve(__dirname, 'fixtures'))).toEqual([]);
    expect(listProbes('/nonexistent')).toEqual([]);
  });
});

/**
 * AWP-003 — the blank page, diagnosed rather than guessed at.
 *
 * The fixture is DeepSeek V4 Pro's real session-8 artefact, and it is **evidence**:
 * it is the project as the model left it at turn 60, after it deleted the Group
 * holding its six sections in a last restructuring attempt. It is not repaired on
 * disk and must not be.
 *
 * That makes it a sharper fixture than AWP-003 expected. The task predicted the
 * live cause would be the missing `visualRoots` of F43; measured on 2026-08-09 it
 * is not, because AWP-001 §3 derives those at read time and `render-from-disk`
 * does too. What is left is a page whose visual root is a bare `Page` node — so
 * the walk has to name *that*, and stay silent about the Page node and the
 * routing, both of which are correct here.
 */
describe('AWP-003 — why is nothing on screen', () => {
  const fixture = path.join(__dirname, 'fixtures', 'replay-deepseek-v4-pro');
  const diagnosis = blankDiagnosis(fixture);

  it('names the component and the determined cause, on the real artefact', () => {
    expect(diagnosis.ok).toBe(true);
    expect(diagnosis.cause).toBe(BlankCause.PageHasNoContent);
    expect(diagnosis.evidence.component).toBe('/Pages/Home');
    expect(diagnosis.message).toContain('/Pages/Home');
  });

  it('does not blame the Page node or the routing, because both are correct', () => {
    // The two guesses the old message led with. Here they are checked facts, and
    // they held — so they belong in `checked`, never in the message.
    expect(diagnosis.message).not.toContain('Router');
    expect(diagnosis.checked.join(' ')).toContain('startPage');
    expect(diagnosis.checked.join(' ')).toContain('routes');
    expect(diagnosis.checked.join(' ')).toContain('Page node');
  });

  it('carries the component through to the finding an agent reads', () => {
    const blank = summarise(
      {
        desktop: {
          requested: { width: 1280, height: 900 },
          layoutWidth: 1280,
          clientWidth: 1280,
          scrollWidth: 1280,
          pageHeight: 900,
          overflowing: [],
          overflowingCount: 0,
          text: { elements: 0, fontWeights: {}, distinctFontSizes: 0, bodyFontFamily: 'Inter' },
          placeholders: { count: 0, byText: {}, samples: [] },
          images: { total: 0, broken: 0, brokenSources: [] },
          emptyDecoratedBoxes: { count: 0, samples: [] },
          repeatedGroups: []
        }
      },
      diagnosis
    );
    const [finding] = blank.findings as Finding[];
    expect(finding.code).toBe(RenderFinding.BlankRender);
    // Acceptance: every blank-render-class finding carries a component path.
    expect((finding.evidence as { component: string }).component).toBe('/Pages/Home');
  });

  it('abstains rather than guessing when there is no project to walk', () => {
    const missing = blankDiagnosis('/nonexistent');
    expect(missing.ok).toBe(false);
    expect(missing.cause).toBe(BlankCause.Unreadable);
  });

  /**
   * The anti-paraphrase check. `rootNodes` restates the editor's own rule — a node
   * with no parent — in plain JS, because this file cannot import TypeScript. A
   * restatement is exactly the defect class AWP-002 gates, so it is run against
   * the real `deriveVisualRootIds` over every component of the real project.
   */
  it('derives the same roots as the editor reader it paraphrases', () => {
    const { components } = readComponents(fixture);
    expect(components.length).toBeGreaterThan(10);
    const isVisual = projectVisualPredicate(components);

    for (const component of components) {
      const here = rootNodes(component.nodes)
        .filter((n: { type: string }) => isVisual(n.type))
        .map((n: { id: string }) => n.id);
      const there = deriveVisualRootIds(component.nodes, isVisual);
      expect({ component: component.name, roots: here }).toEqual({ component: component.name, roots: there });
    }
  });
});

/**
 * AWP-004 — the eyes must fail a page nobody can see.
 *
 * `phase55-s8-kimi-k3-rerun` is the page that made this task: a storefront with a
 * dialog mounted into the layout instead of over it, reported as *"Rendered
 * clean: 83 texts, 10 images"* with zero findings.
 */
describe('AWP-004 — a page nobody can see is not clean', () => {
  const kimi = report('phase55-s8-kimi-k3-rerun');

  it('fails the page the old report called clean', () => {
    expect(kimi.summary).not.toContain('Rendered clean');
    expect(codes(kimi.findings, 'error').length).toBeGreaterThan(0);
  });

  it('counts the content no scroll can reach, and names the numbers', () => {
    const stranded = kimi.findings.find((f) => f.code === RenderFinding.ContentNotVisible);
    expect(stranded?.severity).toBe('error');
    // 70 of 83 texts and 9 of 10 images laid out past a page that stops at 900px.
    expect(stranded?.message).toContain('70 of 83 text elements');
    expect(stranded?.message).toContain('9 of 10 images');
  });

  it('names the mechanism: a page pinned to the viewport with content past it', () => {
    const clipped = kimi.findings.find((f) => f.code === RenderFinding.ClippedPage);
    expect(clipped?.viewport).toBe('desktop');
    expect(clipped?.message).toContain('900px');
    expect(clipped?.message).toContain('5292px');
  });

  it('reports the 43 overflowing elements the page-level check could not see', () => {
    // `scrollWidth <= clientWidth` held, so `horizontal-overflow` stayed silent
    // while 43 elements overflowed inside the page. The number had been measured
    // since LAS-005 and had no rule attached to it — register note A7.
    const over = kimi.findings.find((f) => f.code === RenderFinding.ElementsOverflowing);
    expect(over?.viewport).toBe('phone');
    expect(over?.message).toContain('43 elements');
  });

  it('says what is on screen, not only what is in the DOM', () => {
    // The single cheapest change in the task: "83 texts, 13 on screen" needs no
    // finding attached for a model to know something is wrong.
    expect(kimi.summary).toContain('83 texts, 13 on screen');
  });

  /**
   * The fixture that stops the new checks crying wolf — register note A8. Both of
   * these are real agent-authored pages that genuinely render, and the first
   * version of `content-not-visible` (counted text vs text in the viewport, as
   * AWP-004 §2 proposed it) fired on **both**: sonnet shows 19 of 82 texts at
   * 1280×900 against Kimi's 13, so the ratio does not separate them.
   */
  it('says nothing new about the build this phase calls correct', () => {
    const sonnet = report('phase55-replay-sonnet');
    expect(sonnet.summary).toContain('Rendered clean');
    expect(codes(sonnet.findings)).not.toContain(RenderFinding.ContentNotVisible);
    expect(codes(sonnet.findings)).not.toContain(RenderFinding.ClippedPage);
    expect(codes(sonnet.findings)).not.toContain(RenderFinding.ElementsOverflowing);
  });

  it('does not trip a short page that is genuinely complete', () => {
    // A page that fits the fold with nothing past it is fine, and that is the
    // difference `clipped-page` turns on: content *exceeding* a pinned height.
    const short = summarise({
      desktop: {
        requested: { width: 1280, height: 900 },
        layoutWidth: 1280,
        clientWidth: 1280,
        clientHeight: 900,
        scrollWidth: 1280,
        pageHeight: 900,
        contentBottom: 640,
        overflowing: [],
        overflowingCount: 0,
        text: { elements: 6, onScreen: 6, unreachable: 0, fontWeights: { '400': 3, '700': 3 }, distinctFontSizes: 3, bodyFontFamily: 'Inter' },
        placeholders: { count: 0, byText: {}, samples: [] },
        images: { total: 1, onScreen: 1, unreachable: 0, broken: 0, brokenSources: [] },
        emptyDecoratedBoxes: { count: 0, samples: [] },
        repeatedGroups: []
      }
    });
    expect(short.findings).toEqual([]);
    expect(short.summary).toContain('Rendered clean');
  });

  it('abstains, rather than claiming clean, when visibility was never measured', () => {
    // A recording made before these fields existed cannot answer the question,
    // and "no check I own fired" is the claim that certified three broken pages.
    const old = summarise({
      desktop: {
        requested: { width: 1280, height: 900 },
        layoutWidth: 1280,
        clientWidth: 1280,
        scrollWidth: 1280,
        pageHeight: 2400,
        overflowing: [],
        overflowingCount: 0,
        text: { elements: 40, fontWeights: { '400': 20, '700': 20 }, distinctFontSizes: 4, bodyFontFamily: 'Inter' },
        placeholders: { count: 0, byText: {}, samples: [] },
        images: { total: 2, broken: 0, brokenSources: [] },
        emptyDecoratedBoxes: { count: 0, samples: [] },
        repeatedGroups: []
      }
    });
    expect(old.findings).toEqual([]);
    expect(old.summary).not.toContain('Rendered clean');
    expect(old.summary).toContain('visibility was not measured');
  });
});

/**
 * AWP-004 §3 — the placeholders the catalog cannot know about.
 *
 * The task assumed `Title`, `Body` and `Got it` were "the untouched defaults of a
 * dialog component" and that the catalog could answer for them. Measured: **no
 * catalog default matches any of the three**. They are text the model hardcoded
 * in its own components, on ports a `Component Inputs` node also feeds — a value
 * only ever visible when the input does not arrive. So the strings are derived
 * from the graph rather than listed, which is what §3 asks for when it warns
 * against over-fitting to the three it happened to name.
 */
describe('AWP-004 §3 — a fallback on screen is an input that never arrived', () => {
  const kimiProject = '/Users/richardosborne/vscode_projects/NodeGX test projects/phase55-s8-kimi-k3-rerun';
  const available = fs.existsSync(kimiProject);
  const maybe = available ? it : it.skip;

  maybe('derives all three of the strings the task named, and never lists them', () => {
    const derived = overriddenDefaults(kimiProject);
    for (const string of ['Title', 'Body', 'Got it']) expect([...derived.keys()]).toContain(string);
    // None of the three is a node-type default, which is why `placeholders.count`
    // was 0 on a page showing all three.
    for (const string of ['Title', 'Body', 'Got it']) expect(placeholderStrings()).not.toContain(string);
  });

  maybe('records every site of a string, not the first one seen', () => {
    // "Title" is hardcoded in both TrustItem and NoticeDialog. A finding naming
    // one would send an agent to a component that was never on screen.
    const derived = overriddenDefaults(kimiProject);
    expect(derived.get('Title').sites.length).toBeGreaterThan(1);
  });

  it('reports the two placeholder classes as two different causes', () => {
    const measured = {
      desktop: {
        requested: { width: 1280, height: 900 },
        layoutWidth: 1280,
        clientWidth: 1280,
        clientHeight: 900,
        scrollWidth: 1280,
        pageHeight: 2400,
        contentBottom: 2400,
        overflowing: [],
        overflowingCount: 0,
        text: { elements: 20, onScreen: 8, unreachable: 0, fontWeights: { '400': 10, '700': 10 }, distinctFontSizes: 4, bodyFontFamily: 'Inter' },
        placeholders: {
          count: 2,
          byText: { Text: 1, 'Got it': 1 },
          samples: [
            { text: 'Text', tag: 'DIV', cls: '' },
            { text: 'Got it', tag: 'DIV', cls: '' }
          ]
        },
        images: { total: 1, onScreen: 1, unreachable: 0, broken: 0, brokenSources: [] },
        emptyDecoratedBoxes: { count: 0, samples: [] },
        repeatedGroups: []
      }
    };
    const { findings } = summarise(measured, undefined, {
      'Got it': { sites: [{ component: '/Components/NoticeDialog', nodeId: 'btn', port: 'label' }] }
    });
    const placeholders = (findings as Finding[]).filter((f) => f.code === RenderFinding.DeadPlaceholderText);
    expect(placeholders).toHaveLength(2);

    const nodeDefault = placeholders.find((f) => f.message.includes('node-type default'));
    expect(nodeDefault?.message).toContain('"Text"');
    expect(nodeDefault?.message).not.toContain('Got it');

    const fallback = placeholders.find((f) => f.message.includes('did not arrive'));
    expect(fallback?.message).toContain('label in /Components/NoticeDialog');
    expect(fallback?.message).not.toContain('"Text"');
  });
});
