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

import {
  authoredPreconditionDiagnostics,
  connectedInputs,
  isBlockingForAuthoredOutput
} from '../../src/editor/src/validation/authoredCandidate';
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

function columnsWith(
  children: Array<{ id: string; type?: string; parameters?: Record<string, unknown> }>
): LayoutNode[] {
  return [
    {
      id: 'cols',
      type: COLUMNS,
      parameters: { sizing: 'autoFit', minWidth: 120 },
      children: children.map((c) => c.id)
    } as LayoutNode,
    ...children.map((c) => ({ id: c.id, type: c.type ?? BUTTON, parameters: c.parameters ?? {} } as LayoutNode))
  ];
}

/**
 * FLD-005's shape: a column parent whose height is whatever `parent` says, holding `children`.
 * The default parent is the defect's own — `sizeMode: 'explicit'` with a real px height.
 */
function fixedColumnWith(
  children: Array<{ id: string; type?: string; parameters?: Record<string, unknown> }>,
  parent: Record<string, unknown> = { sizeMode: 'explicit', height: { value: 800, unit: 'px' } }
): LayoutNode[] {
  return [
    {
      id: 'box',
      type: 'Group',
      parameters: { flexDirection: 'column', ...parent },
      children: children.map((c) => c.id)
    } as LayoutNode,
    ...children.map((c) => ({ id: c.id, type: c.type ?? 'Group', parameters: c.parameters ?? {} } as LayoutNode))
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
    ...children.map((c) => ({ id: c.id, type: c.type ?? 'Text', parameters: c.parameters ?? {} } as LayoutNode))
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
        rowWith('space-between', [{ id: 'left' }, { id: 'right', parameters: { width: { value: 240, unit: 'px' } } }])
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
    // Asserted by CODE, not by emptiness: FLD-004's rule fires on this very graph and is right to
    // — `b`'s width is wired into a row parent's own main axis — so `toEqual([])` would now be
    // grading two rules at once and would have to be weakened by whichever one moved next.
    expect(run(nodes, new Set(['b::width'])).map((d) => d.code)).not.toContain(
      DiagnosticCode.JustifyContentDistributesNothing
    );
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
    expect(run(rowWith('space-between', [{ id: 'a' }, { id: 'b', parameters: { position: 'absolute' } }]))).toEqual([]);
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
    expect(
      isBlockingForAuthoredOutput({ code: DiagnosticCode.ColumnsChildKeepsOwnWidth, severity: 'warning' } as Diagnostic)
    ).toBe(false);
    expect(
      isBlockingForAuthoredOutput({
        code: DiagnosticCode.JustifyContentDistributesNothing,
        severity: 'warning'
      } as Diagnostic)
    ).toBe(false);
  });
});

describe('FLD-004 — wired-dimension-becomes-grow', () => {
  /** A parent that stacks along `axis`, holding one child of `childType`. */
  function stack(
    axis: 'row' | 'column' | 'none',
    child: { id?: string; type?: string; parameters?: Record<string, unknown> } = {},
    parentType = 'Group'
  ): LayoutNode[] {
    return [
      {
        id: 'parent',
        type: parentType,
        parameters: parentType === 'Group' ? { flexDirection: axis } : {},
        children: [child.id ?? 'box']
      } as LayoutNode,
      { id: child.id ?? 'box', type: child.type ?? 'Group', parameters: child.parameters ?? {} } as LayoutNode
    ];
  }

  const WIRED_HEIGHT = new Set(['box::height']);
  const WIRED_WIDTH = new Set(['box::width']);

  it('reports #26 verbatim: a number wired into height, inside a column parent', () => {
    const found = run(stack('column'), WIRED_HEIGHT);
    expect(found.map((d) => d.code)).toEqual([DiagnosticCode.WiredDimensionBecomesGrow]);
    const d = found[0];
    expect(d.severity).toBe('warning');
    expect(d.location.nodeId).toBe('box');
    expect(d.location.port).toBe('height');
    expect(d.location.plug).toBe('input');
    // The message has to carry the mechanism, or the author reads it as "you set it wrong".
    expect(d.message).toContain('PERCENTAGE');
    expect(d.message).toContain('flex-grow');
    expect(d.message).toContain('Layout: Vertical');
    expect(d.suggestion).toContain('px');
  });

  it('🔴 THE DISCRIMINATOR — the SAME wire into width, on the same node in the same parent, is silent', () => {
    // AC2's second arm, and the reporter's own three-way result: `width` and `paddingTop` accept
    // the identical connection and work, because a percentage on the CROSS axis stays a real CSS
    // length. A rule that fired on both would be reporting "this port is wired", not this defect.
    expect(run(stack('column'), WIRED_WIDTH)).toEqual([]);
  });

  it('mirrors on a row parent: width fires, height is silent — the axis decides, not the port name', () => {
    expect(run(stack('row'), WIRED_WIDTH).map((d) => d.location.port)).toEqual(['width']);
    expect(run(stack('row'), WIRED_HEIGHT)).toEqual([]);
  });

  it('🔴 is silent when the port is NOT wired — a percentage height in a column IS the shipped idiom', () => {
    // The noise arm, and the reason the rule keys on the connection. Every visual node's `width`
    // and `height` default to 100%, and on the main axis that default is how a child fills its
    // parent: keying on the value alone reports the whole corpus.
    expect(run(stack('column', { parameters: { height: { value: 400, unit: '%' } } }))).toEqual([]);
  });

  it('abstains on a Group set to Layout: None — it positions its children absolutely and converts nothing', () => {
    expect(run(stack('none'), WIRED_HEIGHT)).toEqual([]);
  });

  it('abstains under a Columns — its children never receive a parentLayout at all (D28 owns that graph)', () => {
    const nodes: LayoutNode[] = [
      {
        id: 'parent',
        type: COLUMNS,
        parameters: { sizing: 'autoFit', minWidth: 120 },
        children: ['box']
      } as LayoutNode,
      { id: 'box', type: 'Group', parameters: {} } as LayoutNode
    ];
    expect(run(nodes, WIRED_HEIGHT)).toEqual([]);
  });

  it('abstains on an out-of-flow child — layout.ts converts only position: relative', () => {
    expect(run(stack('column', { parameters: { position: 'absolute' } }), WIRED_HEIGHT)).toEqual([]);
    expect(run(stack('column', { parameters: { position: 'sticky' } }), WIRED_HEIGHT)).toEqual([]);
    expect(run(stack('column'), new Set(['box::height', 'box::position']))).toEqual([]);
  });

  it('abstains when sizeMode never reads the port — that is inert-dimension’s sentence, not this one’s', () => {
    expect(run(stack('column', { parameters: { sizeMode: 'contentSize' } }), WIRED_HEIGHT)).toEqual([]);
    expect(run(stack('column', { parameters: { sizeMode: 'contentHeight' } }), WIRED_HEIGHT)).toEqual([]);
    // A Text's TYPE DEFAULT is contentHeight, so the same abstention has to survive the default
    // being resolved rather than authored — the `resolveAgainstDefaults` mutant.
    expect(run(stack('column', { type: 'Text' }), WIRED_HEIGHT)).toEqual([]);
    expect(run(stack('column'), new Set(['box::height', 'box::sizeMode']))).toEqual([]);
  });

  it('🔴 abstains when the port already holds a px value — that IS the exit the message names', () => {
    // `setInputValue` merges a bare number into the unit the port is currently holding, so with a
    // px value in the panel the wire arrives as a real length. Firing here would contradict the
    // advice the other arm prints.
    expect(run(stack('column', { parameters: { height: { value: 400, unit: 'px' } } }), WIRED_HEIGHT)).toEqual([]);
    expect(run(stack('column', { parameters: { height: { value: 50, unit: 'vh' } } }), WIRED_HEIGHT)).toEqual([]);
    // ...and still fires when the value it holds is a percentage, which is the default.
    expect(
      run(stack('column', { parameters: { height: { value: 100, unit: '%' } } }), WIRED_HEIGHT).map((d) => d.code)
    ).toEqual([DiagnosticCode.WiredDimensionBecomesGrow]);
  });

  it('abstains on a component-instance child — its root sizing is not in this graph', () => {
    expect(run(stack('column', { type: '/Cards/Puppy' }), WIRED_HEIGHT)).toEqual([]);
  });

  it('reads a Page and a Router as column parents — both hand their children layout: column', () => {
    expect(run(stack('column', {}, 'Page'), WIRED_HEIGHT).map((d) => d.code)).toEqual([
      DiagnosticCode.WiredDimensionBecomesGrow
    ]);
    expect(run(stack('column', {}, 'Router'), WIRED_HEIGHT).map((d) => d.code)).toEqual([
      DiagnosticCode.WiredDimensionBecomesGrow
    ]);
  });

  it('fires once per offending child — the count is the number of edits the repair needs', () => {
    const ids = ['a', 'b', 'c'];
    const nodes: LayoutNode[] = [
      { id: 'parent', type: 'Group', parameters: { flexDirection: 'column' }, children: ids } as LayoutNode,
      ...ids.map((id) => ({ id, type: 'Group', parameters: {} } as LayoutNode))
    ];
    const found = run(nodes, new Set(ids.map((id) => `${id}::height`)));
    expect(found.map((d) => d.location.nodeId)).toEqual(ids);
  });

  it('the composed set reads real stored connections, and the code does not block authored output', () => {
    const wired = connectedInputs([
      { fromId: 'x', fromProperty: 'result', toId: 'box', toProperty: 'height' }
    ] as never);
    expect(run(stack('column'), wired).map((d) => d.code)).toEqual([DiagnosticCode.WiredDimensionBecomesGrow]);
    expect(
      isBlockingForAuthoredOutput({ code: DiagnosticCode.WiredDimensionBecomesGrow, severity: 'warning' } as Diagnostic)
    ).toBe(false);
  });

  // ── FLD-005 (#35) — a definite-height column whose children share it out ──────────────────
  //
  // The runtime readings these stand on are in `noodl-mcp/tests/fld005ColumnMultipliesOut.test.ts`:
  // five rows of one to five lines inside an 800px parent come back 160px each, and a `card` in a
  // 300px parent loses six of its ten lines. The mutants each arm exists to redden:
  //  - drop the `hasDefiniteHeight` guard → the content-height-parent arm reddens, and it is the
  //    arm that keeps this rule off the whole corpus.
  //  - drop the `>= 2` floor to `>= 1` → the single-child arm reddens.
  //  - accept a px height on a child as growing → the px-child arm reddens.
  //  - drop `resolveAgainstDefaults` → the bare-children arm reddens: the defect is entirely made
  //    of DEFAULTS, so answering from the authored bag alone sees nothing at all.
  //  - fire per child instead of per parent → the cardinality arm reddens.
  //  - promote the code to `AUTHORED_BLOCKING_WARNINGS` → the severity arm reddens.

  it('FLD-005 — two bare Groups in a fixed-height column are reported, once, on the parent', () => {
    const found = run(fixedColumnWith([{ id: 'a' }, { id: 'b' }]));
    expect(found.map((d) => d.code)).toEqual([DiagnosticCode.ColumnChildrenSplitAFixedHeight]);
    expect(found[0].location.nodeId).toBe('box');
    expect(found[0].location.port).toBe('height');
    // The children are named, because "which ones" is the first thing the author asks.
    expect(found[0].message).toContain('2 of');
  });

  it('FLD-005 BOTH ARMS — the same column whose children set contentHeight is silent', () => {
    const found = run(
      fixedColumnWith([
        { id: 'a', parameters: { sizeMode: 'contentHeight', width: { value: 100, unit: '%' } } },
        { id: 'b', parameters: { sizeMode: 'contentHeight', width: { value: 100, unit: '%' } } }
      ])
    );
    expect(found).toEqual([]);
  });

  it('FLD-005 — the parent WITHOUT a definite height is silent: there is no free space to share', () => {
    // #35's own smallest graph. Measured in Chrome: every row lands at its content height and the
    // page is the viewport. A rule that fired here would report the whole corpus for nothing.
    const found = run(fixedColumnWith([{ id: 'a' }, { id: 'b' }], { sizeMode: 'contentHeight' }));
    expect(found).toEqual([]);
    // And the default parent — no sizeMode at all, which is the majority of every project.
    expect(run(fixedColumnWith([{ id: 'a' }, { id: 'b' }], {}))).toEqual([]);
  });

  it('FLD-005 — a parent whose height is a PERCENTAGE is not definite either', () => {
    const found = run(
      fixedColumnWith([{ id: 'a' }, { id: 'b' }], { sizeMode: 'explicit', height: { value: 100, unit: '%' } })
    );
    expect(found).toEqual([]);
  });

  it('FLD-005 — one growing child is the shipped idiom and is not reported', () => {
    const found = run(fixedColumnWith([{ id: 'a' }]));
    expect(found).toEqual([]);
    // Two children, only one of which grows, is the same case.
    expect(run(fixedColumnWith([{ id: 'a' }, { id: 'b', parameters: { sizeMode: 'contentHeight' } }]))).toEqual([]);
  });

  it('FLD-005 — a child with a real px height keeps it and does not grow', () => {
    const found = run(
      fixedColumnWith([
        { id: 'a', parameters: { height: { value: 120, unit: 'px' } } },
        { id: 'b', parameters: { height: { value: 120, unit: 'px' } } }
      ])
    );
    expect(found).toEqual([]);
  });

  it('FLD-005 — a row parent is not this rule: a percentage height there stays a length', () => {
    const found = run(
      fixedColumnWith([{ id: 'a' }, { id: 'b' }], {
        flexDirection: 'row',
        sizeMode: 'explicit',
        height: { value: 800, unit: 'px' }
      })
    );
    expect(found.some((d) => d.code === DiagnosticCode.ColumnChildrenSplitAFixedHeight)).toBe(false);
  });

  it('FLD-005 — a wired sizing port on a child makes it unknowable, not guilty', () => {
    const nodes = fixedColumnWith([{ id: 'a' }, { id: 'b' }]);
    const found = run(
      nodes,
      connectedInputs([{ fromId: 'x', fromProperty: 'v', toId: 'a', toProperty: 'height' }] as never)
    );
    expect(found.some((d) => d.code === DiagnosticCode.ColumnChildrenSplitAFixedHeight)).toBe(false);
    // 🔴 And the neighbour DOES speak, which is the point of separating them: a wired height on
    // the main axis is FLD-004's sentence, and one mistake gets one repair, not two.
    expect(found.map((d) => d.code)).toEqual([DiagnosticCode.WiredDimensionBecomesGrow]);
  });

  it('FLD-005 — an out-of-flow child neither grows nor takes part', () => {
    const found = run(
      fixedColumnWith([
        { id: 'a', parameters: { position: 'absolute' } },
        { id: 'b', parameters: { position: 'absolute' } }
      ])
    );
    expect(found).toEqual([]);
  });

  it('FLD-005 — a component instance child is skipped: its root sizing is not in this graph', () => {
    const found = run(
      fixedColumnWith([
        { id: 'a', type: '/Comps/Row' },
        { id: 'b', type: '/Comps/Row' }
      ])
    );
    expect(found).toEqual([]);
  });

  it('FLD-005 CARDINALITY — five sharing children are ONE report, not five', () => {
    const found = run(fixedColumnWith([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }]));
    expect(found.length).toBe(1);
    expect(found[0].message).toContain('5 of');
  });

  it('FLD-005 SEVERITY — a warning, and not blocking for authored output on first ship', () => {
    const found = run(fixedColumnWith([{ id: 'a' }, { id: 'b' }]));
    expect(found[0].severity).toBe('warning');
    expect(
      isBlockingForAuthoredOutput({
        code: DiagnosticCode.ColumnChildrenSplitAFixedHeight,
        severity: 'warning'
      } as Diagnostic)
    ).toBe(false);
  });
});
