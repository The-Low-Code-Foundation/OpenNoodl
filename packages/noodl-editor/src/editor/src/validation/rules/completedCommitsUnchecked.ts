/**
 * Rule: in a cloud function, a `completed` edge that commits a result nothing
 * checked.
 *
 * DEF-004 §4c, AC4. From phase 77 D3.
 *
 * ## What `completed` is, and why wiring it to a commit is a claim
 *
 * `outcome.ts`: *"Fires after every invocation, **whatever the outcome** — wire
 * this to carry on regardless."* It is the one outcome port that cannot mean
 * success. Wired into a **commit** — a record write's `store`, a response's
 * `send` — it therefore writes a fact, or answers a caller, on a run that may
 * have failed. Measured in a shipped template: `publishPage` marked a page
 * `published` after a `Run Tasks` that set no section's access rules, and
 * `duplicatePage` answered with a page id after a section copy that failed.
 *
 * ## 🔴 The rule is NOT "where it lands", and the task file's own version of it
 * would have banned the port
 *
 * DEF-004's AC4 asked for `completed` reaching a record write **or a
 * `noodl.cloud.response.send`** to be refused by name. Measured over the shipped
 * corpus, that predicate refuses `submitContactForm` — the one graph written to
 * honour this task's own trap, whose `mail.completed → res.send` exists so a
 * bounced mail still answers the visitor. SBR-015's template-side gate escapes
 * the contradiction only by also requiring `type === 'RunTasks'`, which is a
 * hand-list wearing a predicate: it cannot see the identical defect from a
 * `sendemail` or a `DbModel2`.
 *
 * So the four shipped instances were compared on every structural axis, and
 * exactly one separates them:
 *
 * | wire | commit? | failure routed to the SAME commit? | |
 * |---|---|---|---|
 * | `publishPage` `RunTasks.completed → Set…​.store` | yes | **no** — sole wire | defect |
 * | `duplicatePage` `RunTasks.completed → response.send` | yes | **no** — sole wire | defect |
 * | `submitContactForm` `sendemail.completed → response.send` | yes | **yes** — `save.failure`, `stored.failure` | correct |
 * | `ContactRecipient` `secret.completed → JavaScriptFunction.run` | **no** | — | correct |
 *
 * That is a principled difference, not a coincidence of this corpus. Where a
 * failure route reaches the same commit, the author **has** enumerated the bad
 * outcomes and `completed` is genuinely the "carry on regardless" leg the port
 * is for. Where nothing does, `completed` is not a supplementary path — it is
 * the author's only exit, used as if it meant success. `submitContactForm` is
 * the proof: its `received` flag is set by `stored`, which runs on
 * `save.done`, so `received: true` means *the message was stored* and a bounced
 * mail does not make it false.
 *
 * ## Not a duplicate of `failureReachesNothing` — measured, not assumed
 *
 * *A check in a second pipeline is a duplicate first*, so this was run against
 * the real pre-SBR-015 graphs before it was written. `failureReachesNothing`
 * fires there on `prep`, `prep-2` and `afterCopy` — the `JavaScriptFunction`
 * nodes — and **never on the `RunTasks` that carries the `completed` wire**,
 * because `prep.out-pageId → res.pm-pageId` answers the caller without passing
 * through it, so `answeredWithout` excuses it.
 *
 * The two rules ask different questions and this one covers the hole in the
 * other: `failureReachesNothing` asks *is the caller answered at all* — a
 * 30-second hang. This defect answers the caller perfectly well, with a lie.
 *
 * ## Scope: only inside a cloud function
 *
 * Same boundary as `failureReachesNothing`, for the same reason and one more.
 * A cloud function's commit is the durable record of a request that has no
 * person watching it; a browser-side `store` fired on `completed` is in front of
 * somebody who can see it did not work. The browser population is also large and
 * uncalibrated, and widening a rule past the population it was measured on is
 * how a checker's first finding becomes about the checker.
 *
 * ⚠️ **`noodl.cloud.sendemail`'s `send` is deliberately NOT a commit**, though it
 * is a signal input spelled the same. Sending a mail is an action whose failure
 * is its own and is reported on its own ports; it asserts no fact about the work
 * upstream. This rule is about a **claim** — a record written, or a caller told
 * the request succeeded. Named here rather than left to the reader because the
 * port name collides and a future reader will wonder.
 *
 * Warning severity, matching `failureReachesNothing`: advisory over
 * hand-authored projects, and an `AUTHORED_BLOCKING_WARNINGS` entry makes it
 * blocking for a graph an agent just wrote.
 *
 * @module noodl-editor/validation/rules/completedCommitsUnchecked
 */

import { Diagnostic, DiagnosticCode } from '../diagnostics';
import { Rule, RuleContext } from './types';

export const CLOUD_REQUEST_TYPE = 'noodl.cloud.request';

/**
 * The outcome ports, spelled here rather than imported from `noodl-runtime`'s
 * `outcome.ts` for the same reason `unwiredOutcome` and `failureReachesNothing`
 * spell theirs: the validation layer does not depend on the runtime.
 */
const COMPLETED_PORT = 'completed';

/**
 * The ports that route a **bad** outcome. `error` is deliberately absent: it is
 * a `string` output carrying a message, not a signal, so it routes no control
 * and cannot reach a commit.
 */
const NEGATIVE_OUTCOME_PORTS = new Set(['failure', 'unchanged']);

/**
 * A commit: the (node type, signal input) pairs at which a cloud function makes
 * a claim that outlives the request.
 *
 * Each carries the reason it is one, and each is checked against the catalog at
 * run time — a typo here would silently disable the rule rather than fail, and
 * `the population is part of the checker`.
 */
export const COMMIT_PORTS: ReadonlyArray<{ type: string; port: string; why: string }> = [
  { type: 'NewDbModelProperties', port: 'store', why: 'a record is created' },
  { type: 'SetDbModelProperties', port: 'store', why: 'a record is updated' },
  { type: 'DeleteDbModelProperties', port: 'store', why: 'a record is deleted' },
  { type: 'noodl.cloud.response', port: 'send', why: 'the caller is told the request succeeded' }
];

export const completedCommitsUnchecked: Rule = {
  code: DiagnosticCode.CompletedCommitsUnchecked,
  description: 'In a cloud function, no `completed` edge commits a result nothing checked.',
  defaultEnabled: true,

  run(ctx: RuleContext): Diagnostic[] {
    const out: Diagnostic[] = [];

    /**
     * The commit surface, narrowed to what the catalog actually carries. A pair
     * whose port is not a signal input on that type is dropped rather than
     * trusted — see the note on `COMMIT_PORTS`.
     */
    const commitPort = new Map<string, string>();
    for (const { type, port } of COMMIT_PORTS) {
      const declared = ctx.catalog.getPort(type, 'input', port);
      if (declared) commitPort.set(type, port);
    }
    if (commitPort.size === 0) return out;

    for (const { component, nodeById } of ctx.components) {
      if (!component.nodes.some((n) => n.type === CLOUD_REQUEST_TYPE)) continue;

      const outgoing = new Map<string, Array<{ port: string; to: string; toPort: string }>>();
      for (const c of component.connections) {
        const edge = { port: c.fromProperty, to: c.toId, toPort: c.toProperty };
        const list = outgoing.get(c.fromId);
        if (list) list.push(edge);
        else outgoing.set(c.fromId, [edge]);
      }

      /**
       * Every commit a bad outcome can reach, as `nodeId\0port` keys.
       *
       * ⚠️ `\0` is the separator, not a space, and it is the house idiom —
       * `author.ts` keys connections `${fromId}\0${fromProperty}\0…`,
       * `unlabelledNode.ts` uses `'\0root'`. A node id or a derived port name
       * may contain a space (`pm-Some Param`), and two different pairs must
       * never collapse to one key. Written as the `\0` **escape** rather than a
       * literal NUL byte, which is what those files hold: a literal one makes
       * `grep` call the whole file binary and skip it silently, and this comment
       * exists because that cost a mutation run before it was understood.
       *
       * ⚠️ Reachability is deliberately generous, in the same direction and for
       * the same reason as `failureReachesNothing`: from the far end of a
       * `failure` or `unchanged` wire it follows *every* outgoing connection,
       * not only signals. A superset of what the runtime would really run can
       * only make this rule **accept** a graph it might have refused. For a rule
       * whose whole risk is crying wolf on a shape an author chose deliberately,
       * that is the direction to be wrong in.
       */
      const commitsAFailureReaches = new Set<string>();
      {
        const seen = new Set<string>();
        const queue: string[] = [];
        for (const c of component.connections) {
          if (!NEGATIVE_OUTCOME_PORTS.has(c.fromProperty)) continue;
          commitsAFailureReaches.add(`${c.toId}\0${c.toProperty}`);
          if (!seen.has(c.toId)) {
            seen.add(c.toId);
            queue.push(c.toId);
          }
        }
        while (queue.length > 0) {
          const id = queue.shift() as string;
          for (const edge of outgoing.get(id) ?? []) {
            commitsAFailureReaches.add(`${edge.to}\0${edge.toPort}`);
            if (seen.has(edge.to)) continue;
            seen.add(edge.to);
            queue.push(edge.to);
          }
        }
      }

      for (const c of component.connections) {
        if (c.fromProperty !== COMPLETED_PORT) continue;
        const target = nodeById.get(c.toId);
        if (!target) continue;
        if (commitPort.get(target.type) !== c.toProperty) continue;
        if (commitsAFailureReaches.has(`${c.toId}\0${c.toProperty}`)) continue;

        const source = nodeById.get(c.fromId);
        const sourceLabel = source ? (source.label ? `"${source.label}"` : source.type) : c.fromId;
        const targetLabel = target.label ? `"${target.label}"` : target.type;
        const claim =
          target.type === 'noodl.cloud.response'
            ? 'the caller is told the request succeeded'
            : 'a record is written saying the work was done';

        out.push({
          code: DiagnosticCode.CompletedCommitsUnchecked,
          severity: 'warning',
          message:
            `${sourceLabel}'s Completed output is the only thing that reaches ${targetLabel}'s ` +
            `${c.toProperty}, and Completed fires after every invocation whatever the outcome. So when ` +
            `${sourceLabel} fails, ${claim} anyway — and nothing in this component routes a Failure to ` +
            `that same ${c.toProperty}. Wire Done instead if the commit depends on the work having ` +
            'succeeded, and give Failure its own path.',
          location: {
            component: component.name,
            nodeId: c.fromId,
            nodeType: source?.type,
            nodeLabel: source?.label,
            port: COMPLETED_PORT,
            plug: 'output',
            connection: { fromId: c.fromId, fromProperty: c.fromProperty, toId: c.toId, toProperty: c.toProperty }
          },
          suggestion:
            `Connect ${sourceLabel}'s Done output to ${targetLabel}'s ${c.toProperty} instead, and wire its ` +
            'Failure to a noodl.cloud.response with status "failure". Keep Completed only where the next ' +
            'step is correct whether or not this one worked.'
        });
      }
    }

    return out;
  }
};
