/**
 * The live-editor half of the lesson condition evaluator.
 *
 * 🔴 WHY THIS IS A SEPARATE FILE, AND WHY A LAZY `require` WAS NOT ENOUGH
 * ----------------------------------------------------------------------
 * UNI-007 moved `ProjectModel` and `NodeGraphContextTmp` out of module scope in
 * `lessonevalconditions.ts` and into a `require` inside the one function that
 * needs them, so the pure evaluator would load in a plain-Node runner. That
 * worked for jest and for `tests-unit/`, and it did not survive contact with the
 * thing it was done for: UNI-010's MCP sidecar is **bundled** by esbuild, and
 *
 * > **a lazy `require` defers execution, not resolution.**
 *
 * A bundler resolves `require('../../models/projectmodel')` wherever it appears,
 * so importing the evaluator from `noodl-mcp` pulled in the node graph, React and
 * `.scss` files, and the build failed. "Loadable in plain Node" and "safe to
 * bundle" are two different properties; the arc's central claim — one evaluator,
 * never forked, reachable from the sidecar — rested on the weaker one.
 *
 * The split restores it properly. `lessonevalconditions.ts` now reaches no editor
 * singleton at all, by any route a bundler can follow, and everything that needs
 * a renderer is here. Same convention, same reason, as
 * `models/lessonwholesolution.live.ts`.
 *
 * ⚠️ **Nothing outside the renderer may import this module.** That is the whole
 * contract; there is no clever import that makes it safe.
 *
 * @module noodl-editor/views/lessons/lessonevalconditions.live
 */

import { evalConditionsWithContext } from './lessonevalconditions';
import type { LessonComponent, LessonCondition, LessonEvalContext, LessonNode } from './lessonevalconditions';
import { ProjectModel } from '../../models/projectmodel';
import { NodeGraphContextTmp } from '../../contexts/NodeGraphContext/NodeGraphContext';

/** Build a context from the live editor singletons. Renderer-only, by nature. */
export function liveLessonEvalContext(): LessonEvalContext {
  const project = ProjectModel.instance as unknown as {
    components: LessonComponent[];
    getRootNode(): LessonNode | undefined;
    getMetaData(key: string): Record<string, unknown> | undefined;
  };
  const activeComponent = NodeGraphContextTmp.nodeGraph?.getActiveComponent?.();

  return {
    components: project.components,
    rootNode: project.getRootNode(),
    getMetaData: (key: string) => project.getMetaData(key),
    viewerPath: (window as unknown as { noodlEditorPreviewRoute?: string }).noodlEditorPreviewRoute,
    activeComponentName: activeComponent?.name
  };
}

/**
 * Legacy entry point used by the lesson layer: evaluate a step's conditions
 * against the live editor. Retains the original default-export signature.
 */
export default function evalConditions(conditions: LessonCondition[]): boolean {
  return evalConditionsWithContext(conditions, liveLessonEvalContext());
}
