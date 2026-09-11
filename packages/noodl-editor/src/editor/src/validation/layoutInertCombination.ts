/**
 * DEF-018 (P78 D28) + DEF-020 (P78 D32) — two parent/child layout combinations in which a
 * declared parameter is silently inert, decidable from the graph alone.
 *
 * The neighbouring rules each check one node: `inert-dimension` is a `width` the node's own
 * `sizeMode` switches off, `uncollapsible-multi-column` is a `Group` that cannot do what only a
 * `Columns` can. This module checks the *combination* — each parameter individually valid, the
 * pair wrong on one row — because that is where both register rows lived:
 *
 *  - **`columns-child-keeps-own-width`** (D28): `Columns` hands every child a fixed box
 *    (`column-item`, `flexGrow: 0, flexShrink: 0`, percentage width — `Columns.tsx`) and nothing
 *    clips it. A child whose `sizeMode` is `contentSize`/`contentWidth` keeps its intrinsic width
 *    and ignores that box entirely, so at any width where its content is wider it draws straight
 *    across the next column's content. Measured (`def018-def020-layout-drive.test.ts`): the
 *    members band's own five buttons, the `primaryButton` composition verbatim, overlap by 14px
 *    at 1280×900 — and the overlap appears at *wide* viewports, where auto-fit makes narrow
 *    columns, which is the opposite of where anyone checks.
 *
 *  - **`wired-dimension-becomes-grow`** (FLD-004, #26): a number WIRED into the `width`/`height`
 *    that lies along the parent's own main axis. It arrives as a percentage — dimension ports
 *    declare `defaultUnit: '%'` and `setInputValue` merges a bare number into the port's current
 *    unit — and `layout.ts` turns a percentage on the main axis into `flexGrow`. So the number is
 *    a ratio against growing siblings, not a length, and the box does not move. The reporter's own
 *    sentence: *"the third state — accepted, then silently discarded — is the worst of the three."*
 *    The SAME wire into `width` on the same node works, because a percentage on the cross axis
 *    stays a real CSS length — which is why the discriminator is the axis and not the port.
 *
 *  - **`column-children-split-a-fixed-height`** (FLD-005, #35): two or more children of a column
 *    parent that HAS a definite height, each at the default `100%`. They do not multiply out —
 *    `layout.ts` sets `flex-shrink: 1` on the same branch as `flex-grow` — they take an equal
 *    SHARE, and the share replaces the height their content wanted. Measured
 *    (`fld005ColumnMultipliesOut.test.ts`): five rows of one to five lines in an 800px parent come
 *    back 160px each, and a `card` (which ships `clip: true`) in a 300px parent loses six of its
 *    ten lines off the bottom. 🔴 The parent's definite height is the whole condition: without it
 *    there is no free space, nothing grows, and the issue's own smallest graph renders correctly.
 *
 *  - **`justify-content-distributes-nothing`** (D32): every visual node's `width` defaults to
 *    `100%` (`node-shared-port-definitions.ts`), and `layout.ts` turns a percentage width inside
 *    a `row` parent into `flexGrow`. So growing is what a child of a row does unless something
 *    stops it — and two growing children absorb all the free space a `space-between` was meant
 *    to distribute. Measured: two default Texts split a 1280px row 640/640 with a 0px gap; the
 *    content-sized control shows a 1108px gap. The parameter is not refused, not warned about,
 *    and asked to distribute nothing.
 *
 * ## What each child's sizing is resolved against
 *
 * `resolveAgainstDefaults` over `CatalogIndex.inputDefaults` — DEF-006's evaluator, for
 * DEF-006's reason: the runtime falls back to `port.default`, so a bare
 * `net.noodl.controls.button` (type default `contentSize`) keeps its own width in a Columns just
 * as surely as one stamped by the composition, and answering from the authored bag alone would
 * miss exactly the child most likely to be there. A child whose `sizeMode` or `width` is
 * *connected* is unknowable at authoring time and is skipped — the same abstention every
 * statically-known-only rule here takes.
 *
 * ## Honest limits
 *
 * A component-instance child renders whatever the component renders; its root sizing is not in
 * this graph, so instances are skipped in both directions (an instance whose root is
 * `contentSize` still overlaps its column, and this rule cannot see it). `For Each` children of
 * a `Columns` render through a separate path (`forEachComponents`) and are skipped too. A
 * percentage that arrives as a `var(--token)` string is unknowable and treated as not growing.
 *
 * ## Severity
 *
 * Both **warnings**, deliberately not in `AUTHORED_BLOCKING_WARNINGS` on first ship — the
 * `responsiveArrangement` argument: promotion is earned on evidence of firing correctly against
 * authored output, and the corpus calibration is in this rule's header commit, not a replay.
 * The promotion case is real (both describe output an agent believes it authored and did not
 * get), so the decision is recorded rather than skipped.
 *
 * Pure: the caller supplies nodes, a catalog, and the connected-input set.
 *
 * @module noodl-editor/validation/layoutInertCombination
 */

import type { CatalogIndex } from './CatalogIndex';
import { DiagnosticCode, type Diagnostic } from './diagnostics';
import { isComponentRef } from './model';
import type { ParameterizedNode } from './parameterValues';
import { resolveAgainstDefaults } from './portConditions';
import { COLUMNS_TYPE } from './responsiveArrangement';

/** The one general-purpose container whose `flexDirection` makes a row. */
const GROUP_TYPE = 'Group';

/** `sizeMode` values in which the `width` port is never read and the node keeps intrinsic width. */
const CONTENT_WIDTH_MODES = new Set(['contentSize', 'contentWidth']);

/** `justifyContent` values that exist to distribute free space along the main axis. */
const DISTRIBUTING = new Set(['space-between', 'space-around', 'space-evenly']);

/**
 * What a parent hands its children as `parentLayout` — the prop `layout.ts` branches on.
 *
 * Only these four node types set `props.layout` at all (`react-component-node.ts`'s `setLayout`
 * and its three callers). Everything else — `Columns` above all, whose children go through
 * `column-item` and are D28's business — leaves `parentLayout` undefined, and then `layout.ts`
 * converts NOTHING: both percentage branches are guarded on `parentLayout === 'row'|'column'`.
 * An unlisted parent is unknowable and is skipped, never judged.
 */
const PARENT_MAIN_AXIS: Record<string, 'row' | 'column' | 'fromFlexDirection'> = {
  Group: 'fromFlexDirection',
  Page: 'column',
  Router: 'column',
  'net.noodl.controls.button': 'row'
};

/** The two ports `layout.ts` converts. `maxWidth`/`minWidth`/`maxHeight`/`minHeight` are NOT converted. */
const MAIN_AXIS_PORT = { row: 'width', column: 'height' } as const;

/** `sizeMode` values in which each dimension port is actually read (`Layout.size`). */
const SIZE_MODES_READING: Record<'width' | 'height', ReadonlySet<string>> = {
  width: new Set(['explicit', 'contentHeight']),
  height: new Set(['explicit', 'contentWidth'])
};

/** A node as this check reads it: parameters, plus who it parents. */
export interface LayoutNode extends ParameterizedNode {
  children?: readonly string[] | null;
}

export interface CheckLayoutInertCombinationOptions {
  /** Component identifier for the diagnostics' location. */
  component: string;
  /** Read for `isVisual` and for `inputDefaults` — the runtime's own fallback, per DEF-006. */
  catalog: CatalogIndex;
  /** `"nodeId::portName"` for every wired input; a connected sizing port makes a child unknowable. */
  connectedInputs?: ReadonlySet<string>;
}

/**
 * Whether a resolved `width` value is a percentage — the form `layout.ts` converts to `flexGrow`
 * inside a row. `undefined` means unknowable (a token, an unparseable string), and the caller
 * treats unknowable as not growing: this rule's claims must survive being wrong only in the
 * quiet direction.
 */
export function widthIsPercentage(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number') return true; // dimension ports' defaultUnit is '%', incl. the catalog's own `default: 100`
  if (typeof value === 'object') {
    const unit = (value as { unit?: unknown }).unit;
    if (typeof unit === 'string') return unit === '%';
    return undefined;
  }
  if (typeof value === 'string') {
    if (/^\s*[\d.]+\s*%\s*$/.test(value)) return true;
    if (/^\s*[\d.]+\s*(px|vw|vh)\s*$/.test(value)) return false;
    return undefined;
  }
  return undefined;
}

/**
 * Whether a resolved dimension is the port's own **`100%`** rather than a proportion somebody
 * chose. FLD-005 is about the value nobody looked at: `width` and `height` both declare
 * `default: 100, defaultUnit: '%'`, so a node that says nothing says `100%`.
 *
 * 🔴 An authored `40%` is NOT this defect and must not be reported as one. Measured on the corpus:
 * `Erleah-2`'s login form is an 86vh column holding a `Logo` at `40%` and a `Data input` at the
 * default — the author asked for two-fifths and got 40/(40+100), which is a real mistake about the
 * arithmetic and is `wired-dimension-becomes-grow`'s family of sentence, not this one. Counting it
 * here would make this rule's own message ("sized by the default 100%") false about the node it
 * names, which is the one thing a diagnostic may never be.
 */
function isTheDefaultFullSize(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true; // the port default: 100%
  if (typeof value === 'number') return value === 100;
  if (typeof value === 'object') {
    const v = value as { value?: unknown; unit?: unknown };
    return v.unit === '%' && v.value === 100;
  }
  if (typeof value === 'string') return /^\s*100\s*%\s*$/.test(value);
  return false;
}

interface ResolvedChild {
  node: LayoutNode;
  /** `sizeMode` after the catalog default is merged under the authored bag. */
  sizeMode: string | undefined;
}

/**
 * The children of `parent` whose sizing this rule can know: visual, statically typed, and with
 * neither `sizeMode` nor `width` fed by a wire. Everything else is skipped, not judged.
 */
function knowableChildren(
  parent: LayoutNode,
  byId: Map<string, LayoutNode>,
  catalog: CatalogIndex,
  connected: ReadonlySet<string> | undefined
): ResolvedChild[] {
  const out: ResolvedChild[] = [];
  for (const id of parent.children ?? []) {
    const node = byId.get(id);
    if (!node) continue;
    if (isComponentRef(node.type)) continue;
    const type = catalog.getNode(node.type);
    if (!type?.isVisual) continue;
    if (connected?.has(`${node.id}::sizeMode`) || connected?.has(`${node.id}::width`)) continue;
    const resolved = resolveAgainstDefaults(node.parameters ?? {}, catalog.inputDefaults(node.type));
    const sizeMode = typeof resolved['sizeMode'] === 'string' ? (resolved['sizeMode'] as string) : undefined;
    out.push({ node, sizeMode });
  }
  return out;
}

/** The two exits, in the same sentence as the defect, the way every rule here phrases them. */
const D28_EXIT =
  'Give it sizeMode "contentHeight" with width 100% so the column decides the width and the label decides the height, ' +
  'or sizeMode "explicit" with a width no wider than Min Column Width.';
const D32_EXIT =
  'Give every child that should hug its content sizeMode "contentSize" (or a px width) so free space exists to ' +
  'distribute — or drop justifyContent and let one growing child fill the row.';

/** FLD-005's exit. The first half is what every shipped style composition now does. */
const FLD005_EXIT =
  'Give each child sizeMode "contentHeight" so its height comes from its own content and its width still ' +
  'comes from the column — that is what every composition in the style vocabulary now ships — or take the ' +
  'fixed height off this parent and let the column be as tall as what is in it.';

/** FLD-004's exit, and it is the one the runtime half prints too. */
const FLD004_EXIT =
  'Send a {value, unit} object instead of a bare number (an Expression or Function can build one), or give this ' +
  'port a px value in the property panel first — a bare number arriving over a wire is merged into the unit the ' +
  'port is already holding.';

/**
 * Which axis, if any, `parent` lays its children out along — the `parentLayout` prop `layout.ts`
 * branches on. `undefined` means this parent converts nothing, so nothing here is reportable:
 * a `Group` set to "None" positions its children absolutely, and every type outside
 * `PARENT_MAIN_AXIS` never sets `props.layout` at all.
 */
function parentAxis(parent: LayoutNode, catalog: CatalogIndex): 'row' | 'column' | undefined {
  const declared = PARENT_MAIN_AXIS[parent.type];
  if (declared === undefined) return undefined;
  if (declared !== 'fromFlexDirection') return declared;
  const resolved = resolveAgainstDefaults(parent.parameters ?? {}, catalog.inputDefaults(parent.type));
  const flexDirection = resolved['flexDirection'];
  if (flexDirection === 'row') return 'row';
  if (flexDirection === 'column' || flexDirection === undefined) return 'column';
  return undefined; // "none", or a value the enum does not define
}

/**
 * FLD-004 (#26) — a number wired into the dimension that lies along the parent's own main axis.
 *
 * Reported per child, from the PARENT, because the parent is where the axis is decided and a
 * child does not know who holds it. The abstentions, each one a case where the value is NOT
 * turned into `flexGrow` and the author is owed no message:
 *
 *  - the parent lays out on the other axis, or on no axis at all (see {@link parentAxis});
 *  - the child is out of flow — `layout.ts` requires `position: relative` for the conversion;
 *  - the child's `sizeMode` never reads that port, which is `inert-dimension`'s sentence, not
 *    this one's, and saying both about one port is two repairs for one mistake;
 *  - the port carries an authored value that is NOT a percentage, because then the wire's bare
 *    number merges into THAT unit (`setInputValue`) and arrives as a real length — this is the
 *    exit the message names, so firing on it would contradict the advice;
 *  - the child is a component instance: its root's sizing is not in this graph.
 *
 * 🔴 It fires only on a CONNECTED port. The same percentage written as a parameter is the shipped
 * idiom — `width` and `height` both default to `100%`, and on the main axis that default is how a
 * child fills its parent — so a rule keyed on the value alone reports the whole corpus.
 */
function checkWiredMainAxisDimensions(
  parent: LayoutNode,
  byId: Map<string, LayoutNode>,
  component: string,
  catalog: CatalogIndex,
  connected: ReadonlySet<string> | undefined
): Diagnostic[] {
  const axis = parentAxis(parent, catalog);
  if (!axis) return [];
  const port = MAIN_AXIS_PORT[axis];
  const out: Diagnostic[] = [];

  for (const id of parent.children ?? []) {
    const child = byId.get(id);
    if (!child) continue;
    if (isComponentRef(child.type)) continue;
    if (!connected?.has(`${child.id}::${port}`)) continue;
    const type = catalog.getNode(child.type);
    if (!type?.isVisual) continue;

    const resolved = resolveAgainstDefaults(child.parameters ?? {}, catalog.inputDefaults(child.type));

    // Out of flow: `layout.ts` converts only `position: relative`. A wired `position` is
    // unknowable, and unknowable abstains.
    if (connected?.has(`${child.id}::position`)) continue;
    const position = resolved['position'];
    if (position !== undefined && position !== 'relative') continue;

    // A `sizeMode` that never reads this port is `inert-dimension`'s report, not this one's.
    if (connected?.has(`${child.id}::sizeMode`)) continue;
    const sizeMode = resolved['sizeMode'];
    if (typeof sizeMode === 'string' && !SIZE_MODES_READING[port].has(sizeMode)) continue;

    // The port already holding a non-percentage value is the EXIT, not the defect: the wire's
    // bare number merges into that unit and arrives as a real length.
    if (widthIsPercentage(resolved[port]) === false) continue;

    out.push({
      code: DiagnosticCode.WiredDimensionBecomesGrow,
      severity: 'warning',
      message:
        `"${port}" on this ${child.type} is wired, and the parent stacks its children along that same axis ` +
        `(${axis === 'row' ? 'Layout: Horizontal' : 'Layout: Vertical'}). A bare number arriving here is read as a ` +
        `PERCENTAGE — dimension ports default to "%" — and a percentage on the parent's main axis becomes ` +
        `flex-grow, which is a ratio against the siblings that also grow, not a ${
          axis === 'row' ? 'width' : 'height'
        }. ` +
        `So the value arrives, the connection is live, and the box does not move. ${FLD004_EXIT}`,
      location: {
        component,
        nodeId: child.id,
        nodeType: child.type,
        ...(child.label ? { nodeLabel: child.label } : {}),
        port,
        plug: 'input' as const
      },
      suggestion: `${port}: { "value": 400, "unit": "px" }`
    });
  }

  return out;
}

/**
 * Whether `parent` holds a height this rule can call **definite** — the only circumstance in which
 * `flexGrow` has anything to distribute, and therefore the only circumstance in which FLD-005's
 * defect exists at all.
 *
 * Definite here means stated on the node itself: a `sizeMode` that assigns `style.height`
 * (`explicit` or `contentWidth`) together with a `height` that is NOT a percentage. A height
 * inherited down a chain of explicit ancestors is definite too and is **not** detected — that
 * needs the whole tree and this rule sees one parent, so it abstains, which is the quiet
 * direction. A `Page` is not definite: measured, its content box is sized by its content, and the
 * issue's own smallest graph renders correctly underneath one.
 */
function hasDefiniteHeight(
  parent: LayoutNode,
  catalog: CatalogIndex,
  connected: ReadonlySet<string> | undefined
): boolean {
  if (connected?.has(`${parent.id}::sizeMode`) || connected?.has(`${parent.id}::height`)) return false;
  const resolved = resolveAgainstDefaults(parent.parameters ?? {}, catalog.inputDefaults(parent.type));
  const sizeMode = resolved['sizeMode'];
  if (typeof sizeMode !== 'string' || !SIZE_MODES_READING.height.has(sizeMode)) return false;
  return widthIsPercentage(resolved['height']) === false;
}

/**
 * FLD-005 (#35) — children of a definite-height column sharing it out between them.
 *
 * Reported from the PARENT, once, because the definite height is the parent's fact and the repair
 * is a decision about the column. The abstentions:
 *
 *  - the parent does not lay out on the column axis, or lays out on none (see {@link parentAxis});
 *  - the parent's own height is not definite, which is the majority of every corpus and the state
 *    in which nothing goes wrong — measured, not assumed;
 *  - fewer than two children grow: one child filling a fixed band is the shipped idiom, and is
 *    what `imageGround` is FOR;
 *  - a child whose `sizeMode` never reads `height`, whose `height` is a real length, which is out
 *    of flow, whose sizing is wired, or which is a component instance whose root is not in this
 *    graph;
 *  - a child carrying an authored proportion — `40%`, not `100%`. That author asked for a share
 *    and got a slightly different share; this rule is about the share nobody asked for. See
 *    {@link isTheDefaultFullSize}.
 */
function checkColumnChildrenSplitAFixedHeight(
  parent: LayoutNode,
  byId: Map<string, LayoutNode>,
  component: string,
  catalog: CatalogIndex,
  connected: ReadonlySet<string> | undefined
): Diagnostic[] {
  if (parentAxis(parent, catalog) !== 'column') return [];
  if (!hasDefiniteHeight(parent, catalog, connected)) return [];

  const sharing: LayoutNode[] = [];
  for (const id of parent.children ?? []) {
    const child = byId.get(id);
    if (!child) continue;
    if (isComponentRef(child.type)) continue;
    const type = catalog.getNode(child.type);
    if (!type?.isVisual) continue;
    if (connected?.has(`${child.id}::sizeMode`) || connected?.has(`${child.id}::height`)) continue;
    if (connected?.has(`${child.id}::position`)) continue;

    const resolved = resolveAgainstDefaults(child.parameters ?? {}, catalog.inputDefaults(child.type));
    const position = resolved['position'];
    if (position !== undefined && position !== 'relative') continue;
    const sizeMode = resolved['sizeMode'];
    if (typeof sizeMode !== 'string' || !SIZE_MODES_READING.height.has(sizeMode)) continue;
    if (widthIsPercentage(resolved['height']) !== true) continue;
    // 🔴 Only the port's own 100%. An authored proportion is a different mistake — see
    // {@link isTheDefaultFullSize}.
    if (!isTheDefaultFullSize(child.parameters?.['height'])) continue;
    sharing.push(child);
  }

  if (sharing.length < 2) return [];

  const names = sharing.map((c) => c.label || c.id).join(', ');
  return [
    {
      code: DiagnosticCode.ColumnChildrenSplitAFixedHeight,
      severity: 'warning',
      message:
        `This ${parent.type} has a fixed height and stacks its children (Layout: Vertical), and ${sharing.length} of ` +
        `them (${names}) are sized by the default "100%" — which on the parent's own axis means "grow". They end up ` +
        `with an EQUAL SHARE of the height, not the height of what is inside them: a one-line row and a five-line ` +
        `row come out the same size. Anything taller than its share is not scrolled and not overflowed — a Group ` +
        `with "clip" on simply cuts it off, with nothing reported. ${FLD005_EXIT}`,
      location: {
        component,
        nodeId: parent.id,
        nodeType: parent.type,
        ...(parent.label ? { nodeLabel: parent.label } : {}),
        port: 'height',
        plug: 'input' as const
      },
      suggestion: 'sizeMode: "contentHeight"'
    }
  ];
}

/**
 * DEF-018 + DEF-020 — layout combinations in which a declared parameter does nothing, silently.
 */
export function checkLayoutInertCombination(
  nodes: readonly LayoutNode[],
  options: CheckLayoutInertCombinationOptions
): Diagnostic[] {
  const { component, catalog, connectedInputs } = options;
  const diagnostics: Diagnostic[] = [];
  const byId = new Map<string, LayoutNode>(nodes.map((n) => [n.id, n]));

  for (const node of nodes) {
    // ── FLD-004: a number wired into the child's main-axis dimension ────────
    diagnostics.push(...checkWiredMainAxisDimensions(node, byId, component, catalog, connectedInputs));

    // ── FLD-005: a definite-height column whose children share it out ───────
    diagnostics.push(...checkColumnChildrenSplitAFixedHeight(node, byId, component, catalog, connectedInputs));

    // ── D28: a Columns child that keeps its own width ───────────────────────
    if (node.type === COLUMNS_TYPE) {
      for (const { node: child, sizeMode } of knowableChildren(node, byId, catalog, connectedInputs)) {
        if (!sizeMode || !CONTENT_WIDTH_MODES.has(sizeMode)) continue;
        diagnostics.push({
          code: DiagnosticCode.ColumnsChildKeepsOwnWidth,
          severity: 'warning',
          message:
            `This ${child.type} is sized to its own content (sizeMode "${sizeMode}"), but a Columns hands every ` +
            'child a fixed box and clips nothing — so it keeps its intrinsic width, ignores its column, and when ' +
            'its content is wider it draws straight across the next column. The overlap appears at WIDE viewports, ' +
            `where auto-fit makes the columns narrow. ${D28_EXIT}`,
          location: {
            component,
            nodeId: child.id,
            nodeType: child.type,
            ...(child.label ? { nodeLabel: child.label } : {}),
            port: 'sizeMode',
            plug: 'input' as const
          },
          suggestion: 'sizeMode: "contentHeight"'
        });
      }
      continue;
    }

    // ── D32: a distributing justifyContent with nothing to distribute ───────
    if (node.type !== GROUP_TYPE) continue;
    // Held by equivalence, not by a spec: today no catalog default makes a Group a row or gives
    // any type a distributing justifyContent, so this resolution answers exactly as the authored
    // bag would (the mutant survives). It stays the evaluator anyway so that a future default
    // change is absorbed correctly instead of silently splitting the two answers.
    const resolved = resolveAgainstDefaults(node.parameters ?? {}, catalog.inputDefaults(node.type));
    if (resolved['flexDirection'] !== 'row') continue;
    const justify = resolved['justifyContent'];
    if (typeof justify !== 'string' || !DISTRIBUTING.has(justify)) continue;
    // A wired justifyContent is somebody's runtime decision, not this graph's.
    if (connectedInputs?.has(`${node.id}::justifyContent`)) continue;

    const growing = knowableChildren(node, byId, catalog, connectedInputs).filter(({ node: child, sizeMode }) => {
      if (sizeMode && CONTENT_WIDTH_MODES.has(sizeMode)) return false;
      // An out-of-flow child neither grows nor takes part in distribution (`layout.ts` requires
      // `position: relative` for the percentage→flexGrow conversion).
      const childResolved = resolveAgainstDefaults(child.parameters ?? {}, catalog.inputDefaults(child.type));
      if (childResolved['position'] === 'absolute' || childResolved['position'] === 'sticky') return false;
      // A capped grower leaves real free space behind — `maxWidth` binds as plain CSS, so a
      // child carrying one can stop growing while the row still has room, and there
      // justifyContent DOES distribute. Whether the cap binds depends on values this rule
      // cannot resolve, so a maxWidth child is unknowable, not growing.
      const maxWidth = childResolved['maxWidth'];
      if (
        (maxWidth !== undefined && maxWidth !== null && maxWidth !== '') ||
        connectedInputs?.has(`${child.id}::maxWidth`)
      )
        return false;
      return widthIsPercentage(childResolved['width']) === true;
    });
    if (growing.length < 2) continue;

    const names = growing.map(({ node: c }) => c.label || c.id).join(', ');
    diagnostics.push({
      code: DiagnosticCode.JustifyContentDistributesNothing,
      severity: 'warning',
      message:
        `justifyContent "${justify}" distributes free space, and this row has none: ${growing.length} children ` +
        `(${names}) have a percentage width, which inside a row means "grow" — width defaults to 100%, so growing ` +
        'is what a child of a row does unless something stops it. They absorb the row and split it evenly instead ' +
        `of being pushed apart. ${D32_EXIT}`,
      location: {
        component,
        nodeId: node.id,
        nodeType: node.type,
        ...(node.label ? { nodeLabel: node.label } : {}),
        port: 'justifyContent',
        plug: 'input' as const
      },
      suggestion: 'sizeMode: "contentSize"'
    });
  }

  return diagnostics;
}
