/**
 * LAS-003 checks 2 and 3 — the badge-pill trap (audit F7) and the raw colour
 * literal.
 *
 * Both rules were calibrated against the corpus BEFORE their severity was
 * chosen, and in both cases the measurement changed the design:
 *
 *  - "absolute with no width or height" alone hits 151 nodes, 122 of which are
 *    legitimate overlays. Requiring decoration cuts it to 29, and 21 of those
 *    are editor test fixtures. The narrowing is the rule.
 *  - raw colour literals hit 553 times, so an error was never on the table.
 *    Legacy content is untokenised, not wrong.
 *
 * The specs below pin both the catch and the *silence* — for a rule feeding an
 * automated repair round, the cases it must not fire on are worth more tests
 * than the cases it must.
 */

import { loadDefaultCatalog } from '../../src/editor/src/validation/catalog';
import { DiagnosticCode } from '../../src/editor/src/validation/diagnostics';
import { checkParameterValues } from '../../src/editor/src/validation/parameterValues';
import type { ParameterizedNode } from '../../src/editor/src/validation/parameterValues';

const catalog = loadDefaultCatalog();

function diagnosticsFor(type: string, parameters: Record<string, unknown>, code: DiagnosticCode) {
  const nodes: ParameterizedNode[] = [{ id: 'n', type, parameters }];
  return checkParameterValues(nodes, catalog, { component: '/Test' }).filter((d) => d.code === code);
}

// ─── check 2: the unsized absolute box ───────────────────────────────────────

/**
 * Driven through `checkParameterValues` rather than a rule, and that is a
 * finding rather than a convenience: `NormNode` — the model every rule in
 * `rules/` sees — carries no `parameters` field at all, because the normalized
 * model is deliberately structural. A cross-parameter check has exactly one
 * home, and the type system says which.
 */
function runRule(nodes: Array<{ id: string; type: string; parameters?: Record<string, unknown> }>) {
  return checkParameterValues(nodes as ParameterizedNode[], catalog, { component: '/Test' }).filter(
    (d) => d.code === DiagnosticCode.UnsizedAbsoluteBox
  );
}

describe("LAS-003/2 — sonnet's badge pill", () => {
  it('flags a decorated absolute box with neither width nor height', () => {
    const [found] = runRule([
      { id: 'badge', type: 'Group', parameters: { position: 'absolute', backgroundColor: 'var(--primary)' } }
    ]);

    expect(found).toBeDefined();
    expect(found.severity).toBe('warning');
    // The mechanism, named: the audit inferred this from a screenshot, and the
    // catalog confirms `width`/`height` are `dimension` with default 100 / `%`.
    expect(found.message).toContain('both default to 100%');
    expect(found.message).toContain('fills its parent');
    expect(found.location.nodeId).toBe('badge');
  });

  it('is satisfied by EITHER dimension — one is enough to take it out of the trap', () => {
    expect(
      runRule([{ id: 'b', type: 'Group', parameters: { position: 'absolute', backgroundColor: '#fff', width: { value: 40, unit: 'px' } } }])
    ).toEqual([]);
    expect(
      runRule([{ id: 'b', type: 'Group', parameters: { position: 'absolute', backgroundColor: '#fff', height: { value: 24, unit: 'px' } } }])
    ).toEqual([]);
  });
});

describe('LAS-003/2 — the 122 nodes it must stay silent about', () => {
  it('ignores an undecorated absolute box — that is the overlay pattern, authored on purpose', () => {
    expect(runRule([{ id: 'overlay', type: 'Group', parameters: { position: 'absolute' } }])).toEqual([]);
  });

  it('ignores a decorated box that is still in flow', () => {
    // In flow the parent sizes it, so no dimension is needed and nothing is
    // surprising. `position` defaults to `relative`.
    expect(runRule([{ id: 'card', type: 'Group', parameters: { backgroundColor: 'var(--surface)' } }])).toEqual([]);
    expect(
      runRule([{ id: 'card', type: 'Group', parameters: { position: 'relative', backgroundColor: 'var(--surface)' } }])
    ).toEqual([]);
  });

  it('treats an empty-string parameter as unset, the way a cleared editor field writes it', () => {
    expect(runRule([{ id: 'x', type: 'Group', parameters: { position: 'absolute', backgroundColor: '' } }])).toEqual([]);
  });
});

// ─── check 3: the raw colour literal ─────────────────────────────────────────

function colorDiagnostics(type: string, parameters: Record<string, unknown>) {
  return diagnosticsFor(type, parameters, DiagnosticCode.RawColorLiteral);
}

describe('LAS-003/3 — "never raw hex" becomes checkable', () => {
  it('warns on the hex the doctrine forbids, and points at where the tokens are', () => {
    const [found] = colorDiagnostics('Group', { backgroundColor: '#B3542E' });

    expect(found).toBeDefined();
    // A warning, never an error: 553 corpus occurrences, and legacy content is
    // untokenised rather than wrong.
    expect(found.severity).toBe('warning');
    expect(found.message).toContain('get_style_vocabulary');
    expect(found.message).toContain('var(--token)');
  });

  it('catches the functional notations too', () => {
    expect(colorDiagnostics('Group', { backgroundColor: 'rgb(179, 84, 46)' })).not.toEqual([]);
    expect(colorDiagnostics('Group', { backgroundColor: 'rgba(179, 84, 46, 0.5)' })).not.toEqual([]);
    expect(colorDiagnostics('Group', { backgroundColor: 'hsl(20 60% 44%)' })).not.toEqual([]);
  });

  it('says nothing about a token, which is the whole point', () => {
    expect(colorDiagnostics('Group', { backgroundColor: 'var(--primary)' })).toEqual([]);
  });

  it('leaves named colours alone — no token replaces `transparent`', () => {
    expect(colorDiagnostics('Group', { backgroundColor: 'transparent' })).toEqual([]);
  });
});
