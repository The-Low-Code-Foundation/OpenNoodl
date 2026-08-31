/**
 * DEF-003 — three ordinary authoring acts, and whether the product answers them.
 *
 * The row is phase 77 D8 (= phase 76 F15), phase 77 D7, and phase 76 F16: three unrelated-looking
 * findings with one shape, *"a builder does an ordinary thing, the product accepts it, and it does
 * not mean what it says"*. Driving all three first changed what the work was — recorded here beside
 * the arms, because the next reader will otherwise re-derive it:
 *
 *  - **(a) a bare number on a dimension port** was already answered at HEAD, by
 *    `unitless-dimension` (phase 40 / DSG-004), which is a *blocking* warning naming both object
 *    forms. Both phases that recorded the row measured the coercion and never asked the door. The
 *    arms below are the ones that keep it answered; nothing was built for it.
 *  - **(b) `Text` has no padding or `borderRadius`** was answered with `unknown-parameter`, which
 *    is true and is a dead end. It now carries the exit as well.
 *  - **(c) a page title needs an editor attached** is **false**. Driven headlessly: a page authored
 *    through the MCP door with `title` set, no editor ever attached, renders with that
 *    `document.title` (`packages/noodl-mcp/tests/def003PageTitleDrive.test.ts`). The port worked;
 *    the *declaration* was missing, so the catalog said `notFound` for the two most commonly set
 *    ports on a page. Both are declared inputs now.
 *
 * The real generated catalog throughout, for `parameterValues.test.ts`'s reason: every claim here
 * is about the ports the product actually ships.
 */

import { loadDefaultCatalog } from '../../src/editor/src/validation/catalog';
import { DiagnosticCode } from '../../src/editor/src/validation/diagnostics';
import { checkParameterValues, noBoxExit } from '../../src/editor/src/validation/parameterValues';
import type { ParameterizedNode } from '../../src/editor/src/validation/parameterValues';

const catalog = loadDefaultCatalog();

function check(nodes: ParameterizedNode[]) {
  return checkParameterValues(nodes, catalog, { component: '/Test' });
}

function one(type: string, parameters: Record<string, unknown>) {
  return check([{ id: 'n1', type, parameters }]);
}

describe('(a) a bare number on a dimension port — already answered, and this is what keeps it so', () => {
  it('names the size it actually renders at, which the drive measured as 240% of the parent', () => {
    // Driven: `width: 240` on a Text inside a 756px page renders 1814.39px — 240% — while
    // `{value: 240, unit: 'px'}` renders exactly 240px. The message's claim is a measured one.
    const [d, ...rest] = one('Text', { width: 240 }).filter(
      (x) => x.code === DiagnosticCode.UnitlessDimension
    );
    expect(rest).toEqual([]);
    expect(d.severity).toBe('warning');
    expect(d.message).toContain('"240%"');
    expect(d.alternatives).toEqual([
      JSON.stringify({ value: 240, unit: 'px' }),
      JSON.stringify({ value: 240, unit: '%' })
    ]);
  });

  it('leaves the object form alone — the repair the message proposes must not itself be a defect', () => {
    expect(one('Text', { width: { value: 240, unit: 'px' } })).toEqual([]);
  });

  it('stays quiet where a bare number already means what it says', () => {
    // `paddingLeft` on a Group defaults to px, so `24` is exactly 24px and there is nothing to
    // warn about ON THIS AXIS. Without this row the rule could be widened to every units port and
    // still pass.
    //
    // 🔴 **Written as a code SET rather than as `toEqual([])`, 2026-08-31 (P81 VIB-007 / V28).**
    // The bare assertion was a proxy — its subject is `unitless-dimension`, and it stood in for
    // "that rule does not reach here" by demanding total silence from every rule at once. So it
    // reddened when `raw-spacing-literal` arrived: a different rule, on a different axis, saying
    // `var(--space-6)` is exactly 24px. That finding is correct and non-blocking (measured at the
    // door: `create_component` returns `isError: false` and carries it as a warning), and it is
    // the same relationship `raw-color-literal` has with a perfectly valid `#2563eb`.
    //
    // ⚠️ The anti-widening guarantee is STRONGER in this form, not weaker. `toEqual([])` could
    // only say "nobody speaks"; this says exactly WHO may, so a fourth rule appearing on this
    // value still trips the row — and now names itself when it does.
    const codes = one('Group', { paddingLeft: 24 }).map((d) => d.code).sort();
    expect(codes).not.toContain(DiagnosticCode.UnitlessDimension);
    expect(codes).toEqual([DiagnosticCode.RawSpacingLiteral]);
  });
});

describe('(b) a box property on a node that has no box', () => {
  const padded = () =>
    one('Text', { paddingLeft: 24 }).filter((d) => d.code === DiagnosticCode.UnknownParameter);

  it('still refuses it — the diagnosis was never the missing half', () => {
    expect(padded()).toHaveLength(1);
    expect(padded()[0].message).toContain('Text has no input port "paddingLeft"');
  });

  it('now carries the exit: the Group wrapper, named at the moment it is needed', () => {
    // Driven: `paddingLeft: 24` on a Text computes `padding-left: 0px`; on a wrapping Group it
    // computes 24px. There is no differently-named port to look for, which is why "no such port"
    // on its own sends an author round a loop.
    expect(padded()[0].message).toContain('Wrap it in a Group');
    expect(padded()[0].message).toContain('"paddingLeft"');
  });

  it('says nothing extra about a plain typo — the note is about boxes, not about being unknown', () => {
    const [d] = one('Text', { nonsenseXyz: 1 }).filter(
      (x) => x.code === DiagnosticCode.UnknownParameter
    );
    expect(d.message).not.toContain('Group');
  });

  /**
   * 🔴 The two controls that decide whether the rule is keyed on the right thing. A rule keyed on
   * the parameter name alone passes every row above and fails both of these.
   */
  it('does not fire on a node that has a box but not this one property', () => {
    // Icon declares padding and no border, so `borderRadius` on it is a missing *port*, not a
    // missing *box*, and telling its author to wrap it in a Group would be wrong.
    expect(catalog.getPort('net.noodl.visual.icon', 'input', 'paddingLeft')).toBeTruthy();
    expect(noBoxExit(catalog, 'net.noodl.visual.icon', 'borderRadius')).toBeUndefined();
    expect(noBoxExit(catalog, 'Text', 'borderRadius')).toContain('Wrap it in a Group');
  });

  it('does not fire on a node that paints under different names', () => {
    // 🔴 `Circle` was a false positive of the first version of this rule: it declares no
    // `backgroundColor` and no `borderRadius`, and paints through `fillColor`/`strokeColor`
    // instead. "It has no box of its own to paint" is simply untrue of it, and the sentence would
    // have walked its author away from the port they wanted.
    expect(catalog.getPort('Circle', 'input', 'backgroundColor')).toBeFalsy();
    expect(catalog.getPort('Circle', 'input', 'fillColor')).toBeTruthy();
    expect(noBoxExit(catalog, 'Circle', 'backgroundColor')).toBeUndefined();
  });

  it('does fire on the rest of the population the sentence is true of', () => {
    // Named rather than derived: a rule that fires on "whatever has no box" should be readable as
    // a list, and if a future node joins or leaves it, this row is where that shows up.
    for (const type of ['Text', 'net.noodl.visual.columns', 'For Each']) {
      expect(noBoxExit(catalog, type, 'paddingLeft')).toContain('Wrap it in a Group');
    }
  });

  it('leaves a node that really does have the port completely alone', () => {
    // ⚠️ Same amendment as (a)'s third row, and for the same reason: this row's subject is
    // `unknown-parameter`, and `toEqual([])` stood in for "it does not fire here". The object form
    // is as tokenisable as the bare number, so `raw-spacing-literal` speaks about it too;
    // `borderRadius: 8` is deliberately outside that rule's port set and stays silent, which is
    // what makes this a control on the port set as well as on the code.
    const codes = one('Group', { paddingLeft: { value: 24, unit: 'px' }, borderRadius: 8 })
      .map((d) => d.code)
      .sort();
    expect(codes).not.toContain(DiagnosticCode.UnknownParameter);
    expect(codes).toEqual([DiagnosticCode.RawSpacingLiteral]);
  });
});

describe('(c) a page title, with no editor attached', () => {
  it('declares title and urlPath as ordinary input ports', () => {
    // Until DEF-003 these existed only inside `setup()`, which returns immediately without a local
    // editor connection — so the generated catalog never saw them and `get_node_type("Page")`
    // answered `notFound` for both.
    expect(catalog.getPort('Page', 'input', 'title')).toBeTruthy();
    expect(catalog.getPort('Page', 'input', 'urlPath')).toBeTruthy();
  });

  it('accepts a page that sets both, with nothing left unverified', () => {
    // The old state was one `dynamic-port-skipped` info on every correct page in the product —
    // 96 of 947 measured skips — which D16 suppressed with a two-name carve-out. The carve-out is
    // gone; this is the same silence, earned rather than granted.
    expect(one('Page', { title: 'Pricing', urlPath: 'pricing' })).toEqual([]);
  });

  it('still reports an invented parameter on a Page — D16 ruling, now true by construction', () => {
    const codes = one('Page', { title: 'Pricing', pageTitle: 'Invented' }).map((d) => d.code);
    expect(codes).toEqual([DiagnosticCode.DynamicPortSkipped]);
    const [d] = one('Page', { title: 'Pricing', pageTitle: 'Invented' });
    expect(d.message).toContain('pageTitle');
    expect(d.message).not.toContain('"title"');
  });
});
