/**
 * LAS-012 — the repeater's template contract.
 *
 * ## The hole
 *
 * Haiku's session-6 cold replay of the storefront brief came out
 * **architecturally correct on every axis the phase measures**: 10 components, 7
 * declaring `Component Inputs`, 32 connections, 3 `Columns`, zero instance
 * parameters with nowhere to land — the shape LAS-001…008 were built to produce.
 * And the page draws a header, a hero, an info strip, and then nothing.
 *
 * Three instruments agreed it was fine:
 *
 * | Instrument | What it said |
 * |---|---|
 * | `validate:project` | `0 error(s), 0 warning(s), 0 info — 88 nodes` |
 * | `render_report` | `0 errors, 1 warning` (an unrelated layout floor) |
 * | a node census | `For Each: 3` — indistinguishable from a pass |
 *
 * All three of its `For Each` nodes carry a correct inline `items` array and no
 * `template`. `render:report` on that project counts **0 images** across desktop
 * and phone, on a page whose three repeaters all carry product photography.
 *
 * ## Why this is a precondition check and not a `rules/` rule
 *
 * `NormNode` (`validation/model.ts`) carries `id`, `type`, `label`, `parent`,
 * `children`, `instancePorts`, `metadata` — and **no `parameters`**. A check that
 * reads `parameters.template` cannot be a rule, the same reason LAS-001's
 * interface gate gives in `componentInterface.ts`'s header, and the same reason
 * the other seven preconditions exist.
 *
 * ## What a Repeater actually is
 *
 * Not a container. `addItem` calls `internal.target.addChild(itemNode, index)`
 * where `target` is the repeater's **parent** (`updateTarget(nodeModel.parent.id)`),
 * so item nodes are inserted as the repeater's later siblings, at
 * `parent.getChildren().indexOf(repeater) + 1 + itemIndex`. The `For Each` node
 * has no React component of its own and renders nothing — including anything
 * authored underneath it.
 *
 * That is the second half of the finding, and it is the half the task file
 * missed. Session 6 recorded qwen nesting the item component as a **child** and
 * being rejected (`Node "products-repeater" lists unknown child "product-card"`,
 * an `invalid-argument` hierarchy error carrying no recipe), and recorded haiku
 * as simply omitting `template`. Read off disk, haiku did **both**: all three of
 * its repeaters nest their item content as a child —
 * `/Components/ProductCard`, `/Components/CategoryCard` and a bare `Group`. The
 * two models made the *same* mistake; qwen's was caught only because its child
 * id dangled.
 *
 * ## Calibration
 *
 * `measurements/scan-repeaters.js`, both corpora, 2026-08-08 — 107 legacy
 * projects + 15 v2, **89 `For Each` nodes** in 32 of them:
 *
 *  - **8 without a template.** 3 haiku's, 5 in hand-built QA fixtures
 *    (`Puppy test`, `erg-qa`, `erg003-qa` ×2, `nodegx-debug-demo`). Zero in the
 *    repo, zero among the 12 repeaters in the recipe library — so no F23 repeat
 *    here: the examples all teach the shape the gate wants.
 *  - **0 fed by a connection into `template`.** The population that would have
 *    made this check a nuisance does not exist — but {@link
 *    CheckRepeaterTemplateOptions.connectedInputs} is honoured anyway, because a
 *    check that reports a working list as broken is worse than no check.
 *  - **2 unresolved templates**, both one legacy merge fixture whose components
 *    moved under `/Old/`.
 *  - **3 with children**, all three haiku's. No legitimate use in 89.
 *  - `templateType`: 71 unset, 11 `explicit`, 7 `dynamic` — and all 7 dynamic
 *    ones carry a `templateScript`, so that branch has no measured defect and is
 *    checked only for the empty case.
 *
 * Pure — the caller supplies the nodes and, optionally, which input ports carry
 * a wire.
 *
 * @module noodl-editor/validation/repeaterTemplate
 */

import { DiagnosticCode, type Diagnostic, type Severity } from './diagnostics';
import { isComponentRef, refToPath } from './model';
import type { ParameterizedNode } from './parameterValues';

/** The Repeater's stored type name. `displayNodeName` is "Repeater". */
export const REPEATER_TYPE = 'For Each';

/** How many child types a message will name before it stops being readable. */
const MAX_NAMED_CHILDREN = 6;

/** A node as this check reads it: parameters, plus who it parents. */
export interface RepeaterNode extends ParameterizedNode {
  /** Child node ids, as `nodes.json` stores them. */
  children?: readonly string[] | null;
}

export interface CheckRepeaterTemplateOptions {
  /** Component identifier for the diagnostics' location. */
  component: string;
  /**
   * Every component name a `template` could legitimately name — the project's,
   * the candidate's own, and whatever a plan in flight will create.
   *
   * **Omitted means "do not check resolution"**, the convention `urlPaths`,
   * `backend` and `interfaces` already follow in `authoredPreconditionDiagnostics`:
   * a caller that cannot enumerate the project's components cannot tell a
   * template that names nothing from one whose component it has not read.
   */
  components?: readonly string[];
  /**
   * Input ports carrying a wire, as `` `${nodeId}::${port}` ``. **Omitted means
   * "no connection information"**, and a wired `template` then reads as unset.
   * Zero of the corpus's 89 repeaters are wired this way, but the field exists
   * so that the one that eventually is does not get a hard rejection for it.
   */
  connectedInputs?: ReadonlySet<string>;
  /** Severity for the two non-fatal findings. Defaults to `warning`. */
  severity?: Severity;
}

/** `template` is only live when the node is in explicit mode. */
function isExplicitMode(node: RepeaterNode): boolean {
  const templateType = node.parameters?.['templateType'];
  return templateType === undefined || templateType === null || templateType === 'explicit';
}

function trimmedString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * Turn a nested child into the instruction that promotes it.
 *
 * A component instance is one edit — move the type onto `template` and drop the
 * child. Anything else has to become a component first, and saying so is the
 * difference between an instruction and a complaint.
 */
function describeChildren(childTypes: readonly string[]): { text: string; suggestion?: string } {
  const named = childTypes.slice(0, MAX_NAMED_CHILDREN).map((t) => `"${t}"`).join(', ');
  const more = childTypes.length > MAX_NAMED_CHILDREN ? `, and ${childTypes.length - MAX_NAMED_CHILDREN} more` : '';
  const componentChild = childTypes.find((t) => isComponentRef(t));
  if (componentChild) {
    return {
      text:
        `Set template to ${JSON.stringify(componentChild)} and remove it from the Repeater's children — ` +
        'the same component, named on the port instead of nested.',
      suggestion: componentChild
    };
  }
  return {
    text:
      `Move ${named}${more} into its own component and name that component on template. A Repeater cannot ` +
      'hold item markup; it can only instantiate a component once per item.'
  };
}

/**
 * The repeater contract: a `For Each` names a template component, and holds no
 * children.
 *
 * Three codes, and which fires is decided by the node, not by listing every
 * complaint that applies:
 *
 *  - **no template, with children** → {@link DiagnosticCode.RepeaterWithVisualChildren}
 *    as an **error**. Both facts have one cause — the author believes a Repeater
 *    is a container — and one message that names the child it should promote is
 *    a repair instruction, where two diagnostics is a repair round spent
 *    choosing between them. This is the shape the corpus actually contains.
 *  - **no template, no children** → {@link DiagnosticCode.RepeaterWithoutTemplate},
 *    error.
 *  - **template set** → {@link DiagnosticCode.RepeaterTemplateUnresolved} if it
 *    names no component, plus {@link DiagnosticCode.RepeaterWithVisualChildren}
 *    as a *warning* if it also has children: the list renders, the children are
 *    inert, and that is a different severity of wrong.
 *
 * A `dynamic` repeater is checked only for an empty `templateScript`; its script
 * picks a component per item and no static reading can resolve that.
 */
export function checkRepeaterTemplate(
  nodes: readonly RepeaterNode[],
  options: CheckRepeaterTemplateOptions
): Diagnostic[] {
  const { component, components, connectedInputs, severity = 'warning' } = options;
  const diagnostics: Diagnostic[] = [];

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const known = components
    ? new Set(components.flatMap((name) => [name, refToPath(name)]))
    : undefined;

  for (const node of nodes) {
    if (node.type !== REPEATER_TYPE) continue;

    const childIds = Array.isArray(node.children) ? node.children : [];
    const childTypes = childIds.map((id) => byId.get(id)?.type).filter((t): t is string => typeof t === 'string');
    const location = {
      component,
      nodeId: node.id,
      nodeType: node.type,
      ...(node.label ? { nodeLabel: node.label } : {})
    };

    if (!isExplicitMode(node)) {
      const script = trimmedString(node.parameters?.['templateScript']);
      if (!script && !connectedInputs?.has(`${node.id}::templateScript`)) {
        diagnostics.push({
          code: DiagnosticCode.RepeaterWithoutTemplate,
          severity: 'error',
          message:
            'This Repeater is in Dynamic template mode and its Script is empty, so it picks no component for ' +
            'any item and the list renders nothing. Write a Script that sets `component` to a component path, ' +
            'or set templateType to "explicit" and name one component on template.',
          location: { ...location, port: 'templateScript', plug: 'input' as const }
        });
      }
      continue;
    }

    const template = trimmedString(node.parameters?.['template']);

    if (!template) {
      if (connectedInputs?.has(`${node.id}::template`)) continue;

      if (childTypes.length > 0) {
        const { text, suggestion } = describeChildren(childTypes);
        diagnostics.push({
          code: DiagnosticCode.RepeaterWithVisualChildren,
          severity: 'error',
          message:
            `This Repeater has no template and ${childTypes.length === 1 ? 'a child' : `${childTypes.length} children`} ` +
            'nested under it, so it renders nothing at all. A Repeater is not a container: it instantiates the ' +
            'component named on its template port once per item and inserts each copy as its own next sibling, ' +
            `and anything parented to it never reaches the page. ${text}`,
          location: { ...location, port: 'template', plug: 'input' as const },
          ...(suggestion ? { suggestion } : {})
        });
        continue;
      }

      diagnostics.push({
        code: DiagnosticCode.RepeaterWithoutTemplate,
        severity: 'error',
        message:
          'This Repeater has no template, so it instantiates nothing and its list is absent from the page — ' +
          'items alone are not enough. Set template to the path of the component to create once per item, ' +
          'e.g. "/Components/ProductCard"; that component reads each item through its Component Object.',
        location: { ...location, port: 'template', plug: 'input' as const }
      });
      continue;
    }

    if (known && !template.startsWith('.') && !known.has(template) && !known.has(refToPath(template))) {
      diagnostics.push({
        code: DiagnosticCode.RepeaterTemplateUnresolved,
        severity,
        message:
          `This Repeater's template names ${JSON.stringify(template)}, which is not a component in this ` +
          'project, so every item fails to build and the list is empty. It may have been renamed or moved.',
        location: { ...location, port: 'template', plug: 'input' as const },
        alternatives: [...known].filter((n) => n.startsWith('/')).slice(0, 24)
      });
    }

    if (childTypes.length > 0) {
      const named = childTypes.slice(0, MAX_NAMED_CHILDREN).map((t) => `"${t}"`).join(', ');
      diagnostics.push({
        code: DiagnosticCode.RepeaterWithVisualChildren,
        severity,
        message:
          `This Repeater builds ${JSON.stringify(template)} per item and also has ${named} nested under it. ` +
          'A Repeater renders nothing of its own — it inserts each item copy as its own next sibling — so ' +
          'those children never reach the page. Move them out to the Repeater\'s parent, or delete them.',
        location: { ...location, port: 'template', plug: 'input' as const }
      });
    }
  }

  return diagnostics;
}
