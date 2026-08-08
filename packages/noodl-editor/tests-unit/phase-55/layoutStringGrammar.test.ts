/**
 * LAS-003 check 1 — the `layoutString` grammar (audit F3).
 *
 * Haiku's cold replay of the storefront brief emitted
 * `layoutString: "1fr 1fr 1fr 1fr"` — the CSS Grid dialect, which is what
 * every model has seen a million times and what nothing in NodeGX speaks.
 * `parseLayout` reads each space-separated token with `Number()`, drops
 * everything that is not a positive finite number, and falls back to `[1]` when
 * nothing survives. So the product grid rendered as ONE COLUMN at every width,
 * on the one node in the runtime that exists to reflow — with **zero**
 * diagnostics.
 *
 * ## The grammar, read from source rather than from the recipes
 *
 * The task doc and the `ui-*` recipes both describe this port as "integers and
 * spaces". That is wrong, and shipping a check built on it would have rejected
 * legal layouts. `readLayoutToken`
 * (`noodl-viewer-react/src/components/visual/Columns/Columns.tsx`) is
 * deliberately `Number`, not `parseInt` — its own docblock records that
 * `parseInt` had silently truncated `'1 2.5 1'` to `1 2 1`, and that nothing
 * downstream assumes integers because `_calcAutofold` only ever sums and
 * divides. **Fractional proportions are legal.** `Number` rather than
 * `parseFloat` for the opposite reason: `parseFloat` reads a prefix, turning
 * `'1abc'` into `1`.
 *
 * This check therefore mirrors exactly one predicate — `Number(token)` is
 * finite and greater than zero — and the parity spec below pins it against the
 * runtime's own reference cases so the two cannot drift.
 */

import { loadDefaultCatalog } from '../../src/editor/src/validation/catalog';
import { DiagnosticCode } from '../../src/editor/src/validation/diagnostics';
import { checkParameterValues } from '../../src/editor/src/validation/parameterValues';
import type { ParameterizedNode } from '../../src/editor/src/validation/parameterValues';

const catalog = loadDefaultCatalog();
const COLUMNS = 'net.noodl.visual.columns';

function check(parameters: Record<string, unknown>) {
  const nodes: ParameterizedNode[] = [{ id: 'cols', type: COLUMNS, parameters }];
  return checkParameterValues(nodes, catalog, { component: '/Test' });
}

function layoutErrors(parameters: Record<string, unknown>) {
  return check(parameters).filter(
    (d) => d.severity === 'error' && d.code === DiagnosticCode.InvalidParameterValue
  );
}

describe('LAS-003 — the measured failure', () => {
  it("rejects haiku's exact `1fr 1fr 1fr 1fr` and hands back the corrected string", () => {
    const [error] = layoutErrors({ layoutString: '1fr 1fr 1fr 1fr' });

    expect(error).toBeDefined();
    // The suggestion is the whole repair. The audit measured that rejections
    // carrying one get self-corrected on the next turn, even by the mid-tier
    // model, while rejections carrying only prose get argued with.
    expect(error.suggestion).toBe('1 1 1 1');
    expect(error.message).toContain('1fr');
  });

  it('accepts the corrected string it just suggested', () => {
    expect(layoutErrors({ layoutString: '1 1 1 1' })).toEqual([]);
  });

  it('names the port, so a Columns node with three of them says which one is wrong', () => {
    const found = layoutErrors({
      layoutString: '1 1',
      mediumLayout: '1 1',
      smallLayout: 'repeat(1, minmax(0, 1fr))'
    });
    expect(found.length).toBe(1);
    expect(found[0].location.port).toBe('smallLayout');
  });
});

describe('LAS-003 — the grammar is the runtime\'s, not the recipes\'', () => {
  it('accepts fractional proportions — `Number`, not `parseInt`', () => {
    // The recipes say "integers and spaces". The runtime says otherwise, and
    // the runtime is the authority: rejecting this would be a gate inventing a
    // constraint the thing it guards does not have.
    expect(layoutErrors({ layoutString: '1 2.5 1' })).toEqual([]);
  });

  it('rejects a prefix-number, which `parseFloat` would have accepted', () => {
    expect(layoutErrors({ layoutString: '1abc 1' })).not.toEqual([]);
  });

  it('rejects zero and negative tracks — the predicate is `> 0`, not `isFinite`', () => {
    expect(layoutErrors({ layoutString: '1 0 1' })).not.toEqual([]);
    expect(layoutErrors({ layoutString: '1 -1' })).not.toEqual([]);
  });

  it('tolerates a double space, which the runtime drops on purpose', () => {
    // `describeLayoutString` explicitly declines to report this: an empty entry
    // "means nothing, and it is not a mistake worth reporting". Two gates
    // disagreeing about the same string is the drift this spec exists to stop.
    expect(layoutErrors({ layoutString: '1  2' })).toEqual([]);
  });

  it('leaves an unset or empty port alone', () => {
    expect(layoutErrors({ sizing: 'autoFit' })).toEqual([]);
    // Blank is the documented way to make a breakpoint inert — "leaving it
    // blank makes the breakpoint inert", per the port's own description.
    expect(layoutErrors({ layoutString: '1 1', mediumLayout: '' })).toEqual([]);
  });
});

describe('LAS-003 — the suggestion only appears when it is trustworthy', () => {
  it('strips units and keeps ratios for the fr/px dialects', () => {
    expect(layoutErrors({ layoutString: '2fr 1fr' })[0].suggestion).toBe('2 1');
    expect(layoutErrors({ layoutString: '260px 120px' })[0].suggestion).toBe('260 120');
  });

  it('offers no suggestion for a string it cannot repair', () => {
    // `repeat(2, 1fr)` has no ratio to recover. A confident guess here would be
    // auto-applied by an agent told never to argue with a diagnostic, so the
    // rule stays silent rather than inventing a layout.
    const [error] = layoutErrors({ layoutString: 'repeat(2, minmax(0, 1fr))' });
    expect(error).toBeDefined();
    expect(error.suggestion).toBeUndefined();
  });
});
