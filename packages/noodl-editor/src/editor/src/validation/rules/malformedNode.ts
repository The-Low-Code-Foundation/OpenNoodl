/**
 * Rule: every node object carries the fields the graph format requires of a
 * node — currently `type`.
 *
 * FIX-023. This rule exists because of the *second* defect in that report, not
 * the first. The first was that one node object without a `type` reached
 * `isComponentRef(node.type)` and threw
 * `Cannot read properties of undefined (reading 'startsWith')`, taking down
 * every walk over the project. The normalisers now substitute
 * `MALFORMED_NODE_TYPE` so nothing throws — but a crash replaced by silence
 * would be the worse outcome, because the project is still malformed and the
 * node still cannot mount.
 *
 * The bigger defect was that the failure named nothing. The MCP server wrapped
 * it as `io-error: Unexpected failure: Cannot read properties of undefined`,
 * which does not say which node, which component, or even which project — so a
 * user could not act on it and an agent had no string to search for. One node
 * in one component silently disabled the whole project's write surface.
 *
 * So the message here names the node id and the component path **in the message
 * text**, not only in `location`: the location fields are structured data that
 * some consumers render and some drop, and the whole point of this diagnostic
 * is that the identifying detail survives whatever formatting it passes
 * through.
 *
 * ## Why `error`, and why it supersedes `unknown-node-type`
 *
 * `unknown-node-type` is a warning because real projects legitimately use
 * module-provided nodes the catalog cannot enumerate — we are uninformed, the
 * node is not wrong. That reading has no analogue here: the field is absent, so
 * there is nothing for a module to later supply. `unknownNodeType` skips nodes
 * this rule owns, exactly as it defers to `legacyImportPlaceholder`, so a
 * reader never meets `Unknown node type ""` beside this.
 *
 * @module noodl-editor/validation/rules/malformedNode
 */

import { Diagnostic, DiagnosticCode } from '../diagnostics';
import { MalformedNodeReason, refToPath } from '../model';
import { Rule, RuleContext } from './types';

/**
 * What each reason means in the message, phrased as a fact about the file
 * rather than a judgement about the author — the same contract
 * `unknownTypeSkip` states for its own wording.
 */
const REASON_TEXT: Record<MalformedNodeReason, string> = {
  'missing-type': 'has no "type" field'
};

/** The fix to offer, per reason. */
const REASON_FIX: Record<MalformedNodeReason, string> = {
  'missing-type':
    'Every node needs a type — it is what decides how the node is created, drawn and connected. ' +
    'Restore the node\'s type, or delete the node object.'
};

export const malformedNode: Rule = {
  code: DiagnosticCode.MalformedNode,
  description: 'Every node object carries the fields the graph format requires (currently: a type).',
  defaultEnabled: true,

  run(ctx: RuleContext): Diagnostic[] {
    const out: Diagnostic[] = [];
    for (const { component } of ctx.components) {
      for (const node of component.nodes) {
        if (!node.malformed || node.malformed.length === 0) continue;

        const what = node.malformed.map((r) => REASON_TEXT[r]).join(' and ');
        const fix = node.malformed.map((r) => REASON_FIX[r]).join(' ');
        // The component is named in path form as well as verbatim: v2 stores
        // "/Pages/Admin Login" while the registry, the MCP tools and the user
        // all say "Pages/Admin Login", and a reader searching for either
        // should find this line.
        const path = refToPath(component.name);
        out.push({
          code: DiagnosticCode.MalformedNode,
          severity: 'error',
          message:
            `Node "${node.id}" in component "${path}" ${what}. ${fix} ` +
            'Until it is fixed this node is skipped by every other check, and older builds ' +
            'failed the whole project with "Cannot read properties of undefined (reading \'startsWith\')".',
          location: {
            component: component.name,
            nodeId: node.id,
            nodeLabel: node.label
          }
        });
      }
    }
    return out;
  }
};
