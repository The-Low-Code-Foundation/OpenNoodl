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
import type {
  LessonComponent,
  LessonCondition,
  LessonDatabaseSnapshot,
  LessonEvalContext,
  LessonNode
} from './lessonevalconditions';
import { ProjectModel } from '../../models/projectmodel';
import { NodeGraphContextTmp } from '../../contexts/NodeGraphContext/NodeGraphContext';

/**
 * Build a context from the live editor singletons. Renderer-only, by nature.
 *
 * 🔴 **`database` is a parameter and not a read, and that is the whole shape of TUT-002.** The
 * graph is already in memory and can be sampled synchronously; the database is over a wire and
 * cannot. So the caller — which is the one that can `await` — reads it with
 * `liveLessonDatabaseSnapshot()` and hands it in, and `evalConditionsWithContext` stays
 * synchronous for all fifteen verbs.
 *
 * Omitting it is *not* the same as passing an empty snapshot: absent means nobody looked, and
 * every collection verb treats it as unproven rather than as "no collections". See
 * {@link databaseRefusal}, which turns that into a sentence.
 */
export function liveLessonEvalContext(database?: LessonDatabaseSnapshot): LessonEvalContext {
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
    activeComponentName: activeComponent?.name,
    ...(database ? { database } : {})
  };
}

/**
 * Legacy entry point used by the lesson layer: evaluate a step's conditions
 * against the live editor. Retains the original default-export signature.
 *
 * `database` is optional for the same reason it is above: the lesson layer's `refresh()` is
 * synchronous and re-runs on every graph change, so it keeps the last snapshot it read and
 * passes it in rather than reading one here.
 */
export default function evalConditions(conditions: LessonCondition[], database?: LessonDatabaseSnapshot): boolean {
  return evalConditionsWithContext(conditions, liveLessonEvalContext(database));
}
