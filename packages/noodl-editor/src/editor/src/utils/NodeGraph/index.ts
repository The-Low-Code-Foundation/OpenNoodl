import { ComponentModel } from '@noodl-models/componentmodel';
import { NodeGraphNode } from '@noodl-models/nodegraphmodel';
import { RuntimeType } from '@noodl-models/nodelibrary/NodeLibraryData';
import { WORKFLOW_NAME_PREFIX } from '@noodl-models/workflow/workflowPorts';

/**
 * WFA-004's workflow adapter name prefix, re-exported.
 *
 * It moved to `models/workflow/workflowPorts` in WFA-007 (a module with no
 * imports at all) because the proposal diff needs it without dragging the
 * editor in, and a review graph that lost the prefix would leak its model
 * events to the viewer.
 */
export { WORKFLOW_NAME_PREFIX };

export function getComponentModelRuntimeType(node: ComponentModel) {
  // Guard against undefined node (happens on empty projects)
  if (!node) return RuntimeType.Browser;

  const name = node.name;

  if (name.startsWith('/#__cloud__/')) {
    return RuntimeType.Cloud;
  }

  if (name.startsWith(WORKFLOW_NAME_PREFIX)) {
    return RuntimeType.Workflow;
  }

  return RuntimeType.Browser;
}

export const isComponentModel_BrowserRuntime = (node: ComponentModel) =>
  getComponentModelRuntimeType(node) === RuntimeType.Browser;
export const isComponentModel_CloudRuntime = (node: ComponentModel) =>
  getComponentModelRuntimeType(node) === RuntimeType.Cloud;

export function getNodeGraphNodeRuntimeType(node: NodeGraphNode): RuntimeType {
  return node?.owner?.owner?.name?.startsWith('/#__cloud__') ? RuntimeType.Cloud : RuntimeType.Browser;
}
