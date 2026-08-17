/**
 * AIB-001 — the parameter-value contract.
 *
 * The defect this closes destroyed 44 nodes across three components on apply:
 * the model wrote `pathParams: ["id","slug"]` — the correct reading of a port
 * the catalog types `stringlist` — and `PageInputsAdapter`'s `.split(',')` threw
 * from inside the apply transaction, which rolled the whole plan back.
 *
 * Two things are asserted here and they pull in opposite directions, which is
 * the point:
 *
 *  1. every constrained port type rejects the value a model plausibly writes;
 *  2. the rule does not cry wolf — it is run over **every real project in this
 *     repository** and must stay near-silent. A gate that rejects legitimate
 *     values costs a repair round each time and, on an update, can make a
 *     component permanently unrevisable.
 *
 * The real generated catalog throughout, never a hand-built one: NDA-017's rule
 * shipped broken on the strength of a fixture catalog, and every rule here is a
 * claim about what the *shipped* port types demand.
 */

import { loadDefaultCatalog } from '../../src/editor/src/validation/catalog';
import { DiagnosticCode } from '../../src/editor/src/validation/diagnostics';
import {
  checkParameterValues,
  wireFormatHint,
  WIRE_FORMAT_LEGEND
} from '../../src/editor/src/validation/parameterValues';
import type { ParameterizedNode } from '../../src/editor/src/validation/parameterValues';

const catalog = loadDefaultCatalog();

function check(nodes: ParameterizedNode[]) {
  return checkParameterValues(nodes, catalog, { component: '/Test' });
}

function one(type: string, parameters: Record<string, unknown>) {
  return check([{ id: 'n1', type, parameters }]);
}

/** The errors a single-node candidate produced, as `port → message`. */
function errors(type: string, parameters: Record<string, unknown>) {
  return one(type, parameters).filter((d) => d.severity === 'error');
}

describe('the crash this task exists for', () => {
  const AS_AUTHORED = { id: 'pi', type: 'PageInputs', parameters: { pathParams: ['id', 'slug'] } };

  it('rejects the exact candidate that was thrown away, before anything reaches a model', () => {
    const [diagnostic, ...rest] = check([AS_AUTHORED]);
    expect(rest).toHaveLength(0);
    expect(diagnostic.severity).toBe('error');
    expect(diagnostic.code).toBe(DiagnosticCode.InvalidParameterValue);
    expect(diagnostic.location).toMatchObject({ nodeId: 'pi', nodeType: 'PageInputs', port: 'pathParams' });
  });

  it('names the node, the port and the wire format — the repair round needs no second question', () => {
    const [diagnostic] = check([AS_AUTHORED]);
    expect(diagnostic.message).toContain('pathParams');
    expect(diagnostic.message).toContain('stringlist');
    expect(diagnostic.message).toContain('comma-separated');
    // The fix, not just the complaint.
    expect(diagnostic.suggestion).toBe('"id,slug"');
  });

  it('accepts the value the adapter can actually consume', () => {
    expect(one('PageInputs', { pathParams: 'id,slug' })).toEqual([]);
  });

  it('checks a STATIC port on a node whose other ports are dynamic', () => {
    // PageInputs declares `dynamicPorts` — its outputs are synthesised by the
    // adapter. That must not exempt `pathParams`, which is the input the
    // adapter reads to synthesise them.
    expect(catalog.isDynamicNode('PageInputs')).toBe(true);
    expect(errors('PageInputs', { pathParams: ['a'] })).toHaveLength(1);
  });
});

describe('one legal and one illegal value per constrained port type', () => {
  // Each row: node type, port, a value the editor consumes, a value a model
  // plausibly writes that it cannot.
  const CASES: Array<[string, string, string, unknown, unknown]> = [
    ['stringlist', 'PageInputs', 'pathParams', 'id,slug', ['id', 'slug']],
    ['proplist', 'JavaScriptFunction', 'scriptInputs', [{ label: 'From', value: 'from' }], { From: 'from' }],
    ['enum', 'Group', 'sizeMode', 'contentSize', 'Content Size'],
    ['number (units)', 'Group', 'paddingTop', { value: 16, unit: 'px' }, '16px'],
    ['dimension', 'Group', 'width', { value: 100, unit: '%' }, [100, '%']],
    ['color', 'Group', 'backgroundColor', 'var(--primary)', 0x3b82f6],
    ['boolean', 'Group', 'scrollEnabled', true, 'false']
  ];

  it.each(CASES)('%s: accepts the legal value', (_label, type, port, legal) => {
    expect(errors(type, { [port]: legal })).toEqual([]);
  });

  it.each(CASES)('%s: rejects the illegal value', (_label, type, port, _legal, illegal) => {
    const found = errors(type, { [port]: illegal });
    expect(found).toHaveLength(1);
    expect(found[0].location.port).toBe(port);
  });
});

describe('what the rule says when it rejects', () => {
  it('an enum lists the options it will accept, and guesses the near miss', () => {
    const [diagnostic] = errors('Group', { sizeMode: 'contentsize' });
    expect(diagnostic.alternatives).toEqual(['explicit', 'contentWidth', 'contentHeight', 'contentSize']);
    expect(diagnostic.suggestion).toBe('contentSize');
  });

  it('a units value written as a CSS string is corrected into the object form', () => {
    const [diagnostic] = errors('Group', { paddingTop: '16px' });
    // Worse than a crash: `defineRegularInputProp` reads `.value` off the
    // string, finds undefined and deletes the property, so the value vanishes
    // with no error anywhere.
    expect(diagnostic.message).toContain('dropped silently');
    expect(diagnostic.suggestion).toBe(JSON.stringify({ value: 16, unit: 'px' }));
  });

  it('a stringified boolean says why "false" is the opposite of what it reads', () => {
    const [diagnostic] = errors('Group', { scrollEnabled: 'false' });
    expect(diagnostic.message).toContain('truthy');
    expect(diagnostic.suggestion).toBe('false');
  });

  it('a unit outside the port\'s declared set is rejected with the set', () => {
    const [diagnostic] = errors('Group', { paddingTop: { value: 2, unit: 'rem' } });
    expect(diagnostic.alternatives).toEqual(['"px"']);
  });
});

describe('what it deliberately lets through', () => {
  it('a bare number on a units port — the runtime merges it into the current unit', () => {
    expect(errors('Group', { paddingTop: 16 })).toEqual([]);
  });

  it('a var(--token) reference anywhere it becomes a CSS value', () => {
    expect(errors('Group', { backgroundColor: 'var(--primary)', paddingTop: 'var(--space-4)' })).toEqual([]);
  });

  it('a numeric string, which the runtime and the corpus both treat as a number', () => {
    expect(errors('Group', { paddingTop: { value: '16', unit: 'px' } })).toEqual([]);
  });

  it('a parameter on a node type the catalog does not carry — unknown-node-type owns that', () => {
    const out = check([{ id: 'm', type: 'module.somethingCustom', parameters: { anything: [1, 2] } }]);

    // CN-002 changed what this returns but not what it *means*. The guarantee
    // this test protects is that an unresolvable type raises no problem here —
    // `[1, 2]` on a port we cannot see is not evidence of anything. That still
    // holds: the only thing emitted is `info`, which never fails a gate and
    // never blocks authored output.
    //
    // What is new is that the skip is now *announced* instead of returning an
    // empty array that reads as a pass. Asserting `toEqual([])` again would
    // re-hide it, so this asserts the property rather than the shape.
    expect(out.filter((d) => d.severity !== 'info')).toEqual([]);
    expect(out.map((d) => d.code)).toEqual([DiagnosticCode.UnknownTypeCheckSkipped]);
  });

  it('a parameter naming an unknown port on a DYNAMIC node — the port is very likely real', () => {
    // `States` names its ports from a seed parameter; the catalog cannot see them.
    const out = check([{ id: 's', type: 'States', parameters: { 'value-on-opacity': 1 } }]);

    // CN-010 / AC2 — updated for the same reason, and by the same rule, as the
    // CN-002 case above: the guarantee this test exists to protect is that a
    // port the node really creates draws **no accusation**. That still holds and
    // is what is asserted. What changed is that the skip is announced instead of
    // returning an empty array that reads as a pass, so `toEqual([])` would now
    // re-hide exactly what CN-010 set out to surface.
    expect(out.filter((d) => d.severity !== 'info')).toEqual([]);
    expect(out.map((d) => d.code)).toEqual([DiagnosticCode.DynamicPortSkipped]);
  });

  it('never invents a default for a parameter that is simply absent', () => {
    expect(check([{ id: 'g', type: 'Group', parameters: {} }])).toEqual([]);
    expect(check([{ id: 'g', type: 'Group', parameters: null }])).toEqual([]);
  });
});

describe('a parameter that names no port at all', () => {
  it('is a warning on a static-port node, never an error', () => {
    // `Number Remapper` is one of the 54 authorable types with no dynamic
    // ports at all — the only population this check is allowed to speak about.
    expect(catalog.isDynamicNode('Number Remapper')).toBe(false);
    const [diagnostic, ...rest] = check([{ id: 'r', type: 'Number Remapper', parameters: { clmap: true } }]);
    expect(rest).toHaveLength(0);
    expect(diagnostic.severity).toBe('warning');
    expect(diagnostic.code).toBe(DiagnosticCode.UnknownParameter);
    expect(diagnostic.suggestion).toBe('clamp');
  });

  it('is skipped only when the ports are genuinely runtime-determined', () => {
    // `States` names its ports from a seed parameter: the catalog cannot
    // enumerate them, so an accusation is not available.
    //
    // 🔴 The comment here used to end "so silence is the only honest answer",
    // and CN-010 / AC2 is the finding that it was not: *not accusing* is honest,
    // *saying nothing at all* reported an unverified parameter as a checked one.
    // 947 parameters across 321 nodes in the 29 real test projects landed here.
    // The distinction this test guards — runtime-determined is exempt from the
    // **warning**, conditional groups are not — is unchanged and asserted below.
    expect(catalog.hasRuntimeDynamicPorts('States')).toBe(true);
    const out = check([{ id: 's', type: 'States', parameters: { 'value-on-opacity': 1 } }]);

    expect(out.map((d) => [d.code, d.severity])).toEqual([[DiagnosticCode.DynamicPortSkipped, 'info']]);
    expect(out.map((d) => d.code)).not.toContain(DiagnosticCode.UnknownParameter);
  });

  it('checks a node whose only dynamism is conditional port groups', () => {
    // `Group` declares dynamic ports, but every one of them is listed in the
    // catalog under a condition — so the catalog *can* say that `widht` is not
    // among them. The exemption used to key on `isDynamicNode`, which covers 88
    // of the 175 types and swallowed this entire class: `Text`, `Group`,
    // `Image`, `Button`, `Text Input` — the whole visual vocabulary a page is
    // built from. That is how 18 `fontWeight` parameters validated clean while
    // no node in the runtime has ever had a `fontWeight` port.
    expect(catalog.isDynamicNode('Group')).toBe(true);
    expect(catalog.hasRuntimeDynamicPorts('Group')).toBe(false);

    const [diagnostic, ...rest] = check([{ id: 'g', type: 'Group', parameters: { widht: 100 } }]);
    expect(rest).toHaveLength(0);
    expect(diagnostic.code).toBe(DiagnosticCode.UnknownParameter);
    expect(diagnostic.severity).toBe('warning');
    expect(diagnostic.suggestion).toBe('width');
  });

  it('accepts the weight token that a whole page was silently losing', () => {
    // An authored page carried 18 of these and rendered every word at 400: the
    // design system shipped nine `--font-*` weight tokens and four Inter faces
    // to serve them, `ElementConfigs` gave every variant a `fontWeight`, and
    // `StyleVocabulary` handed those variants to the model as the worked
    // example — while no node in the runtime had a port to consume any of it.
    // The port exists now, typed like `lineHeight` so a token is legal on it.
    expect(catalog.hasPort('Text', 'input', 'fontWeight')).toBe(true);
    expect(check([{ id: 't', type: 'Text', parameters: { fontWeight: 'var(--font-semibold)' } }])).toEqual([]);
    // and the plain numeric form the CSS property actually takes
    expect(check([{ id: 't', type: 'Text', parameters: { fontWeight: 600 } }])).toEqual([]);
  });

  it('still catches a parameter the visual vocabulary genuinely has no port for', () => {
    // `padding` is a CSS shorthand, not a port — the four edges are.
    const found = check([{ id: 'g', type: 'Group', parameters: { padding: '16px' } }]);
    expect(found.map((d) => d.code)).toEqual([DiagnosticCode.UnknownParameter]);
    expect(found[0].message).toContain('padding');
  });

  it('can be turned off for callers that only want value problems', () => {
    const found = checkParameterValues([{ id: 'r', type: 'Number Remapper', parameters: { clmap: true } }], catalog, {
      component: '/Test',
      reportUnknownParameters: false
    });
    expect(found).toEqual([]);
  });
});

describe('the hint the model is given is the rule the gate enforces', () => {
  it('spells out the stringlist wire format the type name hides', () => {
    const port = catalog.getPort('PageInputs', 'input', 'pathParams');
    expect(wireFormatHint(port)).toContain('COMMA-SEPARATED STRING');
    expect(wireFormatHint(port)).toContain('"id,slug"');
  });

  it('lists an enum\'s legal options', () => {
    expect(wireFormatHint(catalog.getPort('Group', 'input', 'sizeMode'))).toContain('contentSize');
  });

  it('gives the object form for a units port, with that port\'s own units', () => {
    expect(wireFormatHint(catalog.getPort('Group', 'input', 'width'))).toBe('{value, unit}, units: %|px|vw|vh');
  });

  it('is empty for a type that speaks for itself, so callers can append blindly', () => {
    // `string`, `boolean`, `color`, plain `number`: the type name is the format.
    // A visual node has ~45 ports and the general rules are stated once, in the
    // legend — see WIRE_FORMAT_LEGEND.
    expect(wireFormatHint(catalog.getPort('Text', 'input', 'text'))).toBe('');
    expect(wireFormatHint(catalog.getPort('Group', 'input', 'scrollEnabled'))).toBe('');
    expect(wireFormatHint(catalog.getPort('Group', 'input', 'backgroundColor'))).toBe('');
  });

  it('states the rules a whole type shares exactly once', () => {
    expect(WIRE_FORMAT_LEGEND).toContain('DROPPED silently');
    expect(WIRE_FORMAT_LEGEND).toContain('var(--token)');
  });

  // FIX-007 — the legend is the one thing both authoring clients send
  // unconditionally, so the prefix rule goes here rather than only in the
  // catalog entry a caller may never fetch.
  it('carries the Function node port prefix, and says which ports it does not apply to', () => {
    expect(WIRE_FORMAT_LEGEND).toContain('in-x');
    expect(WIRE_FORMAT_LEGEND).toContain('out-y');
    expect(WIRE_FORMAT_LEGEND).toContain('stay unprefixed');
  });
});

/**
 * The two ways an AI-authored page rendered as an unstyled column while the
 * validator reported it clean.
 *
 * Both are asserted against the real catalog and against the exact parameters a
 * live build actually emitted, because both were invisible to every rule above:
 * one sets a port that genuinely exists, the other writes a value that is
 * genuinely legal.
 */
describe('the styling a candidate believes it set', () => {
  describe('a connection-only port', () => {
    // The agent expressed ALL typography this way — `variant` and nothing
    // else, no fontSize, no color — so every word rendered at browser default.
    it('is an error, not the silence a real-but-unsettable port used to get', () => {
      const found = errors('Text', { variant: 'heading-1' });
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe(DiagnosticCode.ConnectionOnlyParameter);
      expect(found[0].message).toContain('only accepts a wired connection');
    });

    it('says what to do instead, since dropping the parameter styles nothing', () => {
      expect(errors('Text', { variant: 'lead' })[0].message).toContain('STYLE VOCABULARY');
    });

    it('catches it on every element that carries a variant, not just Text', () => {
      for (const type of ['Group', 'net.noodl.controls.button']) {
        expect(errors(type, { variant: 'primary' }).map((d) => d.code)).toEqual([
          DiagnosticCode.ConnectionOnlyParameter
        ]);
      }
    });

    it('leaves a port that merely looks similar alone', () => {
      expect(errors('Text', { text: 'heading-1' })).toEqual([]);
    });
  });

  describe('the width/widthUnit pairing legacy Noodl taught every model', () => {
    // Verbatim from the build: an Image card that rendered 228% wide.
    const AS_AUTHORED = { width: 228, widthUnit: 'px', height: 180, heightUnit: 'px' };

    it('is an error, because the bare number is legal and means percent', () => {
      const found = errors('Image', AS_AUTHORED);
      expect(found.map((d) => d.location.port).sort()).toEqual(['height', 'width']);
    });

    it('names the size the node actually renders at, not just the mistake', () => {
      const width = errors('Image', AS_AUTHORED).find((d) => d.location.port === 'width');
      expect(width.message).toContain('"228%"');
      expect(width.message).toContain('"228px"');
      expect(width.suggestion).toBe(JSON.stringify({ value: 228, unit: 'px' }));
    });

    it('stays quiet when the author already used the object form', () => {
      // The unit is already right, so the stray sibling costs nothing and
      // erroring would spend a repair round making the candidate no better.
      const found = one('Image', { width: { value: 228, unit: 'px' }, widthUnit: 'px' });
      expect(found.filter((d) => d.code === DiagnosticCode.InvalidParameterValue)).toEqual([]);
      expect(found.filter((d) => d.code === DiagnosticCode.UnitlessDimension)).toEqual([]);
      // What it does say is two separate true things: `Image`'s `sizeMode`
      // defaults to `contentSize`, so this perfectly-formed width is ignored;
      // and `widthUnit` is not a port on anything, so it is never read either.
      // The unit *trap* stays quiet because the width needs no repair — that is
      // a different claim from "the stray sibling is a real port".
      //
      // DSG-004 §2.2 renamed the first of those: the `sizeMode` family reports
      // as `InertDimension` so that it alone can block authored output. Same
      // finding, same node, its own code.
      expect(found.map((d) => d.code)).toEqual([
        DiagnosticCode.InertDimension,
        DiagnosticCode.UnknownParameter
      ]);
    });

    it('fires on a node with dynamic ports, whose static ports are still static', () => {
      expect(errors('Image', { width: 228, widthUnit: 'px' })).toHaveLength(1);
    });

    it('stays quiet on a bare number with no unit claimed alongside it', () => {
      // `width: 100` meaning 100% is idiomatic and correct.
      expect(errors('Group', { width: 100 })).toEqual([]);
    });

    it('ignores a suffix that pairs with no units-typed port', () => {
      expect(errors('Text', { textUnit: 'px' })).toEqual([]);
    });
  });

  describe('a bare number on a port that is read as a percentage', () => {
    // The Image in the generated page carried no `widthUnit` at all — just
    // `width: 228, height: 180` — so the pairing trap above could not see it,
    // and it rendered 228% wide. Real content writes these in object form
    // 3,589 times and as a bare number zero times.
    it('is reported even with no unit sibling to give the intent away', () => {
      const found = one('Image', { width: 228, height: 180 }).filter(
        (d) => d.code === DiagnosticCode.UnitlessDimension
      );
      expect(found.map((d) => d.location.port).sort()).toEqual(['height', 'width']);
      expect(found[0].message).toContain('"228%"');
    });

    it('offers both units rather than guessing, since the loop applies a suggestion', () => {
      // `width: 100` meaning 100% is as likely as `width: 228` meaning 228px.
      const found = one('Group', { width: 100 })[0];
      expect(found.suggestion).toBeUndefined();
      expect(found.alternatives).toEqual([
        JSON.stringify({ value: 100, unit: 'px' }),
        JSON.stringify({ value: 100, unit: '%' })
      ]);
    });

    it('leaves px-defaulting ports alone, where a bare number is idiomatic', () => {
      // 70 borderRadius, 11 fontSize and 6 letterSpacing values in the corpus
      // are bare numbers and all of them are correct.
      expect(one('Group', { borderRadius: 8 })).toEqual([]);
      expect(one('Text', { fontSize: 14 })).toEqual([]);
    });

    it('does not double-report when the unit sibling already explains it', () => {
      const codes = one('Image', { width: 228, widthUnit: 'px' }).map((d) => d.code);
      // One report for the unit mistake, not two — plus the independent fact
      // that `sizeMode` leaves the width unread either way. Both are needed:
      // repairing only the unit gives an image that is still ignored, and
      // repairing only `sizeMode` gives one that is 228% wide.
      expect(codes).toEqual([DiagnosticCode.InertDimension, DiagnosticCode.InvalidParameterValue]);
    });

    it('says nothing about a conditional port whose condition is met', () => {
      // The same width, with the sibling the condition asks for.
      const codes = one('Image', { sizeMode: 'explicit', width: { value: 228, unit: 'px' } }).map((d) => d.code);
      expect(codes).toEqual([]);
    });

    it('blocks an authored candidate even though it is only a warning', () => {
      // The severity is right for the corpus and wrong for the loop; see the
      // BLOCKING_WARNINGS note in authoring/validate.ts.
      expect(one('Image', { width: 228 })[0].severity).toBe('warning');
    });
  });

  it('warns the model in the legend that a bare number is not pixels', () => {
    expect(WIRE_FORMAT_LEGEND).toContain('260% wide');
    expect(WIRE_FORMAT_LEGEND).toContain('widthUnit');
  });
});
