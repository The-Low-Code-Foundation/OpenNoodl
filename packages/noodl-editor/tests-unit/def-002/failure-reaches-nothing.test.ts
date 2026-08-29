/**
 * DEF-002 §2 — in a cloud function, a `Failure` edge that reaches no response.
 *
 * ## 🔴 The arm that matters is the mutant, not the green one
 *
 * This rule's first version (SBR-015's) asked *"does this node reach a
 * Response?"* — true of **every node on a happy path** — so it would have passed
 * the unfixed `publishPage`, the one graph it was written to catch. The green
 * arm did not notice; the mutant did. `grades the failure EDGE, not the node`
 * below is that mutant made permanent: it builds a node that reaches a response
 * along its **success** path and along no other, and requires a finding.
 *
 * ## AC3's pair is real, and it is in the corpus
 *
 * *"`publishPage` as it shipped before SBR-015 is refused by rule 2, and as it
 * ships now is accepted. Two arms, one graph, one wire apart."* Measured on the
 * two projects that hold those two versions: `Test site builder` (before) fires
 * **7** inside `publishPage`; `SBR-015 Zero Section Drive` (after) fires **0**.
 * The shapes below are those two graphs reduced to the wire that separates them.
 *
 * @module noodl-editor/tests-unit/def-002/failure-reaches-nothing
 */
import { failureReachesNothing } from '@noodl-models/../validation/rules/failureReachesNothing';
import { DiagnosticCode } from '@noodl-models/../validation/diagnostics';
import { CatalogIndex } from '@noodl-models/../validation/CatalogIndex';
import { defaultCatalog } from '@noodl-models/../validation/catalog';
import type { NormComponent, NormNode } from '@noodl-models/../validation/model';
import type { RuleContext } from '@noodl-models/../validation/rules/types';

const CATALOG = new CatalogIndex(defaultCatalog());

function node(id: string, type: string, label?: string): NormNode {
  return { id, type, label, children: [], instancePorts: [] } as unknown as NormNode;
}

function wire(fromId: string, fromProperty: string, toId: string, toProperty = 'send') {
  return { fromId, fromProperty, toId, toProperty };
}

function run(component: NormComponent) {
  const ctx = {
    project: { components: [component], componentRefs: new Set<string>() },
    catalog: CATALOG,
    options: {},
    components: [{ component, nodeById: new Map(component.nodes.map((n) => [n.id, n])) }],
    counters: { nodesChecked: 0, endpointsChecked: 0 }
  } as unknown as RuleContext;
  return failureReachesNothing.run(ctx);
}

/**
 * `publishPage`, reduced to the wire AC3 turns on: a request, a worker that can
 * fail, an `Answer` response on the success path, and — only in the fixed arm —
 * a `Could not publish` response on the failure path.
 */
function publishPage(wireTheFailure: boolean): NormComponent {
  return {
    name: '/#__cloud__/publishPage',
    nodes: [
      node('req', 'noodl.cloud.request', 'publishPage'),
      node('work', 'SetDbModelProperties', 'Write the page: mirror + access rules'),
      node('answer', 'noodl.cloud.response', 'Answer'),
      node('refuse', 'noodl.cloud.response', 'Could not publish')
    ],
    connections: [
      wire('req', 'run', 'work'),
      wire('work', 'success', 'answer'),
      ...(wireTheFailure ? [wire('work', 'failure', 'refuse')] : [])
    ]
  } as unknown as NormComponent;
}

describe('DEF-002 §2 — AC3, one graph, one wire apart', () => {
  it('refuses publishPage as it shipped before SBR-015', () => {
    const found = run(publishPage(false));
    expect(found.map((d) => d.code)).toEqual([DiagnosticCode.FailureReachesNothing]);
    expect(found[0].location.nodeId).toBe('work');
    expect(found[0].location.port).toBe('failure');
    expect(found[0].message).toContain('carries no connection at all');
  });

  it('accepts publishPage as it ships now', () => {
    expect(run(publishPage(true))).toEqual([]);
  });
});

describe('DEF-002 §2 — what the rule actually asks', () => {
  /**
   * 🔴 The 14th hole, as a permanent arm. `work` reaches a response — along its
   * SUCCESS path. A rule asking "does this node reach a Response?" accepts this
   * graph, and this graph is the defect.
   */
  it('grades the failure EDGE, not the node', () => {
    const found = run(publishPage(false));
    expect(found).toHaveLength(1);
    // Stated positively so the arm cannot pass by the rule going silent: the
    // node genuinely does reach a response, just not from `failure`.
    const c = publishPage(false).connections;
    expect(c.some((x) => x.fromId === 'work' && x.toId === 'answer')).toBe(true);
  });

  it('refuses a failure wired into a chain that never sends', () => {
    const component = {
      name: '/#__cloud__/publishPage',
      nodes: [
        node('req', 'noodl.cloud.request'),
        node('work', 'SetDbModelProperties', 'Write the page'),
        node('log', 'JavaScriptFunction', 'Note the problem'),
        node('answer', 'noodl.cloud.response', 'Answer')
      ],
      connections: [wire('req', 'run', 'work'), wire('work', 'success', 'answer'), wire('work', 'failure', 'log')]
    } as unknown as NormComponent;
    const found = run(component);
    expect(found.map((d) => d.location.nodeId)).toContain('work');
    expect(found.find((d) => d.location.nodeId === 'work')?.message).toContain('nothing downstream');
  });

  it('accepts a failure that reaches a response through an intermediate node', () => {
    const component = {
      name: '/#__cloud__/publishPage',
      nodes: [
        node('req', 'noodl.cloud.request'),
        node('work', 'SetDbModelProperties', 'Write the page'),
        node('reason', 'JavaScriptFunction', 'Explain the problem'),
        node('answer', 'noodl.cloud.response', 'Answer'),
        node('refuse', 'noodl.cloud.response', 'Could not publish')
      ],
      connections: [
        wire('req', 'run', 'work'),
        wire('work', 'success', 'answer'),
        wire('work', 'failure', 'reason'),
        wire('reason', 'success', 'refuse')
      ]
    } as unknown as NormComponent;
    expect(run(component).map((d) => d.location.nodeId)).not.toContain('work');
  });

  /**
   * 🔴 A response node IS the send: its `failure` says *sending* failed, and
   * requiring that to reach a response is an infinite regress. Measured before
   * it was stated — 67 of the rule's first 249 corpus firings were response
   * nodes, including both of the post-fix `publishPage`'s only two.
   */
  it('says nothing about a response node itself', () => {
    const component = {
      name: '/#__cloud__/publishPage',
      nodes: [node('req', 'noodl.cloud.request'), node('answer', 'noodl.cloud.response', 'Answer')],
      connections: [wire('req', 'run', 'answer')]
    } as unknown as NormComponent;
    expect(run(component)).toEqual([]);
  });

  /**
   * 🔴 `completed` fires whatever the outcome, so one that reaches a response
   * HAS answered the failure path. The site-builder's `submitContactForm` wires
   * `mail.completed -> res.send` for exactly this — *"so a bounced or
   * unconfigured mail service still answers the visitor"* — and DEF-002's own
   * trap names that case as a legitimate unwired `Failure`. Without this arm the
   * rule demanded a repair to the one graph written to honour it.
   */
  it('accepts a node whose completed reaches a response, though its failure is unwired', () => {
    const component = {
      name: '/#__cloud__/submitContactForm',
      nodes: [
        node('req', 'noodl.cloud.request'),
        node('mail', 'noodl.cloud.sendemail', 'Tell the site owner'),
        node('res', 'noodl.cloud.response', 'Answer the visitor')
      ],
      connections: [wire('req', 'receive', 'mail', 'send'), wire('mail', 'completed', 'res')]
    } as unknown as NormComponent;
    expect(run(component)).toEqual([]);
  });

  it('control: the same node with completed reaching nothing IS reported', () => {
    const component = {
      name: '/#__cloud__/submitContactForm',
      nodes: [
        node('req', 'noodl.cloud.request'),
        node('mail', 'noodl.cloud.sendemail', 'Tell the site owner'),
        node('note', 'JavaScriptFunction', 'Log it'),
        node('res', 'noodl.cloud.response', 'Answer the visitor')
      ],
      // No route to `res` around `mail`, so the graph really does hang if the
      // mail path is the one that fails — which is what makes this a control
      // for the `completed` exit rather than for the dominator one below.
      connections: [wire('req', 'receive', 'mail', 'send'), wire('mail', 'completed', 'note')]
    } as unknown as NormComponent;
    expect(run(component).map((d) => d.location.nodeId)).toContain('mail');
  });

  /**
   * 🔴 The narrowing that the site-builder's `submitContactForm` forced, and its
   * control. `compose` has an unwired `failure`; the visitor is still answered
   * through a branch that does not pass through it, so the request does not
   * hang and the rule must not ask for a wire. Remove that branch and the same
   * node is reported.
   */
  it('accepts a node a parallel branch already answers around', () => {
    const component = {
      name: '/#__cloud__/submitContactForm',
      nodes: [
        node('req', 'noodl.cloud.request'),
        node('compose', 'JavaScriptFunction', 'The message body'),
        node('save', 'SetDbModelProperties', 'Store the enquiry'),
        node('res', 'noodl.cloud.response', 'Answer the visitor')
      ],
      connections: [
        wire('req', 'receive', 'compose', 'run'),
        wire('req', 'receive', 'save', 'store'),
        wire('save', 'done', 'res')
      ]
    } as unknown as NormComponent;
    expect(run(component).map((d) => d.location.nodeId)).not.toContain('compose');
  });

  it('control: with the parallel branch gone, the same node IS reported', () => {
    const component = {
      name: '/#__cloud__/submitContactForm',
      nodes: [
        node('req', 'noodl.cloud.request'),
        node('compose', 'JavaScriptFunction', 'The message body'),
        node('save', 'SetDbModelProperties', 'Store the enquiry'),
        node('res', 'noodl.cloud.response', 'Answer the visitor')
      ],
      // The only route to `res` now runs through `compose`.
      connections: [
        wire('req', 'receive', 'compose', 'run'),
        wire('compose', 'done', 'save', 'store'),
        wire('save', 'done', 'res')
      ]
    } as unknown as NormComponent;
    expect(run(component).map((d) => d.location.nodeId)).toContain('compose');
  });

  it('says nothing outside a cloud function, where there is no request to hang', () => {
    const component = {
      name: '/Pages/Home',
      nodes: [node('work', 'SetDbModelProperties', 'Save'), node('resp', 'noodl.cloud.response', 'Answer')],
      connections: []
    } as unknown as NormComponent;
    expect(run(component)).toEqual([]);
  });

  it('says nothing when the function has no response node at all — that is one fault, not one per node', () => {
    const component = {
      name: '/#__cloud__/broken',
      nodes: [node('req', 'noodl.cloud.request'), node('work', 'SetDbModelProperties', 'Save')],
      connections: [wire('req', 'run', 'work')]
    } as unknown as NormComponent;
    expect(run(component)).toEqual([]);
  });

  it('says nothing about a node the catalog gives no failure port', () => {
    const component = {
      name: '/#__cloud__/publishPage',
      nodes: [
        node('req', 'noodl.cloud.request'),
        node('text', 'Text', 'Just a label'),
        node('answer', 'noodl.cloud.response', 'Answer')
      ],
      connections: [wire('req', 'run', 'answer')]
    } as unknown as NormComponent;
    expect(run(component)).toEqual([]);
  });
});
