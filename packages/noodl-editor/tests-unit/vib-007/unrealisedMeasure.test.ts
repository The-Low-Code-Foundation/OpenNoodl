/**
 * VIB-007 / register **V29** — the measure belongs to the shell.
 *
 * 🔴 **The row names a shape with 13 corpus instances and only ONE of them is the defect**, which is
 * why the arms below are mostly silences. `vib007-v29.look.ts` rendered every `Text` in the corpus
 * carrying a `maxWidth`, at 1280 and 1900, and measured the painted extent of the band each sits in:
 * twelve read **374 left / 374 right**, and three of those twelve are on `ui-landing-page`, the page
 * Richard ruled *"it looks fucking pro"*. `ui-image-scrim-band` reads **374 / 766** — his ruling's
 * own numbers. Every silence here is one of those twelve, kept as a named control rather than left
 * to a corpus census that would pass just as happily against a check returning nothing.
 *
 * The two hero shapes are the whole argument and are asserted against each other: they differ by a
 * single uncapped child, and that child is the difference between symmetric and not.
 */
import * as fs from 'fs';
import * as path from 'path';

import { loadDefaultCatalog } from '../../src/editor/src/validation/catalog';
import { checkUnrealisedMeasure } from '../../src/editor/src/validation/unrealisedMeasure';

const catalog = loadDefaultCatalog();
const REPO = path.join(__dirname, '..', '..', '..', '..');
const EXAMPLES = path.join(REPO, 'docs', 'node-catalog', 'examples');

const px = (value: number) => ({ value, unit: 'px' });

type Node = { id: string; type: string; parameters?: Record<string, unknown>; children?: string[] };

const run = (nodes: Node[], fed: string[] = [], component = '/Test') =>
  checkUnrealisedMeasure(nodes, { component, catalog, connectedInputs: new Set(fed) });

/** `ui-image-scrim-band`'s shell verbatim — the one corpus hit, and the shape Richard ruled on. */
const scrimBand = (): Node[] => [
  { id: 'shell', type: 'Group', parameters: { maxWidth: px(1200) }, children: ['heading', 'sub'] },
  { id: 'heading', type: 'Text', parameters: { maxWidth: px(760) } },
  { id: 'sub', type: 'Text', parameters: { maxWidth: px(560) } }
];

/** `ui-gradient-hero`'s shell verbatim — the same shape plus one uncapped child, and it is correct. */
const gradientHero = (): Node[] => [
  { id: 'shell', type: 'Group', parameters: { maxWidth: px(1200) }, children: ['eyebrow', 'headline', 'lead'] },
  { id: 'eyebrow', type: 'Text', parameters: {} },
  { id: 'headline', type: 'Text', parameters: { maxWidth: px(900) } },
  { id: 'lead', type: 'Text', parameters: { maxWidth: px(560) } }
];

describe('V29 — the two hero shells that differ by one node', () => {
  it('reports the shell whose every child is capped narrower', () => {
    const d = run(scrimBand());
    expect(d).toHaveLength(1);
    expect(d[0].code).toBe('unrealised-measure');
    expect(d[0].location.nodeId).toBe('shell');
    expect(d[0].location.port).toBe('maxWidth');
    // The message names the gap a reader can see on the page: 1200 declared, 760 drawn.
    expect(d[0].message).toContain('1200px');
    expect(d[0].message).toContain('760px');
    expect(d[0].suggestion).toContain('760px');
  });

  /**
   * 🔴 The discriminator, and the reason this check is about the shell rather than the Text. The
   * uncapped `eyebrow` paints the shell's full inner width, so the measure is realised and the band
   * renders symmetric — measured at 374/374.
   */
  it('is silent on the same shell when ONE child is uncapped', () => {
    expect(run(gradientHero())).toEqual([]);
  });

  /**
   * 🔴 A mutation on the control rather than on the subject: delete the one uncapped child's role
   * and the correct page becomes the defect. Without this, "silent on gradientHero" could be true
   * because the check never fires on anything.
   */
  it('reports gradientHero once its uncapped child is given a cap — the silence is load-bearing', () => {
    const mutated = gradientHero();
    mutated[1].parameters = { maxWidth: px(400) };
    const d = run(mutated);
    expect(d).toHaveLength(1);
    expect(d[0].location.nodeId).toBe('shell');
    // The widest is now the headline, not the deleted eyebrow.
    expect(d[0].message).toContain('900px');
  });
});

describe('V29 — the twelve correct instances, as named controls', () => {
  /**
   * `ui-landing-page`'s `/Sections/SiteFooter`: a 320px blurb in a band 1900 wide, and RIGHT,
   * because the band draws to its measure elsewhere. The page Richard ruled "fucking pro".
   */
  it('is silent when a capped Text sits beside an uncapped sibling', () => {
    expect(
      run([
        { id: 'footer_about', type: 'Group', parameters: { maxWidth: px(1200) }, children: ['brand', 'blurb'] },
        { id: 'brand', type: 'Text', parameters: {} },
        { id: 'blurb', type: 'Text', parameters: { maxWidth: px(320) } }
      ])
    ).toEqual([]);
  });

  /**
   * `ui-empty-state`: every child capped, and it renders the most symmetric reading in the whole
   * population — 760 left, 760 right — because the root centres them.
   */
  it('is silent when the shell centres its children with alignItems', () => {
    expect(
      run([
        { id: 'root', type: 'Group', parameters: { maxWidth: px(900), alignItems: 'center' }, children: ['body'] },
        { id: 'body', type: 'Text', parameters: { maxWidth: px(380) } }
      ])
    ).toEqual([]);
  });

  it('is silent when the child centres itself with alignX — the other way to be symmetric', () => {
    expect(
      run([
        { id: 'shell', type: 'Group', parameters: { maxWidth: px(1200) }, children: ['body'] },
        { id: 'body', type: 'Text', parameters: { maxWidth: px(560), alignX: 'center' } }
      ])
    ).toEqual([]);
  });
});

describe('V29 — the narrowings, each asserted as a mechanism rather than trusted', () => {
  it('skips a row, where justifyContent centres and children sit side by side', () => {
    const nodes = scrimBand();
    nodes[0].parameters = { maxWidth: px(1200), flexDirection: 'row' };
    expect(run(nodes)).toEqual([]);
  });

  it('skips absolute positioning, which has no measure to realise', () => {
    const nodes = scrimBand();
    nodes[0].parameters = { maxWidth: px(1200), flexDirection: 'none' };
    expect(run(nodes)).toEqual([]);
  });

  it('fires on an explicit column, so the direction test is not simply passing everything', () => {
    const nodes = scrimBand();
    nodes[0].parameters = { maxWidth: px(1200), flexDirection: 'column' };
    expect(run(nodes)).toHaveLength(1);
  });

  it('does not count a percentage cap as narrower — the port defaults to %, which is relative', () => {
    const nodes = scrimBand();
    nodes[1].parameters = { maxWidth: { value: 80, unit: '%' } };
    expect(run(nodes)).toEqual([]);
  });

  it('does not count a cap arriving over a connection, which it cannot read', () => {
    expect(run(scrimBand(), ['heading::maxWidth'])).toEqual([]);
  });

  it('does not count a component instance, whose content is inside it', () => {
    const nodes = scrimBand();
    nodes[1] = { id: 'heading', type: '/Components/Hero', parameters: { maxWidth: px(760) } };
    expect(run(nodes)).toEqual([]);
  });

  it('ignores a non-painting child, which no measure is about', () => {
    expect(
      run([
        { id: 'shell', type: 'Group', parameters: { maxWidth: px(1200) }, children: ['sub', 'data'] },
        { id: 'sub', type: 'Text', parameters: { maxWidth: px(560) } },
        { id: 'data', type: 'Static Data', parameters: {} }
      ])
    ).toHaveLength(1);
  });

  /**
   * 🔴 `every()` over an empty list is `true`. Without this guard the check would report every
   * childless capped node in every graph — the answer it "wanted", arrived at by cardinality.
   */
  it('says nothing about a capped node with no children at all', () => {
    expect(run([{ id: 'lone', type: 'Text', parameters: { maxWidth: px(560) } }])).toEqual([]);
  });

  it('says nothing about a shell with no maxWidth of its own', () => {
    const nodes = scrimBand();
    nodes[0].parameters = {};
    expect(run(nodes)).toEqual([]);
  });

  it('says nothing when a child is capped WIDER than the shell', () => {
    const nodes = scrimBand();
    nodes[1].parameters = { maxWidth: px(1600) };
    expect(run(nodes)).toEqual([]);
  });
});

describe('V29 — the corpus, and the population the row was wrong about', () => {
  type Example = {
    components: {
      name: string;
      nodes: Node[];
      connections?: Array<{ toId: string; toProperty: string }>;
    }[];
  };

  const load = (): { file: string; example: Example }[] =>
    fs
      .readdirSync(EXAMPLES)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .map((file) => ({ file, example: JSON.parse(fs.readFileSync(path.join(EXAMPLES, file), 'utf-8')) }));

  const sweep = (examples: { file: string; example: Example }[]) => {
    const hits: string[] = [];
    for (const { file, example } of examples) {
      for (const c of example.components ?? []) {
        const d = checkUnrealisedMeasure(c.nodes ?? [], {
          component: c.name,
          catalog,
          connectedInputs: new Set((c.connections ?? []).map((k) => `${k.toId}::${k.toProperty}`))
        });
        if (d.length) hits.push(`${file}:${c.name}:${d.map((x) => x.location.nodeId).join('+')}`);
      }
    }
    return hits;
  };

  /**
   * 🔴 The number in the register row, re-derived. V28's *"30 raw pixel numbers"* re-derived to 1 and
   * V23's *"a glyph absent from the manifest"* would have condemned the WORTHY page; this asserts
   * what the row's shape actually contains so the next reader does not have to take it on trust.
   */
  it('the row\'s shape is 13 capped Texts across 7 examples — and 12 of them are correct', () => {
    const examples = load();
    expect(examples.length).toBeGreaterThanOrEqual(67);

    const cappedTexts = examples.flatMap(({ example }) =>
      (example.components ?? []).flatMap((c) =>
        (c.nodes ?? []).filter((n) => n.type === 'Text' && n.parameters && 'maxWidth' in n.parameters)
      )
    );
    const allCaps = examples.flatMap(({ example }) =>
      (example.components ?? []).flatMap((c) =>
        (c.nodes ?? []).filter((n) => n.parameters && 'maxWidth' in n.parameters)
      )
    );
    // Cardinality before the verdict: the shape exists in quantity, so the single hit below is a
    // narrowing rather than a check that cannot see anything.
    expect(allCaps).toHaveLength(42);
    expect(cappedTexts).toHaveLength(13);

    const hits = sweep(examples);
    expect(hits).toEqual(['ui-image-scrim-band.json:/Pages/Example:shell']);
  });

  /**
   * ⚠️ The one hit is NOT repaired here. Register V29 assigns `ui-image-scrim-band` to **VIB-008**:
   * it is VIB-002's shipped recipe and re-cutting its geometry re-opens a verdict Richard has
   * already given on the rendered page. This row pins the hit so the day it is repaired is a day a
   * spec reports, rather than a silent drift — and so `catalog:examples` can adopt the check then
   * (register V45).
   */
  it('the one hit is the band the ruling was about, still unrepaired and deliberately so', () => {
    const band = load().find((e) => e.file === 'ui-image-scrim-band.json')!;
    const page = band.example.components.find((c) => c.name === '/Pages/Example')!;
    const shell = page.nodes.find((n) => n.id === 'shell')!;
    expect(shell.parameters!.maxWidth).toEqual(px(1200));
    expect(shell.parameters!.alignItems).toBeUndefined();
    expect(page.nodes.filter((n) => n.parameters && 'maxWidth' in n.parameters).map((n) => n.id)).toEqual([
      'shell',
      'heading',
      'sub'
    ]);
  });
});
