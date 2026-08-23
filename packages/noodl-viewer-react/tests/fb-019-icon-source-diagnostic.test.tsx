/**
 * FB-019 AC3 — the icon port that was handed a string and said nothing.
 *
 * Driven before it was fixed (2026-08-23), because two of two predicted-from-source claims in
 * FB-019 had already turned out to be fiction. This one was real. A three-arm fixture, one
 * `Icon` node per arm, a Function node's `*` output carrying the string:
 *
 * | arm | `iconIconSource` | rendered, before the fix |
 * |---|---|---|
 * | A | the string `'account_circle'`, over a wire | `<span class="" style="font-size:40px"></span>` |
 * | B | `{class:'material-icons', code:'account_circle'}` | the glyph |
 * | C | never set | no span at all |
 *
 * Arm C is what makes arm A a defect: an undrawable value does not degrade to "nothing", it
 * produces an **empty, styled span** that still takes its `iconSize` in layout. Nothing was
 * logged and the editor's connection health had nothing to say — a `*` source is exempt from
 * `unconvertedCast` by design, and `*` is the only type that can reach an icon port at all
 * (0 of 16 rows in the cast table target `icon`, read live off the running editor).
 *
 * The arms below are the ones that must disagree. Arm C's row is not decoration: it is the row
 * that fails if the check ever starts firing on an unset port, which would put a warning on
 * every icon node in every project.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { Icon } from '../src/components/visual/Icon';
import { IconGlyph } from '../src/components/visual/Icon/IconGlyph';
import { iconSourceProblem } from '../src/components/visual/Icon/iconSourceProblem';
import IconNodeModule from '../src/nodes/visual/icon';

type AnyProps = Record<string, unknown>;

/** The `iconIconSource` setter the runtime actually installs, plus the node it runs against. */
function iconPortHarness() {
  const definition = (
    IconNodeModule as never as {
      node: { inputs: Record<string, { set?: (v: unknown) => void; displayName?: string }> };
    }
  ).node;

  const input = definition.inputs.iconIconSource;
  const diagnostics: Record<string, string | null | undefined> = {};

  const node: AnyProps = {
    props: {} as AnyProps,
    setDiagnostic(key: string, message?: string | null) {
      diagnostics[key] = message ?? null;
    },
    forceUpdate() {
      /* no renderer in this harness */
    }
  };

  return {
    input,
    diagnostics,
    props: node.props as AnyProps,
    set: (value: unknown) => (input.set as (v: unknown) => void).call(node, value)
  };
}

/** The one diagnostic key this port mints. Bounded, so it can always be cleared. */
const KEY = 'visual/icon-source-not-an-icon/iconIconSource';

describe('FB-019 AC3 — an icon port reports a value it cannot draw', () => {
  it('has a set function at all, installed by the port definition', () => {
    // If this fails the rest of the file grades nothing: every arm below calls `input.set`.
    expect(typeof iconPortHarness().input.set).toBe('function');
  });

  it('ARM A: a bare string does not reach props, and raises a diagnostic naming it', () => {
    const h = iconPortHarness();
    h.set('account_circle');

    expect('iconIconSource' in h.props).toBe(false);
    expect(h.diagnostics[KEY]).toContain('expects an icon');
    // The value, quoted — what makes the warning findable rather than merely true.
    expect(h.diagnostics[KEY]).toContain('account_circle');
  });

  it('ARM B: the picker’s own value is set, and clears the diagnostic', () => {
    const h = iconPortHarness();
    h.set('account_circle');
    h.set({ class: 'material-icons', code: 'account_circle' });

    expect(h.props.iconIconSource).toEqual({ class: 'material-icons', code: 'account_circle' });
    // A setter, not a report/clear pair: the statement that raised it is the one that clears it.
    expect(h.diagnostics[KEY]).toBeFalsy();
  });

  it('ARM C: an unset port is silent — this is the row that keeps the fix off every project', () => {
    const h = iconPortHarness();
    h.set(undefined);

    expect('iconIconSource' in h.props).toBe(false);
    expect(h.diagnostics[KEY]).toBeFalsy();
  });

  it('the other two members of the union still reach props', () => {
    const sprite = { kind: 'sprite', url: '/icons.svg', symbolId: 'search' };
    const inline = { kind: 'inline', svg: '<svg></svg>' };

    const a = iconPortHarness();
    a.set(sprite);
    expect(a.props.iconIconSource).toEqual(sprite);
    expect(a.diagnostics[KEY]).toBeFalsy();

    const b = iconPortHarness();
    b.set(inline);
    expect(b.props.iconIconSource).toEqual(inline);
    expect(b.diagnostics[KEY]).toBeFalsy();
  });
});

/**
 * The arm that grades what the drive actually measured. The three above read `props`, which is
 * the mechanism; this one renders the same component the viewer renders and asks the question
 * the fixture asked: is there a span. Before the fix this drew
 * `<span class="" style="font-size:40px"></span>` — present, styled, empty.
 */
describe('FB-019 AC3 — the consequence: no empty span survives a string', () => {
  function renderIconWithSource(value: unknown) {
    const h = iconPortHarness();
    h.set(value);
    const props: AnyProps = {
      iconSourceType: 'icon',
      iconSize: '40px',
      iconColor: '#FF0000',
      style: {},
      ...h.props
    };
    const AnyIcon = Icon as unknown as (p: AnyProps) => React.ReactElement;
    return renderToStaticMarkup(<AnyIcon {...props} />);
  }

  it('a string draws no glyph span at all — the same as a port that was never set', () => {
    const fromString = renderIconWithSource('account_circle');
    const fromUnset = renderIconWithSource(undefined);

    expect(fromString).not.toContain('<span');
    // Identical, which is the point: an undrawable value degrades to "nothing", not to a
    // styled empty box that still takes its `iconSize` in layout.
    expect(fromString).toBe(fromUnset);
  });

  it('a picker value still draws its glyph', () => {
    const html = renderIconWithSource({ class: 'material-icons', code: 'search' });
    expect(html).toContain('material-icons');
    expect(html).toContain('search');
  });
});

describe('FB-019 AC3 — iconSourceProblem', () => {
  it.each([
    ['a string', 'account_circle'],
    ['a number', 42],
    ['a boolean', true],
    ['an object with none of the union’s fields', { size: 3 }]
  ])('refuses %s', (_label, value) => {
    expect(iconSourceProblem(value)).toContain('expects an icon');
  });

  it.each([
    ['unset', undefined],
    ['null', null],
    ['a font value', { class: 'material-icons', code: 'search' }],
    ['a class-per-glyph value', { class: 'fa', code: 'fa-user', codeAsClass: true }],
    ['a sprite value', { kind: 'sprite', url: '/i.svg', symbolId: 'x' }],
    ['an inline value', { kind: 'inline', svg: '<svg/>' }]
  ])('accepts %s', (_label, value) => {
    expect(iconSourceProblem(value)).toBeNull();
  });

  it('says where the class comes from, because that is why a string cannot be coerced', () => {
    // `iconValueForGlyph` builds `class` from the SET's manifest and only `code` from the glyph
    // name, so any coercion of a bare string has to guess the set. The message has to say so,
    // or the advice reads as "you typed it wrong" when the author typed it exactly right.
    expect(iconSourceProblem('search')).toContain('installed icon set');
  });
});

describe('FB-019 AC3 — what the drop prevents', () => {
  it('IconGlyph renders an empty span for a string: the defect, characterised', () => {
    const html = renderToStaticMarkup(<IconGlyph source={'account_circle' as never} style={{ fontSize: '40px' }} />);

    // Present, styled, and carrying nothing — which is why arm A had to stop reaching here
    // rather than being left to render "nothing useful".
    expect(html).toContain('<span');
    expect(html).not.toContain('account_circle');
  });

  it('IconGlyph renders the glyph for a font value, and nothing at all for undefined', () => {
    const drawn = renderToStaticMarkup(<IconGlyph source={{ class: 'material-icons', code: 'search' }} style={{}} />);
    expect(drawn).toContain('material-icons');
    expect(drawn).toContain('search');

    expect(renderToStaticMarkup(<IconGlyph source={undefined as never} style={{}} />)).toBe('');
  });
});
