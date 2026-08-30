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
      if ((maxWidth !== undefined && maxWidth !== null && maxWidth !== '') || connectedInputs?.has(`${child.id}::maxWidth`))
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
