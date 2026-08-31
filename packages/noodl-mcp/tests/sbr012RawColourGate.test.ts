/**
 * SBR-012 — the raw-colour gate.
 *
 * Workstream B's enforcement: the rule that keeps SBR-003..009 true after this
 * phase ends. Scoped down from the screens artifact's *"no component may set a
 * raw value"* — unenforceable as stated, because `flexDirection: 'row'` is a raw
 * value and always will be — to the three things a gate can actually hold:
 *
 *  1. **no raw colour**, in either population;
 *  2. **every consumed token resolves**;
 *  3. **every non-token dimension is named, with a reason.**
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ## Two populations, always both
 *
 * The template is generated. `sb00{4,5,6}Components.ts` plus `sb007Template.ts`
 * are the source; `site-builder.content.json` is what a person receives. A gate
 * over the source alone cannot see regeneration drift, and a gate over the
 * artefact alone reddens after the fact — so both, every run, and §1 and §2
 * below are deliberately the same three checks pointed at different bytes.
 *
 * ⚠️ `sb007Template.test.ts` already asserts the artefact is byte-identical to a
 * fresh generation, which makes the two populations equal **today**. That is a
 * reason to keep both arms, not to drop one: byte-identity is itself a gate that
 * can be suspended, and if it ever is, this file is what still says which of the
 * two went wrong.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ## 🔴 A new checker's first finding is about the checker
 *
 * Calibrated on HEAD before a single assertion was written. All three checks
 * read **zero** over the shipped template:
 *
 * | check | artefact | component sets |
 * |---|---|---|
 * | raw colour (`#hex`, `rgb()`, `hsl()`) | **0** in 289KB | **0**, comments stripped |
 * | unresolved `var(--x)` | **0** of 33 distinct | **0** of 33 distinct |
 * | non-token dimensions | **9**, all named in §3 | — |
 *
 * A checker that reads zero everywhere and a checker that is broken produce the
 * same output, so **every arm here is paired with a planted-defect spec** that
 * must red. That pairing is AC1's *"known-good and known-broken must disagree,
 * demonstrated in the suite itself"*, and it is the only reason to believe the
 * greens above.
 *
 * ⚠️ The plants mutate an **in-memory copy**. Nothing in this file writes to the
 * artefact or to a component set.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ## What this gate deliberately does NOT do
 *
 * 🔴 **It does not touch `DiagnosticCode.RawColorLiteral`'s global severity.**
 * That diagnostic is a warning by design — the wider corpus carries 553 and
 * imported content is not wrong for being untokenised, it is just untokenised.
 * Promoting it project-wide would red the door on every import anyone has ever
 * made. The rule is promoted to FAIL **for this template's two populations**,
 * which is what a template can be held to and a corpus cannot.
 *
 * @see siteBuilderStyleScan.ts — the instrument, shared with `sb006PublicSite`.
 */
import {
  ARTEFACT_PATH,
  COMPONENT_SET_FILES,
  ParamRow,
  RAW_COLOR_LITERAL,
  TEMPLATE_DIMENSION_EXEMPTIONS,
  artefactParams,
  rawColoursInArtefact,
  rawColoursInSource,
  rawDimensionsInArtefact,
  readArtefact,
  readComponentSet,
  stripComments,
  templateExemptionKey,
  tokenUniverse,
  tokensUsedIn,
  unresolvedTokens
} from './siteBuilderStyleScan';

const artefact = readArtefact();
const rows = artefactParams(artefact);
const artefactText = JSON.stringify(artefact);
const sources = COMPONENT_SET_FILES.map((file) => [file, readComponentSet(file)] as const);
const universe = tokenUniverse();

/** A deep copy, so a plant never reaches the file the other specs read. */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe('SBR-012 §0 — the instrument can see', () => {
  /**
   * 🔴 Read this before believing any zero below.
   *
   * `rawColoursInArtefact` returning `[]` is equally good evidence for "the
   * template is tokenised" and for "the walker visited nothing" — opposite
   * conclusions, and the second one is what a wrong path or a renamed field
   * produces. So the reach is asserted as a floor, in the same run.
   */
  it('the artefact walker reaches the whole template', () => {
    expect(artefact.components.length).toBeGreaterThanOrEqual(19);
    expect(rows.length).toBeGreaterThanOrEqual(500);
    const components = new Set(rows.map((r) => r.component));
    expect(components.size).toBe(artefact.components.length);
  });

  it('the walker reaches script bodies, which is the hole it exists for', () => {
    const scripts = rows.filter((r) => r.port === 'functionScript');
    expect(scripts.length).toBeGreaterThanOrEqual(30);
    // `applyTheme` by name: it is the node the task file singles out, because it
    // writes custom properties itself and is therefore the likeliest home for a
    // literal that no colour-typed-port check could ever see.
    expect(scripts.some((r) => r.label === 'The theme record, as CSS variables')).toBe(true);
  });

  it('the source scan reaches every component set, comments removed', () => {
    for (const [file, source] of sources) {
      expect(`${file} read: ${source.length > 5000}`).toBe(`${file} read: true`);
      expect(`${file} shrank: ${stripComments(source).length < source.length}`).toBe(`${file} shrank: true`);
    }
    expect(sources.length).toBe(4);
  });
});

describe('SBR-012 §1 — no raw colour, in either population', () => {
  it('AC1: the generated artefact names no colour', () => {
    expect(rawColoursInArtefact(rows)).toEqual([]);
  });

  it('AC1: the component sets name no colour', () => {
    const hits = sources.flatMap(([file, source]) => rawColoursInSource(file, source));
    expect(hits.map((h) => `${h.file}:${h.line} ${h.text}`)).toEqual([]);
  });

  /**
   * The scan is textual over the whole artefact as well as per-parameter,
   * because a colour could sit somewhere `artefactParams` does not model — a
   * component-level field, a future `styles` block. The per-row scan names the
   * culprit; this one refuses to be surprised.
   *
   * 🔴 The one allowed home for literals is the `designTokens` block, and it is
   * NOT in this file — `buildSiteDesignTokens()` lives on the template object
   * and is written into project metadata by `EmbeddedTemplateProvider.install`.
   * So the artefact's budget is zero, with no carve-out to police.
   */
  it('AC1: the artefact text carries no colour literal at all', () => {
    expect(artefactText).not.toMatch(RAW_COLOR_LITERAL);
    expect(artefactText).not.toMatch(/#[0-9a-fA-F]{3}\b/);
  });
});

describe('SBR-012 §1b — MUTANTS: the three ways a colour gets in', () => {
  /**
   * (a) A colour port. This is the one the product's own `RawColorLiteral`
   * would also catch — planted anyway, because a gate that only finds what the
   * product already finds has no reason to exist, and proving it finds this too
   * is what makes the other two plants readable as a *widening*.
   */
  it('AC1(a): a hex on a colour port reddens the artefact scan', () => {
    const mutant = clone(artefact);
    const target = artefactParams(mutant).find((r) => r.port === 'backgroundColor');
    expect(target).toBeDefined();
    const edits = plant(mutant, target!, '#1e4d8c');
    expect(`edits: ${edits}`).toBe('edits: 1');
    expect(rawColoursInArtefact(artefactParams(mutant))).toEqual([
      templateExemptionKey(target!.component, target!.label, target!.port)
    ]);
  });

  /**
   * (b) A script body — `RawColorLiteral` reads colour-TYPED ports only, and a
   * `functionScript` is a string on a `*` port. `applyTheme` is chosen on
   * purpose: it is the node that writes custom properties, so a literal there
   * would override a themed token for every element on the site and no
   * diagnostic in the product could report it.
   */
  it('AC1(b): a hex inside a script body reddens the artefact scan', () => {
    const mutant = clone(artefact);
    const target = artefactParams(mutant).find(
      (r) => r.port === 'functionScript' && String(r.value).includes("setProperty('--primary'")
    );
    expect(target).toBeDefined();
    const edits = plant(mutant, target!, String(target!.value).replace('t.colorPrimary)', "'#1e4d8c')"));
    expect(`edits: ${edits}`).toBe('edits: 1');
    expect(rawColoursInArtefact(artefactParams(mutant))).toEqual([
      templateExemptionKey(target!.component, target!.label, target!.port)
    ]);
  });

  /**
   * 🔴 (c) The artefact only — regeneration drift. The plant goes into the
   * artefact and NOT into any component set, which is the shape of a hand edit
   * to `site-builder.content.json` and of a generator that stopped matching its
   * source. The source scan stays green on the same run, and that pair is the
   * argument for scanning two populations rather than one.
   */
  it('AC1(c): a hex in the artefact alone reddens the artefact and not the source', () => {
    const mutant = clone(artefact);
    const target = artefactParams(mutant).find((r) => r.port === 'color');
    expect(target).toBeDefined();
    plant(mutant, target!, 'rgba(30, 77, 140, 0.9)');
    expect(rawColoursInArtefact(artefactParams(mutant)).length).toBe(1);
    // The control half: the source population is untouched and still reads clean,
    // so the red above is attributable to the artefact and to nothing else.
    expect(sources.flatMap(([file, source]) => rawColoursInSource(file, source))).toEqual([]);
  });

  /**
   * The hole in the PRODUCT's regex, demonstrated rather than described:
   * `RAW_COLOR` is anchored `^\s*`, so a hex in the middle of a shorthand walks
   * past it. This gate's pattern is unanchored, and this spec is what says so.
   */
  it('AC1: a hex MID-STRING reddens here, where the product regex is anchored', () => {
    const PRODUCT_ANCHORED = /^\s*(#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\()/;
    const smuggled = '1px solid #cdc5b6';
    expect(PRODUCT_ANCHORED.test(smuggled)).toBe(false);
    expect(RAW_COLOR_LITERAL.test(smuggled)).toBe(true);
  });

  /** A mutation that matched nothing leaves the arm identical to the control. */
  function plant(content: ReturnType<typeof readArtefact>, target: ParamRow, value: unknown): number {
    let edits = 0;
    const walk = (node: { label?: string; type: string; parameters?: Record<string, unknown>; children?: any[] }, component: string) => {
      const label = node.label ?? node.type;
      if (component === target.component && label === target.label && node.parameters?.[target.port] !== undefined) {
        node.parameters[target.port] = value;
        edits += 1;
      }
      for (const child of node.children ?? []) walk(child, component);
    };
    for (const component of content.components) for (const root of component.graph.roots) walk(root as any, component.name);
    return edits;
  }
});

describe('SBR-012 §2 — every consumed token resolves', () => {
  /**
   * The arm no colour check can have. `var(--tpyo)` is a well-formed CSS value
   * naming a property that was never declared: the browser drops the declaration
   * and the element inherits, so the page renders *almost* right and there is no
   * literal for anything to find.
   */
  it('AC2: the artefact names no token that resolves nowhere', () => {
    expect(unresolvedTokens(artefactText, universe)).toEqual([]);
  });

  it('AC2: the component sets name no token that resolves nowhere', () => {
    for (const [file, source] of sources) {
      expect(`${file}: ${unresolvedTokens(stripComments(source), universe).join(', ')}`).toBe(`${file}: `);
    }
  });

  it('the resolver saw a real population, not an empty one', () => {
    // 🔴 `all([])` is the answer you wanted. 33 distinct names across 284 uses is
    // the floor; a walker that found none would satisfy the two specs above.
    expect(tokensUsedIn(artefactText).size).toBeGreaterThanOrEqual(30);
    expect(universe.size).toBeGreaterThanOrEqual(180);
    expect(universe.has('--site-measure')).toBe(true);
  });

  it('AC2 MUTANT: a planted var(--tpyo) reddens the resolver', () => {
    const typo = artefactText.replace('var(--primary)', 'var(--tpyo)');
    expect(`text changed: ${typo !== artefactText}`).toBe('text changed: true');
    expect(unresolvedTokens(typo, universe)).toEqual(['--tpyo']);
  });

  it('AC2 MUTANT: a token dropped from the universe reddens the resolver', () => {
    // The other direction, and the one a person actually causes: the name is
    // spelled correctly and the token was deleted. Same failure, opposite edit.
    const shrunk = new Set(universe);
    shrunk.delete('--site-measure');
    expect(unresolvedTokens(artefactText, shrunk)).toEqual(['--site-measure']);
  });
});

describe('SBR-012 §3 — every non-token dimension is named, with a reason', () => {
  it('AC3: the artefact\'s raw dimensions are exactly the named exemptions', () => {
    const found = rawDimensionsInArtefact(rows);
    const named = TEMPLATE_DIMENSION_EXEMPTIONS.map((e) =>
      templateExemptionKey(e.component, e.label, e.port)
    ).sort();
    // 🔴 Equality, both directions. An unnamed dimension reds, and so does an
    // exemption that matches nothing — the second reads exactly like a raw value
    // that was never introduced, which is how a stale list becomes a hole.
    expect(found).toEqual(named);
  });

  it('AC3: every exemption carries a reason, not a shrug', () => {
    for (const e of TEMPLATE_DIMENSION_EXEMPTIONS) {
      const key = templateExemptionKey(e.component, e.label, e.port);
      expect(`${key} reasoned: ${e.why.length > 60}`).toBe(`${key} reasoned: true`);
    }
  });

  it('AC3: colour, radius, gap, face and font size have no exemptions at all', () => {
    // The vocabulary covers all five, so a raw one there is a defect rather than
    // a gap — and an exemption for one would be the relaxation this list exists
    // to refuse.
    const forbidden = /^(color|background|border.*(Color|Radius)|font|letterSpacing|lineHeight|rowGap|columnGap)/i;
    expect(TEMPLATE_DIMENSION_EXEMPTIONS.filter((e) => forbidden.test(e.port))).toEqual([]);
  });

  it('the dimension scan saw the tokenised ports it clears', () => {
    const tokened = rows.filter((r) => typeof r.value === 'string' && r.value.startsWith('var(--'));
    expect(tokened.length).toBeGreaterThanOrEqual(200);
  });

  it('AC3 MUTANT: an unnamed raw dimension reddens the audit', () => {
    const mutant = clone(rows);
    const target = mutant.find((r) => r.component === '/Site/SectionView' && r.port === 'paddingTop');
    expect(target).toBeDefined();
    target!.value = { value: 17, unit: 'px' };
    const found = rawDimensionsInArtefact(mutant);
    expect(found).toContain(templateExemptionKey(target!.component, target!.label, 'paddingTop'));
    expect(found.length).toBe(TEMPLATE_DIMENSION_EXEMPTIONS.length + 1);
  });

  it('AC3 MUTANT: a bare number reddens it too, not only a unit object', () => {
    // The shape the door refuses with `unitless-dimension` — a bare 32 on a
    // spacing port is read as 32%. It must not slip past the audit on its way to
    // being refused somewhere else.
    const mutant = clone(rows);
    const target = mutant.find((r) => r.component === '/Pages/Site' && r.port === 'rowGap');
    expect(target).toBeDefined();
    target!.value = 32;
    expect(rawDimensionsInArtefact(mutant)).toContain(
      templateExemptionKey(target!.component, target!.label, 'rowGap')
    );
  });

  it('AC3: the label-only key would have been ambiguous, and is not used', () => {
    // 🔴 Why `TEMPLATE_DIMENSION_EXEMPTIONS` carries a component. SB-006's four
    // live in one set where `label` is unique; the template has several nodes
    // labelled `Heading` and exactly one sets a raw width. A label-only key
    // would exempt the others without anyone deciding to.
    const headings = new Set(rows.filter((r) => r.label === 'Heading').map((r) => r.component));
    expect(headings.size).toBeGreaterThan(1);
    expect(TEMPLATE_DIMENSION_EXEMPTIONS.filter((e) => e.label === 'Heading').length).toBe(1);
  });
});

describe('SBR-012 §4 — AC4: the gate actually runs', () => {
  /**
   * 🔴 An unrun gate is worse than no gate: it is a green nobody reads.
   *
   * The task's AC names "the spec barrel", which is the **editor's** convention
   * — `tests-unit` is an explicit `index.ts` export list and a spec missing from
   * it never runs. This package has no barrel; `jest.config.js` matches
   * `tests/**\/*.test.ts` by glob, so discovery is by filename. The AC's
   * substance is therefore checked where it actually lives: this file's name is
   * matched by that glob, `test:packages` scopes `@noodl/mcp`, and `pr.yml` runs
   * `test:packages`.
   *
   * ⚠️ It is `test:packages`, NOT `test:ci`. `test:ci` is the editor's own
   * runner (`scripts/test-editor.ts --ci`) and does not execute this package at
   * all — writing the assertion against `test:ci` would have produced a spec
   * that passes while measuring the wrong gate.
   */
  it('AC4: this file is discovered by the package jest config', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const config = require('../jest.config.js') as { testMatch: string[] };
    expect(config.testMatch).toContain('<rootDir>/tests/**/*.test.ts');
    expect(__filename.endsWith('.test.ts')).toBe(true);
  });

  it('AC4: the runner that executes this package is in CI', () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const repo = path.join(__dirname, '..', '..', '..');
    const root = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(root.scripts['test:packages']).toContain('@noodl/mcp');
    const pr = fs.readFileSync(path.join(repo, '.github', 'workflows', 'pr.yml'), 'utf8');
    expect(pr).toContain('npm run test:packages');
  });

  it('the artefact this gate reads is the one the template ships', () => {
    // The path is derived rather than restated, but a wrong path cannot fire —
    // so it is asserted to be the file `site-builder.template.ts` imports.
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    expect(fs.existsSync(ARTEFACT_PATH)).toBe(true);
    const template = fs.readFileSync(
      path.join(path.dirname(ARTEFACT_PATH), 'site-builder.template.ts'),
      'utf8'
    );
    expect(template).toContain(`./${path.basename(ARTEFACT_PATH)}`);
  });
});
