/**
 * VFN-009 — reading the project, so `myblocks/usage.ts` does not have to.
 *
 * `myblocks/` owns every rule and no I/O; this file owns the read and no rules, exactly as
 * `MyBlocksShelves.ts` owns the two shelves' persistence and `myblocks/store.ts` owns what may go
 * on them. The split is not tidiness — it is what keeps the usage scan, and therefore the delete
 * refusal and the propagation warning, in a plain-Node runner: this file reaches `ProjectModel`
 * and nothing that imports it can be tested without Electron.
 *
 * ⚠️ **Taken fresh, cached nowhere.** An edit reaches the node model 300 ms after it settles, so a
 * scan taken when a panel opened is already out of date by the time a button on it is pressed.
 * Every caller in this feature calls {@link scanProject} at the moment it needs the answer, and
 * `usage.ts`'s header says why a stored usage index would be the `requires`-cache mistake one
 * level up.
 *
 * @module BlocklyEditor
 */

import { ProjectModel } from '../../models/projectmodel';
import { LOGIC_BUILDER_NODE_TYPE, WORKSPACE_PARAMETER, type ProjectScan, type ScannedNode } from './myblocks/usage';

/**
 * Every Logic Builder node in the project, with the component it lives in.
 *
 * ⚠️ `forEachNode`, **not** `forEachNodeRecursive`. The recursive walk descends through a node
 * whose type is a `ComponentModel` into that component's own graph, so every node inside a reused
 * component would be counted once per place the component is instantiated — a usage count that
 * grows when you drop a second copy of a page. `forEachNode` covers a component's roots and the
 * children of its groups, which is exactly "the nodes in this component" and is what the outer
 * loop over `getComponents()` already visits every component for.
 *
 * A component with no Logic Builder nodes contributes an empty entry rather than being skipped;
 * the scan is a description of the project, and `scanNodeUsage` ignores it either way.
 */
export function scanProject(project = ProjectModel.instance): ProjectScan {
  if (!project) return { components: [] };

  const components = project.getComponents().map((component) => {
    const nodes: ScannedNode[] = [];

    component.forEachNode((node) => {
      if (node.typename !== LOGIC_BUILDER_NODE_TYPE) return;
      nodes.push({
        id: node.id,
        typename: node.typename,
        // `label` falls back to the type's own display name when the author has not named the
        // node, so this is never empty in practice; `usage.ts` still guards it, because a scan
        // assembled by hand (a spec, a future MCP caller) can hand it anything.
        label: node.label,
        workspace: node.parameters?.[WORKSPACE_PARAMETER]
      });
    });

    return {
      id: component.id,
      name: component.displayName,
      // 🔴 Read off the model, never assembled. Component names in this codebase are not
      // leading-slash normalised, so a path built by string surgery is a path that matches nothing.
      path: component.fullName,
      nodes
    };
  });

  return { components };
}

/** The live node with this id, wherever in the project it is. `undefined` when it has gone. */
export function findNodeById(nodeId: string, project = ProjectModel.instance) {
  if (!project) return undefined;

  for (const component of project.getComponents()) {
    let found: TSFixme;
    component.forEachNode((node) => {
      if (node.id === nodeId) {
        found = node;
        return true;
      }
    });
    if (found) return found;
  }

  return undefined;
}
