/**
 * VIB-007 / register **V32** — `catalog:examples` now runs `raw-color-literal`.
 *
 * The row is a sentence about what a green gate claims: a
 * `"boxShadowColor": "rgb(15 23 42 / 0.08)"` written into a new recipe passed the corpus gate
 * **66/66 strict, warnings-as-errors**, and was caught by a person reading the gate's header.
 * *"The gate is green"* and *"the corpus has no raw colours"* were different claims and only the
 * first was true. The fix is configuration — the rule already existed and simply was not run here.
 *
 * ⚠️ **The rule's own behaviour is NOT retested here.** `tests-unit/phase-55/
 * unsizedAbsoluteAndRawColor.test.ts` already pins the catch, the functional notations, the
 * silence on `var()` and the deliberate silence on named colours. A second copy of those cases
 * would be a duplicate that drifts. What this file pins is what that one cannot see: the rule
 * over the **corpus**, the value V32 was actually found by, and the hole the switch leaves open.
 *
 * 🔴 **The corpus arm is a MUTATION, not a census.** "The corpus is clean" passes just as happily
 * against a check that returns `[]` for everything.
 */
import * as fs from 'fs';
import * as path from 'path';

import { loadDefaultCatalog } from '../../src/editor/src/validation/catalog';
import { DiagnosticCode } from '../../src/editor/src/validation/diagnostics';
import { checkParameterValues } from '../../src/editor/src/validation/parameterValues';
import type { ParameterizedNode } from '../../src/editor/src/validation/parameterValues';

const catalog = loadDefaultCatalog();
const REPO = path.join(__dirname, '..', '..', '..', '..');
const EXAMPLES = path.join(REPO, 'docs', 'node-catalog', 'examples');

const rawColours = (nodes: Array<{ id: string; type: string; parameters?: Record<string, unknown> }>, component: string) =>
  checkParameterValues(nodes as ParameterizedNode[], catalog, { component }).filter(
    (d) => d.code === DiagnosticCode.RawColorLiteral
  );

describe('V32 — the value the row was found by', () => {
  /**
   * 🔴 Asserted rather than assumed. If `boxShadowColor` were not a colour-TYPED port, switching
   * the rule on in the corpus gate would catch some other family and leave V32's own value
   * passing — a fix measured against the wrong thing. It is typed `color`, and the space-separated
   * `rgb()` form matches, so the switch catches the case that motivated it.
   */
  it('catches a shadow colour written in the modern space-separated rgb() form', () => {
    const found = rawColours(
      [{ id: 'card', type: 'Group', parameters: { boxShadowEnabled: true, boxShadowColor: 'rgb(15 23 42 / 0.08)' } }],
      '/Test'
    );
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('warning');
  });

  it('is silent on the same port carrying a token — the control, from the same port', () => {
    expect(
      rawColours(
        [{ id: 'card', type: 'Group', parameters: { boxShadowEnabled: true, boxShadowColor: 'var(--gray-900)' } }],
        '/Test'
      )
    ).toEqual([]);
  });
});

describe('V32 — the hole the switch leaves open, pinned so it is known rather than assumed', () => {
  /**
   * ⚠️ `checkParameterValues` can only reach a port the catalog declares. `Color Blend` accepts an
   * unbounded numbered set (`color-0`, `color-1`, …) discovered at runtime, so a raw hex on one is
   * invisible to this rule and stays invisible after V32.
   *
   * ✅ **In the corpus this costs nothing, and that is luck rather than design.** The only two
   * corpus hexes it hides are `anim-hover-highlight`'s, and `Color Blend`'s own `blendedColor`
   * description says *"the inputs must be 6-digit hex, since any other notation yields nonsense"* —
   * they are **correct authoring** that a token would break. A different dynamic-port node would
   * not have that excuse.
   */
  it('cannot see a colour on a dynamically-discovered port', () => {
    expect(rawColours([{ id: 'blend', type: 'Color Blend', parameters: { 'color-0': '#ffffff' } }], '/Test')).toEqual([]);
  });

  it('sees the identical value on a declared port — so the miss is the PORT, not the value', () => {
    expect(rawColours([{ id: 'g', type: 'Group', parameters: { backgroundColor: '#ffffff' } }], '/Test')).toHaveLength(1);
  });
});

describe('V32 — the corpus, by mutation', () => {
  type Example = {
    id: string;
    components: { name: string; nodes: Array<{ id: string; type: string; parameters?: Record<string, unknown> }> }[];
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
        const d = rawColours(c.nodes ?? [], c.name);
        if (d.length) hits.push(`${file}:${c.name}:${d.length}`);
      }
    }
    return hits;
  };

  it('is clean — and the population is asserted, so an empty read is not mistaken for a pass', () => {
    const examples = load();
    // 🔴 Cardinality before the verdict. `readdirSync` on the wrong directory returns [], and
    // `sweep([])` is [] — the answer this test wants, for the wrong reason.
    expect(examples.length).toBeGreaterThanOrEqual(67);
    const colourish = examples.flatMap(({ example }) =>
      (example.components ?? []).flatMap((c) =>
        (c.nodes ?? []).flatMap((n) => Object.keys(n.parameters ?? {}).filter((k) => k.toLowerCase().includes('color')))
      )
    );
    expect(colourish.length).toBeGreaterThanOrEqual(200);

    expect(sweep(examples)).toEqual([]);
  });

  it('reddens when the repair is undone on ONE file, and only that file', () => {
    const examples = load();
    const subject = 'var-avatar-picker-responsive.json';
    const target = examples.find((e) => e.file === subject)!;
    const accent = target.example.components.flatMap((c) => c.nodes).find((n) => n.id === 'accent')!;

    // The mutation IS the pre-repair corpus: this file shipped its `Color` node holding `#3366ff`
    // and passed this gate 67/67 strict, because the gate did not run this rule.
    expect(accent.parameters!.value).toBe('var(--primary)');
    accent.parameters!.value = '#3366ff';

    expect(sweep(examples)).toEqual([`${subject}:/Avatar Upload:1`]);
  });
});
