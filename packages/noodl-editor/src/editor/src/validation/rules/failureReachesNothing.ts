/**
 * Rule: in a cloud function, a `Failure` edge that reaches no response.
 *
 * DEF-002 §2, from phase 77 D1.
 *
 * ## Why this is not a degraded result but a hang
 *
 * A cloud function's request ends only when something **sends**. A node whose
 * `Failure` fires into nothing therefore does not produce a worse answer — it
 * produces **no answer**, and the caller waits out its timeout. Measured:
 * `publishPage` and `duplicatePage` shipped in a real template with **zero**
 * failure wires between them, and a zero-section publish took **30,004 ms** to
 * return nothing. The same shape was observed again on `/Admin/PageRow`, where
 * three `CloudFunction2` nodes wire `done` and no `failure` and the admin sees
 * nothing at all for 47 seconds.
 *
 * ⚠️ The runtime half is already done and is not the gap. NDA-012 / ERG-001 made
 * every node **report** on its outcome ports. **A node that reports perfectly
 * into an unwired port is exactly as silent as one that never reported.**
 *
 * ## 🔴 Grade the EDGE, not the node — this rule's first version was the 14th
 * gate with a hole shaped like its own defect
 *
 * SBR-015's first attempt asked *"does this node reach a Response?"*. That is
 * true of **every node on a happy path**, so it would have passed the unfixed
 * `publishPage` — the graph it was written to catch. The mutant caught it; the
 * green arm did not. So the question here is asked of the `failure` **port**:
 * follow the wires that leave it, and ask whether *those* reach a response.
 *
 * That single predicate covers both shapes without a second clause, which is the
 * reason to phrase it this way rather than as "is `failure` wired":
 *
 *  - `failure` carries **no** wire → the reachable set is empty → no response;
 *  - `failure` is wired into a chain that never sends → also no response.
 *
 * ⚠️ **Reachability is deliberately generous.** From the far end of a failure
 * wire it follows *every* outgoing connection, not only signals, and stops at
 * nothing. A superset of what the runtime would actually run can only make this
 * rule **accept** a graph it might have refused — never refuse a working one.
 * For a rule whose whole risk is crying wolf on a shape an author chose, that is
 * the direction to be wrong in.
 *
 * ## Scope: only inside a cloud function
 *
 * The component must hold a `noodl.cloud.request`. Outside one there is no
 * response to reach and no request to hang: a browser-side node whose `failure`
 * goes nowhere is a missing message, which is a different and much weaker
 * finding. The two legitimate unwired-`Failure` shapes this task recorded — an
 * unprovisioned secret that must still reach the picker, a bounced mail that
 * must still answer the visitor — are both about *where the edge lands*, and
 * both are answered by asking for a response rather than for a wire.
 *
 * Warning severity, and deliberately not an error: the population is
 * hand-authored templates, and `AUTHORED_BLOCKING_WARNINGS` is the seam that
 * makes it blocking for a graph an agent just wrote while staying advisory for
 * a project somebody imported.
 *
 * @module noodl-editor/validation/rules/failureReachesNothing
 */

import { Diagnostic, DiagnosticCode } from '../diagnostics';
import { Rule, RuleContext } from './types';

export const CLOUD_REQUEST_TYPE = 'noodl.cloud.request';
export const CLOUD_RESPONSE_TYPE = 'noodl.cloud.response';

/**
 * The outcome port this rule is about.
 *
 * Spelled here rather than imported from `noodl-runtime`'s `outcome.ts` for the
 * same reason `unwiredOutcome` spells its four: the validation layer does not
 * depend on the runtime.
 */
const FAILURE_PORT = 'failure';

/**
 * 🔴 The port that answers a failure without being one.
 *
 * `outcome.ts`: *"Fires after every invocation, **whatever the outcome** — wire
 * this to carry on regardless."* So a node whose `completed` reaches a response
 * **has** answered its failure path, and asking its `failure` to reach one too
 * is asking for a second answer to a request that can only be answered once.
 *
 * ⚠️ Learned the hard way, from the graph the task file itself cites: the
 * site-builder's `submitContactForm` wires `mail.completed → res.send` with the
 * comment *"so a bounced or unconfigured mail service still answers the
 * visitor"*, and DEF-002's own trap names that case — *"a bounced mail must
 * still answer the visitor"* — as a **legitimate** unwired `Failure`. Without
 * this, the rule demanded a repair to the one graph written to honour it.
 */
const COMPLETED_PORT = 'completed';

export const failureReachesNothing: Rule = {
  code: DiagnosticCode.FailureReachesNothing,
  description: 'In a cloud function, every Failure edge reaches a Response.',
  defaultEnabled: true,

  run(ctx: RuleContext): Diagnostic[] {
    const out: Diagnostic[] = [];

    for (const { component, nodeById } of ctx.components) {
      const isCloudFunction = component.nodes.some((n) => n.type === CLOUD_REQUEST_TYPE);
      if (!isCloudFunction) continue;

      const responses = new Set(component.nodes.filter((n) => n.type === CLOUD_RESPONSE_TYPE).map((n) => n.id));
      // A cloud function with no response at all cannot answer any path, which
      // is a whole-component fault rather than one per failure edge. Reporting
      // it here would be one diagnostic per node for a single missing node.
      if (responses.size === 0) continue;

      const outgoing = new Map<string, Array<{ port: string; to: string }>>();
      for (const c of component.connections) {
        const list = outgoing.get(c.fromId);
        if (list) list.push({ port: c.fromProperty, to: c.toId });
        else outgoing.set(c.fromId, [{ port: c.fromProperty, to: c.toId }]);
      }

      /** Whether anything downstream of `start` is a response node. */
      const reachesResponse = (start: string): boolean => {
        const seen = new Set<string>([start]);
        const queue = [start];
        while (queue.length > 0) {
          const id = queue.shift() as string;
          if (responses.has(id)) return true;
          for (const edge of outgoing.get(id) ?? []) {
            if (seen.has(edge.to)) continue;
            seen.add(edge.to);
            queue.push(edge.to);
          }
        }
        return false;
      };

      const requests = component.nodes.filter((n) => n.type === CLOUD_REQUEST_TYPE).map((n) => n.id);

      /** Whether some response is reachable from a request without passing through `skip`. */
      const answeredWithout = (skip: string): boolean => {
        const seen = new Set<string>([skip]);
        const queue = requests.filter((id) => id !== skip);
        for (const id of queue) seen.add(id);
        while (queue.length > 0) {
          const id = queue.shift() as string;
          if (responses.has(id)) return true;
          for (const edge of outgoing.get(id) ?? []) {
            if (seen.has(edge.to)) continue;
            seen.add(edge.to);
            queue.push(edge.to);
          }
        }
        return false;
      };

      for (const node of component.nodes) {
        // 🔴 A response node IS the send, so its own `failure` cannot be
        // answered by reaching a response — that would be an infinite regress.
        // What its `failure` reports is that *sending* failed, which no graph
        // can recover from. Measured before it was stated: without this, the
        // rule fired 249 times across the corpus, 67 of them on response nodes,
        // including both arms of its own acceptance pair — the post-SBR-015
        // `publishPage`'s only two firings were its `Answer` and
        // `Could not publish` nodes. **A new checker's first finding is about
        // the checker.**
        if (node.type === CLOUD_RESPONSE_TYPE) continue;
        // The node must actually have a `failure` port to be missing one. The
        // catalog is the authority; a type it does not know is skipped, the way
        // every rule here skips what it cannot see.
        if (!ctx.catalog.getPort(node.type, 'output', FAILURE_PORT)) continue;

        // 🔴 The request hangs only if this node stands on EVERY route to a
        // response. Where another branch of the graph still answers, a failure
        // here costs the work, not the reply — and demanding a wire would be
        // asking the author to answer a request that is already answered.
        //
        // ⚠️ This is NOT the 14th hole in disguise. That mutant asked *"does
        // this node reach a response"*, which is true of every node on a happy
        // path. This asks the opposite: *"is a response reachable WITHOUT it"* —
        // and on the pre-SBR-015 `publishPage` the answer is no (the one worker
        // is the only route), so that arm still fires.
        //
        // Measured on the graph that forced it: `submitContactForm`'s `compose`
        // has an unwired `failure`, and the visitor is still answered through
        // `recipient → save → stored → mail → res`, which does not pass through
        // it. The rule was asking for a repair to a correct graph.
        if (answeredWithout(node.id)) continue;
        const edges = outgoing.get(node.id) ?? [];
        // `completed` fires whatever the outcome, so one that reaches a response
        // answers the failure path. Checked first because it is the cheaper and
        // the more definite of the two exits.
        if (edges.some((e) => e.port === COMPLETED_PORT && reachesResponse(e.to))) continue;
        const failureEdges = edges.filter((e) => e.port === FAILURE_PORT);
        if (failureEdges.some((e) => reachesResponse(e.to))) continue;

        const label = node.label ? `"${node.label}"` : node.type;
        const wiring =
          failureEdges.length === 0
            ? 'its Failure output carries no connection at all'
            : 'nothing downstream of its Failure output sends a response';

        out.push({
          code: DiagnosticCode.FailureReachesNothing,
          severity: 'warning',
          message:
            `${label} can fail, and ${wiring}. A cloud function's request ends only when something sends: ` +
            'on this path nothing does, so the caller does not get an error — it gets no answer at all, and ' +
            'waits out its timeout (measured at 30 seconds). Wire Failure to a Response node with status ' +
            '"failure" so the caller is told what went wrong.',
          location: {
            component: component.name,
            nodeId: node.id,
            nodeType: node.type,
            nodeLabel: node.label,
            port: FAILURE_PORT,
            plug: 'output'
          },
          suggestion:
            'Add a noodl.cloud.response node with status "failure" and an errorMessage, and connect this ' +
            "node's Failure output to its Send input."
        });
      }
    }

    return out;
  }
};
