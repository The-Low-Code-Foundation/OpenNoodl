/**
 * CN-002 — name the hole.
 *
 * When validation meets a node type it cannot resolve, it does the right thing
 * at the top level: `unknown-node-type` is a **warning**, because real projects
 * legitimately use module-provided nodes the catalog cannot enumerate and
 * erroring on those would cry wolf. That policy is correct and CN-002 does not
 * change it.
 *
 * The defect is what happens next. Every downstream check *skips* such a node —
 * `checkParameterValues` returns on its first line, `nonexistentPort` and
 * `typeIncompatibleConnection` pass over its endpoints — and says nothing. So
 * the checks do not soften for a custom node; they **do not run**, and the
 * result is reported as a pass.
 *
 * Measured on `NodeGX test projects/cashflow-command-centre` before this
 * landed: five kit nodes carrying **26 parameters** verified by nothing, and
 * **10 of the project's 28 connection endpoints** never reached. The report read
 * `0 error(s), 5 warning(s), 0 info`. The summary line does technically leak it
 * — "18 endpoints checked" against 28 in the file — but only to a reader who
 * counts the project's connections by hand first.
 *
 * ## Why the message is worded the way it is
 *
 * A kit node is not wrong; we are uninformed. So the reason is stated as a fact
 * about **our knowledge** — *"type `X` is not in the node catalog"* — and never
 * as a judgement about the node. Getting this backwards would teach authors
 * that using a custom node is an error, which is the opposite of what this
 * phase is for.
 *
 * ## Why one per (node, check) and not per project or per endpoint
 *
 * Per project loses the thing worth knowing — *which* nodes are unverified. Per
 * endpoint is noise: four connections to one unresolvable node are one fact
 * about that node, not four. So each rule dedupes on the node before emitting.
 *
 * ## It is also the instrument that measures CN-003
 *
 * After the project catalog overlay lands, the count of these for a kit project
 * should go to **zero**, and each disappearing line should be replaced by a real
 * result. That is a number taken before and after, which is a far better
 * acceptance signal for CN-003 than "validation seems to work now". Suppressing
 * these without replacing that measurement throws the baseline away.
 *
 * @module noodl-editor/validation/unknownTypeSkip
 */

import { Diagnostic, DiagnosticCode } from './diagnostics';

/**
 * The checks that silently stop at an unresolvable type.
 *
 * Named as the reader would name them, not as the module is named — the whole
 * value of this diagnostic is that it says *what* did not run, and
 * "parameterValues" tells a user nothing. Each string is emitted verbatim into
 * the message.
 */
export const SkippedCheck = {
  /** `checkParameterValues` — value shapes, unknown parameters, the unit-suffix trap. */
  ParameterValues: 'parameter values',
  /** `nonexistentPort` — does each connection endpoint name a port that exists. */
  ConnectionPorts: 'connection port existence',
  /** `typeIncompatibleConnection` — can the source port's type feed the target's. */
  ConnectionTypes: 'connection type compatibility'
} as const;

export type SkippedCheckName = (typeof SkippedCheck)[keyof typeof SkippedCheck];

export interface UnknownTypeSkipParams {
  component: string;
  nodeId: string;
  nodeType: string;
  nodeLabel?: string;
  check: SkippedCheckName;
}

/**
 * One `info` diagnostic: this check did not run on this node, and here is why.
 *
 * `info` never fails anything — that is the point, and it is load-bearing. A CI
 * gate that starts failing after CN-002 means the severity was implemented
 * wrong, not that a project got worse.
 */
export function unknownTypeSkip(params: UnknownTypeSkipParams): Diagnostic {
  const { component, nodeId, nodeType, nodeLabel, check } = params;

  return {
    code: DiagnosticCode.UnknownTypeCheckSkipped,
    severity: 'info',
    message:
      `The "${check}" check did not run on this node: type "${nodeType}" is not in the node catalog, ` +
      'so there is nothing to check it against. The node is unverified by this check rather than ' +
      'verified as correct. If it comes from a module, this is expected today — the catalog is ' +
      'built from built-in node types only.',
    location: {
      component,
      nodeId,
      nodeType,
      ...(nodeLabel ? { nodeLabel } : {})
    }
  };
}
