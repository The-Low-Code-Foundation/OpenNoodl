/**
 * P79 E2 — `Color Blend` returned the literal string `#NaNNaNNaN` for every token colour.
 *
 * `setRGB` was three blind `parseInt(hex.substring(i, i + 2), 16)` calls. Handed `var(--primary)`
 * it read `"ar"`, `"--"` and `"pr"` — all `NaN` — and `rgbToHex` stringified them. No warning, no
 * fallback, no console error.
 *
 * Since every project the authoring tools build styles on design tokens, that made the node
 * unusable in all of them. The corpus's own idiom for a smooth interaction is
 * `Switch → Animate To Value → Color Blend → backgroundColor`, and it was the first design tried
 * for spine lesson 3 — the lesson animates `opacity` instead because of this row.
 *
 * ⚠️ Three-digit hex was broken in the same function and nobody had recorded it: `#abc` read
 * `ab`, `c` and `""`, so the blue channel alone came back `NaN`. A colour that is wrong rather
 * than absent is the harder kind to see.
 */

/* eslint-env jest */

import { createCorpusGraph, type CorpusGraph } from '../../noodl-runtime/test/corpus/graph-harness';

import ColorBlendModule from '../src/nodes/std-library/colorblend';

/**
 * The node reads tokens off the document, and this suite runs in `testEnvironment: 'node'`.
 * Rather than pull in jsdom for three properties, the two globals it touches are stubbed with
 * a token table — which also lets a row assert what happens when a token is NOT defined, a
 * state a real page reaches whenever a theme has not loaded.
 */
function withTokens(tokens: Record<string, string>): () => void {
  const g = globalThis as Record<string, unknown>;
  const hadDocument = 'document' in g;
  const previousDocument = g.document;
  const previousGetComputedStyle = g.getComputedStyle;

  g.document = { documentElement: {} };
  g.getComputedStyle = () => ({ getPropertyValue: (name: string) => tokens[name] ?? '' });

  return () => {
    if (hadDocument) g.document = previousDocument;
    else delete g.document;
    g.getComputedStyle = previousGetComputedStyle;
  };
}

async function blend(
  colors: Record<string, string>,
  blendValue: number
): Promise<{ result: unknown; graph: CorpusGraph }> {
  const graph = await createCorpusGraph({
    modules: [ColorBlendModule as never],
    data: {
      components: [
        {
          name: '/root',
          nodes: [{ id: 'blend', type: 'Color Blend', parameters: { ...colors, blendValue } }],
          connections: []
        }
      ]
    } as never
  });
  await graph.settle(4);
  return { result: graph.node('blend').getOutput('result').value, graph };
}

const BLACK_TO_WHITE = { 'color 0': '#000000', 'color 1': '#ffffff' };

describe('P79 E2 — a token colour blends', () => {
  let restore: () => void;
  beforeEach(() => {
    restore = withTokens({ '--primary': '#000000', '--accent': '#ffffff', '--alias': 'var(--accent)' });
  });
  afterEach(() => restore());

  test('🔴 halfway between two tokens is a real colour, not #NaNNaNNaN', async () => {
    const { result } = await blend({ 'color 0': 'var(--primary)', 'color 1': 'var(--accent)' }, 0.5);
    expect(result).toBe('#7f7f7f');
  });

  test('a token resolving to another token is followed', async () => {
    const { result } = await blend({ 'color 0': 'var(--primary)', 'color 1': 'var(--alias)' }, 0.5);
    expect(result).toBe('#7f7f7f');
  });

  test("uses the author's own var() fallback when the token is not defined", async () => {
    const { result } = await blend({ 'color 0': '#000000', 'color 1': 'var(--nope, #ffffff)' }, 0.5);
    expect(result).toBe('#7f7f7f');
  });
});

describe('P79 E2 — the notations that were silently wrong', () => {
  test('🔴 three-digit hex blends on all three channels', async () => {
    // #000 → #fff. Before the fix the blue channel alone read NaN.
    const { result } = await blend({ 'color 0': '#000', 'color 1': '#fff' }, 0.5);
    expect(result).toBe('#7f7f7f');
  });

  test('rgb() and rgba() are read', async () => {
    const { result } = await blend({ 'color 0': 'rgb(0, 0, 0)', 'color 1': 'rgba(255, 255, 255, 0.5)' }, 0.5);
    expect(result).toBe('#7f7f7f');
  });

  test('an eight-digit hex blends on its colour channels', async () => {
    const { result } = await blend({ 'color 0': '#000000ff', 'color 1': '#ffffffff' }, 0.5);
    expect(result).toBe('#7f7f7f');
  });
});

describe('P79 E2 — a colour it still cannot read', () => {
  let restore: () => void;
  beforeEach(() => {
    restore = withTokens({});
  });
  afterEach(() => restore());

  test('🔴 shows the nearest authored colour rather than #NaNNaNNaN, and says so', async () => {
    const { result, graph } = await blend({ 'color 0': '#000000', 'color 1': 'chartreuse' }, 0.25);

    expect(String(result)).not.toContain('NaN');
    // Nearest endpoint at t = 0.25 is color 0, verbatim — a colour the author chose.
    expect(result).toBe('#000000');
    expect(graph.errors.map((e) => e.code)).toContain('color-blend/unreadable-color');
  });

  test('an undefined token with no fallback is reported, not guessed at', async () => {
    const { result, graph } = await blend({ 'color 0': '#000000', 'color 1': 'var(--not-defined)' }, 0.75);

    expect(String(result)).not.toContain('NaN');
    expect(result).toBe('var(--not-defined)'); // nearest endpoint at t = 0.75, and the DOM may yet resolve it
    expect(graph.errors.map((e) => e.code)).toContain('color-blend/unreadable-color');
  });

  test('⚠️ reports once per bad value, not once per frame', async () => {
    const graph = await createCorpusGraph({
      modules: [ColorBlendModule as never],
      data: {
        components: [
          {
            name: '/root',
            nodes: [
              {
                id: 'blend',
                type: 'Color Blend',
                parameters: { 'color 0': '#000000', 'color 1': 'chartreuse', blendValue: 0.25 }
              }
            ],
            connections: []
          }
        ]
      } as never
    });
    await graph.settle(4);

    const raised = graph.errors.filter((e) => e.code === 'color-blend/unreadable-color').length;
    // Cardinality first: an absence of extra reports means nothing unless one was reported.
    expect(raised).toBe(1);

    const node = graph.node('blend');
    node.setInputValue('blendValue', 0.3);
    node.setInputValue('blendValue', 0.35);
    await graph.settle(4);

    expect(graph.errors.filter((e) => e.code === 'color-blend/unreadable-color').length).toBe(1);
  });
});

describe('P79 E2 — the behaviour that must not have moved', () => {
  test('control — six-digit hex blends exactly as before', async () => {
    expect((await blend(BLACK_TO_WHITE, 0.5)).result).toBe('#7f7f7f');
    expect((await blend(BLACK_TO_WHITE, 0.25)).result).toBe('#3f3f3f');
  });

  test('control — at rest the authored colour passes through verbatim', async () => {
    // This is why a token has always worked at a whole blend value: `var(--primary)` reaching a
    // colour port is resolved by the DOM. Only the interpolation in between was broken.
    const restore = withTokens({ '--primary': '#123456' });
    expect((await blend({ 'color 0': 'var(--primary)', 'color 1': '#ffffff' }, 0)).result).toBe('var(--primary)');
    restore();
  });

  test('control — a blend value past the ends is still clamped', async () => {
    expect((await blend(BLACK_TO_WHITE, 5)).result).toBe('#ffffff');
    expect((await blend(BLACK_TO_WHITE, -5)).result).toBe('#000000');
  });
});
