import { ComponentModel } from '@noodl-models/componentmodel';
import { NodeGraphNode } from '@noodl-models/nodegraphmodel';
import { RuntimeType } from '@noodl-models/nodelibrary/NodeLibraryData';

/**
 * WFA-004: the prefix a workflow's canvas adapter is named with.
 *
 * It echoes the `/#__cloud__/` sheet prefix so the runtime type still resolves
 * from the name, but it is NOT a project sheet — nothing named with it is in
 * `ProjectModel`. See WFA-004-ASSESSMENT §1b.
 */
export const WORKFLOW_NAME_PREFIX = '/#__workflow__/';

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
