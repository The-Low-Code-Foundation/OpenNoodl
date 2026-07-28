/**
 * The canvas adapter for a workflow (WFA-004).
 *
 * There is exactly one canvas and exactly one door into it —
 * `NodeGraphEditor.switchToComponent(component: ComponentModel)` — so a
 * workflow reaches the canvas as a `ComponentModel`. It is **never** handed to
 * `ProjectModel`: `owner` stays undefined, which is the state a component has
 * before it is added to a project and which the codebase already handles
 * everywhere it matters (`evaluateHealth`, `updateTypes` and `ViewerConnection`
 * all check `owner.owner`).
 *
 * This class is an adapter, not a claim that a workflow is a component. A
 * workflow has no ports, cannot be instantiated, is not in the project, is not
 * in version control and is not deployed — see WFA-004-ASSESSMENT §1a.
 *
 * @module models/workflow/WorkflowComponentModel
 */

import { ComponentModel } from '@noodl-models/componentmodel';
import { RuntimeType } from '@noodl-models/nodelibrary/NodeLibraryData';
import { WORKFLOW_NAME_PREFIX } from '@noodl-utils/NodeGraph';

import type { WorkflowGraphModel } from './WorkflowGraphModel';

export function workflowComponentName(workflowId: string): string {
  return WORKFLOW_NAME_PREFIX + workflowId;
}

export class WorkflowComponentModel extends ComponentModel {
  /** The backend whose data directory holds this workflow. */
  public readonly backendId: string;
  public readonly backendName: string;
  public readonly workflowId: string;
  /** The workflow's own display name, which is not derivable from the adapter name. */
  public workflowName: string;

  constructor(args: {
    backendId: string;
    backendName: string;
    workflowId: string;
    workflowName: string;
    graph: WorkflowGraphModel;
  }) {
    super({
      name: workflowComponentName(args.workflowId),
      id: `workflow:${args.backendId}:${args.workflowId}`,
      graph: args.graph
    });

    this.backendId = args.backendId;
    this.backendName = args.backendName;
    this.workflowId = args.workflowId;
    this.workflowName = args.workflowName;
  }

  /**
   * A workflow has no ports.
   *
   * The base implementation derives them from nodes declaring
   * `haveComponentPorts`; no step kind does, so it would return `[]` anyway.
   * Stated explicitly because "it happens to be empty" and "it cannot have any"
   * are different facts, and the second is the one that is true.
   */
  getPorts() {
    return [];
  }

  /**
   * Only workflow step kinds can be created here.
   *
   * `createNodeIndex` calls this for every candidate type, so it is what keeps
   * a Text node out of the picker on a workflow canvas — no filtering code in
   * the picker itself.
   */
  getCreateStatus(args: { parent?: unknown; type: { runtimeTypes?: string[]; graph?: unknown } }) {
    const type = args.type as { runtimeTypes?: string[]; graph?: unknown };

    // A project component (it has a graph) is never a workflow step.
    if (type && type.graph) {
      return { creatable: false, message: 'A workflow runs steps, not component instances.' };
    }

    if (!type || !type.runtimeTypes || !type.runtimeTypes.includes(RuntimeType.Workflow)) {
      return { creatable: false, message: 'Only workflow steps can be added to a workflow.' };
    }

    // Steps are never nested: the DAG is the structure, and `for-each` iterates
    // a function rather than a sub-graph (WF-002's decision, restated in the
    // task's Out of Scope).
    if (args.parent) {
      return { creatable: false, message: 'Workflow steps are not nested — connect them instead.' };
    }

    return { creatable: true };
  }

  /** The title bar reads this; the adapter's own `name` is a namespaced id. */
  get displayName() {
    return this.workflowName || this.workflowId;
  }
}
