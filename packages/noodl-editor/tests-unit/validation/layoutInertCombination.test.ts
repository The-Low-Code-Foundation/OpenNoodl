/**
 * DEF-018 (P78 D28) + DEF-020 (P78 D32) — the two layout combinations in which a declared
 * parameter is silently inert. The RUNTIME readings these rules stand on are pinned in
 * `noodl-mcp/tests/def018-def020-layout-drive.test.ts`, rendered in a real browser with a
 * one-variable control per arm: the members band's own buttons overlap by 14px at 1280×900, and a
 * space-between row splits 640/640 with a 0px gap. This file pins the DOOR's answer to the same
 * graphs.
 *
 * The mutant ledger (each arm exists to redden exactly one sabotage):
 *  - drop `resolveAgainstDefaults` (answer from the authored bag alone) → the bare-button arm
 *    reddens: `net.noodl.controls.button`'s type default IS `contentSize`.
 *  - widen `widthIsPercentage` to accept px → the px-width arm reddens.
 *  - drop the `>= 2` growers floor to `>= 1` → the one-grower arm reddens.
 *  - drop the connected-input abstention → both wired arms redden.
 *  - fire per Columns instead of per child → the cardinality arm reddens.
 *  - promote either code to `AUTHORED_BLOCKING_WARNINGS` → the severity arms redden, so a later
 *    edit cannot promote silently (the `unlabelled-node` pattern).
 */

import { authoredPreconditionDiagnostics, connectedInputs, isBlockingForAuthoredOutput } from '../../src/editor/src/validation/authoredCandidate';
import { loadDefaultCatalog } from '../../src/editor/src/validation/catalog';
import { DiagnosticCode, type Diagnostic } from '../../src/editor/src/validation/diagnostics';
import {
  checkLayoutInertCombination,
  widthIsPercentage,
  type LayoutNode
} from '../../src/editor/src/validation/layoutInertCombination';

const catalog = loadDefaultCatalog();
const COMPONENT = '/Pages/Members';

const COLUMNS = 'net.noodl.visual.columns';
const BUTTON = 'net.noodl.controls.button';

/** The `primaryButton` composition's whole relevant half. */
const CONTENT_SIZED = { sizeMode: 'contentSize' };
/** `tpl001Components.ts`'s `inColumn` — the shape that fixed the members band. */
const IN_COLUMN = { sizeMode: 'contentHeight', width: { value: 100, unit: '%' } };

function run(nodes: LayoutNode[], wired?: ReadonlySet<string>): Diagnostic[] {
  return checkLayoutInertCombination(nodes, { component: COMPONENT, catalog, connectedInputs: wired });
}

function columnsWith(children: Array<{ id: string; type?: string; parameters?: Record<string, unknown> }>): LayoutNode[] {
  return [
    {
      id: 'cols',
      type: COLUMNS,
      parameters: { sizing: 'autoFit', minWidth: 120 },
      children: children.map((c) => c.id)
    } as LayoutNode,
    ...children.map((c) => ({ id: c.id, type: c.type ?? BUTTON, parameters: c.parameters ?? {} }) as LayoutNode)
  ];
}

function rowWith(
  justifyContent: string,
  children: Array<{ id: string; type?: string; parameters?: Record<string, unknown> }>,
  rowParameters: Record<string, unknown> = {}
): LayoutNode[] {
  return [
    {
      id: 'row',
      type: 'Group',
      parameters: { flexDirection: 'row', justifyContent, ...rowParameters },
      children: children.map((c) => c.id)
    } as LayoutNode,
    ...children.map((c) => ({ id: c.id, type: c.type ?? 'Text', parameters: c.parameters ?? {} }) as LayoutNode)
  ];
}

describe('DEF-018 — columns-child-keeps-own-width', () => {
  it('reports a contentSize child of a Columns — the composition verbatim, the drive’s 14px overlap', () => {
    const found = run(columnsWith([{ id: 'btn', parameters: { label: 'Announcements board', ...CONTENT_SIZED } }]));
    expect(found.map((d) => d.code)).toEqual([DiagnosticCode.ColumnsChildKeepsOwnWidth]);
    const d = found[0];
    expect(d.severity).toBe('warning');
    expect(d.location.nodeId).toBe('btn');
    expect(d.location.port).toBe('sizeMode');
    // The message carries the mechanism and both exits — a rejection without a
    // suggested fix is a rejection a model argues with.
    expect(d.message).toContain('contentSize');
    expect(d.message).toContain('contentHeight');
    expect(d.message).toContain('WIDE viewports');
    expect(d.suggestion).toBe('sizeMode: "contentHeight"');
  });

  it('reports a BARE button child too — the type default is contentSize, and the runtime falls back to it', () => {
    // Kills the answer-from-the-authored-bag-alone mutant: nothing is authored here.
    const found = run(columnsWith([{ id: 'btn', parameters: { label: 'Meetings' } }]));
    expect(found.map((d) => d.code)).toEqual([DiagnosticCode.ColumnsChildKeepsOwnWidth]);
  });

  it('reports contentWidth for the same reason as contentSize', () => {
    const found = run(columnsWith([{ id: 'btn', parameters: { sizeMode: 'contentWidth' } }]));
    expect(found.map((d) => d.code)).toEqual([DiagnosticCode.ColumnsChildKeepsOwnWidth]);
  });

  it('is silent on the inColumn shape — width from the column, height from the label', () => {
    expect(run(columnsWith([{ id: 'btn', parameters: { label: 'Post something', ...IN_COLUMN } }]))).toEqual([]);
  });

  it('is silent on a Text child — its type default (contentHeight) reads the width the column gives it', () => {
    expect(run(columnsWith([{ id: 'txt', type: 'Text', parameters: { text: 'a cell' } }]))).toEqual([]);
  });

  it('abstains when the child’s sizeMode is wired — a connected sizing is unknowable at authoring time', () => {
    const nodes = columnsWith([{ id: 'btn', parameters: CONTENT_SIZED }]);
    expect(run(nodes, new Set(['btn::sizeMode']))).toEqual([]);
  });

  it('abstains on a component-instance child — its root sizing is not in this graph (the honest limit, pinned)', () => {
    expect(run(columnsWith([{ id: 'card', type: '/Cards/Puppy', parameters: {} }]))).toEqual([]);
  });

  it('fires once per offending child — the count is the number of edits the repair needs', () => {
    const five = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, parameters: CONTENT_SIZED }));
    const found = run(columnsWith(five));
    expect(found.map((d) => d.code)).toEqual(Array(5).fill(DiagnosticCode.ColumnsChildKeepsOwnWidth));
    expect(found.map((d) => d.location.nodeId)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('judges children of a Columns only — the same child under a Group is a different question', () => {
    const nodes: LayoutNode[] = [
      { id: 'g', type: 'Group', parameters: {}, children: ['btn'] } as LayoutNode,
      { id: 'btn', type: BUTTON, parameters: CONTENT_SIZED } as LayoutNode
    ];
    expect(run(nodes)).toEqual([]);
  });
});

describe('DEF-020 — justify-content-distributes-nothing', () => {
  it('reports the drive’s exact shape: two default-width Texts under space-between, named in the message', () => {
    const found = run(rowWith('space-between', [{ id: 'left' }, { id: 'right' }]));
    expect(found.map((d) => d.code)).toEqual([DiagnosticCode.JustifyContentDistributesNothing]);
    const d = found[0];
    expect(d.severity).toBe('warning');
    expect(d.location.nodeId).toBe('row');
    expect(d.location.port).toBe('justifyContent');
    expect(d.message).toContain('space-between');
    expect(d.message).toContain('left');
    expect(d.message).toContain('right');
    expect(d.message).toContain('contentSize');
  });

  it('is silent with exactly one grower — that row renders what the author meant', () => {
    // Kills the >=1 mutant: one content-sized child leaves one grower.
    expect(
      run(rowWith('space-between', [{ id: 'left' }, { id: 'right', parameters: { sizeMode: 'contentSize' } }]))
    ).toEqual([]);
  });

  it('is silent when a child’s width is a px value — a fixed width does not grow', () => {
    expect(
      run(
        rowWith('space-between', [
          { id: 'left' },
          { id: 'right', parameters: { width: { value: 240, unit: 'px' } } }
        ])
      )
    ).toEqual([]);
  });

  it('is silent on a column Group — flexDirection defaults to column, and a stack has no row to split', () => {
    const nodes: LayoutNode[] = [
      { id: 'row', type: 'Group', parameters: { justifyContent: 'space-between' }, children: ['a', 'b'] } as LayoutNode,
      { id: 'a', type: 'Text', parameters: {} } as LayoutNode,
      { id: 'b', type: 'Text', parameters: {} } as LayoutNode
    ];
    expect(run(nodes)).toEqual([]);
  });

  it('fires on every distributing value and no aligning one', () => {
    for (const justify of ['space-between', 'space-around', 'space-evenly']) {
      expect(run(rowWith(justify, [{ id: 'a' }, { id: 'b' }])).length).toBe(1);
    }
    for (const justify of ['flex-start', 'center', 'flex-end']) {
      expect(run(rowWith(justify, [{ id: 'a' }, { id: 'b' }]))).toEqual([]);
    }
  });

  it('abstains when justifyContent is wired — a connected value is a runtime decision, not this graph’s', () => {
    const nodes = rowWith('space-between', [{ id: 'a' }, { id: 'b' }]);
    expect(run(nodes, new Set(['row::justifyContent']))).toEqual([]);
  });

  it('does not count a child whose width is wired, and abstains rather than fires on the strength of it', () => {
    const nodes = rowWith('space-between', [{ id: 'a' }, { id: 'b' }]);
    expect(run(nodes, new Set(['b::width']))).toEqual([]);
  });

  it('does not count a child with a maxWidth — a capped grower leaves free space, and there justifyContent works', () => {
    // The one shape found while calibrating where the naive predicate is WRONG rather than
    // merely noisy: maxWidth binds as plain CSS, the child stops growing, free space exists.
    expect(
      run(rowWith('space-between', [{ id: 'a' }, { id: 'b', parameters: { maxWidth: { value: 320, unit: 'px' } } }]))
    ).toEqual([]);
    const nodes = rowWith('space-between', [{ id: 'a' }, { id: 'b' }]);
    expect(run(nodes, new Set(['b::maxWidth']))).toEqual([]);
  });

  it('does not count an absolutely-positioned child — out of flow, out of the distribution', () => {
    expect(
      run(rowWith('space-between', [{ id: 'a' }, { id: 'b', parameters: { position: 'absolute' } }]))
    ).toEqual([]);
  });

  it('still fires with three growers — the floor is two, not exactly-two', () => {
    expect(run(rowWith('space-between', [{ id: 'a' }, { id: 'b' }, { id: 'c' }])).length).toBe(1);
  });
});

describe('widthIsPercentage — the one predicate layout.ts’s flexGrow conversion turns on', () => {
  it('reads the three authored forms and the catalog default', () => {
    expect(widthIsPercentage(100)).toBe(true); // the catalog's own `default: 100`, defaultUnit '%'
    expect(widthIsPercentage({ value: 100, unit: '%' })).toBe(true);
    expect(widthIsPercentage({ value: 240, unit: 'px' })).toBe(false);
    expect(widthIsPercentage('50%')).toBe(true);
    expect(widthIsPercentage('240px')).toBe(false);
  });

  it('answers "unknowable" — not false, not true — for a token', () => {
    expect(widthIsPercentage('var(--space-6)')).toBeUndefined();
    expect(widthIsPercentage(undefined)).toBeUndefined();
  });
});

describe('reached through the shared precondition set, and advisory on purpose', () => {
  it('both codes surface through authoredPreconditionDiagnostics — the composition both clients call', () => {
    const nodes = [
      ...columnsWith([{ id: 'btn', parameters: CONTENT_SIZED }]),
      ...rowWith('space-between', [{ id: 'a' }, { id: 'b' }])
    ];
    const found = authoredPreconditionDiagnostics({
      component: COMPONENT,
      nodes: nodes as never,
      components: [COMPONENT],
      catalog
    });
    expect(found.some((d) => d.code === DiagnosticCode.ColumnsChildKeepsOwnWidth)).toBe(true);
    expect(found.some((d) => d.code === DiagnosticCode.JustifyContentDistributesNothing)).toBe(true);
  });

  it('the composed set reads real wires: a stored connection into sizeMode silences the child arm', () => {
    // `connectedInputs` is the same builder both clients use, so this pins the
    // key format end to end rather than the Set literal the unit arms use.
    const wired = connectedInputs([
      { fromId: 'x', fromProperty: 'value', toId: 'btn', toProperty: 'sizeMode' }
    ] as never);
    expect(run(columnsWith([{ id: 'btn', parameters: CONTENT_SIZED }]), wired)).toEqual([]);
  });

  it('neither code blocks authored output — advisory until a calibration earns promotion, and not silently', () => {
    expect(isBlockingForAuthoredOutput({ code: DiagnosticCode.ColumnsChildKeepsOwnWidth, severity: 'warning' } as Diagnostic)).toBe(false);
    expect(isBlockingForAuthoredOutput({ code: DiagnosticCode.JustifyContentDistributesNothing, severity: 'warning' } as Diagnostic)).toBe(false);
  });
});
