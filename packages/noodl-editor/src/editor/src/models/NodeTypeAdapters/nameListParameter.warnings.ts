/**
 * AIB-001 slice 3 — `parseNameList`, filed against the node it is about.
 *
 * Separate from the rule itself because `WarningsModel` reaches
 * `ProjectModel`/`ComponentModel` and the rule does not: keeping the decision
 * pure is what lets it be tested without an editor, and the six call sites all
 * want the reporting, so this is what they import.
 *
 * @module noodl-editor/models/NodeTypeAdapters/nameListParameter.warnings
 */

import { parseNameList } from './nameListParameter';
import { WarningsModel } from '../warningsmodel';

/** Enough of a `NodeGraphNode` to read a parameter and locate a warning. */
interface NodeLike {
  parameters?: Record<string, unknown>;
  owner?: { owner?: unknown };
}

const WARNING_KEY = 'parameter-wire-format';

/**
 * A node's `stringlist` parameter as its list of names, with any off-format
 * value reported against the node in the warnings panel the author already
 * watches — and, above all, never thrown.
 */
export function readNameList(node: NodeLike, parameterName: string): string[] {
  const { names, problem } = parseNameList(node.parameters?.[parameterName], parameterName);
  // A guard that crashes while reporting a crash is worse than the crash: these
  // run during project load, before the warnings model necessarily has a
  // component to file against.
  try {
    WarningsModel.instance.setWarning(
      { component: node.owner?.owner, node, key: `${WARNING_KEY}-${parameterName}` },
      problem ? { level: 'warning', message: problem } : undefined
    );
  } catch {
    /* the port list is the job; the warning is the courtesy */
  }
  return names;
}
