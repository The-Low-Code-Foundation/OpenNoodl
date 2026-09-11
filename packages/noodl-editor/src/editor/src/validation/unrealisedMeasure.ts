/**
 * VIB-007 / register **V29** — a shell that declares a measure nothing under it can draw to.
 *
 * Richard, 2026-08-31: *"the wider you go the more the features stretch out in terms of column
 * spacing up to a max and then there's white space to the left and right **equally**… not just on
 * one side, that's weird… the structural page divs have a max width and are centred."*
 *
 * ## 🔴 The row's shape has 13 instances and **one** of them is the defect
 *
 * The register tables this as *"a `maxWidth` on a `Text` inside a centred shell — the measure
 * belongs to the shell"*, and the corpus carries **42** `maxWidth` parameters, **13** of them on a
 * `Text`. A check written to that sentence fires on all 13. `vib007-v29.look.ts` rendered every one
 * of them at 1280 and 1900 and measured, for each, the painted extent of the band it sits in:
 *
 * ```
 *   ui-image-scrim-band   band content   374 left   766 right    asymmetry 392   <-- the defect
 *   the other twelve      band content   374 left   374 right    asymmetry   0
 * ```
 *
 * **Twelve of the thirteen sit in a perfectly symmetric band, and three of those twelve are on
 * `ui-landing-page`** — the page Richard ruled *"it looks fucking pro"*. The one that is asymmetric
 * reproduces his ruling's own numbers exactly. A measure on body copy is *correct typography*; what
 * he ruled against is the white space landing on one side. §9.3 is the cautionary tale this follows:
 * V23's tabled predicate would have condemned five glyphs on that same page.
 *
 * ## What actually separates them, measured rather than reasoned about
 *
 * Both `ui-gradient-hero` and `ui-image-scrim-band` put a `maxWidth: 1200` shell inside a centred
 * full-width band, and fill it with capped `Text`. One renders symmetric and one does not, and the
 * difference is a single node:
 *
 * ```
 *   ui-gradient-hero    shell(1200) > eyebrow  (NO cap) , headline(900), lead(560), actions, stats
 *   ui-image-scrim-band shell(1200) > heading  (760)    , sub(560)
 * ```
 *
 * The uncapped `eyebrow` paints the shell's full 1152px inner width, so the shell's measure is
 * **realised** and the band's content is symmetric about it. `ui-image-scrim-band` has no such
 * child: nothing it contains can ever draw to 1200, so the shell's declared measure is a number that
 * describes nothing, the widest thing drawn is 760, and the band's white space is 374 against 766.
 *
 * 🔴 **So the predicate is not about the `Text` at all — it is about the shell.** *Every* painting
 * child capped narrower than the shell, and nothing centring them. That is the finding, and it is
 * the reason a per-`Text` rule cannot be narrowed into correctness: `ui-landing-page`'s
 * `footer_blurb` is capped at **320** inside a 1900 band and is right, because its band draws to the
 * measure elsewhere.
 *
 * ## The narrowings, each from something read rather than assumed
 *
 * - **Column layouts only.** `flexDirection` defaults to `column`, where the cross axis is the
 *   horizontal one and `alignItems` is what centres. In a `row` the main axis is horizontal and
 *   `justifyContent` centres instead, and children sit side by side — a different geometry that this
 *   was not measured on. `none` positions children absolutely and has no measure to speak of. Both
 *   are skipped rather than guessed at.
 * - **Two ways to centre, and either exempts.** `alignItems: 'center'` on the shell ("where children
 *   sit across the layout direction") and `alignX: 'center'` on the child ("horizontal alignment of
 *   this element within the space its parent gives it"). `ui-empty-state` is the proof the exemption
 *   is needed and is real: its body is capped at 380 inside a centring root and renders **760 left,
 *   760 right** — the most symmetric reading in the whole population.
 * - **px against px only.** A `%` or `vw` cap is relative to the shell and does not describe a
 *   narrower measure; a cap arriving over a connection is a value this check cannot read. Neither
 *   counts as capped, so neither can complete an "every child is capped" verdict.
 * - **A component instance is never capped**, because what it draws is inside it. One such child is
 *   enough to keep this silent, which is the conservative direction.
 *
 * ⚠️ **Not switched on in `catalog:examples`.** The gate runs warnings-as-errors and the corpus's one
 * hit is `ui-image-scrim-band`, whose repair register V29 assigns to **VIB-008** — it is VIB-002's
 * shipped recipe and re-cutting its geometry re-opens a verdict Richard has already given on the
 * rendered page. The check ships at the authoring door, where it costs an author nothing today; the
 * corpus gate can adopt it the moment that band is repaired. Recorded as register **V45**.
 *
 * @module validation/unrealisedMeasure
 */
import { CatalogIndex } from './CatalogIndex';
import { DiagnosticCode, type Diagnostic, type Severity } from './diagnostics';

/** A node as this check reads it. */
export interface MeasureNode {
  id: string;
  type: string;
  label?: string;
  parameters?: Record<string, unknown> | null;
  children?: readonly string[] | null;
}

export interface CheckUnrealisedMeasureOptions {
  /** Component identifier for the diagnostics' location. */
  component: string;
  /** Read for `isVisual` — which children paint, and therefore which ones a measure is about. */
  catalog: CatalogIndex;
  /** `"nodeId::portName"` for every wired input; a connected `maxWidth` is a value this cannot read. */
  connectedInputs?: ReadonlySet<string>;
  /** Severity for these findings. Defaults to `warning`; see {@link DiagnosticCode.UnrealisedMeasure}. */
  severity?: Severity;
}

/** `"/Components/Card"` — an instance of a project component. */
const isComponentRef = (type: string): boolean => type.startsWith('/');

/**
 * A `maxWidth` in pixels, or `undefined` for every other shape.
 *
 * 🔴 Only `px` describes a measure that can be compared against another one. The port's own default
 * unit is `%`, which is relative to the parent and therefore says nothing about whether a child is
 * narrower than the shell it sits in.
 */
function pxCap(parameters: Record<string, unknown> | null | undefined): number | undefined {
  const raw = parameters?.maxWidth;
  if (!raw || typeof raw !== 'object') return undefined;
  const cap = raw as { value?: unknown; unit?: unknown };
  if (cap.unit !== 'px' || typeof cap.value !== 'number' || !Number.isFinite(cap.value)) return undefined;
  return cap.value;
}

/** Whether this node paints, and so whether the shell's measure is about it. */
function paints(type: string, catalog: CatalogIndex): boolean {
  if (isComponentRef(type)) return true;
  return !!catalog.getNode(type)?.isVisual;
}

/**
 * Report every shell whose declared measure no child can draw to.
 *
 * One diagnostic per shell rather than per capped child: the decision is a single one about where
 * the measure belongs, and naming each child would invite removing the caps one at a time.
 */
export function checkUnrealisedMeasure(
  nodes: readonly MeasureNode[],
  options: CheckUnrealisedMeasureOptions
): Diagnostic[] {
  const { component, catalog, connectedInputs, severity = 'warning' } = options;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const diagnostics: Diagnostic[] = [];

  for (const node of nodes) {
    const parameters = node.parameters;
    if (!parameters) continue;
    const shellCap = pxCap(parameters);
    if (shellCap === undefined) continue;

    // Column layouts only — see the module note on why `row` and `none` are skipped rather than
    // guessed at.
    const direction = parameters.flexDirection;
    if (direction !== undefined && direction !== 'column') continue;
    // The shell centres its children: the white space is symmetric whatever they are capped at.
    if (parameters.alignItems === 'center') continue;

    const children = (node.children ?? [])
      .map((id) => byId.get(id))
      .filter((c): c is MeasureNode => !!c && paints(c.type, catalog));
    // 🔴 Cardinality before the verdict: `every()` over an empty list is `true`, which would report
    // every childless capped node in the graph as an unrealised measure.
    if (children.length === 0) continue;

    const capped = children.every((child) => {
      if (isComponentRef(child.type)) return false;
      if (connectedInputs?.has(`${child.id}::maxWidth`)) return false;
      if (child.parameters?.alignX === 'center') return false;
      const childCap = pxCap(child.parameters);
      return childCap !== undefined && childCap < shellCap;
    });
    if (!capped) continue;

    const widest = Math.max(...children.map((c) => pxCap(c.parameters) ?? 0));
    diagnostics.push({
      code: DiagnosticCode.UnrealisedMeasure,
      severity,
      message:
        `This element sets maxWidth ${shellCap}px, but every one of its ${children.length} visual ` +
        `children carries a narrower maxWidth of its own — the widest is ${widest}px. Nothing here ` +
        `can ever draw to ${shellCap}px, so the ${shellCap - widest}px difference becomes white ` +
        'space on ONE side rather than a measure the content is centred in.',
      location: { component, nodeId: node.id, nodeType: node.type, nodeLabel: node.label, port: 'maxWidth' },
      suggestion:
        `Put the measure on this shell and take it off the content: set maxWidth to ${widest}px here ` +
        'and remove the maxWidth from the children, so the shell is the thing that is centred. If ' +
        'the children are meant to be narrower than the shell on purpose, set alignItems to ' +
        '"center" on this element so the leftover width falls equally on both sides.'
    });
  }

  return diagnostics;
}
