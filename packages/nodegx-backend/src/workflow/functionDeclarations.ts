/**
 * SB-016 — what endpoints a deployed bundle declares, and what each one says
 * about who may call it.
 *
 * **Extracted, not copied.** `WorkflowRunner` has answered both of these
 * questions since WF-004 (`findRequestNodeForFunction`, `getAvailableFunctions`,
 * `functionAllowsNoAuth`), but only over workflows it has already *loaded* —
 * which happens at service step 5, long after the HTTP server is listening.
 * SB-016's deploy interlock has to answer them at step 1.5, beside the
 * `devOpen` one, so it reads the same files off disk instead.
 *
 * 🔴 **Two readers of one predicate is how a gate starts disagreeing with the
 * thing it gates.** If this module said "endpoint" and the runner said
 * "endpoint" and the two definitions drifted, the interlock would refuse a
 * deploy over a name nothing serves, or — worse — wave through one it does. So
 * the predicate itself lives here once (`findRequestNode`, the `/#__cloud__/`
 * prefix, SB-003's has-a-Request-node rule) and `WorkflowRunner` imports it.
 * `sb016-function-gate-interlock.test.ts` asserts the two agree over a real
 * deployed bundle rather than trusting that they must.
 *
 * SB-003's rule is load-bearing here and is stated once more because the
 * interlock inherits it: a `/#__cloud__/` component **without** a Request node
 * is a *helper*, not an endpoint. It cannot be called over HTTP at all, so it
 * has nothing for a `functions` rule to gate and must not appear in a refusal
 * telling somebody to write one.
 *
 * @module nodegx-backend/workflow/functionDeclarations
 */

import * as fs from 'fs';
import * as path from 'path';

export const CLOUD_COMPONENT_PREFIX = '/#__cloud__/';
export const REQUEST_NODE_TYPE = 'noodl.cloud.request';
export const WORKFLOW_FILE_SUFFIX = '.workflow.json';

/** One endpoint a bundle serves, and the only thing its graph says about access. */
export interface FunctionDeclaration {
  /** The name an HTTP caller uses — the component name minus the cloud prefix. */
  name: string;
  /** Which `*.workflow.json` it came from. */
  workflow: string;
  /**
   * The Request node's `Allow Unauthenticated` port, as the graph declares it.
   *
   * ⚠️ Two values, and the policy a real project needs has three — a privileged
   * endpoint wants `role:admin` and this port cannot say it. That gap is the
   * whole of SB-016; see the task file's §3.
   */
  allowNoAuth: boolean;
}

/** A component as it appears inside an exported workflow bundle. */
interface BundleComponent {
  name: string;
  nodes?: Record<string, unknown>[];
}

/**
 * The Request node anywhere in a component's node tree, or null.
 *
 * Recursive because the export nests children rather than flattening them, and
 * a Request node placed inside a Group is still the component's Request node.
 */
export function findRequestNode(nodes: Record<string, unknown>[]): Record<string, unknown> | null {
  for (const node of nodes) {
    if (node.type === REQUEST_NODE_TYPE) return node;
    const children = node.children as Record<string, unknown>[] | undefined;
    if (Array.isArray(children)) {
      const found = findRequestNode(children);
      if (found) return found;
    }
  }
  return null;
}

/** `allowNoAuth` off a Request node — false for anything that is not literally `true`. */
export function requestNodeAllowsNoAuth(requestNode: Record<string, unknown> | null): boolean {
  if (!requestNode) return false;
  const params = requestNode.parameters as Record<string, unknown> | undefined;
  return params?.allowNoAuth === true;
}

/**
 * Every endpoint one exported bundle declares.
 *
 * `exportData` is the parsed `*.workflow.json`; anything that is not shaped like
 * one yields no endpoints rather than throwing, because a bundle this cannot
 * read is already handled loudly by the loader that reads it for real.
 */
export function declaredFunctionsIn(exportData: unknown, workflowName: string): FunctionDeclaration[] {
  const components = ((exportData as { components?: BundleComponent[] } | null)?.components || []) as BundleComponent[];
  const found: FunctionDeclaration[] = [];
  for (const component of components) {
    if (typeof component?.name !== 'string') continue;
    if (!component.name.startsWith(CLOUD_COMPONENT_PREFIX)) continue;
    const requestNode = findRequestNode(component.nodes || []);
    // SB-003: no Request node = a helper, not an endpoint.
    if (!requestNode) continue;
    found.push({
      name: component.name.slice(CLOUD_COMPONENT_PREFIX.length),
      workflow: workflowName,
      allowNoAuth: requestNodeAllowsNoAuth(requestNode)
    });
  }
  return found;
}

/**
 * Every endpoint the bundles in `workflowsPath` declare, read straight off disk.
 *
 * Synchronous and forgiving by design: it runs inside the startup sequence
 * before anything else has opened these files, and a bundle it cannot parse
 * contributes nothing rather than aborting the scan. That direction is the safe
 * one for *this* caller and only this one — an unreadable bundle yields no
 * endpoints, so the interlock has nothing to complain about, and the loader at
 * step 5 is the thing that reports the broken file. The interlock must never be
 * the reason a corrupt workflow is discovered, and it never is.
 *
 * A missing directory is a backend with no functions deployed, which is most of
 * them, and answers `[]`.
 */
export function scanDeployedFunctions(workflowsPath: string): FunctionDeclaration[] {
  let entries: string[];
  try {
    entries = fs.readdirSync(workflowsPath);
  } catch {
    return [];
  }
  const declarations: FunctionDeclaration[] = [];
  for (const file of entries.filter((f) => f.endsWith(WORKFLOW_FILE_SUFFIX)).sort()) {
    const workflowName = file.slice(0, -WORKFLOW_FILE_SUFFIX.length);
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(workflowsPath, file), 'utf-8'));
      declarations.push(...declaredFunctionsIn(parsed, workflowName));
    } catch {
      // See above: the loader reports it, not the gate.
    }
  }
  return declarations;
}
