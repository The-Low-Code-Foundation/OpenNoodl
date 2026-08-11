/**
 * DSG-004 §2.1 — the gate behind doctrine `§7`, the runtime's only responsive
 * mechanism.
 *
 * ## The hole
 *
 * `§7` is the most consequential mechanical sentence in the design doctrine:
 * **a `Group` never responds to width, and there are no media queries or
 * breakpoints anywhere in the runtime except on `net.noodl.visual.columns`.**
 * Nothing checked it. The measured consequence is this phase's whole argument
 * about prose:
 *
 *  - the **author of the doctrine broke it three commits after shipping it** —
 *    `ecommerce-example`, the reference build, arranges its header (3 tracks),
 *    its footer (4), its trust strip (3) and its category row (3) as row
 *    `Group`s, and its featured grid as a wrapped `Group` around a Repeater;
 *  - every cold replay reproduced the shape: sonnet's `InfoStrip` and `Footer`,
 *    haiku's `InfoStrip` and `Footer`, deepseek's `NavBar`;
 *  - `§7` was itself *added* after Richard found the reference build did not
 *    survive a narrow width. The doctrine already knew, and knowing was not
 *    enough.
 *
 * ## Why this is a precondition check and not a `rules/` rule
 *
 * `NormNode` carries `id`, `type`, `label`, `parent`, `children`,
 * `instancePorts`, `metadata` — and **no `parameters`**. "Is this Group a row?"
 * is a question about `flexDirection`, so no rule in `rules/` can ask it, the
 * same reason LAS-001's interface gate and LAS-012's repeater contract live
 * here. The consequence worth stating plainly: this check runs on **authored
 * output only**. `validate:project` cannot see it, so the 107-project corpus
 * numbers below are calibration evidence, not a report anyone will receive.
 *
 * ## Calibration — 107 projects, both corpora, 2026-08-11
 *
 * `measurements/explore-rows.ts` and `explore-bands.ts`. 1,855 `Group` nodes, of
 * which **516 are `flexDirection: "row"`**. A rule that fired on all of them
 * would be useless, so the thresholds were picked from the distribution, not
 * from the doctrine:
 *
 * | Predicate | Hits | Projects |
 * |---|---|---|
 * | row Group, any children | 516 | — |
 * | ≥2 visual children | 402 | 21 |
 * | ≥3 visual children | 110 | 18 |
 * | ≥3 visual children, each a subtree of ≥2 | 27 | 11 |
 * | ≥3 visual children, each a subtree of ≥3 | 19 | 11 |
 * | …and not content-width-sized (**shipped**) | **15** | **9** |
 * | ≥3 visual children, each a subtree of ≥4 | 6 | 5 |
 *
 * Two thresholds rather than one, the way `repeatedSiblingSubtree` uses two: at
 * one child-count threshold alone the rule fires on every icon-and-label row on
 * the machine. The **per-child** floor is what separates a band of cards from a
 * cluster of controls, and it has to be a floor on *every* track rather than on
 * the total — a stepper (`−  1  +`) and a star-rating row are 3 children of 2–3
 * nodes each and total 7–8 nodes, which is indistinguishable from a small band
 * by total size.
 *
 * The **content-width** exclusion is the second half of the same separation, and
 * it is the one that took the false-positive rate to zero on authored output. A
 * band owns the page's width; a cluster is as wide as its contents. Every one of
 * the 4 hits it removed is a legacy control cluster (`Supabase Header`,
 * `filter ratings`, `Symptom Choices Group`, an `agent-chat` toolbar), and every
 * one of the 13 it keeps sets `width: 100%` explicitly.
 *
 * **What the 15 are.** 13 are the defect, inspected one by one: the reference
 * build's four rows and its `ecom-responsive-probe` copy's two, sonnet's two,
 * haiku's two, and deepseek's `NavBar` in three copies of one project. The
 * remaining 2 are hand-built legacy graphs (`big-merge-test-mine`'s "filter on
 * time popup" and a slot-picker row) which neither corpus half ever submits
 * through an authoring gate. **Zero authored false positives measured.**
 *
 * Arm B — the wrapped grid — is calibrated separately and even more sharply: of
 * the 45 row Groups that parent a `For Each`, 36 are legacy chip, pill and
 * carousel lists whose gutter comes from the items themselves, and **3** carry a
 * `columnGap`: `Puppy test 3`'s puppy grid, the reference build's featured grid,
 * and sonnet's product grid. All three are the defect, and `columnGap` is not a
 * proxy invented here — `§7`'s last bullet names it: *"a percentage gap on a
 * wrapped Group is a desktop-only trick and stops being one the moment the
 * layout must collapse."*
 *
 * ## Severity, and the promotion this does not make
 *
 * A **warning**, and deliberately **not** in `AUTHORED_BLOCKING_WARNINGS` yet.
 * The case for blocking is strong — LAS-004 measured warnings being ignored by
 * three models out of three, and rejections carrying a suggestion self-corrected
 * at a 100% rate — but `repeated-sibling-subtree` was promoted on evidence that
 * it had *already* fired correctly on every measured build, and this rule has
 * never run against one. The measurement that decides it is a replay under
 * DSG-006 plus one run of the editor's jasmine suite, neither of which was
 * available to the session that wrote this. See `NOTES-DSG-004.md`.
 *
 * Pure: the caller supplies the nodes and a catalog.
 *
 * @module noodl-editor/validation/responsiveArrangement
 */

import type { CatalogIndex } from './CatalogIndex';
import { DiagnosticCode, type Diagnostic, type Severity } from './diagnostics';
import { isComponentRef } from './model';
import type { ParameterizedNode } from './parameterValues';
import { REPEATER_TYPE } from './repeaterTemplate';

/** The only node in the runtime that responds to width. */
export const COLUMNS_TYPE = 'net.noodl.visual.columns';

/** The one node type this rule judges. `Columns` is the answer, not the defect. */
const GROUP_TYPE = 'Group';

/**
 * How many visual children make an arrangement a multi-column one worth
 * reporting. Three, not the two a flex row technically has: a row of two is a
 * pair — a label beside a value, an icon beside a label — and 304 of the
 * corpus's 516 rows are exactly that.
 */
export const MIN_TRACKS = 3;

/**
 * How many nodes a track must contain before it is a column of content rather
 * than one item in a cluster. See the header: this is the threshold that tells
 * a three-up card band from a stepper.
 */
export const MIN_TRACK_NODES = 3;

/** `sizeMode` values that make a Group as wide as its contents, not as wide as the page. */
const CONTENT_WIDTH_MODES = new Set(['contentWidth', 'contentSize']);

/** A node as this check reads it: parameters, plus who it parents. */
export interface ArrangementNode extends ParameterizedNode {
  children?: readonly string[] | null;
}

export interface CheckResponsiveArrangementOptions {
  /** Component identifier for the diagnostics' location. */
  component: string;
  /** Read for `isVisual`; a type the catalog does not know is not counted as a track. */
  catalog: CatalogIndex;
  /** Severity for both arms. Defaults to `warning`. */
  severity?: Severity;
}

/**
 * The exit, in the doctrine's own words, and in the same sentence as the defect.
 * A rejection without a suggested fix is a rejection a model argues with.
 */
const REPEAT_EXIT =
  'Use a Columns node instead: sizing "autoFit" with a minWidth of 260-320px fits as many columns as will ' +
  'hold that width and reflows on its own, which is the right default for anything fed by a Repeater.';
const FIXED_EXIT =
  'Use a Columns node instead: layoutString ("1 1", "1 1 1", "2 1" for an uneven split) plus smallBreakpoint ' +
  'and smallLayout ("1" under about 700px) so the arrangement collapses to one column on a phone.';

function isVisualType(type: string, catalog: CatalogIndex): boolean {
  // A component instance renders whatever the component renders — and the
  // three-cards-in-a-row case is *made* of them, so they have to count.
  if (isComponentRef(type)) return true;
  return !!catalog.getNode(type)?.isVisual;
}

/** Total nodes in a subtree, counting the root. Cycle-safe: a corrupt graph is not a crash. */
function subtreeSize(id: string, byId: Map<string, ArrangementNode>, seen: Set<string>): number {
  if (seen.has(id)) return 0;
  seen.add(id);
  const node = byId.get(id);
  if (!node) return 0;
  let size = 1;
  for (const child of node.children ?? []) size += subtreeSize(child, byId, seen);
  return size;
}

/**
 * A `Group` that arranges content in more than one column, and therefore cannot
 * collapse.
 *
 * Two arms, both from doctrine `§7`/`§8`, and each with its own calibration:
 *
 *  - **a band of tracks** — a row Group with {@link MIN_TRACKS} or more visual
 *    children, each at least {@link MIN_TRACK_NODES} nodes, that is not sized to
 *    its own contents;
 *  - **a wrapped grid** — a wrapping row Group with a gutter of its own and a
 *    `For Each` under it, which is `§8`'s "a wrapped Group cannot collapse at any
 *    width" exactly.
 *
 * One diagnostic per Group, never one per child: the repair is a single edit to
 * a single node, and three rejections for one row is a repair round spent
 * reading.
 */
export function checkResponsiveArrangement(
  nodes: readonly ArrangementNode[],
  options: CheckResponsiveArrangementOptions
): Diagnostic[] {
  const { component, catalog, severity = 'warning' } = options;
  const diagnostics: Diagnostic[] = [];

  const byId = new Map<string, ArrangementNode>(nodes.map((n) => [n.id, n]));
  const parentOf = new Map<string, string>();
  for (const node of nodes) {
    for (const child of node.children ?? []) parentOf.set(child, node.id);
  }

  const hasColumnsAncestor = (id: string): boolean => {
    const seen = new Set<string>();
    let cursor = parentOf.get(id);
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      if (byId.get(cursor)?.type === COLUMNS_TYPE) return true;
      cursor = parentOf.get(cursor);
    }
    return false;
  };

  for (const node of nodes) {
    if (node.type !== GROUP_TYPE) continue;

    const parameters = node.parameters ?? {};
    // `flexDirection` defaults to `column`, so an unset row is not a thing: an
    // unset Group stacks downward and is already responsive.
    if (parameters['flexDirection'] !== 'row') continue;
    // Already inside the one node that reflows. A generous exclusion, and it
    // costs 12 of the corpus's 516 rows.
    if (hasColumnsAncestor(node.id)) continue;

    const childNodes = (node.children ?? [])
      .map((id) => byId.get(id))
      .filter((n): n is ArrangementNode => !!n);
    const visualChildren = childNodes.filter((c) => isVisualType(c.type, catalog));
    const wraps = parameters['flexWrap'] === 'wrap' || parameters['flexWrap'] === 'wrap-reverse';
    const location = {
      component,
      nodeId: node.id,
      nodeType: node.type,
      ...(node.label ? { nodeLabel: node.label } : {})
    };

    // ── Arm B: a wrapped grid fed by a Repeater ─────────────────────────────
    // Checked first: a wrapped Group around a Repeater is a grid whatever its
    // child count says, and its exit is the autoFit one rather than the
    // layoutString one. `continue` keeps the diagnostic singular.
    const repeaterChild = childNodes.find((c) => c.type === REPEATER_TYPE);
    // `columnGap` only — `Group` declares no `marginX`, and the gutter is what
    // the corpus split on: 3 of the 45 rows that parent a `For Each` set one,
    // and all three are the defect.
    const gutter = parameters['columnGap'];
    if (wraps && repeaterChild && gutter !== undefined && gutter !== null && gutter !== '') {
      diagnostics.push({
        code: DiagnosticCode.UncollapsibleMultiColumn,
        severity,
        message:
          'This Group wraps a Repeater into a grid with its own gutter, and a wrapped Group cannot collapse at ' +
          'any width: a wrapped flex row does not shrink its children, so each item keeps the width it was ' +
          `given and the grid is frozen at the proportions authored for a desktop. ${REPEAT_EXIT}`,
        location: { ...location, port: 'flexWrap', plug: 'input' as const },
        suggestion: 'net.noodl.visual.columns'
      });
      continue;
    }

    // ── Arm A: a band of tracks ─────────────────────────────────────────────
    if (visualChildren.length < MIN_TRACKS) continue;
    // A cluster is as wide as its contents; a band owns the page's width. This
    // is the exclusion that took the authored false-positive rate to zero.
    if (CONTENT_WIDTH_MODES.has(String(parameters['sizeMode']))) continue;

    const trackSizes = visualChildren.map((c) => subtreeSize(c.id, byId, new Set()));
    if (trackSizes.some((size) => size < MIN_TRACK_NODES)) continue;

    diagnostics.push({
      code: DiagnosticCode.UncollapsibleMultiColumn,
      severity,
      message:
        `This Group arranges ${visualChildren.length} columns of content across the page ` +
        `(${trackSizes.join(', ')} nodes each), and a Group never responds to width — there are no breakpoints ` +
        'anywhere in the runtime except on a Columns node, so these columns stay side by side at 390px and each ' +
        `becomes a fraction of its authored width. ${wraps ? REPEAT_EXIT : FIXED_EXIT}`,
      location: { ...location, port: 'flexDirection', plug: 'input' as const },
      suggestion: 'net.noodl.visual.columns'
    });
  }

  return diagnostics;
}
