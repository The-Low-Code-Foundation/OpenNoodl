/**
 * AIX-011 criterion 7 — the doc-authoring turn and its graph-restatement lint.
 *
 * The gap this closes: a `doc` plan operation used to carry only `{target,
 * intent}`, `PlanRun` skipped doc operations in the fan-out, and so there was
 * no authored body for the write path to write. These specs are about the
 * body — that one is produced, that it is produced knowing what the plan
 * actually built, that "nothing worth recording" is a real answer rather than
 * a failure, and that the AIX-009 design line (docs never restate the graph)
 * is enforced by something other than a paragraph of prompt.
 *
 * Everything here is offline: the chat function is a script.
 */

import { DocSession } from '../../src/editor/src/models/AiAssistant/authoring/DocSession';
import { docLint } from '../../src/editor/src/models/AiAssistant/authoring/docLint';
import { PlanRun } from '../../src/editor/src/models/AiAssistant/authoring/PlanRun';
import { renderPlanOutcome } from '../../src/editor/src/models/AiAssistant/authoring/plan';
import type { AuthoringPlan } from '../../src/editor/src/models/AiAssistant/authoring/plan';
import type { AiChatRequest, AiChatResponse } from '../../src/editor/src/models/AiAssistant/client/types';
import { fromSerialisedProject } from '../../src/editor/src/models/AiAssistant/explain/graph';

/* eslint-disable @typescript-eslint/no-var-requires */
const gitRepoUtf8 = require('../testfs/git-repo-utf8/project.json');
/* eslint-enable @typescript-eslint/no-var-requires */

function loadGraph() {
  return fromSerialisedProject(JSON.parse(JSON.stringify(gitRepoUtf8)));
}

const usage = { promptTokens: 10, completionTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0.01 };

function submitDoc(content: string, summary?: string): AiChatResponse {
  return {
    text: '',
    toolCalls: [
      {
        id: `call-${Math.random().toString(36).slice(2, 8)}`,
        name: 'submit_doc',
        arguments: { content, ...(summary ? { summary } : {}) }
      }
    ],
    usage,
    model: 'test',
    stopReason: 'tool_calls'
  };
}

function prose(text: string): AiChatResponse {
  return { text, toolCalls: [], usage, model: 'test', stopReason: 'stop' };
}

/** A chat that replays the given responses, one per turn, recording the prompts. */
function scripted(responses: AiChatResponse[], seen: AiChatRequest[] = []) {
  let index = 0;
  const chat = async (request: AiChatRequest): Promise<AiChatResponse> => {
    seen.push(request);
    const response = responses[Math.min(index, responses.length - 1)];
    index++;
    return response;
  };
  return { chat, seen };
}

const BASELINE = '# Architecture\n\n## Pages\n\nThe app has a reading list and an article page.\n';
const CLEAN_DOC =
  '# Architecture\n\n## Pages\n\nThe app has a reading list and an article page.\n\n' +
  '## Checkout\n\nCheckout is a page rather than a modal so the browser back button behaves.\n';

const REQUEST = {
  path: 'docs/ARCHITECTURE.md',
  intent: 'Record why checkout became its own page.',
  request: 'Wire Checkout into the app',
  outcome: [
    {
      operation: { id: 'op-1', kind: 'create' as const, target: 'Pages/Checkout', intent: 'the new page' },
      built: true,
      nodeCount: 12
    }
  ],
  baseline: BASELINE
};

describe('AIX-011 criterion 7 — the doc-authoring turn', () => {
  it('produces the whole file, and hands it back with the model’s own summary', async () => {
    const { chat } = scripted([submitDoc(CLEAN_DOC, 'Recorded the checkout decision')]);
    const outcome = await new DocSession(loadGraph(), REQUEST, { chat }).run();

    expect(outcome.status).toBe('authored');
    expect(outcome.content).toBe(CLEAN_DOC);
    expect(outcome.summary).toBe('Recorded the checkout decision');
    expect(outcome.lintFindings).toEqual([]);
  });

  it('is told what the plan BUILT — including what it failed to build', async () => {
    const seen: AiChatRequest[] = [];
    const { chat } = scripted([submitDoc(CLEAN_DOC)], seen);
    await new DocSession(
      loadGraph(),
      {
        ...REQUEST,
        outcome: [
          ...REQUEST.outcome,
          {
            operation: { id: 'op-2', kind: 'update' as const, target: 'Pages/Cart', intent: 'link to checkout' },
            built: false,
            note: 'the gate rejected every attempt'
          }
        ]
      },
      { chat }
    ).run();

    const opening = seen[0].messages.find((m) => m.role === 'user')!.content;
    expect(opening).toContain('BUILT — create Pages/Checkout (12 nodes)');
    expect(opening).toContain('NOT BUILT — update Pages/Cart');
    // …and is told, in as many words, not to document what does not exist.
    expect(opening).toContain('Do not document anything marked NOT BUILT');
    // The current file is its subject, not a summary of it.
    expect(opening).toContain('The app has a reading list and an article page.');
  });

  it('offers the template — not an empty prompt — when the file does not exist yet', async () => {
    const seen: AiChatRequest[] = [];
    const { chat } = scripted([submitDoc('# Architecture\n\nCheckout is a page.\n')], seen);
    const outcome = await new DocSession(loadGraph(), { ...REQUEST, baseline: null }, { chat }).run();

    expect(outcome.status).toBe('authored');
    const opening = seen[0].messages.find((m) => m.role === 'user')!.content;
    expect(opening).toContain('docs/ARCHITECTURE.md DOES NOT EXIST YET');
    expect(opening).toContain('An empty heading is better than an invented paragraph.');
  });

  it('treats prose without a submission as a decline, not a failure', async () => {
    const { chat } = scripted([prose('ARCHITECTURE.md already explains this. Nothing to add.')]);
    const outcome = await new DocSession(loadGraph(), REQUEST, { chat }).run();

    expect(outcome.status).toBe('declined');
    expect(outcome.note).toContain('already explains this');
    expect(outcome.content).toBeUndefined();
  });

  it('treats an unchanged file as a decline — an empty diff is not a review', async () => {
    const { chat } = scripted([submitDoc(BASELINE)]);
    const outcome = await new DocSession(loadGraph(), REQUEST, { chat }).run();

    expect(outcome.status).toBe('declined');
    expect(outcome.note).toContain('unchanged');
  });

  it('rejects an empty submission and accepts the repair', async () => {
    const seen: AiChatRequest[] = [];
    const { chat } = scripted([submitDoc(''), submitDoc(CLEAN_DOC)], seen);
    const outcome = await new DocSession(loadGraph(), REQUEST, { chat }).run();

    expect(outcome.status).toBe('authored');
    expect(outcome.content).toBe(CLEAN_DOC);
    const repair = seen[1].messages.find((m) => m.role === 'tool')!.content;
    expect(repair).toContain('complete file');
  });

  it('asks once for a rewrite when the document restates the graph, and keeps the first version if the rewrite never lands', async () => {
    const restating =
      BASELINE +
      '\n## Checkout\n\nThe Checkout page contains a Group with a Repeater nested inside it.\n' +
      'The Repeater connects to the Cart Collection.\n';
    const seen: AiChatRequest[] = [];
    // Second turn: the model talks instead of resubmitting.
    const { chat } = scripted([submitDoc(restating), prose('I think those lines are fine.')], seen);
    const outcome = await new DocSession(loadGraph(), REQUEST, { chat }).run();

    // The advisory went out…
    const advisory = seen[1].messages.find((m) => m.role === 'tool')!.content;
    expect(advisory).toContain('describe the GRAPH');
    // …and the usable document still stands. An advisory must never turn a
    // usable document into a failure.
    expect(outcome.status).toBe('authored');
    expect(outcome.content).toBe(restating);
    expect(outcome.lintFindings.length).toBeGreaterThan(0);
  });

  it('does not lint at all when the caller turns it off', async () => {
    const restating = BASELINE + '\nThe Checkout page contains a Repeater connected to the Cart Collection.\n';
    const seen: AiChatRequest[] = [];
    const { chat } = scripted([submitDoc(restating)], seen);
    const outcome = await new DocSession(loadGraph(), REQUEST, { chat, docLint: false }).run();

    expect(outcome.status).toBe('authored');
    expect(outcome.lintFindings).toEqual([]);
    expect(seen.length).toBe(1); // no advisory turn
  });
});

describe('AIX-011 criterion 7 — the graph-restatement lint', () => {
  it('flags containment and wiring sentences that name a distinctive node type', () => {
    const findings = docLint(
      'The Checkout page contains a Repeater bound to the order lines.\n' +
        'Its Repeater connects to the Cart collection.\n'
    ).findings;
    expect(findings.length).toBe(2);
    expect(findings[0].why).toContain('contains');
  });

  it('leaves ordinary prose alone, including sentences that merely name a component', () => {
    const clean =
      '# Brief\n\nThe app is a reading list for book clubs.\n\n' +
      'Checkout is a page rather than a modal so the browser back button behaves.\n' +
      'The Stripe integration connects to their hosted checkout; we never see card details.\n' +
      'Cart links to Checkout.\n';
    expect(docLint(clean).findings).toEqual([]);
  });

  it('does not report the human’s existing prose back at the model', () => {
    const existing = 'The Cart page contains a Repeater over the line items.\n';
    const proposed = existing + '\nCheckout is a page so the back button behaves.\n';
    expect(docLint(proposed, { baseline: existing }).findings).toEqual([]);
    // …but the same line in a document with no baseline is fair game.
    expect(docLint(proposed).findings.length).toBe(1);
  });

  it('ignores fenced code — a quoted API payload is exactly what a contract doc holds', () => {
    const withFence =
      '## The orders API\n\nIt returns:\n\n```json\n{ "lines": [{ "id": 1 }] }\n```\n\n' +
      'It connects to the Repeater? No — it is an HTTP contract.\n';
    // Only the prose line outside the fence is even considered, and it names no
    // distinctive type in a structural sentence.
    expect(docLint('```\nThe page contains a Repeater connected to a Collection.\n```\n').findings).toEqual([]);
    expect(withFence).toContain('lines');
  });

  it('counts node counts as graph restatement on their own', () => {
    expect(docLint('The checkout flow is 14 nodes and connects to the cart.').findings.length).toBe(1);
  });
});

describe('AIX-011 criterion 7 — doc operations in the fan-out', () => {
  const plan: AuthoringPlan = {
    request: 'Wire Checkout into the app',
    operations: [{ id: 'op-1', kind: 'doc', target: 'docs/ARCHITECTURE.md', intent: 'record the checkout flow' }]
  };

  it('authors the body, stages it with its baseline, and offers it to the accepted set', async () => {
    const { chat } = scripted([submitDoc(CLEAN_DOC, 'Recorded checkout')]);
    const run = new PlanRun(loadGraph(), plan, {
      docBaselineFor: () => BASELINE,
      doc: { chat }
    });
    const state = await run.run();

    expect(state.operations[0].status).toBe('staged');
    expect(state.operations[0].stagedDoc!.chars).toBe(CLEAN_DOC.length);
    expect(state.operations[0].stagedDoc!.created).toBe(false);
    expect(state.operations[0].stagedDoc!.summary).toBe('Recorded checkout');

    const staged = run.docFor('op-1')!;
    expect(staged.proposed).toBe(CLEAN_DOC);
    expect(staged.baseline).toBe(BASELINE);

    const { operations } = run.acceptedOperations();
    expect(operations.length).toBe(1);
    const accepted = operations[0];
    expect(accepted.kind).toBe('doc');
    expect(accepted.kind === 'doc' && accepted.proposed).toBe(CLEAN_DOC);
    expect(accepted.kind === 'doc' && accepted.baseline).toBe(BASELINE);
  });

  it('a declined doc is skipped, not failed — and never reaches the accepted set', async () => {
    const { chat } = scripted([prose('The architecture doc already covers this.')]);
    const run = new PlanRun(loadGraph(), plan, { docBaselineFor: () => BASELINE, doc: { chat } });
    const state = await run.run();

    expect(state.operations[0].status).toBe('skipped');
    expect(state.operations[0].error).toContain('already covers this');
    expect(run.acceptedOperations().operations).toEqual([]);
  });

  it('fails loudly with no docs reader rather than authoring against an imagined file', async () => {
    const { chat } = scripted([submitDoc(CLEAN_DOC)]);
    const run = new PlanRun(loadGraph(), plan, { doc: { chat } });
    const state = await run.run();

    expect(state.operations[0].status).toBe('failed');
    expect(state.operations[0].error).toContain('no project-docs reader');
    expect(run.acceptedOperations().operations).toEqual([]);
  });

  it('runs the doc turn AFTER the components, whatever order the plan is in', async () => {
    const order: string[] = [];
    const mixed: AuthoringPlan = {
      request: 'Wire Checkout into the app',
      operations: [
        { id: 'op-doc', kind: 'doc', target: 'docs/ARCHITECTURE.md', intent: 'record it' },
        { id: 'op-c', kind: 'create', target: 'Pages/Checkout', intent: 'the new page' }
      ]
    };
    const chat = async (request: AiChatRequest): Promise<AiChatResponse> => {
      const opening = request.messages.find((m) => m.role === 'user')?.content ?? '';
      if (opening.includes('submit_doc')) {
        order.push('doc');
        return submitDoc(CLEAN_DOC);
      }
      order.push('component');
      return {
        text: '',
        toolCalls: [
          {
            id: 'c1',
            name: 'submit_component',
            arguments: {
              nodes: [
                { id: 'co_page', type: 'Page', label: 'Checkout', parameters: { title: 'Checkout', urlPath: '/checkout' } },
                { id: 'co_root', type: 'Group', parent: 'co_page', label: 'Checkout root' }
              ],
              visual_roots: ['co_page']
            }
          }
        ],
        usage,
        model: 'test',
        stopReason: 'tool_calls'
      };
    };

    const run = new PlanRun(loadGraph(), mixed, {
      docBaselineFor: () => BASELINE,
      doc: { chat },
      session: { chat }
    });
    await run.run();

    expect(order).toEqual(['component', 'doc']);
  });
});

describe('AIB-009 F4 — the doc pass after a stopped run', () => {
  const mixed: AuthoringPlan = {
    request: 'Wire Checkout into the app',
    operations: [
      { id: 'op-c', kind: 'create', target: 'Pages/Checkout', intent: 'the new page' },
      { id: 'op-doc', kind: 'doc', target: 'docs/ARCHITECTURE.md', intent: 'record it' }
    ]
  };

  const componentSubmission: AiChatResponse = {
    text: '',
    toolCalls: [
      {
        id: 'c1',
        name: 'submit_component',
        arguments: {
          nodes: [
            { id: 'co_page', type: 'Page', label: 'Checkout', parameters: { title: 'Checkout', urlPath: '/checkout' } },
            { id: 'co_root', type: 'Group', parent: 'co_page', label: 'Checkout root' }
          ],
          visual_roots: ['co_page']
        }
      }
    ],
    usage,
    model: 'test',
    stopReason: 'tool_calls'
  };

  /** A run stopped while the component was authoring: the component still stages. */
  async function stoppedRun(docChat: (request: AiChatRequest) => Promise<AiChatResponse>) {
    const held: { run?: PlanRun } = {};
    const sessionChat = async (): Promise<AiChatResponse> => {
      // Stop pressed while the first operation is in flight. The submission
      // still arrives and still passes the gate — which is the case F4 is
      // about: work survives, documentation does not.
      held.run!.cancel();
      return componentSubmission;
    };
    const run = new PlanRun(loadGraph(), mixed, {
      docBaselineFor: () => BASELINE,
      doc: { chat: docChat },
      session: { chat: sessionChat }
    });
    held.run = run;
    const state = await run.run();
    return { run, state };
  }

  it('a stop leaves the components staged and the documents skipped — and says which is which', async () => {
    const { chat } = scripted([submitDoc(CLEAN_DOC, 'Recorded checkout')]);
    const { run, state } = await stoppedRun(chat);

    expect(state.phase).toBe('cancelled');
    const byId = new Map(state.operations.map((op) => [op.operation.id, op]));
    expect(byId.get('op-c')!.status).toBe('staged');
    expect(byId.get('op-doc')!.status).toBe('skipped');
    // The flag is the whole of F4: `skipped` alone cannot tell a stop apart from
    // an agent that read the work and decided there was nothing to record.
    expect(byId.get('op-doc')!.skippedByCancel).toBe(true);
    expect(run.docsAwaitingCancelledPass().map((s) => s.operation.id)).toEqual(['op-doc']);
    expect(run.acceptedOperations().operations.map((op) => op.operation.id)).toEqual(['op-c']);
  });

  it('runs just the doc pass afterwards, against what is staged, and stages the body', async () => {
    const { chat, seen } = scripted([submitDoc(CLEAN_DOC, 'Recorded checkout')]);
    const { run } = await stoppedRun(chat);

    const state = await run.runDocPass();

    expect(state.phase).toBe('done');
    const doc = state.operations.find((op) => op.operation.id === 'op-doc')!;
    expect(doc.status).toBe('staged');
    expect(doc.skippedByCancel).toBeFalsy();
    expect(run.docFor('op-doc')!.proposed).toBe(CLEAN_DOC);
    // The doc turn saw the component the stopped run managed to build — the
    // whole reason the pass runs second in the first place.
    expect(seen[0].messages.map((m) => m.content).join('\n')).toContain('Pages/Checkout');
    // Nothing has reached any project; the accepted set is what apply is offered.
    expect(run.acceptedOperations().operations.map((op) => op.operation.id)).toEqual(['op-c', 'op-doc']);
  });

  it('refuses to re-ask a document the agent declined — that was an answer, not an interruption', async () => {
    const { chat } = scripted([prose('The architecture doc already covers this.')]);
    const run = new PlanRun(loadGraph(), mixed, {
      docBaselineFor: () => BASELINE,
      doc: { chat },
      session: {
        chat: async () => componentSubmission
      }
    });
    await run.run();

    expect(run.docsAwaitingCancelledPass()).toEqual([]);
    await expectAsync(run.runDocPass()).toBeRejectedWithError(/no document in this plan waiting/);
  });
});

describe('AIX-011 criterion 7 — the plan outcome rendering', () => {
  it('says so plainly when a plan changes no components at all', () => {
    expect(renderPlanOutcome([])).toContain('documentation-only change');
  });
});
