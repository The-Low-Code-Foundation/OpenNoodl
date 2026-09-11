/**
 * VIB-007 / register **V28** — the spacing half of *"never emit a raw hex or px when a token fits"*.
 *
 * 🔴 **The register row made two claims and the measurements changed both.**
 *
 * 1. *"a `var()` in a units-typed port, which is dropped silently"* — **disproved by a render.**
 *    `packages/nodegx-backend/tests/vib007-v28.look.ts` draws four arms differing only in `width`:
 *    explicit 200px reads 200, `var(--space-16)` reads **64** (exactly the token's value), no width
 *    at all reads 708, and the same token on `paddingLeft` insets by 64. The value is honoured, not
 *    dropped. A diagnostic written to that sentence would have punished correct authoring.
 * 2. *"30 raw pixel numbers where a `--space` token belongs"* — **re-derived to 1.** Of 402 spacing
 *    parameters in the corpus, 401 are tokenised. The 15 that look most like the family are
 *    `Columns` `marginX`/`marginY`, and those are correct: the runtime's own note says autofold
 *    needs a number and a tokenised gutter folds as though it were 0.
 *
 * So the rule that ships is narrowed twice, and both narrowings are graded below rather than
 * described. What survives is real: one corpus hit, repaired, and the door now says the sentence
 * for spacing that it has always said for colour.
 */
import * as fs from 'fs';
import * as path from 'path';

import { loadDefaultCatalog } from '../../src/editor/src/validation/catalog';
import { DiagnosticCode } from '../../src/editor/src/validation/diagnostics';
import { checkParameterValues, spacingPixels } from '../../src/editor/src/validation/parameterValues';
import type { ParameterizedNode } from '../../src/editor/src/validation/parameterValues';

const catalog = loadDefaultCatalog();
const REPO = path.join(__dirname, '..', '..', '..', '..');
const EXAMPLES = path.join(REPO, 'docs', 'node-catalog', 'examples');

const spacing = (type: string, parameters: Record<string, unknown>) =>
  checkParameterValues([{ id: 'n', type, parameters }] as ParameterizedNode[], catalog, {
    component: '/Test'
  }).filter((d) => d.code === DiagnosticCode.RawSpacingLiteral);

describe('V28 — the catch', () => {
  it('names the exact token, in both shapes a spacing port is legally written in', () => {
    for (const value of [16, { value: 16, unit: 'px' }]) {
      const [found] = spacing('Group', { paddingTop: value });
      expect(found).toBeDefined();
      expect(found.severity).toBe('warning');
      expect(found.suggestion).toBe('"var(--space-4)"');
    }
  });

  /**
   * 🔴 The regression this rule caused on its first draft, kept as a test. A `"16px"` string on a
   * units-typed port is not untokenised, it is **dropped** — `InvalidParameterValue` already says
   * so as an ERROR whose message is *"dropped silently"*. Reading it as a spacing literal made this
   * rule fire first and `continue`, downgrading that error to a warning about tokens. Caught by
   * `tests-unit/aib-001/parameterValues.test.ts`, which is a neighbour and not this task's.
   */
  it('leaves the "16px" string to the error that already owns it, and does not downgrade it', () => {
    expect(spacing('Group', { paddingTop: '16px' })).toEqual([]);
    const all = checkParameterValues([{ id: 'n', type: 'Group', parameters: { paddingTop: '16px' } }] as ParameterizedNode[], catalog, {
      component: '/Test'
    });
    const invalid = all.find((d) => d.code === DiagnosticCode.InvalidParameterValue);
    expect(invalid).toBeDefined();
    expect(invalid!.severity).toBe('error');
    expect(invalid!.message).toContain('dropped silently');
  });

  it('covers the gap ports, not only padding', () => {
    expect(spacing('Group', { rowGap: 24 })[0].suggestion).toBe('"var(--space-6)"');
    expect(spacing('Group', { columnGap: { value: 32, unit: 'px' } })[0].suggestion).toBe('"var(--space-8)"');
  });

  it('says nothing about a token, which is the whole point', () => {
    expect(spacing('Group', { paddingTop: 'var(--space-2)' })).toEqual([]);
  });
});

describe('V28 — the first narrowing: a Columns gutter must stay a number', () => {
  /**
   * `Columns.tsx`: *"autofold genuinely needs a number, and a `var()` cannot be resolved without
   * computed styles. A tokenised `marginX` still folds as though the gutter were 0, and a tokenised
   * `minWidth` disables `autoFit` entirely."* Fifteen corpus values are in exactly this state and
   * every one is right.
   */
  it('is silent on marginX/marginY, which are not in the rule at all', () => {
    expect(spacing('net.noodl.visual.columns', { marginX: { value: 48, unit: 'px' } })).toEqual([]);
    expect(spacing('net.noodl.visual.columns', { marginY: { value: 24, unit: 'px' } })).toEqual([]);
  });

  /**
   * 🔴 The mechanism, asserted rather than assumed — and it is not the one the rule was first
   * written with. A `node.type !== COLUMNS_TYPE` guard was dead on arrival: `Columns` declares
   * `marginX`/`marginY` and **no padding port at all**, so the type test could never be what
   * excluded anything. The port set is the whole protection, and this is what says so.
   */
  it('excludes by PORT NAME, and Columns has no other spacing port for a type guard to catch', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const idx = loadDefaultCatalog() as unknown as { catalog: { nodes: { typeName: string; inputs: { name: string }[] }[] } };
    const columns = idx.catalog.nodes.find((n) => n.typeName === 'net.noodl.visual.columns')!;
    expect(columns.inputs.map((p) => p.name).filter((n) => /padding|margin|gap/i.test(n)).sort()).toEqual([
      'marginX',
      'marginY'
    ]);
    // The same two names on a node that is NOT a Columns are equally silent — the rule never
    // looked at the type.
    expect(spacing('Group', { marginX: 48, marginY: 24 })).toEqual([]);
  });
});

describe('V28 — the second narrowing: the advice has to be a token that exists', () => {
  it('is silent on a value no --space token carries', () => {
    // 🔴 13px is off the scale. Warning here would tell an author to write `var(--space-3.25)`.
    expect(spacing('Group', { paddingTop: 13 })).toEqual([]);
    expect(spacing('Group', { paddingLeft: { value: 100, unit: 'px' } })).toEqual([]);
  });

  it('is silent on values that are not plain pixel lengths', () => {
    expect(spacingPixels('clamp(1rem, 2vw, 2rem)')).toBeUndefined();
    expect(spacingPixels({ value: 50, unit: '%' })).toBeUndefined();
    expect(spacing('Group', { paddingTop: { value: 50, unit: '%' } })).toEqual([]);
  });

  /**
   * ⚠️ The rule carries its own copy of the spacing scale, and a second copy of a palette drifts
   * silently. This derives the truth from `DefaultTokens.ts` and reddens if the two disagree — so
   * the copy is graded rather than trusted.
   */
  it('offers the token DefaultTokens.ts actually declares, for every value on the scale', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { DEFAULT_TOKENS } = require('../../src/editor/src/models/StyleTokensModel/DefaultTokens');
    const scale = (DEFAULT_TOKENS as { name: string; value: string; category: string }[]).filter(
      (t) => t.category === 'spacing' && /^\d+px$/.test(t.value)
    );
    expect(scale.length).toBeGreaterThanOrEqual(24);

    for (const token of scale) {
      const px = Number(token.value.replace('px', ''));
      const found = spacing('Group', { paddingTop: px });
      // Every value on the scale is caught, and named with ITS token — not merely with some token.
      expect(found).toHaveLength(1);
      expect(found[0].suggestion).toBe(`"var(${token.name})"`);
    }
  });
});

describe('V28 — the corpus, by mutation', () => {
  const load = () =>
    fs
      .readdirSync(EXAMPLES)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .map((file) => ({ file, example: JSON.parse(fs.readFileSync(path.join(EXAMPLES, file), 'utf-8')) }));

  const sweep = (examples: ReturnType<typeof load>) => {
    const hits: string[] = [];
    for (const { file, example } of examples) {
      for (const c of example.components ?? []) {
        const d = checkParameterValues(c.nodes ?? [], catalog, { component: c.name }).filter(
          (x) => x.code === DiagnosticCode.RawSpacingLiteral
        );
        if (d.length) hits.push(`${file}:${c.name}:${d.length}`);
      }
    }
    return hits;
  };

  it('is clean — and the population is asserted, so an empty read is not mistaken for a pass', () => {
    const examples = load();
    expect(examples.length).toBeGreaterThanOrEqual(67);
    // 🔴 Cardinality on the thing being checked: 400+ spacing parameters exist, so a clean sweep is
    // a statement about them rather than about an empty search.
    const spacingParams = examples.flatMap(({ example }) =>
      (example.components ?? []).flatMap((c: { nodes?: { parameters?: Record<string, unknown> }[] }) =>
        (c.nodes ?? []).flatMap((n) =>
          Object.keys(n.parameters ?? {}).filter((k) => /^(padding|margin|rowGap|columnGap|gap)/.test(k))
        )
      )
    );
    expect(spacingParams.length).toBeGreaterThanOrEqual(400);

    expect(sweep(examples)).toEqual([]);
  });

  it('reddens when the repair is undone on ONE file, and only that file', () => {
    const examples = load();
    const subject = 'logic-toggle-details-panel.json';
    const target = examples.find((e) => e.file === subject)!;
    const group = target.example.components
      .flatMap((c: { nodes: { id: string; parameters?: Record<string, unknown> }[] }) => c.nodes)
      .find((n: { id: string }) => n.id === 'details_group')!;

    // The mutation IS the pre-repair corpus: this file shipped `paddingTop: 8` through the gate.
    expect(group.parameters.paddingTop).toBe('var(--space-2)');
    group.parameters.paddingTop = 8;

    expect(sweep(examples)).toEqual([`${subject}:/Order Details Toggle:1`]);
  });
});
